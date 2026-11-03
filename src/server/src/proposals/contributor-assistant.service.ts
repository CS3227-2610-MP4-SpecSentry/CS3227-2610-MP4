import { ConflictException, ForbiddenException, HttpException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { contributorAiUsageResponseSchema, contributorDraftResponseSchema, workingContentSchema,
  type ContributorDraftRequest } from '@specsentry/shared';
import { AI_CLOCK, CONTRIBUTOR_DRAFT_GATEWAY, type AiClock, type AiDeadline, type ContributorDraftContext,
  type ContributorDraftGateway } from '../ai/contracts';
import { AiRequestDeadline } from '../ai/deadline';
import { PrismaAiAccounting, SafeAiError } from '../ai/gateway';
import { DatabaseService } from '../database/database.service';
import { businessTransaction, lockBusinessContext, type BusinessActor } from '../identity/business-context';
import type { ReviewTransaction } from '../reviews/reviewer-context';
import { ProposalsService } from './proposals.service';

@Injectable()
export class ContributorAssistantService {
  private readonly accounting: PrismaAiAccounting;
  constructor(private readonly database: DatabaseService, private readonly proposals: ProposalsService,
    @Inject(CONTRIBUTOR_DRAFT_GATEWAY) private readonly gateway: ContributorDraftGateway,
    @Inject(AI_CLOCK) private readonly clock: AiClock) {
    this.accounting = new PrismaAiAccounting(database.client, clock);
  }
  deadline() { return new AiRequestDeadline(this.clock); }

  private async authorized<T>(actor: BusinessActor, id: string, deadline: AiDeadline,
    action: (tx: ReviewTransaction) => Promise<T>): Promise<T> {
    try {
      const result = await businessTransaction(this.database, actor, 'CONTRIBUTOR', id, 'AI_CONTRIBUTOR', action, [], { deadline });
      deadline.assertRemaining(); return result;
    } catch (error) {
      deadline.assertRemaining();
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      const meta = error && typeof error === 'object' && 'meta' in error ? error.meta as { code?: string } : undefined;
      if (code === 'P2028' || code === 'P2024' || meta?.code === '55P03' || meta?.code === '57014') throw new SafeAiError('DEADLINE');
      throw error;
    }
  }
  private async current(tx: ReviewTransaction, actor: BusinessActor, id: string, input: ContributorDraftRequest) {
    const root = await this.proposals.lockRoot(tx, id);
    if (root.ownerId !== actor.accountId) throw new ForbiddenException();
    if (!['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED'].includes(root.state) || root.releaseAttachmentRef !== null ||
      root.version !== input.expectedVersion) throw new ConflictException();
    const working = await tx.workingRevision.findFirst({ where: { proposalId: id, id: input.workingRevisionId }, select: { id: true } });
    if (!working) throw new NotFoundException();
    return working;
  }

  async rejected(actor: BusinessActor, id: string, deadline: AiDeadline, error: unknown, requestId?: string) {
    const errorClass = error instanceof SafeAiError ? error.errorClass : error instanceof HttpException && error.getStatus() === 409 ? 'SCOPE_CHANGED'
      : error instanceof HttpException && [401, 403, 404].includes(error.getStatus()) ? 'ACCESS_LOST' : 'INTERNAL';
    const cleanup = new AiRequestDeadline(this.clock, Math.max(1, Math.min(100, deadline.remainingMs() || 100)));
    try {
      await this.accounting.bounded(cleanup, async tx => {
        if (requestId && ['SCOPE_CHANGED', 'ACCESS_LOST', 'DEADLINE', 'CANCELLED'].includes(errorClass)) {
          const stale = errorClass === 'SCOPE_CHANGED' && await tx.aiOutboundAttempt.count({ where: { requestId } }) > 0;
          await tx.aiRequest.updateMany({ where: { id: requestId, actorId: actor.accountId, proposalId: id, feature: 'CONTRIBUTOR' },
            data: { outcome: stale ? 'STALE' : errorClass === 'DEADLINE' || errorClass === 'CANCELLED' ? 'CANCELLED' : 'REJECTED',
              errorClass, completedAt: this.clock.now() } });
        }
        await tx.securityEvent.create({ data: { actorId: actor.accountId, target: id, action: 'AI_CONTRIBUTOR_REJECTED',
          outcome: 'rejected', correlationId: actor.correlationId } });
      });
    } catch { /* Bounded operational cleanup cannot replace the primary denial. */ }
    finally { cleanup.close(); }
  }

  async suggest(actor: BusinessActor, id: string, input: ContributorDraftRequest, deadline: AiDeadline) {
    let requestId: string | undefined; let attemptDenial: unknown;
    try {
      const context = await this.authorized(actor, id, deadline, async tx => {
        await this.current(tx, actor, id, input);
        const saved = await tx.workingRevision.findUniqueOrThrow({ where: { id: input.workingRevisionId }, select: { content: true } });
        const content = workingContentSchema.parse(saved.content);
        return { scope: { proposalId: id, ...input }, draft: { title: content.title, summary: content.summary,
          problem: content.problem, constraints: content.constraints, expectedBehavior: content.expectedBehavior,
          criteria: content.criteria.map(c => ({ statement: c.statement, required: c.required })) } } satisfies ContributorDraftContext;
      });
      const generated = await this.gateway.analyze(context, { actorId: actor.accountId, deadline, beforeAttempt: async tx => {
        try {
          const authorization = await lockBusinessContext(tx, actor, 'CONTRIBUTOR');
          await this.current(tx, actor, id, input);
          authorization.checkExpiry(); deadline.assertRemaining();
        }
        catch (error) {
          if (!(error instanceof HttpException) && !(error instanceof SafeAiError)) throw error;
          attemptDenial = error;
          throw error instanceof SafeAiError ? error : new SafeAiError(error.getStatus() === 409 ? 'SCOPE_CHANGED' : 'ACCESS_LOST');
        }
      } });
      requestId = generated.metadata.requestId;
      return await this.authorized(actor, id, deadline, async tx => {
        await this.current(tx, actor, id, input);
        const response = contributorDraftResponseSchema.parse({ analyzedScope: context.scope, result: generated.result });
        deadline.assertRemaining(); return response;
      });
    } catch (error) {
      const denial = attemptDenial ?? error;
      requestId ??= error instanceof SafeAiError ? error.requestId : undefined;
      await this.rejected(actor, id, deadline, denial, requestId);
      throw denial;
    }
  }

  usage(actor: BusinessActor) {
    return businessTransaction(this.database, actor, 'CONTRIBUTOR', 'own-ai-usage', 'AI_CONTRIBUTOR_USAGE', async tx => {
      const now = this.clock.now();
      const startedAt = new Date(Math.floor((now.getTime() + 28_800_000) / 86_400_000) * 86_400_000 - 28_800_000);
      const resetsAt = new Date(startedAt.getTime() + 86_400_000);
      // Attempt windows are independent of request admission, including retries across midnight.
      const requests = await tx.aiRequest.findMany({ where: { actorId: actor.accountId, requestedAt: { gte: startedAt, lt: resetsAt } },
        select: { outcome: true, attempts: { select: { id: true }, take: 1 } } });
      const attempts = await tx.aiOutboundAttempt.findMany({ where: { actorId: actor.accountId, dispatchedAt: { gte: startedAt, lt: resetsAt } },
        select: { ordinal: true, completedAt: true, outcome: true, promptTokens: true, completionTokens: true, totalTokens: true, cachedTokens: true } });
      const completed = attempts.filter(attempt => attempt.completedAt !== null && attempt.outcome !== null);
      const failed = completed.filter(attempt => attempt.outcome !== 'SUCCESS');
      const total = (field: 'promptTokens' | 'completionTokens' | 'totalTokens' | 'cachedTokens') => attempts.length && attempts.every(attempt => attempt[field] !== null)
        ? attempts.reduce((sum, attempt) => sum + attempt[field]!, 0) : null;
      const result = contributorAiUsageResponseSchema.parse({ window: 'SGT_DAY', startedAt: startedAt.toISOString(), resetsAt: resetsAt.toISOString(),
        requests: requests.length, attempts: attempts.length, retries: attempts.filter(attempt => attempt.ordinal > 1).length,
        completedAttempts: completed.length, failedAttempts: failed.length,
        preflightRejections: requests.filter(item => item.attempts.length === 0 && item.outcome === 'REJECTED').length,
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
