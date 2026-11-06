import { Inject, Injectable } from '@nestjs/common';
import { reviewerAiUsageResponseSchema } from '@specsentry/shared';
import { AI_CLOCK, type AiClock } from '../ai/contracts';
import { DatabaseService } from '../database/database.service';
import { businessTransaction, type BusinessActor } from '../identity/business-context';

@Injectable()
export class ReviewerAiUsageService {
  constructor(private readonly database: DatabaseService, @Inject(AI_CLOCK) private readonly clock: AiClock) {}

  usage(actor: BusinessActor) {
    return businessTransaction(this.database, actor, 'REVIEWER', 'own-ai-usage', 'AI_REVIEWER_USAGE', async tx => {
      const now = this.clock.now();
      const startedAt = new Date(Math.floor((now.getTime() + 28_800_000) / 86_400_000) * 86_400_000 - 28_800_000);
      const resetsAt = new Date(startedAt.getTime() + 86_400_000);
      const requests = await tx.aiRequest.findMany({
        where: { actorId: actor.accountId, feature: 'REVIEWER', requestedAt: { gte: startedAt, lt: resetsAt } },
        select: { outcome: true, attempts: { select: { id: true }, take: 1 } },
      });
      // Dispatch windows include retries whose parent request was admitted yesterday.
      const attempts = await tx.aiOutboundAttempt.findMany({
        where: { actorId: actor.accountId, request: { actorId: actor.accountId, feature: 'REVIEWER' }, dispatchedAt: { gte: startedAt, lt: resetsAt } },
        select: { ordinal: true, completedAt: true, outcome: true, promptTokens: true, completionTokens: true, totalTokens: true, cachedTokens: true },
      });
      const completed = attempts.filter(attempt => attempt.completedAt !== null && attempt.outcome !== null);
      // Request-level delivery denial does not turn a successful outbound attempt into a failure.
      const failed = completed.filter(attempt => attempt.outcome !== 'SUCCESS');
      const total = (field: 'promptTokens' | 'completionTokens' | 'totalTokens' | 'cachedTokens') => attempts.length && attempts.every(attempt => attempt[field] !== null)
        ? attempts.reduce((sum, attempt) => sum + attempt[field]!, 0) : null;
      const result = reviewerAiUsageResponseSchema.parse({ window: 'SGT_DAY', startedAt: startedAt.toISOString(), resetsAt: resetsAt.toISOString(),
        requests: requests.length, attempts: attempts.length, retries: attempts.filter(attempt => attempt.ordinal > 1).length,
        completedAttempts: completed.length, failedAttempts: failed.length,
        preflightRejections: requests.filter(item => item.outcome === 'REJECTED' && item.attempts.length === 0).length,
        failureRate: completed.length ? failed.length / completed.length : null,
        usage: { promptTokens: total('promptTokens'), completionTokens: total('completionTokens'), totalTokens: total('totalTokens'), cachedTokens: total('cachedTokens') },
        usageReportedAttempts: attempts.filter(attempt => [attempt.promptTokens, attempt.completionTokens, attempt.totalTokens, attempt.cachedTokens].some(value => value !== null)).length,
        applicationCache: 'DISABLED', providerSpendWindow: 'UTC; separate from application quota' });
      await tx.securityEvent.create({ data: { actorId: actor.accountId, target: 'own-ai-usage', action: 'AI_USAGE_VIEWED',
        outcome: 'success', correlationId: actor.correlationId } });
      return result;
    });
  }
}
