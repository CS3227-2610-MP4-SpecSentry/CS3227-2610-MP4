import { Inject, Injectable } from '@nestjs/common';
import { maintainerAiUsageResponseSchema } from '@specsentry/shared';
import { AI_CLOCK, type AiClock } from '../ai/contracts';
import { DatabaseService } from '../database/database.service';
import { businessTransaction, type BusinessActor } from '../identity/business-context';

@Injectable()
export class MaintainerAiUsageService {
  constructor(private readonly database: DatabaseService,
    @Inject(AI_CLOCK) private readonly clock: AiClock) {}

  usage(actor: BusinessActor) {
    return businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', 'project-ai-usage',
      'AI_MAINTAINER_USAGE', async tx => {
      const now = this.clock.now();
      const startedAt = new Date(Math.floor((now.getTime() + 28_800_000) / 86_400_000) * 86_400_000 - 28_800_000);
      const resetsAt = new Date(startedAt.getTime() + 86_400_000);
      // Project aggregates intentionally span every actor and feature. No row,
      // actor, target, prompt, context hash or model output leaves this service.
      const requestWindow = { requestedAt: { gte: startedAt, lt: resetsAt } };
      const attemptWindow = { dispatchedAt: { gte: startedAt, lt: resetsAt } };
      const [requests, preflightRejections, attempts, retries, completedAttempts, failedAttempts,
        usageReportedAttempts, usageAggregate] = await Promise.all([
        tx.aiRequest.count({ where: requestWindow }),
        tx.aiRequest.count({ where: { ...requestWindow, outcome: 'REJECTED', attempts: { none: {} } } }),
        tx.aiOutboundAttempt.count({ where: attemptWindow }),
        tx.aiOutboundAttempt.count({ where: { ...attemptWindow, ordinal: { gt: 1 } } }),
        tx.aiOutboundAttempt.count({ where: { ...attemptWindow,
          completedAt: { not: null }, outcome: { not: null } } }),
        tx.aiOutboundAttempt.count({ where: { ...attemptWindow,
          completedAt: { not: null }, outcome: { notIn: ['SUCCESS'] } } }),
        tx.aiOutboundAttempt.count({ where: { ...attemptWindow, OR: [
          { promptTokens: { not: null } }, { completionTokens: { not: null } },
          { totalTokens: { not: null } }, { cachedTokens: { not: null } },
        ] } }),
        tx.aiOutboundAttempt.aggregate({ where: attemptWindow,
          _count: { promptTokens: true, completionTokens: true, totalTokens: true, cachedTokens: true },
          _sum: { promptTokens: true, completionTokens: true, totalTokens: true, cachedTokens: true } }),
      ]);
      const total = (field: 'promptTokens' | 'completionTokens' | 'totalTokens' | 'cachedTokens') =>
        attempts > 0 && usageAggregate._count[field] === attempts ? usageAggregate._sum[field] : null;
      const result = maintainerAiUsageResponseSchema.parse({ window: 'SGT_DAY',
        startedAt: startedAt.toISOString(), resetsAt: resetsAt.toISOString(),
        requests, attempts, retries, completedAttempts, failedAttempts, preflightRejections,
        failureRate: completedAttempts ? failedAttempts / completedAttempts : null,
        usage: { promptTokens: total('promptTokens'), completionTokens: total('completionTokens'),
          totalTokens: total('totalTokens'), cachedTokens: total('cachedTokens') },
        usageReportedAttempts,
        applicationCache: 'DISABLED', providerSpendWindow: 'UTC; separate from application quota' });
      await tx.securityEvent.create({ data: { actorId: actor.accountId, target: 'project-ai-usage',
        action: 'AI_USAGE_VIEWED', outcome: 'success', correlationId: actor.correlationId } });
      return result;
    });
  }
}
