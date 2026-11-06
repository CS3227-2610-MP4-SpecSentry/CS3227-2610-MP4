import 'reflect-metadata';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { maintainerAiUsageResponseSchema } from '@specsentry/shared';
import { SystemAiClock } from '../src/ai/gateway';
import type { DatabaseService } from '../src/database/database.service';
import type { BusinessActor } from '../src/identity/business-context';
import { MaintainerAiUsageController } from '../src/releases/maintainer-ai-usage.controller';
import { MaintainerAiUsageService } from '../src/releases/maintainer-ai-usage.service';

const actor: BusinessActor = { accountId: 'maintainer', accountVersion: 1, correlationId: 'safe-correlation',
  session: { digest: 'digest', issuedAt: Date.now(), csrfToken: 'a'.repeat(64) } };
const now = new Date('2026-11-05T16:00:00.000Z');
type UsageField = 'promptTokens' | 'completionTokens' | 'totalTokens' | 'cachedTokens';
type UsageAggregate = { _count: Record<UsageField, number>; _sum: Record<UsageField, number | null> };
function fixture() {
  const account = { id: actor.accountId, role: 'RELEASE_MAINTAINER', enabled: true, version: 1 };
  const session = { data: JSON.stringify({ userId: actor.accountId, accountVersion: 1, ...actor.session }),
    expiresAt: new Date(Date.now() + 60_000) };
  const tx = {
    $queryRaw: jest.fn(async (query: TemplateStringsArray) => query.join('').includes('UserAccount') ? [account] : [session]),
    aiRequest: { count: jest.fn(async () => 0) },
    aiOutboundAttempt: { count: jest.fn(async () => 0),
      aggregate: jest.fn<Promise<UsageAggregate>, [unknown]>().mockResolvedValue({
      _count: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 },
      _sum: { promptTokens: null, completionTokens: null, totalTokens: null, cachedTokens: null },
      }) },
    securityEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  const database = { client: { $transaction: jest.fn(async (work: (client: typeof tx) => unknown) => work(tx)),
    securityEvent: { create: jest.fn().mockResolvedValue({}) } } };
  const clock = new SystemAiClock(); jest.spyOn(clock, 'now').mockReturnValue(now);
  return { tx, account, session, service: new MaintainerAiUsageService(database as unknown as DatabaseService, clock) };
}

describe('Maintainer project AI usage', () => {
  it('aggregates the SGT day across every actor and feature without returning individual history', async () => {
    const { tx, service } = fixture();
    tx.aiRequest.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    tx.aiOutboundAttempt.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2).mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    tx.aiOutboundAttempt.aggregate.mockResolvedValue({
      _count: { promptTokens: 2, completionTokens: 2, totalTokens: 2, cachedTokens: 2 },
      _sum: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 },
    });
    const result = await service.usage(actor);
    const window = { gte: new Date('2026-11-05T16:00:00.000Z'), lt: new Date('2026-11-06T16:00:00.000Z') };
    expect(tx.aiRequest.count).toHaveBeenCalledWith({ where: { requestedAt: window } });
    expect(tx.aiOutboundAttempt.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: { dispatchedAt: window } }));
    expect(result).toMatchObject({ requests: 2, attempts: 2, retries: 1, completedAttempts: 2,
      failedAttempts: 1, preflightRejections: 1, failureRate: 0.5,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 } });
    expect(maintainerAiUsageResponseSchema.safeParse(result).success).toBe(true);
    for (const field of ['actorId', 'feature', 'items', 'proposalId', 'candidateId', 'contextHash', 'templateVersion'])
      expect(result).not.toHaveProperty(field);
    expect(tx.securityEvent.create).toHaveBeenCalledWith({ data: { actorId: 'maintainer',
      target: 'project-ai-usage', action: 'AI_USAGE_VIEWED', outcome: 'success', correlationId: 'safe-correlation' } });
  });

  it('uses SGT midnight and preserves unknown provider usage rather than partial estimates', async () => {
    const { tx, service } = fixture();
    tx.aiOutboundAttempt.count.mockResolvedValueOnce(2).mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2).mockResolvedValueOnce(0).mockResolvedValueOnce(2);
    tx.aiOutboundAttempt.aggregate.mockResolvedValue({
      _count: { promptTokens: 1, completionTokens: 2, totalTokens: 2, cachedTokens: 1 },
      _sum: { promptTokens: 5, completionTokens: 0, totalTokens: 0, cachedTokens: 0 },
    });
    expect(await service.usage(actor)).toMatchObject({ startedAt: '2026-11-05T16:00:00.000Z',
      resetsAt: '2026-11-06T16:00:00.000Z', usageReportedAttempts: 2,
      usage: { promptTokens: null, completionTokens: 0, totalTokens: 0, cachedTokens: null } });
  });

  it.each(['missing-session', 'expired', 'logout', 'disabled', 'version', 'CONTRIBUTOR', 'REVIEWER'])(
    'denies %s before aggregate queries', async condition => {
    const { tx, account, session, service } = fixture(); const input = { ...actor };
    if (condition === 'missing-session') delete input.session;
    if (condition === 'expired') session.expiresAt = new Date(0);
    if (condition === 'logout') tx.$queryRaw.mockImplementation(async query =>
      query.join('').includes('UserAccount') ? [account] : [] as never);
    if (condition === 'disabled') account.enabled = false;
    if (condition === 'version') account.version = 2;
    if (condition === 'CONTRIBUTOR' || condition === 'REVIEWER') account.role = condition;
    await expect(service.usage(input)).rejects.toBeInstanceOf(condition === 'CONTRIBUTOR' || condition === 'REVIEWER'
      ? ForbiddenException : UnauthorizedException);
    expect(tx.aiRequest.count).not.toHaveBeenCalled();
    expect(tx.aiOutboundAttempt.count).not.toHaveBeenCalled();
    });

  it('rejects every client selector before invoking the aggregate service', () => {
    const service = { usage: jest.fn() };
    const controller = new MaintainerAiUsageController(service as unknown as MaintainerAiUsageService);
    for (const key of ['actorId', 'feature', 'date', 'model', 'candidateId'])
      expect(() => controller.usage({} as never, { [key]: 'forged' })).toThrow();
    expect(service.usage).not.toHaveBeenCalled();
  });
});
