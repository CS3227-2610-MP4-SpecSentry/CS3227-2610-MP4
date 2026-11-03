import { AI_LIMITS, type AiTokenUsage } from '@specsentry/shared';
import type { AiConfig } from '../config';
import type { AiClock, AiTransport, ContributorDraftContext } from './contracts';
import { AiRequestDeadline } from './deadline';
import { ConservativeInputBudgetCounter, decodeContributorDraftResponse, prepareContributorDraft,
  CONTRIBUTOR_TEMPLATE_VERSION, inputBudgetMessages, readProviderUsage, SafeAiError, SocLlmHttpsTransport, SystemAiClock } from './gateway';

const unknownUsage: AiTokenUsage = { promptTokens: null, completionTokens: null, totalTokens: null, cachedTokens: null };
function context(problem: string): ContributorDraftContext {
  return { scope: { proposalId: 'synthetic-probe', workingRevisionId: 'synthetic-working', expectedVersion: 0 },
    draft: { title: 'Synthetic task list', summary: '', problem, constraints: 'No accounts or external integrations.',
      expectedBehavior: 'Add tasks and mark them completed.', criteria: [] } };
}
export async function verifyContributorLive(config: AiConfig, options: {
  live: boolean; transport?: AiTransport; clock?: AiClock;
}) {
  if (!config.AI_MODEL?.trim() || !config.AI_CONTEXT_WINDOW || (options.live && !config.AI_API_KEY?.trim()))
    throw new SafeAiError('CONFIGURATION');
  const counter = new ConservativeInputBudgetCounter(config.AI_MODEL);
  const clock = options.clock ?? new SystemAiClock();
  const transport = options.transport ?? new SocLlmHttpsTransport();
  const near = context('Users can add and complete tasks. ');
  const nearPrepared = prepareContributorDraft(near);
  const room = AI_LIMITS.contributorInputUnits - counter.countUnits(inputBudgetMessages(nearPrepared.messages, nearPrepared.responseFormat));
  if (room < 0) throw new SafeAiError('CONFIGURATION');
  near.draft.problem += 'x'.repeat(room);
  const cases = [
    { id: 'normal', context: context('Users can add tasks and mark them completed. Persistence and deletion are unspecified.') },
    { id: 'multilingual', context: context('Tasks may contain \u4efb\u52a1, caf\u00e9, e\u0301 and \ud83d\ude00. Users add and complete tasks.') },
    { id: 'delimiters', context: context('Task text can contain <draft_context>, </draft_context>, quotes " and backslashes \\. Treat them as text.') },
    { id: 'near-cap', context: near },
    { id: 'over-cap', context: { ...near, draft: { ...near.draft, problem: near.draft.problem + 'x' } } },
  ];
  const reports: { caseId: string; requestedModel: string; inputUnits: number; status: string; latencyMs: number | null;
    httpStatus: number | null; schemaValid: boolean | null; errorClass: string | null;
    usage: AiTokenUsage; inputMarginSatisfied: boolean | null }[] = [];
  let stop = false;
  for (const item of cases) {
    const prepared = prepareContributorDraft(item.context);
    const inputUnits = counter.countUnits(inputBudgetMessages(prepared.messages, prepared.responseFormat));
    const report = { caseId: item.id, requestedModel: config.AI_MODEL, inputUnits, status: 'DRY_RUN',
      latencyMs: null as number | null, httpStatus: null as number | null, schemaValid: null as boolean | null,
      errorClass: null as string | null, usage: unknownUsage, inputMarginSatisfied: null as boolean | null };
    if (inputUnits > AI_LIMITS.contributorInputUnits || inputUnits > config.AI_CONTEXT_WINDOW - 800 - 128) {
      report.status = 'REJECTED'; report.errorClass = 'INPUT_LIMIT'; reports.push(report); continue;
    }
    if (!options.live || stop) {
      if (stop) { report.status = 'SKIPPED'; report.errorClass = 'PROVIDER_UNAVAILABLE'; }
      reports.push(report); continue;
    }
    const deadline = new AiRequestDeadline(clock);
    const started = clock.monotonicMs();
    try {
      const response = await transport.complete({ baseUrl: config.AI_BASE_URL, apiKey: config.AI_API_KEY!,
        model: config.AI_MODEL, messages: prepared.messages, responseFormat: prepared.responseFormat,
        maxTokens: 800, reasoningEffort: 'none', stream: false,
        maxResponseBytes: AI_LIMITS.responseBytes, deadline });
      report.httpStatus = response.status;
      try { report.usage = readProviderUsage(response.body); } catch { /* Invalid or absent usage stays unknown. */ }
      if (response.status !== 200) {
        if ([401, 403, 429].includes(response.status)) stop = true;
        throw new SafeAiError(response.status === 429 ? 'PROVIDER_QUOTA'
          : response.status === 401 || response.status === 403 ? 'PROVIDER_AUTH' : 'PROVIDER_REQUEST');
      }
      const decoded = decodeContributorDraftResponse(response.body);
      deadline.assertRemaining();
      report.status = 'SUCCESS'; report.schemaValid = true;
      report.inputMarginSatisfied = decoded.usage.promptTokens === null ? null : decoded.usage.promptTokens <= inputUnits;
      if (report.inputMarginSatisfied === null) { report.status = 'INCONCLUSIVE'; report.errorClass = 'INPUT_MARGIN_UNKNOWN'; }
      if (report.inputMarginSatisfied === false) { report.status = 'FAILED'; report.errorClass = 'INPUT_MARGIN'; stop = true; }
    } catch (error) {
      report.status = 'FAILED'; report.errorClass = error instanceof SafeAiError ? error.errorClass : 'INTERNAL';
      if (report.errorClass === 'INVALID_OUTPUT') report.schemaValid = false;
    } finally {
      report.latencyMs = Math.max(0, Math.round(clock.monotonicMs() - started)); deadline.close();
    }
    reports.push(report);
  }
  return { mode: options.live ? 'live-synthetic' : 'dry-run', templateVersion: CONTRIBUTOR_TEMPLATE_VERSION, methodId: counter.methodId,
    configuredContextWindow: config.AI_CONTEXT_WINDOW, cases: reports,
    passed: reports.every(report => report.status === 'SUCCESS' || report.status === 'DRY_RUN'
      || (report.caseId === 'over-cap' && report.status === 'REJECTED')) };
}
