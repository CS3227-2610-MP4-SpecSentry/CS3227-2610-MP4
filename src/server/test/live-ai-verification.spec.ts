import { readAiConfig } from '../src/config';
import { verifyContributorLive } from '../src/ai/live-verification';
import { prepareContributorDraft, decodeContributorDraftResponse, ConservativeInputBudgetCounter, CONTRIBUTOR_RESPONSE_FORMAT, inputBudgetMessages } from '../src/ai/gateway';
import type { AiTransport } from '../src/ai/contracts';

const configuration = () => readAiConfig({ AI_MODEL: 'synthetic-model', AI_CONTEXT_WINDOW: '262144', AI_API_KEY: 'synthetic-key' });
const result = { objective: 'Add tasks.', acceptanceCriteria: ['Tasks can be completed.'], edgeCases: [], ambiguities: [], testIdeas: [] };
const body = (extra: object = {}) => JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(result) } }], ...extra });
const transport = (): AiTransport => ({ complete: jest.fn(async () => ({ status: 200, body: body(), retryAfter: null })) });

describe('explicit synthetic live verification', () => {
  it('defaults to an offline five-case budget check, rejecting cap+1 before dispatch', async () => {
    const network = transport(); const report = await verifyContributorLive(configuration(), { live: false, transport: network });
    expect(report.passed).toBe(true); expect(network.complete).not.toHaveBeenCalled();
    expect(report.templateVersion).toBe('contributor-draft-v3');
    expect(report.cases).toHaveLength(5);
    expect(report.cases.find(row => row.caseId === 'near-cap')).toMatchObject({ inputUnits: 4000, status: 'DRY_RUN' });
    expect(report.cases.find(row => row.caseId === 'over-cap')).toMatchObject({ inputUnits: 4001, status: 'REJECTED' });
  });
  it('uses complete production messages, strict decoding and provider-only usage for at most four synthetic calls', async () => {
    const network = transport(); jest.mocked(network.complete).mockResolvedValue({ status: 200, body: body({ usage: { prompt_tokens: 100 } }), retryAfter: null });
    const report = await verifyContributorLive(configuration(), { live: true, transport: network });
    expect(report.passed).toBe(true); expect(network.complete).toHaveBeenCalledTimes(4);
    const calls = jest.mocked(network.complete).mock.calls;
    const counter = new ConservativeInputBudgetCounter('synthetic-model');
    for (let i = 0; i < calls.length; i++) {
      expect(counter.countUnits(inputBudgetMessages(calls[i]![0].messages, calls[i]![0].responseFormat))).toBe(report.cases[i]!.inputUnits);
      expect(calls[i]![0]).toMatchObject({ responseFormat: CONTRIBUTOR_RESPONSE_FORMAT, maxTokens: 800, reasoningEffort: 'none', stream: false });
      expect(report.cases[i]!.usage.promptTokens).toBe(100); expect(report.cases[i]!.inputMarginSatisfied).toBe(true);
    }
    const prepared = prepareContributorDraft({ scope: { proposalId: 'p', workingRevisionId: 'w', expectedVersion: 0 },
      draft: { title: 'Synthetic task list', summary: '', problem: 'Users can add tasks and mark them completed. Persistence and deletion are unspecified.',
        constraints: 'No accounts or external integrations.', expectedBehavior: 'Add tasks and mark them completed.', criteria: [] } });
    expect(calls[0]![0].messages).toEqual(prepared.messages);
    expect(decodeContributorDraftResponse(body()).result).toEqual(result);
    expect(JSON.stringify(report)).not.toContain('synthetic-key'); expect(JSON.stringify(report)).not.toContain(result.objective);
  });
  it('keeps absent provider usage unknown and cannot claim live margin verification passed', async () => {
    const report = await verifyContributorLive(configuration(), { live: true, transport: transport() });
    expect(report.passed).toBe(false);
    expect(report.cases[0]).toMatchObject({ status: 'INCONCLUSIVE', schemaValid: true, inputMarginSatisfied: null,
      usage: { promptTokens: null, completionTokens: null, totalTokens: null, cachedTokens: null } });
  });
  it('preserves safe provider usage even when the role output fails schema validation', async () => {
    const network = transport();
    jest.mocked(network.complete).mockResolvedValue({ status: 200, body: JSON.stringify({ choices: [], usage: { prompt_tokens: 80 } }), retryAfter: null });
    const report = await verifyContributorLive(configuration(), { live: true, transport: network });
    expect(report.passed).toBe(false); expect(report.cases[0]).toMatchObject({ schemaValid: false, usage: { promptTokens: 80 } });
  });
  it('retains safe reported usage on a failed HTTP attempt without retaining its body', async () => {
    const network = transport(); jest.mocked(network.complete).mockResolvedValue({ status: 503,
      body: JSON.stringify({ error: 'private-provider-canary', usage: { prompt_tokens: 120 } }), retryAfter: null });
    const report = await verifyContributorLive(configuration(), { live: true, transport: network });
    expect(report.passed).toBe(false);
    expect(report.cases[0]).toMatchObject({ status: 'FAILED', httpStatus: 503, usage: { promptTokens: 120 } });
    expect(JSON.stringify(report)).not.toContain('private-provider-canary');
  });
  it('fails closed on invalid output, hides provider content and stops calls after authentication/quota or margin failure', async () => {
    for (const response of [{ status: 401, body: 'private-provider-canary', retryAfter: null },
      { status: 429, body: 'private-provider-canary', retryAfter: null },
      { status: 200, body: body({ usage: { prompt_tokens: 999999 } }), retryAfter: null }]) {
      const network = transport(); jest.mocked(network.complete).mockResolvedValue(response);
      const report = await verifyContributorLive(configuration(), { live: true, transport: network });
      expect(report.passed).toBe(false); expect(network.complete).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(report)).not.toContain('private-provider-canary');
    }
    const network = transport(); jest.mocked(network.complete).mockResolvedValue({ status: 200, body: 'private-provider-canary', retryAfter: null });
    const report = await verifyContributorLive(configuration(), { live: true, transport: network });
    expect(report.passed).toBe(false); expect(report.cases[0]).toMatchObject({ schemaValid: false, errorClass: 'INVALID_OUTPUT' });
    expect(JSON.stringify(report)).not.toContain('private-provider-canary');
  });
});
