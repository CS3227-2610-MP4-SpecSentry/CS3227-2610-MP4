import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '../src/generated/prisma/client';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import type { AiClock } from '../src/ai/contracts';
import { AiRequestDeadline } from '../src/ai/deadline';
import { PrismaAiAccounting } from '../src/ai/gateway/accounting';

const day = 86_400_000;
function barrier() {
  let open!: () => void;
  const promise = new Promise<void>(resolve => { open = resolve; });
  return { promise, open };
}

describe('PostgreSQL AI retention', () => {
  let database: DatabaseService;
  const prefix = `retention-${randomUUID()}`;
  let time: number;
  const clock: AiClock = { now: () => new Date(time), monotonicMs: () => performance.now(),
    sleep: milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)) };
  const old = () => new Date(time - 2 * day);
  const accounting = () => new PrismaAiAccounting(database.client, clock);
  async function cleanup(value = accounting(), milliseconds = 2000) {
    const deadline = new AiRequestDeadline(clock, milliseconds);
    try { await value.cleanup(deadline); } finally { deadline.close(); }
  }
  async function create(suffix: string, overrides: Partial<Prisma.AiRequestUncheckedCreateInput> = {},
    client: Pick<Prisma.TransactionClient, 'aiRequest'> = database.client) {
    return client.aiRequest.create({ data: { id: `${prefix}-${suffix}`, correlationId: prefix, actorId: prefix,
      proposalId: prefix, revisionId: prefix, assignmentId: prefix, accessGenerationId: prefix,
      expectedVersion: 1, expectedAssignmentVersion: 0, selectedCriterionCount: 1,
      templateVersion: 'synthetic-retention', requestedAt: old(),
      retainedUntil: new Date(time), ...overrides } });
  }
  async function attempt(requestId: string, overrides: Partial<Prisma.AiOutboundAttemptUncheckedCreateInput> = {}) {
    return database.client.aiOutboundAttempt.create({ data: { requestId, actorId: prefix, ordinal: 1,
      dispatchedAt: old(), ...overrides } });
  }
  async function lease(requestId: string, expiresAt: Date) {
    return database.client.aiQueueLease.create({ data: { requestId, actorId: prefix,
      enqueuedAt: new Date(expiresAt.getTime() - 1000), expiresAt } });
  }
  async function cleanFixtures() {
    await database.client.aiQueueLease.deleteMany({ where: { actorId: prefix } });
    await database.client.aiRequest.deleteMany({ where: { actorId: prefix } });
  }
  async function waitForCoordinatorWaiter() {
    for (let i = 0; i < 100; i++) {
      const rows = await database.client.$queryRaw<Array<{ waiting: boolean }>>`SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity WHERE pid <> pg_backend_pid()
          AND wait_event_type = 'Lock' AND query LIKE '%AiQuotaCoordinator%') AS waiting`;
      if (rows[0]?.waiting) return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Coordinator waiter not observed');
  }
  function holdCoordinator() {
    const entered = barrier(); const release = barrier();
    const pending = database.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "AiQuotaCoordinator" WHERE id = 'reviewer-patch-risk' FOR UPDATE`;
      entered.open(); await release.promise;
    }, { timeout: 5000 });
    return { entered, release, pending };
  }
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit isolated TEST_DATABASE_URL required');
    database = new DatabaseService(readConfig({ NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL,
      SESSION_SECRET: 'synthetic-retention-session-secret-at-least-32' }));
    const priorFixtures = await database.client.userAccount.findMany({
      where: { username: { startsWith: 'retention-' }, passwordHash: 'synthetic' }, select: { id: true },
    });
    console.info('Prior synthetic retention fixture IDs:', priorFixtures.map(row => row.id));
    await database.client.aiQuotaCoordinator.upsert({ where: { id: 'reviewer-patch-risk' },
      create: { id: 'reviewer-patch-risk' }, update: {} });
  });
  beforeEach(async () => { time = Date.parse('2026-11-04T12:00:00Z'); await cleanFixtures(); });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => { if (database) { await cleanFixtures(); await database.onModuleDestroy(); } });

  it('deletes at expiry equality, cascades old abandoned attempts, and is idempotent under concurrent cleanup', async () => {
    const request = await create('expired'); await attempt(request.id);
    await lease(request.id, new Date(time)); await lease(`${prefix}-orphan-expired`, new Date(time));
    await Promise.all([cleanup(), cleanup(), cleanup()]); await cleanup();
    expect(await database.client.aiRequest.findUnique({ where: { id: request.id } })).toBeNull();
    expect(await database.client.aiOutboundAttempt.count({ where: { requestId: request.id } })).toBe(0);
    expect(await database.client.aiQueueLease.count({ where: { actorId: prefix } })).toBe(0);
  });

  it.each(['requestedAt', 'completedAt', 'dispatchedAt', 'attemptCompletedAt'] as const)(
    'preserves equality and future values of %s without an upper cutoff', async field => {
      for (const offset of [-day, day]) {
        const stamp = new Date(time + offset);
        const request = await create(`${field}-${offset}`, field === 'requestedAt' || field === 'completedAt' ? { [field]: stamp } : {});
        await attempt(request.id, field === 'dispatchedAt' ? { dispatchedAt: stamp }
          : field === 'attemptCompletedAt' ? { completedAt: stamp } : {});
        await cleanup();
        expect(await database.client.aiRequest.findUnique({ where: { id: request.id } })).not.toBeNull();
        expect(await database.client.aiOutboundAttempt.count({ where: { requestId: request.id } })).toBe(1);
      }
    });

  it('purges just outside the recent boundary but preserves future retention and live/orphan leases until expiry', async () => {
    const stale = new Date(time - day - 1);
    const expired = await create('outside-boundary', { requestedAt: stale, completedAt: stale });
    await attempt(expired.id, { dispatchedAt: stale, completedAt: stale });
    const retained = await create('future-retention', { retainedUntil: new Date(time + 1) });
    const active = await create('live-lease'); await lease(active.id, new Date(time + 1));
    const orphan = `${prefix}-live-orphan`; await lease(orphan, new Date(time + 1));
    await cleanup();
    expect(await database.client.aiRequest.findUnique({ where: { id: expired.id } })).toBeNull();
    for (const id of [retained.id, active.id]) expect(await database.client.aiRequest.findUnique({ where: { id } })).not.toBeNull();
    expect(await database.client.aiQueueLease.count({ where: { requestId: { in: [active.id, orphan] } } })).toBe(2);
    time += 1; await cleanup();
    expect(await database.client.aiRequest.count({ where: { actorId: prefix } })).toBe(0);
    expect(await database.client.aiQueueLease.count({ where: { actorId: prefix } })).toBe(0);
  });

  it('captures the cutoff after waiting for the coordinator and reclaims newly expired leases', async () => {
    const request = await create('cross-cutoff', { retainedUntil: new Date(time + 1000) });
    await lease(request.id, new Date(time + 1000));
    const holder = holdCoordinator(); await holder.entered.promise;
    const pending = cleanup();
    try { await waitForCoordinatorWaiter(); time += 1000; } finally { holder.release.open(); }
    await holder.pending; await pending;
    expect(await database.client.aiRequest.findUnique({ where: { id: request.id } })).toBeNull();
    expect(await database.client.aiQueueLease.count({ where: { requestId: request.id } })).toBe(0);
  });

  it('rolls back expired lease deletion and parent/attempt cascade when the cleanup transaction fails', async () => {
    const request = await create('rollback'); await attempt(request.id); await lease(request.id, new Date(time));
    const prisma = { $transaction: (work: (tx: Prisma.TransactionClient) => Promise<unknown>, options: object) =>
      database.client.$transaction(tx => work(new Proxy(tx, { get(target, property) {
        if (property === '$executeRaw') return async (...args: unknown[]) => {
          await (target.$executeRaw as (...values: unknown[]) => Promise<number>)(...args);
          throw new Error('Synthetic failure after deletion');
        };
        return Reflect.get(target, property);
      } })), options) } as unknown as PrismaClient;
    await expect(cleanup(new PrismaAiAccounting(prisma, clock))).rejects.toMatchObject({ errorClass: 'INTERNAL' });
    expect(await database.client.aiRequest.count({ where: { id: request.id } })).toBe(1);
    expect(await database.client.aiOutboundAttempt.count({ where: { requestId: request.id } })).toBe(1);
    expect(await database.client.aiQueueLease.count({ where: { requestId: request.id } })).toBe(1);
  });

  it('times out behind the coordinator without deleting partial data', async () => {
    const request = await create('timeout'); await lease(request.id, new Date(time));
    const holder = holdCoordinator(); await holder.entered.promise;
    try { await expect(cleanup(accounting(), 75)).rejects.toMatchObject({ errorClass: 'DEADLINE' }); }
    finally { holder.release.open(); await holder.pending; }
    expect(await database.client.aiRequest.count({ where: { id: request.id } })).toBe(1);
    expect(await database.client.aiQueueLease.count({ where: { requestId: request.id } })).toBe(1);
  });

  it('rolls back all deletion when its deadline is aborted before commit', async () => {
    const request = await create('aborted'); await attempt(request.id); await lease(request.id, new Date(time));
    const deadline = new AiRequestDeadline(clock, 2000);
    const prisma = { $transaction: (work: (tx: Prisma.TransactionClient) => Promise<unknown>, options: object) =>
      database.client.$transaction(tx => work(new Proxy(tx, { get(target, property) {
        if (property === '$executeRaw') return async (...args: unknown[]) => {
          const result = await (target.$executeRaw as (...values: unknown[]) => Promise<number>)(...args);
          deadline.close(); return result;
        };
        return Reflect.get(target, property);
      } })), options) } as unknown as PrismaClient;
    try { await expect(new PrismaAiAccounting(prisma, clock).cleanup(deadline)).rejects.toMatchObject({ errorClass: 'DEADLINE' }); }
    finally { deadline.close(); }
    expect(await database.client.aiRequest.count({ where: { id: request.id } })).toBe(1);
    expect(await database.client.aiOutboundAttempt.count({ where: { requestId: request.id } })).toBe(1);
    expect(await database.client.aiQueueLease.count({ where: { requestId: request.id } })).toBe(1);
  });

  it('fails closed without a coordinator', async () => {
    const request = await create('no-coordinator'); await lease(request.id, new Date(time));
    await database.client.aiQuotaCoordinator.delete({ where: { id: 'reviewer-patch-risk' } });
    try { await expect(cleanup()).rejects.toMatchObject({ errorClass: 'INTERNAL' }); }
    finally { await database.client.aiQuotaCoordinator.create({ data: { id: 'reviewer-patch-risk' } }); }
    expect(await database.client.aiRequest.count({ where: { id: request.id } })).toBe(1);
    expect(await database.client.aiQueueLease.count({ where: { requestId: request.id } })).toBe(1);
  });

  it('serializes cleanup with active enqueue, reserve, and finish without losing quota evidence', async () => {
    const queued = await create('enqueue-race', { requestedAt: new Date(time) });
    const deadline = new AiRequestDeadline(clock, 3000);
    try {
      await Promise.all([accounting().enqueue({ requestId: queued.id, actorId: prefix, deadline }), cleanup()]);
      expect(await database.client.aiQueueLease.count({ where: { requestId: queued.id } })).toBe(1);
      const entered = barrier(); const release = barrier();
      const reservation = accounting().reserveAttempt({ requestId: queued.id, actorId: prefix, ordinal: 1, deadline,
        authorize: async () => { entered.open(); await release.promise; } });
      await entered.promise;
      const pending = cleanup();
      try { await waitForCoordinatorWaiter(); } finally { release.open(); }
      const { attemptId } = await reservation; await pending;
      const usage = { promptTokens: 5, completionTokens: 2, totalTokens: 7, cachedTokens: null };
      await Promise.all([cleanup(), accounting().finishAttempt(attemptId, 'SUCCESS', null, usage, 1, deadline)]);
      expect(await database.client.aiRequest.count({ where: { id: queued.id } })).toBe(1);
      expect(await database.client.aiOutboundAttempt.findUnique({ where: { id: attemptId } })).toMatchObject({ totalTokens: 7, outcome: 'SUCCESS' });
      expect(await database.client.aiOutboundAttempt.count({ where: { actorId: prefix, dispatchedAt: { gte: new Date(time - day) } } })).toBe(1);
    } finally { deadline.close(); }
  });

  it('preserves daily quota exhaustion evidence after cleanup', async () => {
    const requests = await Promise.all(Array.from({ length: 60 }, (_, index) => create(`daily-quota-${index}`)));
    await database.client.aiOutboundAttempt.createMany({ data: requests.map(request => ({
      requestId: request.id, actorId: prefix, ordinal: 1, dispatchedAt: new Date('2026-11-04T00:00:00Z'),
    })) });
    await cleanup();
    const deadline = new AiRequestDeadline(clock, 2000);
    try {
      await expect(accounting().reserveAttempt({ requestId: requests[0]!.id, actorId: prefix, ordinal: 2, deadline,
        authorize: async () => undefined })).rejects.toMatchObject({ errorClass: 'RATE_LIMIT' });
    } finally { deadline.close(); }
    expect(await database.client.aiOutboundAttempt.count({ where: { actorId: prefix } })).toBe(60);
  });

  it('leaves immutable submissions, activity, notifications, and security history untouched', async () => {
    const rolledBack = new Error('Deliberate synthetic history rollback');
    await expect(database.client.$transaction(async tx => {
      const user = await tx.userAccount.create({ data: { id: prefix, username: prefix, passwordHash: 'synthetic', role: 'CONTRIBUTOR' } });
      const reviewer = await tx.userAccount.create({ data: { username: `${prefix}-reviewer`, passwordHash: 'synthetic', role: 'REVIEWER' } });
      const proposal = await tx.changeProposal.create({ data: { id: prefix, ownerId: user.id, title: 'Retention history' } });
      const revision = await tx.proposalRevision.create({ data: { proposalId: proposal.id, number: 1,
        summary: 'Synthetic submission', problem: 'Preserve history', constraints: '', expectedBehavior: 'History remains', diffText: '', submittedAt: old() } });
      const assignment = await tx.reviewAssignment.create({ data: { proposalId: proposal.id, revisionId: revision.id, reviewerId: reviewer.id } });
      await tx.changeProposal.update({ where: { id: proposal.id }, data: { state: 'IN_REVIEW', firstSubmittedAt: old(),
        currentRevisionId: revision.id, currentAssignmentId: assignment.id } });
      const activity = await tx.proposalActivity.create({ data: { proposalId: proposal.id, revisionId: revision.id,
        actorId: user.id, action: 'SUBMITTED', summary: 'Synthetic history', timestamp: old() } });
      const notice = await tx.notification.create({ data: { recipientId: reviewer.id, proposalId: proposal.id, revisionId: revision.id,
        assignmentId: assignment.id, activityId: activity.id, kind: 'NEW_REVISION', createdAt: old() } });
      const event = await tx.securityEvent.create({ data: { actorId: user.id, action: 'synthetic', target: prefix, outcome: 'success', timestamp: old() } });
      await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
      const request = await create('business-history', {}, tx);
      const prisma = { $transaction: (work: (value: Prisma.TransactionClient) => Promise<unknown>) => work(tx) } as unknown as PrismaClient;
      await cleanup(new PrismaAiAccounting(prisma, clock));
      expect(await tx.aiRequest.count({ where: { id: request.id } })).toBe(0);
      expect(await tx.proposalRevision.findUnique({ where: { id: revision.id } })).toEqual(revision);
      expect(await tx.proposalActivity.findUnique({ where: { id: activity.id } })).toEqual(activity);
      expect(await tx.notification.findUnique({ where: { id: notice.id } })).toEqual(notice);
      expect(await tx.securityEvent.findUnique({ where: { id: event.id } })).toEqual(event);
      throw rolledBack;
    })).rejects.toBe(rolledBack);
    expect(await database.client.userAccount.findUnique({ where: { id: prefix } })).toBeNull();
  });
});
