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

  async releaseQueue(requestId: string, deadline?: AiDeadline): Promise<void> {
    if (deadline) await this.bounded(deadline, tx => tx.aiQueueLease.deleteMany({ where: { requestId } }));
    else await this.prisma.aiQueueLease.deleteMany({ where: { requestId } });
  }

  async reserveAttempt(input: { requestId: string; actorId: string; ordinal: number; deadline: AiDeadline }): Promise<{ attemptId: string }> {
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
      const attempt = await tx.aiOutboundAttempt.create({ data: {
        requestId: input.requestId, actorId: input.actorId, ordinal: input.ordinal, dispatchedAt: now,
      }, select: { id: true } });
      await tx.aiQueueLease.deleteMany({ where: { requestId: input.requestId } });
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

  async cleanup(): Promise<void> {
    const now = this.clock.now();
    await this.prisma.aiQueueLease.deleteMany({ where: { expiresAt: { lte: now } } });
    await this.prisma.aiRequest.deleteMany({ where: { retainedUntil: { lte: now } } });
  }
}
