import 'reflect-metadata';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { reviewerAiUsageResponseSchema, type AiOutcome } from '@specsentry/shared';
import { SystemAiClock } from '../src/ai/gateway';
import type { DatabaseService } from '../src/database/database.service';
import type { BusinessActor } from '../src/identity/business-context';
import { ReviewerAiUsageService } from '../src/reviews/reviewer-ai-usage.service';
import { ReviewerAiUsageController } from '../src/reviews/reviewer-ai-usage.controller';

const actor: BusinessActor = { accountId: 'reviewer', accountVersion: 1, correlationId: 'safe-correlation',
  session: { digest: 'digest', issuedAt: Date.now(), csrfToken: 'a'.repeat(64) } };
const now = new Date('2026-11-04T16:00:00.000Z');
type Attempt = { ordinal: number; completedAt: Date | null; outcome: AiOutcome | null; promptTokens: number | null; completionTokens: number | null; totalTokens: number | null; cachedTokens: number | null };
const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({ ordinal: 1, completedAt: now, outcome: 'SUCCESS',
  promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0, ...overrides });

function fixture() {
  const account = { id: actor.accountId, role: 'REVIEWER', enabled: true, version: 1 };
  const session = { data: JSON.stringify({ userId: actor.accountId, accountVersion: 1, ...actor.session }), expiresAt: new Date(Date.now() + 60000) };
  const tx = {
    $queryRaw: jest.fn(async (query: TemplateStringsArray) => query.join('').includes('UserAccount') ? [account] : [session]),
    aiRequest: { findMany: jest.fn<Promise<{ outcome: string; attempts: { id: string }[] }[]>, [unknown]>().mockResolvedValue([]) },
    aiOutboundAttempt: { findMany: jest.fn<Promise<ReturnType<typeof attempt>[]>, [unknown]>().mockResolvedValue([]) },
    securityEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  const database = { client: { $transaction: jest.fn(async (work: (client: typeof tx) => unknown) => work(tx)), securityEvent: { create: jest.fn().mockResolvedValue({}) } } };
  const clock = new SystemAiClock(); jest.spyOn(clock, 'now').mockReturnValue(now);
  const service = new ReviewerAiUsageService(database as unknown as DatabaseService, clock);
  return { tx, database, account, session, service };
}

describe('Reviewer usage contracts', () => {
  it('restricts both independent half-open SGT queries to the authenticated actor and Reviewer feature, without assignment access', async () => {
    const { tx, service } = fixture(); const result = await service.usage(actor);
    const window = { gte: new Date('2026-11-04T16:00:00.000Z'), lt: new Date('2026-11-05T16:00:00.000Z') };
    expect(tx.aiRequest.findMany).toHaveBeenCalledWith({ where: { actorId: 'reviewer', feature: 'REVIEWER', requestedAt: window },
      select: { outcome: true, attempts: { select: { id: true }, take: 1 } } });
    expect(tx.aiOutboundAttempt.findMany).toHaveBeenCalledWith({ where: { actorId: 'reviewer', request: { actorId: 'reviewer', feature: 'REVIEWER' }, dispatchedAt: window },
      select: { ordinal: true, completedAt: true, outcome: true, promptTokens: true, completionTokens: true, totalTokens: true, cachedTokens: true } });
    expect(result).toMatchObject({ requests: 0, attempts: 0, failureRate: null, applicationCache: 'DISABLED', providerSpendWindow: 'UTC; separate from application quota',
      usage: { promptTokens: null, completionTokens: null, totalTokens: null, cachedTokens: null } });
    expect(reviewerAiUsageResponseSchema.safeParse({ ...result, proposalId: 'private' }).success).toBe(false);
    for (const key of ['actorId', 'proposalId', 'revisionId', 'assignmentId', 'contextHash', 'templateVersion', 'items']) expect(result).not.toHaveProperty(key);
    expect(tx.securityEvent.create).toHaveBeenCalledWith({ data: { actorId: 'reviewer', target: 'own-ai-usage', action: 'AI_USAGE_VIEWED', outcome: 'success', correlationId: 'safe-correlation' } });
  });

  it.each(['2026-11-04T15:59:59.999Z', '2026-11-04T16:00:00.000Z'])('uses the correct SGT day at %s', async time => {
    const clock = new SystemAiClock(); jest.spyOn(clock, 'now').mockReturnValue(new Date(time));
    const { database } = fixture(); const result = await new ReviewerAiUsageService(database as unknown as DatabaseService, clock).usage(actor);
    expect(result.startedAt).toBe(time.includes('15:59') ? '2026-11-03T16:00:00.000Z' : '2026-11-04T16:00:00.000Z');
    expect(Date.parse(result.resetsAt) - Date.parse(result.startedAt)).toBe(86400000);
  });

  it('counts retry-today independently and checks the full attempt relationship for preflight rejection', async () => {
    const { tx, service } = fixture();
    tx.aiRequest.findMany.mockResolvedValue([{ outcome: 'REJECTED', attempts: [] }, { outcome: 'REJECTED', attempts: [{ id: 'outside-day' }] }]);
    tx.aiOutboundAttempt.findMany.mockResolvedValue([attempt({ ordinal: 2 })]);
    expect(await service.usage(actor)).toMatchObject({ requests: 2, attempts: 1, retries: 1, preflightRejections: 1 });
  });

  it('counts all completed outbound failures while excluding incomplete outcomes and preserving outbound success after denied delivery', async () => {
    const { tx, service } = fixture();
    tx.aiRequest.findMany.mockResolvedValue([{ outcome: 'REJECTED', attempts: [{ id: 'successful-provider-access-lost-delivery' }] }]);
    tx.aiOutboundAttempt.findMany.mockResolvedValue([attempt(), ...['TRANSPORT', 'PROVIDER_REQUEST', 'INVALID_OUTPUT', 'PROVIDER_AUTH'].map(() => attempt({ outcome: 'FAILED' })),
      attempt({ outcome: 'CANCELLED' }), attempt({ outcome: 'REJECTED' }), attempt({ outcome: null }), attempt({ completedAt: null })]);
    expect(await service.usage(actor)).toMatchObject({ attempts: 9, completedAttempts: 7, failedAttempts: 6, failureRate: 6 / 7, preflightRejections: 0 });
  });

  it('preserves genuine zeros and reports each incomplete provider field as unknown rather than a partial sum', async () => {
    const { tx, service } = fixture(); tx.aiOutboundAttempt.findMany.mockResolvedValue([attempt()]);
    expect((await service.usage(actor)).usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 });
    tx.aiOutboundAttempt.findMany.mockResolvedValue([attempt({ promptTokens: 5 }), attempt({ promptTokens: null, cachedTokens: null })]);
    expect(await service.usage(actor)).toMatchObject({ usage: { promptTokens: null, completionTokens: 0, totalTokens: 0, cachedTokens: null }, usageReportedAttempts: 2 });
    tx.aiOutboundAttempt.findMany.mockResolvedValue([attempt({ promptTokens: null, completionTokens: null, totalTokens: null, cachedTokens: null, completedAt: null, outcome: null })]);
    expect(await service.usage(actor)).toMatchObject({ failureRate: null, usageReportedAttempts: 0 });
  });

  it.each(['missing-session', 'expired', 'logout', 'disabled', 'version', 'CONTRIBUTOR', 'RELEASE_MAINTAINER'])('denies %s before protected queries', async condition => {
    const { tx, account, session, service } = fixture(); const input = { ...actor };
    if (condition === 'missing-session') delete input.session;
    if (condition === 'expired') session.expiresAt = new Date(0);
    if (condition === 'logout') tx.$queryRaw.mockImplementation(async query => query.join('').includes('UserAccount') ? [account] : [] as never);
    if (condition === 'disabled') account.enabled = false;
    if (condition === 'version') account.version = 2;
    if (['CONTRIBUTOR', 'RELEASE_MAINTAINER'].includes(condition)) account.role = condition;
    await expect(service.usage(input)).rejects.toBeInstanceOf(['CONTRIBUTOR', 'RELEASE_MAINTAINER'].includes(condition) ? ForbiddenException : UnauthorizedException);
    expect(tx.aiRequest.findMany).not.toHaveBeenCalled(); expect(tx.aiOutboundAttempt.findMany).not.toHaveBeenCalled();
  });

  it('does not return a successful read when its safe usage-view event fails', async () => {
    const { tx, service } = fixture(); tx.securityEvent.create.mockRejectedValue(new Error('synthetic audit failure'));
    await expect(service.usage(actor)).rejects.toThrow('synthetic audit failure');
  });

  it('rejects every client selector before invoking the service', () => {
    const service = { usage: jest.fn() }; const controller = new ReviewerAiUsageController(service as unknown as ReviewerAiUsageService);
    for (const key of ['actorId', 'proposalId', 'date', 'model', 'feature']) expect(() => controller.usage({} as never, { [key]: 'forged' })).toThrow();
    expect(service.usage).not.toHaveBeenCalled();
  });
});
