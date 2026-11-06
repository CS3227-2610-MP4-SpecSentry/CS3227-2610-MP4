import { maintainerGateRequestSchema, maintainerGateResponseSchema, validateMaintainerGateResult,
  type MaintainerGateResult } from '@specsentry/shared';
import type { PrismaClient } from '../src/generated/prisma/client';
import { createMaintainerGateGateway, MAINTAINER_TEMPLATE_VERSION, prepareMaintainerGate, SafeAiError } from '../src/ai/gateway';
import type { AiClock, AiDeadline, AiTransport, MaintainerGateContext } from '../src/ai/contracts';
import { aiTestOptions } from './ai-fixtures';

const result: MaintainerGateResult = {
  blockers: [{ itemIds: ['item-1'], description: 'Required coverage is incomplete.' }],
  dependencies: ['Confirm the downstream compatibility window.'],
  releaseNotes: ['Includes the validation change.'],
  rollbackConsiderations: ['Restore the prior application image.'],
  readinessRecommendation: 'NOT_READY', confidence: 'HIGH',
};
const envelope = (content: unknown = result) => JSON.stringify({
  choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(content) } }],
});
const fixture = (summary = 'Validates a synthetic input.'): MaintainerGateContext => ({
  scope: { candidateId: 'candidate-private', expectedVersion: 4, expectedContentVersion: 2,
    candidateItemCount: 1 },
  candidate: { versionLabel: '1.2.3', rollbackNote: 'Restore the prior image.',
    dependencyNotes: 'Requires service A.', blockerCodes: ['COVERAGE'] },
  items: [{ itemId: 'item-1', title: 'Validation change', revisionNumber: 3,
    submittedSummary: summary, gateStatuses: { currentRevision: 'PASS', approval: 'PASS',
      requiredCoverage: 'FAIL', highCriticalFindings: 'PASS' } }],
});

function harness() {
  let time = Date.parse('2026-11-06T04:00:00Z'); const end = time + 20_000;
  const clock: AiClock = { now: () => new Date(time), monotonicMs: () => time,
    sleep: async milliseconds => { time += milliseconds; } };
  const deadline: AiDeadline = { signal: new AbortController().signal,
    remainingMs: () => Math.max(0, end - time),
    assertRemaining: () => { if (time >= end) throw new SafeAiError('DEADLINE'); } };
  const request = { create: jest.fn(async () => ({})), update: jest.fn(async () => ({})),
    updateMany: jest.fn(async () => ({ count: 0 })), count: jest.fn(async () => 0),
    findFirst: jest.fn(async () => null), deleteMany: jest.fn(async () => ({ count: 0 })) };
  const attempt = { create: jest.fn(async () => ({ id: 'attempt' })), update: jest.fn(async () => ({})),
    updateMany: jest.fn(async () => ({})), count: jest.fn(async () => 0), findFirst: jest.fn(async () => null) };
  const queue = { create: jest.fn(async () => ({})), deleteMany: jest.fn(async () => ({ count: 0 })),
    count: jest.fn(async () => 0) };
  const tx = { aiRequest: request, aiOutboundAttempt: attempt, aiQueueLease: queue,
    $executeRaw: jest.fn(async () => 0), $queryRaw: jest.fn(async () => []),
    $queryRawUnsafe: jest.fn(async () => [{ id: 'reviewer-patch-risk' }]) };
  const prisma = { ...tx, $transaction: async <T>(action: (client: typeof tx) => Promise<T>) => action(tx) } as unknown as PrismaClient;
  const transport: AiTransport = { complete: jest.fn(async () => ({ status: 200, body: envelope(), retryAfter: null })) };
  const counter = { model: aiTestOptions.mode === 'test' ? aiTestOptions.model : '', methodId: 'synthetic-counter-v1',
    countUnits: jest.fn(() => 100) };
  const gateway = createMaintainerGateGateway({ prisma, options: aiTestOptions, transport, counter, clock });
  const beforeAttempt = jest.fn(async () => undefined);
  return { request, attempt, transport, counter, beforeAttempt,
    call: (context = fixture()) => gateway.analyze(context, { actorId: 'maintainer', deadline, beforeAttempt }) };
}

describe('Maintainer release-gate AI gateway', () => {
  it('uses an exact request/current-stale response contract and grounds every returned item ID', () => {
    expect(maintainerGateRequestSchema.parse({ expectedVersion: 4, expectedContentVersion: 2 }))
      .toEqual({ expectedVersion: 4, expectedContentVersion: 2 });
    expect(maintainerGateRequestSchema.safeParse({ expectedVersion: 4, expectedContentVersion: 2,
      candidateId: 'forged' }).success).toBe(false);
    expect(maintainerGateResponseSchema.parse({ status: 'CURRENT', staleReason: null,
      analyzedScope: fixture().scope, result })).toMatchObject({ status: 'CURRENT' });
    expect(maintainerGateResponseSchema.safeParse({ status: 'STALE', staleReason: 'NEW_REVISION',
      analyzedScope: fixture().scope, result }).success).toBe(false);
    expect(() => validateMaintainerGateResult({ ...result,
      blockers: [{ itemIds: ['unknown'], description: 'Unknown item.' }] }, ['item-1'])).toThrow();
  });

  it('sends only bounded candidate metadata, item summaries and gate statuses without private coordinates', async () => {
    const prepared = prepareMaintainerGate(fixture());
    expect(MAINTAINER_TEMPLATE_VERSION).toBe('maintainer-release-gate-v1');
    expect(JSON.stringify(prepared.messages)).toContain('requiredCoverage');
    const h = harness(); await h.call();
    const sent = jest.mocked(h.transport.complete).mock.calls[0]![0];
    const messages = JSON.stringify(sent.messages);
    expect(messages).toContain('item-1'); expect(messages).toContain('Validation change');
    expect(messages).toContain('Validates a synthetic input.'); expect(messages).toContain('requiredCoverage');
    expect(messages).not.toContain('candidate-private'); expect(messages).not.toContain('expectedVersion');
    for (const forbidden of ['diffText', 'evidence', 'finding description', 'approvalId', 'accountId'])
      expect(messages).not.toContain(forbidden);
    expect(sent).toMatchObject({ maxTokens: 800, reasoningEffort: 'none', stream: false });
    expect(sent).not.toHaveProperty('tools');
  });

  it('persists safe Maintainer scope metadata but never model output or release mutations', async () => {
    const h = harness(); expect((await h.call()).result).toEqual(result);
    expect(h.request.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      feature: 'MAINTAINER', candidateId: 'candidate-private', expectedVersion: 4,
      expectedContentVersion: 2, candidateItemCount: 1,
    }) }));
    expect(JSON.stringify(h.request.create.mock.calls)).not.toContain(result.blockers[0]!.description);
    expect(JSON.stringify(h.request.update.mock.calls)).not.toContain(result.releaseNotes[0]);
    expect(h.beforeAttempt).toHaveBeenCalledTimes(1);
  });

  it('rejects secrets, oversized full contexts, unknown IDs and unsafe READY recommendations before delivery', async () => {
    const secret = harness();
    await expect(secret.call(fixture('clsk_synthetic_0123456789abcdefghijklmnop')))
      .rejects.toMatchObject({ errorClass: 'SECRET_DETECTED' });
    expect(secret.transport.complete).not.toHaveBeenCalled(); expect(secret.attempt.create).not.toHaveBeenCalled();

    const oversized = harness(); oversized.counter.countUnits.mockReturnValue(6_001);
    await expect(oversized.call()).rejects.toMatchObject({ errorClass: 'INPUT_LIMIT' });
    expect(oversized.transport.complete).not.toHaveBeenCalled();

    for (const output of [
      { ...result, blockers: [{ itemIds: ['unknown'], description: 'Invented item.' }] },
      { ...result, readinessRecommendation: 'READY' },
    ]) {
      const invalid = harness(); jest.mocked(invalid.transport.complete).mockResolvedValue({
        status: 200, body: envelope(output), retryAfter: null,
      });
      await expect(invalid.call()).rejects.toMatchObject({ errorClass: 'INVALID_OUTPUT' });
    }
  });

  it('admits preflight-only request records through a serialized bounded project quota', async () => {
    const h = harness(); h.request.count.mockResolvedValue(120);
    await expect(h.call()).rejects.toMatchObject({ errorClass: 'RATE_LIMIT' });
    expect(h.request.create).not.toHaveBeenCalled();
    expect(h.transport.complete).not.toHaveBeenCalled();
    expect(h.attempt.create).not.toHaveBeenCalled();
  });

  it('rejects malformed strict JSON, unknown fields, tool calls, refusal and truncated output without repair', async () => {
    const bodies = [
      JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant',
        content: '{"blockers":[],"blockers":[]}' } }] }),
      envelope({ ...result, publish: true }),
      JSON.stringify({ choices: [{ finish_reason: 'length', message: { role: 'assistant',
        content: JSON.stringify(result) } }] }),
      JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant',
        content: JSON.stringify(result), tool_calls: [{}] } }] }),
      JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant',
        content: JSON.stringify(result), refusal: 'No' } }] }),
    ];
    for (const body of bodies) {
      const h = harness(); jest.mocked(h.transport.complete).mockResolvedValue({ status: 200, body, retryAfter: null });
      await expect(h.call()).rejects.toMatchObject({ errorClass: 'INVALID_OUTPUT' });
      expect(h.transport.complete).toHaveBeenCalledTimes(1);
    }
  });
});
