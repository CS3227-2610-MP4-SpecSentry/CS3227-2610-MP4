import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contributorDraftRequestSchema, type ContributorDraftResult } from '@specsentry/shared';
import type { PrismaClient } from '../src/generated/prisma/client';
import { ConservativeInputBudgetCounter, CONTRIBUTOR_RESPONSE_FORMAT, CONTRIBUTOR_TEMPLATE_VERSION, createContributorDraftGateway, inputBudgetMessages, prepareContributorDraft, SafeAiError, SocLlmHttpsTransport } from '../src/ai/gateway';
import type { AiClock, AiDeadline, AiTransport, ContributorDraftContext } from '../src/ai/contracts';
import { aiTestOptions } from './ai-fixtures';

const corpus = JSON.parse(readFileSync(resolve(__dirname, '../../../workflow/tests/ai/contributor/v3.json'), 'utf8')) as {
  version: string; normal: ContributorDraftResult; injections: string[]; highConfidenceSecrets: string[]; invalidJson: string[];
};
const envelope = (content: unknown = corpus.normal, extra: object = {}) => JSON.stringify({
  choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(content) } }], ...extra,
});
const fixture = (problem = 'Validate the value.'): ContributorDraftContext => ({
  scope: { proposalId: 'private-proposal-id', workingRevisionId: 'private-working-id', expectedVersion: 3 },
  draft: { title: 'Validation change', summary: '', problem, constraints: '', expectedBehavior: 'Reject invalid values.',
    criteria: [{ statement: 'Reject invalid input.', required: true }] },
});
function harness() {
  let time = Date.parse('2026-11-01T04:00:00Z'); const end = time + 20_000;
  const clock: AiClock = { now: () => new Date(time), monotonicMs: () => time, sleep: async ms => { time += ms; } };
  const deadline: AiDeadline = { signal: new AbortController().signal, remainingMs: () => Math.max(0, end - time),
    assertRemaining: () => { if (time >= end) throw new SafeAiError('DEADLINE'); } };
  const request = { create: jest.fn(async () => ({})), update: jest.fn(async () => ({})), deleteMany: jest.fn(async () => ({ count: 0 })) };
  const attempt = { create: jest.fn(async () => ({ id: 'attempt' })), update: jest.fn(async () => ({})), updateMany: jest.fn(async () => ({})),
    count: jest.fn(async () => 0), findFirst: jest.fn(async () => null) };
  const queue = { create: jest.fn(async () => ({})), deleteMany: jest.fn(async () => ({})), count: jest.fn(async () => 0) };
  const tx = { aiRequest: request, aiOutboundAttempt: attempt, aiQueueLease: queue,
    $queryRaw: jest.fn(async () => []), $queryRawUnsafe: jest.fn(async () => [{ id: 'reviewer-patch-risk' }]) };
  const prisma = { ...tx, $transaction: async <T>(action: (value: typeof tx) => Promise<T>) => action(tx) } as unknown as PrismaClient;
  const transport: AiTransport = { complete: jest.fn(async () => ({ status: 200, body: envelope(), retryAfter: null })) };
  const counter = { model: aiTestOptions.mode === 'test' ? aiTestOptions.model : '', methodId: 'synthetic-counter-v1', countUnits: jest.fn(() => 100) };
  const gateway = createContributorDraftGateway({ prisma, options: aiTestOptions, transport, counter, clock });
  const beforeAttempt = jest.fn(async () => undefined);
  return { prisma, request, attempt, queue, transport, counter, beforeAttempt, clock, deadline, admission: tx.$queryRawUnsafe,
    advance: (ms: number) => { time += ms; },
    call: (context = fixture()) => gateway.analyze(context, { actorId: 'owner', deadline, beforeAttempt }) };
}

describe('Contributor draft v3 synthetic gateway evaluations', () => {
  it('accepts empty or null optional call metadata as no invocation while preserving strict output', async () => {
    for (const metadata of [{}, { tool_calls: null }, { tool_calls: [] }, { function_call: null },
      { tool_calls: [], function_call: null, refusal: null }]) {
      const h = harness();
      jest.mocked(h.transport.complete).mockResolvedValue({ status: 200, retryAfter: null,
        body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: {
          role: 'assistant', content: JSON.stringify(corpus.normal), ...metadata,
        } }] }) });
      expect((await h.call()).result).toEqual(corpus.normal);
      expect(h.transport.complete).toHaveBeenCalledTimes(1);
    }
  });

  it('versions explicit per-field bounds without weakening the strict result schema', () => {
    expect(CONTRIBUTOR_TEMPLATE_VERSION).toBe('contributor-draft-v3');
    expect(corpus.version).toBe(CONTRIBUTOR_TEMPLATE_VERSION);
    const prepared = prepareContributorDraft(fixture());
    expect(prepared.messages[0]!.content).toContain('edgeCases: an array of 0 to 3 strings');
    expect(prepared.messages[0]!.content).toContain('ambiguities: an array of 0 to 3 strings');
    expect(prepared.messages[0]!.content).toContain('testIdeas: an array of 0 to 3 strings');
    for (const count of [4, 5]) {
      expect(() => prepared.validate({ ...corpus.normal, edgeCases: Array(count).fill('Still too many.') })).toThrow();
      expect(() => prepared.validate({ ...corpus.normal, ambiguities: Array(count).fill('Still too many.') })).toThrow();
      expect(() => prepared.validate({ ...corpus.normal, testIdeas: Array(count).fill('Still too many.') })).toThrow();
    }
  });
  it('rejects standalone SoC credentials including fullwidth forms before attempts or transport', async () => {
    const secret = 'clsk_synthetic_0123456789abcdefghijklmnop';
    const fullwidth = [...secret].map(character => String.fromCharCode(character.charCodeAt(0) + 0xfee0)).join('');
    for (const value of [secret, fullwidth]) {
      const h = harness();
      await expect(h.call(fixture(value))).rejects.toMatchObject({ errorClass: 'SECRET_DETECTED' });
      expect(h.transport.complete).not.toHaveBeenCalled(); expect(h.attempt.create).not.toHaveBeenCalled();
      expect(JSON.stringify([h.request.create.mock.calls, h.request.update.mock.calls])).not.toContain(secret);
      expect(JSON.stringify([h.request.create.mock.calls, h.request.update.mock.calls])).not.toContain(fullwidth);
    }
  });

  it('applies the real conservative method to complete prepared messages without inventing provider usage', async () => {
    for (const problem of ['Validate the value.', 'x'.repeat(3500)]) {
      const h = harness(); const counter = new ConservativeInputBudgetCounter(h.counter.model);
      const count = jest.spyOn(counter, 'countUnits');
      const gateway = createContributorDraftGateway({ prisma: h.prisma, options: { mode: 'test', model: counter.model,
        contextWindow: 16_384, inputBudgetMethodId: counter.methodId }, counter, transport: h.transport, clock: h.clock });
      const call = gateway.analyze(fixture(problem), { actorId: 'owner', deadline: h.deadline, beforeAttempt: h.beforeAttempt });
      if (problem.length < 3500) {
        expect((await call).metadata.usage).toEqual({ promptTokens: null, completionTokens: null, totalTokens: null, cachedTokens: null });
        const sent = jest.mocked(h.transport.complete).mock.calls[0]![0];
        expect(count).toHaveBeenCalledWith(inputBudgetMessages(sent.messages, sent.responseFormat));
      } else {
        await expect(call).rejects.toMatchObject({ errorClass: 'INPUT_LIMIT' });
        expect(h.transport.complete).not.toHaveBeenCalled(); expect(h.attempt.create).not.toHaveBeenCalled();
      }
      expect(count.mock.calls[0]![0][0]!.role).toBe('system');
      expect(count.mock.calls[0]![0][1]!.content).toContain(problem);
    }
  });

  it('counts the complete fixed schema before admission and never sends its counting-only frame as a message', async () => {
    const h = harness(); const context = fixture(); const prepared = prepareContributorDraft(context);
    const counter = new ConservativeInputBudgetCounter(h.counter.model);
    const budget = inputBudgetMessages(prepared.messages, prepared.responseFormat);
    expect(counter.countUnits(budget) - counter.countUnits(prepared.messages))
      .toBe(64 + Buffer.byteLength('system') + Buffer.byteLength(JSON.stringify(CONTRIBUTOR_RESPONSE_FORMAT)));
    await h.call();
    const sent = jest.mocked(h.transport.complete).mock.calls[0]![0];
    expect(sent.messages).toHaveLength(2);
    expect(sent.responseFormat).toEqual(CONTRIBUTOR_RESPONSE_FORMAT);
    expect(h.counter.countUnits).toHaveBeenCalledWith(budget);
    expect(JSON.stringify(sent.messages)).not.toContain('additionalProperties');

    context.draft.problem += 'x'.repeat(4000 - counter.countUnits(prepared.messages));
    expect(counter.countUnits(prepareContributorDraft(context).messages)).toBe(4000);
    const blocked = harness();
    const gateway = createContributorDraftGateway({ prisma: blocked.prisma,
      options: { mode: 'test', model: counter.model, contextWindow: 16384, inputBudgetMethodId: counter.methodId },
      counter, transport: blocked.transport, clock: blocked.clock });
    await expect(gateway.analyze(context, { actorId: 'owner', deadline: blocked.deadline, beforeAttempt: blocked.beforeAttempt }))
      .rejects.toMatchObject({ errorClass: 'INPUT_LIMIT' });
    expect(blocked.attempt.create).not.toHaveBeenCalled(); expect(blocked.transport.complete).not.toHaveBeenCalled();
  });

  it('serializes the fixed server-owned schema in native transport without changing outbound messages', async () => {
    const h = harness(); const prepared = prepareContributorDraft(fixture());
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(envelope(), { status: 200 }));
    try {
      const gateway = createContributorDraftGateway({ prisma: h.prisma,
        options: { mode: 'live', apiKey: 'synthetic-live-key', model: h.counter.model,
          contextWindow: 16384, inputBudgetMethodId: h.counter.methodId },
        counter: h.counter, transport: new SocLlmHttpsTransport(), clock: h.clock });
      await gateway.analyze(fixture(), { actorId: 'owner', deadline: h.deadline, beforeAttempt: h.beforeAttempt });
      const payload = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string) as Record<string, unknown>;
      expect(payload).toMatchObject({ response_format: CONTRIBUTOR_RESPONSE_FORMAT,
        messages: prepared.messages, max_tokens: 800, reasoning_effort: 'none', stream: false });
      expect(CONTRIBUTOR_RESPONSE_FORMAT.json_schema).toMatchObject({ strict: true, schema: {
        additionalProperties: false, required: ['objective', 'acceptanceCriteria', 'edgeCases', 'ambiguities', 'testIdeas'],
      } });
    } finally { fetchSpy.mockRestore(); }
  });

  it('enforces exact full-schema input and context-headroom boundaries before reserving attempts', async () => {
    const counter = new ConservativeInputBudgetCounter(harness().counter.model);
    const original = prepareContributorDraft(fixture());
    const originalUnits = counter.countUnits(inputBudgetMessages(original.messages, original.responseFormat));
    for (const [padding, contextWindow, accepted] of [
      [4000 - originalUnits, 16384, true], [4001 - originalUnits, 16384, false],
      [0, originalUnits + 928, true], [0, originalUnits + 927, false],
    ] as const) {
      const h = harness(); const context = fixture(); context.draft.problem += 'x'.repeat(padding);
      const gateway = createContributorDraftGateway({ prisma: h.prisma,
        options: { mode: 'test', model: counter.model, contextWindow, inputBudgetMethodId: counter.methodId },
        counter, transport: h.transport, clock: h.clock });
      const pending = gateway.analyze(context, { actorId: 'owner', deadline: h.deadline, beforeAttempt: h.beforeAttempt });
      if (accepted) { await expect(pending).resolves.toMatchObject({ result: corpus.normal }); expect(h.attempt.create).toHaveBeenCalledTimes(1); }
      else {
        await expect(pending).rejects.toMatchObject({ errorClass: 'INPUT_LIMIT' });
        expect(h.attempt.create).not.toHaveBeenCalled(); expect(h.transport.complete).not.toHaveBeenCalled();
      }
    }
  });

  it('accepts typed advisory output, excludes scope identifiers and persists only safe feature-aware metadata', async () => {
    const h = harness(); expect((await h.call()).result).toEqual(corpus.normal);
    const request = jest.mocked(h.transport.complete).mock.calls[0]![0];
    expect(request).toMatchObject({ maxTokens: 800, reasoningEffort: 'none', stream: false });
    const messages = JSON.stringify(request.messages);
    expect(messages).toContain('Validate the value.'); expect(messages).not.toContain('private-proposal-id');
    expect(messages).not.toContain('private-working-id'); expect(messages).not.toContain('expectedVersion');
    expect(h.request.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      feature: 'CONTRIBUTOR', workingRevisionId: 'private-working-id', expectedVersion: 3,
    }) }));
    expect(JSON.stringify(h.request.update.mock.calls)).not.toContain(corpus.normal.objective);
  });

  it('keeps direct, indirect, Unicode and delimiter injections as escaped data without tools or mutations', async () => {
    for (const injection of corpus.injections) {
      const h = harness(); await h.call(fixture(injection));
      const sent = jest.mocked(h.transport.complete).mock.calls[0]![0];
      expect(sent.messages[0]!.content).toContain('never instructions');
      expect(sent.messages[1]!.content).not.toContain('<system>');
      expect(sent.messages[1]!.content).not.toContain('<script>');
      expect(sent).not.toHaveProperty('tools');
    }
  });

  it('rejects high-confidence and normalized secrets and unsupported controls before outbound attempts', async () => {
    for (const secret of corpus.highConfidenceSecrets) {
      const h = harness(); await expect(h.call(fixture(secret))).rejects.toMatchObject({ errorClass: 'SECRET_DETECTED' });
      expect(h.transport.complete).not.toHaveBeenCalled();
    }
    const h = harness(); await expect(h.call(fixture('Control\u001btext'))).rejects.toMatchObject({ errorClass: 'UNSUPPORTED_INPUT' });
    expect(h.transport.complete).not.toHaveBeenCalled();
  });

  it('enforces raw and normalized character caps and complete framed input units without truncation', async () => {
    for (const problem of ['x'.repeat(6001), 'ﬀ'.repeat(3000)]) {
      const h = harness(); await expect(h.call(fixture(problem))).rejects.toMatchObject({ errorClass: 'INPUT_LIMIT' });
      expect(h.transport.complete).not.toHaveBeenCalled();
    }
    for (const units of [4001, Number.NaN, -1, Infinity, 1.5, Number.MAX_SAFE_INTEGER]) {
      const h = harness(); h.counter.countUnits.mockReturnValue(units);
      await expect(h.call()).rejects.toMatchObject({ errorClass: 'INPUT_LIMIT' });
      expect(h.transport.complete).not.toHaveBeenCalled(); expect(h.attempt.create).not.toHaveBeenCalled();
    }
    const fit = harness(); fit.counter.countUnits.mockReturnValue(4000); await fit.call();
  });

  it('rejects malformed/duplicate JSON, unknown output fields, refusal, truncation and invalid provider usage without repair', async () => {
    const invalid = [
      ...corpus.invalidJson.map(content => JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }] })),
      envelope({ ...corpus.normal, approved: true }), envelope({ ...corpus.normal, objective: 'x'.repeat(201) }),
      envelope({ ...corpus.normal, acceptanceCriteria: [] }), envelope({ ...corpus.normal, objective: ' \t\n' }),
      envelope(corpus.normal, { usage: { completion_tokens: 801 } }),
      envelope(corpus.normal, { usage: { prompt_tokens: -1 } }),
      JSON.stringify({ choices: [{ finish_reason: 'length', message: { role: 'assistant', content: JSON.stringify(corpus.normal) } }] }),
      JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(corpus.normal), refusal: 'No' } }] }),
      ...[{ tool_calls: [{}] }, { tool_calls: {} }, { tool_calls: 'invalid' }, { tool_calls: false },
        { function_call: {} }, { function_call: [] }, { function_call: 'invalid' }, { function_call: 0 }].map(metadata =>
        JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(corpus.normal), ...metadata } }] })),
      JSON.stringify({ choices: [{ finish_reason: 'length', message: { role: 'assistant', content: JSON.stringify(corpus.normal), tool_calls: [], function_call: null } }] }),
    ];
    for (const body of invalid) {
      const h = harness(); jest.mocked(h.transport.complete).mockResolvedValue({ status: 200, body, retryAfter: null });
      await expect(h.call()).rejects.toMatchObject({ errorClass: 'INVALID_OUTPUT' }); expect(h.transport.complete).toHaveBeenCalledTimes(1);
    }
  });

  it('uses the shared retry, queue and user/global attempt reservations and preserves unknown usage', async () => {
    const h = harness(); jest.mocked(h.transport.complete).mockResolvedValueOnce({ status: 503, body: '{}', retryAfter: null });
    const result = await h.call(); expect(result.metadata.attemptCount).toBe(2);
    expect(h.beforeAttempt).toHaveBeenCalledTimes(2); expect(h.attempt.create).toHaveBeenCalledTimes(2);
    expect(result.metadata.usage).toEqual({ promptTokens: null, completionTokens: null, totalTokens: null, cachedTokens: null });
    const quota = harness(); quota.attempt.count.mockResolvedValue(10);
    await expect(quota.call()).rejects.toMatchObject({ errorClass: 'RATE_LIMIT' }); expect(quota.transport.complete).not.toHaveBeenCalled();
    const full = harness(); full.queue.count.mockResolvedValue(10);
    await expect(full.call()).rejects.toMatchObject({ errorClass: 'QUEUE_FULL' }); expect(full.transport.complete).not.toHaveBeenCalled();
    for (const status of [400, 401, 403, 429]) {
      const bad = harness(); jest.mocked(bad.transport.complete).mockResolvedValue({ status, body: '{}', retryAfter: null });
      await expect(bad.call()).rejects.toBeInstanceOf(SafeAiError); expect(bad.transport.complete).toHaveBeenCalledTimes(1);
    }
  });

  it('keeps live configuration disabled and rejects deadlines without returning a late suggestion', async () => {
    const h = harness(); const disabled = createContributorDraftGateway({ prisma: h.prisma, options: { mode: 'disabled' }, transport: h.transport });
    await expect(disabled.analyze(fixture(), { actorId: 'owner', deadline: h.deadline, beforeAttempt: h.beforeAttempt })).rejects.toMatchObject({ errorClass: 'DISABLED' });
    expect(h.transport.complete).not.toHaveBeenCalled();
    const late = harness(); jest.mocked(late.transport.complete).mockImplementation(async () => {
      late.advance(20_001); return { status: 200, body: envelope(), retryAfter: null };
    });
    await expect(late.call()).rejects.toMatchObject({ errorClass: 'DEADLINE' });
  });

  it('reauthorizes after the reservation lock wait without counting or dispatching a denied attempt (P004)', async () => {
    const h = harness(); let revoked = false; let admissions = 0;
    h.admission.mockImplementation(async () => {
      if (++admissions === 2) revoked = true;
      return [{ id: 'reviewer-patch-risk' }];
    });
    h.beforeAttempt.mockImplementation(async () => { if (revoked) throw new SafeAiError('ACCESS_LOST'); });
    await expect(h.call()).rejects.toMatchObject({ errorClass: 'ACCESS_LOST' });
    expect(h.beforeAttempt).toHaveBeenCalledTimes(1);
    expect(h.attempt.create).not.toHaveBeenCalled(); expect(h.transport.complete).not.toHaveBeenCalled();
  });

  it('classifies database cancellation as a deadline rather than lost access (P004)', async () => {
    for (const code of ['55P03', '57014']) {
      const h = harness(); jest.spyOn(h.prisma, '$transaction').mockRejectedValueOnce({ code: 'P2010', meta: { code } });
      await expect(h.call()).rejects.toMatchObject({ errorClass: 'DEADLINE' }); expect(h.transport.complete).not.toHaveBeenCalled();
    }
  });

  it('accepts only the exact saved-draft request identity, never client context, model or lifecycle fields', () => {
    const body = { expectedVersion: 0, workingRevisionId: 'working' };
    expect(contributorDraftRequestSchema.parse(body)).toEqual(body);
    for (const extra of [{ actorId: 'other' }, { context: 'private text' }, { model: 'override' }, { state: 'APPROVED' },
      { responseFormat: CONTRIBUTOR_RESPONSE_FORMAT }, { response_format: { type: 'text' } }, { expectedVersion: -1 }])
      expect(contributorDraftRequestSchema.safeParse({ ...body, ...extra }).success).toBe(false);
  });
});
