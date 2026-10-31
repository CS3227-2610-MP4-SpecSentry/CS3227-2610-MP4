import { ConflictException, ForbiddenException, HttpException, Inject, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { AI_LIMITS, aiAuditResponseSchema, patchRiskResponseSchema, type PatchRiskRequest, type PatchRiskResponse } from '@specsentry/shared';
import { AI_CLOCK, PATCH_RISK_GATEWAY, type AiClock, type AiDeadline, type PatchRiskContext, type PatchRiskGateway, type PatchRiskScope } from '../ai/contracts';
import { SafeAiError } from '../ai/gateway';
import { DatabaseService } from '../database/database.service';
import { businessTransaction } from '../identity/business-context';
import { ProposalsService } from '../proposals/proposals.service';
import type { ReviewerActor, ReviewTransaction } from './reviewer-context';

// Created at authenticated handler admission, before validation or any DB work.
export class PatchRiskDeadline implements AiDeadline {
  private readonly controller = new AbortController();
  private readonly end: number;
  private readonly timer: ReturnType<typeof setTimeout>;
  constructor(private readonly clock: AiClock, milliseconds: number = AI_LIMITS.deadlineMs) {
    this.end = clock.monotonicMs() + milliseconds;
    this.timer = setTimeout(() => this.controller.abort(), milliseconds);
    this.timer.unref?.();
  }
  get signal() { return this.controller.signal; }
  remainingMs() { return Math.max(0, this.end - this.clock.monotonicMs()); }
  assertRemaining() {
    if (this.signal.aborted || this.remainingMs() <= 0) {
      this.controller.abort(); throw new SafeAiError('DEADLINE');
    }
  }
  close() { clearTimeout(this.timer); this.controller.abort(); }
}

@Injectable()
export class PatchRiskService {
  constructor(private readonly database: DatabaseService, private readonly proposals: ProposalsService,
    @Inject(PATCH_RISK_GATEWAY) private readonly gateway: PatchRiskGateway,
    @Inject(AI_CLOCK) private readonly clock: AiClock) {}

  deadline() { return new PatchRiskDeadline(this.clock); }

  async rejected(actor: ReviewerActor, id: string, deadline: AiDeadline, error: unknown, requestId?: string): Promise<void> {
    const errorClass = error instanceof SafeAiError ? error.errorClass : error instanceof HttpException && error.getStatus() === 409 ? 'SCOPE_CHANGED' :
      error instanceof HttpException && [401,403,404].includes(error.getStatus()) ? 'ACCESS_LOST' : 'INTERNAL';
    // Failed-response cleanup is independent and bounded. It never permits a late
    // successful response or carries any request text into operational records.
    const milliseconds = Math.max(1, Math.min(100, Math.floor(deadline.remainingMs()) || 100));
    try {
      await this.database.client.$transaction(async tx => {
        await tx.$queryRaw`SELECT set_config('statement_timeout', ${String(milliseconds)}, true), set_config('lock_timeout', ${String(milliseconds)}, true)`;
        if (requestId) await tx.aiRequest.updateMany({ where: { id: requestId, actorId: actor.accountId, proposalId: id },
          data: { outcome: errorClass === 'DEADLINE' || errorClass === 'CANCELLED' ? 'CANCELLED' : 'REJECTED', errorClass, completedAt: this.clock.now() } });
        await tx.securityEvent.create({ data: { actorId: actor.accountId, action: 'AI_REVIEW_REJECTED', target: id,
          outcome: 'rejected', correlationId: actor.correlationId } });
      }, { maxWait: milliseconds, timeout: milliseconds });
    } catch { /* Bounded safe cleanup must not replace the primary denial. */ }
  }

  private async authorized<T>(actor: ReviewerActor, id: string, deadline: AiDeadline,
    work: (tx: ReviewTransaction) => Promise<T>): Promise<T> {
    try {
      const result = await businessTransaction(this.database, actor, 'REVIEWER', id, 'AI_REVIEW', work, [], { deadline });
      deadline.assertRemaining();
      return result;
    } catch (error) {
      deadline.assertRemaining();
      // PostgreSQL statement/lock cancellation and Prisma interactive transaction
      // timeout can precede the monotonic timer by a few milliseconds.
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      const meta = error && typeof error === 'object' && 'meta' in error ? error.meta as { code?: string } : undefined;
      if (code === 'P2028' || code === 'P2024' || meta?.code === '55P03' || meta?.code === '57014') throw new SafeAiError('DEADLINE');
      throw error;
    }
  }

  private async current(tx: ReviewTransaction, actor: ReviewerActor, id: string) {
    const root = await this.proposals.assignedRoot(tx, id, actor.accountId);
    if (!['IN_REVIEW', 'CHANGES_REQUESTED'].includes(root.state) || !root.currentRevisionId ||
      root.currentAssignment!.revisionId !== root.currentRevisionId) throw new ForbiddenException();
    return root;
  }

  private exact(root: Awaited<ReturnType<PatchRiskService['current']>>, scope: PatchRiskRequest | PatchRiskScope) {
    if (root.version !== scope.expectedVersion || root.currentRevisionId !== scope.revisionId ||
      root.currentAssignment!.id !== scope.assignmentId || root.currentAssignment!.version !== scope.expectedAssignmentVersion)
      throw new ConflictException();
  }

  async analyze(actor: ReviewerActor, id: string, input: PatchRiskRequest, deadline: AiDeadline): Promise<PatchRiskResponse> {
    let requestId: string | undefined;
    try {
    const context = await this.authorized(actor, id, deadline, async tx => {
      const root = await this.current(tx, actor, id);
      this.exact(root, input);
      // No protected submitted text is selected until all current access and
      // exact-coordinate checks have passed under the account/session/root locks.
      const revision = await tx.proposalRevision.findFirstOrThrow({ where: { id: input.revisionId, proposalId: id },
        select: { summary: true, problem: true, constraints: true, expectedBehavior: true, diffText: true,
          criteria: { orderBy: { id: 'asc' }, select: { id: true, stableKey: true, statement: true, required: true,
            evidenceLinks: { orderBy: { evidenceId: 'asc' }, select: { criterionId: true, evidenceId: true } } } },
          evidence: { orderBy: { id: 'asc' }, select: { id: true, text: true } } } });
      if (input.selectedCriterionIds.some(selected => !revision.criteria.some(c => c.id === selected))) throw new UnprocessableEntityException();
      const { criteria, ...fields } = revision;
      return { ...fields, criteria: criteria.map(({ id, stableKey, statement, required }) => ({ id, stableKey, statement, required })),
        criterionEvidenceLinks: criteria.flatMap(c => c.evidenceLinks), selectedCriterionIds: [...input.selectedCriterionIds],
        scope: { proposalId: id, revisionId: input.revisionId, assignmentId: input.assignmentId,
          expectedVersion: input.expectedVersion, expectedAssignmentVersion: input.expectedAssignmentVersion,
          accessGenerationId: root.currentAssignment!.accessGenerationId } } satisfies PatchRiskContext;
    });
    const generated = await this.gateway.analyze(context, { actorId: actor.accountId, deadline, beforeAttempt: async () => {
      await this.authorized(actor, id, deadline, async tx => {
        const root = await this.current(tx, actor, id);
        if (root.currentAssignment!.accessGenerationId !== context.scope.accessGenerationId) throw new ForbiddenException();
        this.exact(root, context.scope);
      });
    } });
    requestId = generated.metadata.requestId;
    return await this.authorized(actor, id, deadline, async tx => {
      const root = await this.current(tx, actor, id);
      if (root.currentAssignment!.accessGenerationId !== context.scope.accessGenerationId) throw new ForbiddenException();
      const newRevision = root.currentRevisionId !== context.scope.revisionId;
      const changed = root.version !== context.scope.expectedVersion || root.currentAssignment!.id !== context.scope.assignmentId ||
        root.currentAssignment!.version !== context.scope.expectedAssignmentVersion;
      const staleReason = newRevision ? 'NEW_REVISION' as const : changed ? 'REVIEW_CHANGED' as const : null;
      const { accessGenerationId: _generation, ...analyzedScope } = context.scope;
      void _generation;
      const response = patchRiskResponseSchema.parse({ analyzedScope, selectedCriterionIds: context.selectedCriterionIds,
        result: generated.result, ...(staleReason ? { status: 'STALE', staleReason } : { status: 'CURRENT', staleReason: null }) });
      if (staleReason) await tx.aiRequest.updateMany({ where: { id: generated.metadata.requestId, actorId: actor.accountId }, data: { outcome: 'STALE' } });
      deadline.assertRemaining();
      return response;
    });
    } catch (error) {
      await this.rejected(actor, id, deadline, error, requestId);
      throw error;
    }
  }

  audit(actor: ReviewerActor, id: string) {
    return businessTransaction(this.database, actor, 'REVIEWER', id, 'AI_AUDIT', async tx => {
      await this.proposals.assignedRoot(tx, id, actor.accountId);
      const rows = await tx.aiRequest.findMany({ where: { actorId: actor.accountId, proposalId: id, retainedUntil: { gt: new Date() } },
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }], take: AI_LIMITS.auditPage,
        select: { id: true, proposalId: true, revisionId: true, assignmentId: true, expectedVersion: true, expectedAssignmentVersion: true,
          requestedAt: true, completedAt: true, templateVersion: true, contextHash: true, selectedCriterionCount: true,
          outcome: true, errorClass: true, latencyMs: true,
          attempts: { orderBy: { ordinal: 'asc' }, select: { id: true, ordinal: true, dispatchedAt: true, completedAt: true,
            outcome: true, errorClass: true, promptTokens: true, completionTokens: true, totalTokens: true, cachedTokens: true } } } });
      return aiAuditResponseSchema.parse({ items: rows.map(row => ({ requestId: row.id,
        analyzedScope: { proposalId: row.proposalId, revisionId: row.revisionId, assignmentId: row.assignmentId,
          expectedVersion: row.expectedVersion, expectedAssignmentVersion: row.expectedAssignmentVersion },
        requestedAt: row.requestedAt.toISOString(), completedAt: row.completedAt?.toISOString() ?? null,
        templateVersion: row.templateVersion, contextHash: row.contextHash, selectedCriterionCount: row.selectedCriterionCount,
        outcome: row.outcome, errorClass: row.errorClass, latencyMs: row.latencyMs,
        attempts: row.attempts.map(a => ({ attemptId: a.id, ordinal: a.ordinal, dispatchedAt: a.dispatchedAt.toISOString(),
          completedAt: a.completedAt?.toISOString() ?? null, outcome: a.outcome, errorClass: a.errorClass,
          usage: { promptTokens: a.promptTokens, completionTokens: a.completionTokens, totalTokens: a.totalTokens, cachedTokens: a.cachedTokens } })) })) });
    });
  }
}
