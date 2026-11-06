import type { AiErrorClass, AiOutcome, AiTokenUsage } from '@specsentry/shared';
import type { Prisma, PrismaClient } from '../../generated/prisma/client';
import type { AiClock, AiDeadline } from '../contracts';

export class SafeAiError extends Error {
  readonly code = 'AI_UNAVAILABLE';
  constructor(readonly errorClass: AiErrorClass, readonly retryAfterSeconds?: number,
    readonly requestId?: string) {
    super('AI analysis is unavailable. Continue the manual review.');
    this.name = 'SafeAiError';
  }
}

type AccountingPrisma = Pick<PrismaClient, '$transaction' | 'aiQueueLease' | 'aiRequest' | 'aiOutboundAttempt'>;
const coordinator = 'reviewer-patch-risk';
const seconds = (milliseconds: number) => Math.max(1, Math.ceil(milliseconds / 1000));
export const AI_REQUEST_LIMITS = {
  actorTenMinutes: 120,
  actorSgtDay: 1_000,
  projectMinute: 300,
} as const;

export class PrismaAiAccounting {
  constructor(private readonly prisma: AccountingPrisma, private readonly clock: AiClock) {}

  async bounded<T>(deadline: AiDeadline, action: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    deadline.assertRemaining();
    const timeout = Math.max(1, Math.floor(deadline.remainingMs()));
    try {
      return await this.prisma.$transaction(async (tx) => {
        const milliseconds = String(Math.max(1, Math.floor(deadline.remainingMs())));
        await tx.$queryRaw`SELECT set_config('statement_timeout', ${milliseconds}, true), set_config('lock_timeout', ${milliseconds}, true)`;
        deadline.assertRemaining();
        const result = await action(tx);
        deadline.assertRemaining();
        return result;
      }, { maxWait: timeout, timeout });
    } catch (error) {
      if (error instanceof SafeAiError) throw error;
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      const meta = error && typeof error === 'object' && 'meta' in error ? error.meta as { code?: string } : undefined;
      if (code === 'P2028' || code === 'P2024' || meta?.code === '55P03' || meta?.code === '57014') throw new SafeAiError('DEADLINE');
      if (deadline.remainingMs() <= 0 || deadline.signal.aborted) throw new SafeAiError('DEADLINE');
      throw new SafeAiError('INTERNAL');
    }
  }

  private async locked<T>(deadline: AiDeadline, action: (tx: Prisma.TransactionClient, now: Date) => Promise<T>): Promise<T> {
    return this.bounded(deadline, async tx => {
        // The seeded row is the serialization point on every application process.
        const rows = await tx.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "AiQuotaCoordinator" WHERE id = $1 FOR UPDATE', coordinator);
        if (rows.length !== 1) throw new Error('Missing AI coordinator');
        deadline.assertRemaining();
        const now = this.clock.now();
        await tx.aiQueueLease.deleteMany({ where: { expiresAt: { lte: now } } });
        return action(tx, now);
    });
  }

  async enqueue(input: { requestId: string; actorId: string; deadline: AiDeadline }): Promise<void> {
    await this.locked(input.deadline, async (tx, now) => {
      const count = await tx.aiQueueLease.count();
      if (count >= 10) throw new SafeAiError('QUEUE_FULL', 1, input.requestId);
      const expiresAt = new Date(now.getTime() + Math.max(1, Math.min(20_000, Math.floor(input.deadline.remainingMs()))));
      await tx.aiQueueLease.create({ data: { requestId: input.requestId, actorId: input.actorId, enqueuedAt: now, expiresAt } });
    });
  }

  async createRequest(input: { actorId: string; data: Prisma.AiRequestUncheckedCreateInput;
    deadline: AiDeadline }): Promise<void> {
    await this.locked(input.deadline, async (tx, now) => {
      const tenMinutes = new Date(now.getTime() - 600_000);
      const minute = new Date(now.getTime() - 60_000);
      const sgtDay = new Date(Math.floor((now.getTime() + 28_800_000) / 86_400_000) * 86_400_000 - 28_800_000);
      const [actorTen, actorDay, projectMinute] = await Promise.all([
        tx.aiRequest.count({ where: { actorId: input.actorId, requestedAt: { gt: tenMinutes } } }),
        tx.aiRequest.count({ where: { actorId: input.actorId, requestedAt: { gte: sgtDay } } }),
        tx.aiRequest.count({ where: { requestedAt: { gt: minute } } }),
      ]);
      if (actorTen >= AI_REQUEST_LIMITS.actorTenMinutes || actorDay >= AI_REQUEST_LIMITS.actorSgtDay ||
          projectMinute >= AI_REQUEST_LIMITS.projectMinute) {
        const oldest = await tx.aiRequest.findFirst({ where: actorDay >= AI_REQUEST_LIMITS.actorSgtDay
          ? { actorId: input.actorId, requestedAt: { gte: sgtDay } }
          : actorTen >= AI_REQUEST_LIMITS.actorTenMinutes
            ? { actorId: input.actorId, requestedAt: { gt: tenMinutes } }
            : { requestedAt: { gt: minute } },
        orderBy: { requestedAt: 'asc' }, select: { requestedAt: true } });
        const wait = actorDay >= AI_REQUEST_LIMITS.actorSgtDay
          ? sgtDay.getTime() + 86_400_000 - now.getTime()
          : (oldest?.requestedAt.getTime() ?? now.getTime()) +
            (actorTen >= AI_REQUEST_LIMITS.actorTenMinutes ? 600_000 : 60_000) - now.getTime();
        throw new SafeAiError('RATE_LIMIT', seconds(wait));
      }
      await tx.aiRequest.create({ data: input.data });
    });
  }

  async releaseQueue(requestId: string, deadline?: AiDeadline): Promise<void> {
    if (deadline) await this.bounded(deadline, tx => tx.aiQueueLease.deleteMany({ where: { requestId } }));
    else await this.prisma.aiQueueLease.deleteMany({ where: { requestId } });
  }

  async reserveAttempt(input: { requestId: string; actorId: string; ordinal: number; deadline: AiDeadline;
    authorize(tx: Prisma.TransactionClient): Promise<void> }): Promise<{ attemptId: string }> {
    return this.locked(input.deadline, async (tx, now) => {
      const tenMinutes = new Date(now.getTime() - 600_000);
      const minute = new Date(now.getTime() - 60_000);
      const sgtDay = new Date(Math.floor((now.getTime() + 28_800_000) / 86_400_000) * 86_400_000 - 28_800_000);
      const userTen = await tx.aiOutboundAttempt.count({ where: { actorId: input.actorId, dispatchedAt: { gt: tenMinutes } } });
      const userDay = await tx.aiOutboundAttempt.count({ where: { actorId: input.actorId, dispatchedAt: { gte: sgtDay } } });
      const globalMinute = await tx.aiOutboundAttempt.count({ where: { dispatchedAt: { gt: minute } } });
      if (userTen >= 10 || userDay >= 60 || globalMinute >= 30) {
        const oldest = await tx.aiOutboundAttempt.findFirst({
          where: { ...(userDay >= 60 ? { actorId: input.actorId, dispatchedAt: { gte: sgtDay } }
            : userTen >= 10 ? { actorId: input.actorId, dispatchedAt: { gt: tenMinutes } } : { dispatchedAt: { gt: minute } }) },
          orderBy: { dispatchedAt: 'asc' }, select: { dispatchedAt: true },
        });
        const wait = userDay >= 60 ? (sgtDay.getTime() + 86_400_000 - now.getTime())
          : (oldest?.dispatchedAt.getTime() ?? now.getTime()) + (userTen >= 10 ? 600_000 : 60_000) - now.getTime();
        throw new SafeAiError('RATE_LIMIT', seconds(wait), input.requestId);
      }
      await tx.aiQueueLease.deleteMany({ where: { requestId: input.requestId } });
      // Reauthorize after admission waits, on this connection, before counting a dispatch.
      await input.authorize(tx);
      input.deadline.assertRemaining();
      const attempt = await tx.aiOutboundAttempt.create({ data: {
        requestId: input.requestId, actorId: input.actorId, ordinal: input.ordinal, dispatchedAt: this.clock.now(),
      }, select: { id: true } });
      return { attemptId: attempt.id };
    });
  }

  async finishAttempt(attemptId: string, outcome: AiOutcome, errorClass: AiErrorClass | null,
    usage: AiTokenUsage, latencyMs: number, deadline?: AiDeadline): Promise<void> {
    const work = (tx: Pick<Prisma.TransactionClient, 'aiOutboundAttempt'>) => tx.aiOutboundAttempt.update({ where: { id: attemptId }, data: {
      completedAt: this.clock.now(), outcome, errorClass, latencyMs,
      promptTokens: usage.promptTokens, completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens, cachedTokens: usage.cachedTokens,
    } });
    if (deadline) await this.bounded(deadline, work); else await work(this.prisma);
  }

  async cleanup(deadline: AiDeadline): Promise<void> {
    await this.locked(deadline, async (tx, now) => {
      const recentCutoff = new Date(now.getTime() - 86_400_000);
      // Preserve live work and the longest quota window, including future timestamps.
      await tx.$executeRaw`DELETE FROM "AiRequest" AS request
        WHERE request."retainedUntil" <= ${now}
          AND request."requestedAt" < ${recentCutoff}
          AND (request."completedAt" IS NULL OR request."completedAt" < ${recentCutoff})
          AND NOT EXISTS (SELECT 1 FROM "AiQueueLease" AS lease
            WHERE lease."requestId" = request.id AND lease."expiresAt" > ${now})
          AND NOT EXISTS (SELECT 1 FROM "AiOutboundAttempt" AS attempt
            WHERE attempt."requestId" = request.id
              AND (attempt."dispatchedAt" >= ${recentCutoff} OR attempt."completedAt" >= ${recentCutoff}))`;
    });
  }
}
