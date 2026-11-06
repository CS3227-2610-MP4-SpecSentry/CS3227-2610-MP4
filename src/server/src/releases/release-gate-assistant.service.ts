import { ConflictException, ForbiddenException, HttpException, Inject, Injectable } from '@nestjs/common';
import { maintainerGateResponseSchema, type MaintainerGateRequest, type MaintainerGateResponse } from '@specsentry/shared';
import { AI_CLOCK, MAINTAINER_GATEWAY, type AiClock, type AiDeadline, type MaintainerGateCode,
  type MaintainerGateContext, type MaintainerGateGateway } from '../ai/contracts';
import { AiRequestDeadline } from '../ai/deadline';
import { PrismaAiAccounting, SafeAiError } from '../ai/gateway';
import { DatabaseService } from '../database/database.service';
import type { Prisma } from '../generated/prisma/client';
import { businessTransaction, lockBusinessContext, type BusinessActor } from '../identity/business-context';
import { lockReleaseCandidates } from './release-locks';

type Tx = Prisma.TransactionClient;
type LockedCandidate = Awaited<ReturnType<typeof lockReleaseCandidates>>[number];
const blockerOrder: readonly MaintainerGateCode[] = [
  'EMPTY', 'VERSION', 'ROLLBACK', 'SMOKE', 'REVISION', 'APPROVAL', 'COVERAGE', 'FINDING',
];
const memberKey = (proposalId: string, revisionId: string, assignmentId: string) =>
  JSON.stringify([proposalId, revisionId, assignmentId]);
const criterionKey = (proposalId: string, revisionId: string, assignmentId: string, criterionId: string) =>
  JSON.stringify([proposalId, revisionId, assignmentId, criterionId]);

@Injectable()
export class ReleaseGateAssistantService {
  private readonly accounting: PrismaAiAccounting;

  constructor(private readonly database: DatabaseService,
    @Inject(MAINTAINER_GATEWAY) private readonly gateway: MaintainerGateGateway,
    @Inject(AI_CLOCK) private readonly clock: AiClock) {
    this.accounting = new PrismaAiAccounting(database.client, clock);
  }

  deadline() { return new AiRequestDeadline(this.clock); }

  private async authorized<T>(actor: BusinessActor, id: string, deadline: AiDeadline,
    work: (tx: Tx) => Promise<T>): Promise<T> {
    try {
      const result = await businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', id,
        'AI_MAINTAINER', work, [], { deadline });
      deadline.assertRemaining();
      return result;
    } catch (error) {
      deadline.assertRemaining();
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      const meta = error && typeof error === 'object' && 'meta' in error
        ? error.meta as { code?: string } : undefined;
      if (code === 'P2028' || code === 'P2024' || meta?.code === '55P03' || meta?.code === '57014')
        throw new SafeAiError('DEADLINE');
      throw error;
    }
  }

  private async access(tx: Tx, actor: BusinessActor, id: string): Promise<LockedCandidate> {
    const [candidate] = await lockReleaseCandidates(tx, [id]);
    if (candidate!.createdById !== actor.accountId) throw new ForbiddenException();
    return candidate!;
  }

  private exactOpen(candidate: LockedCandidate, input: MaintainerGateRequest | MaintainerGateContext['scope'],
    candidateItemCount?: number): void {
    if (candidate.status !== 'OPEN' || candidate.version !== input.expectedVersion ||
        candidate.contentVersion !== input.expectedContentVersion ||
        candidateItemCount !== undefined && 'candidateItemCount' in input && candidateItemCount !== input.candidateItemCount)
      throw new ConflictException();
  }

  private async itemCount(tx: Tx, id: string): Promise<number> {
    return tx.releaseCandidateMember.count({ where: { candidateId: id, status: 'ATTACHED' } });
  }

  private async context(tx: Tx, id: string, input: MaintainerGateRequest,
    locked: LockedCandidate): Promise<MaintainerGateContext> {
    this.exactOpen(locked, input);
    const candidate = await tx.releaseCandidate.findUniqueOrThrow({ where: { id }, select: {
      semanticVersion: true, rollbackPlan: true, dependencyNotes: true,
    } });
    const members = await tx.releaseCandidateMember.findMany({
      where: { candidateId: id, status: 'ATTACHED' }, orderBy: [{ proposalId: 'asc' }, { id: 'asc' }],
      select: {
        id: true, proposalId: true, revisionId: true, assignmentId: true, approvalId: true,
        proposal: { select: { title: true, state: true, currentRevisionId: true,
          currentAssignmentId: true, releaseAttachmentRef: true } },
        revision: { select: { number: true, summary: true } },
        approval: { select: { decision: true } },
      },
    });
    if (members.length > 1_000) throw new SafeAiError('INPUT_LIMIT');

    const revisionIds = [...new Set(members.map(member => member.revisionId))];
    const requiredCriteria = revisionIds.length ? await tx.acceptanceCriterion.findMany({
      where: { revisionId: { in: revisionIds }, required: true }, select: { id: true, revisionId: true },
    }) : [];
    const memberCoordinates = members.map(member => ({ proposalId: member.proposalId,
      revisionId: member.revisionId, assignmentId: member.assignmentId }));
    const coverage = memberCoordinates.length ? await tx.coverageAssessment.findMany({
      where: { OR: memberCoordinates }, orderBy: [{ mutationVersion: 'desc' }, { id: 'desc' }],
      select: { proposalId: true, revisionId: true, assignmentId: true, criterionId: true, status: true },
    }) : [];
    const findings = memberCoordinates.length ? await tx.reviewFinding.findMany({
      where: { OR: memberCoordinates }, select: { proposalId: true, revisionId: true, assignmentId: true,
        severity: true, events: { orderBy: [{ mutationVersion: 'desc' }, { id: 'desc' }], take: 1,
          select: { status: true, severity: true } } },
    }) : [];
    const invalidations = members.length ? await tx.approvalInvalidation.findMany({
      where: { decisionId: { in: members.map(member => member.approvalId) } }, select: { decisionId: true },
    }) : [];

    const invalidated = new Set(invalidations.map(row => row.decisionId));
    const latestCoverage = new Map<string, (typeof coverage)[number]>();
    for (const row of coverage) {
      const key = criterionKey(row.proposalId, row.revisionId, row.assignmentId, row.criterionId);
      if (!latestCoverage.has(key)) latestCoverage.set(key, row);
    }
    const requiredByRevision = new Map<string, string[]>();
    for (const criterion of requiredCriteria) {
      const current = requiredByRevision.get(criterion.revisionId) ?? [];
      current.push(criterion.id); requiredByRevision.set(criterion.revisionId, current);
    }
    const findingsByMember = new Map<string, (typeof findings)>();
    for (const finding of findings) {
      const key = memberKey(finding.proposalId, finding.revisionId, finding.assignmentId);
      const current = findingsByMember.get(key) ?? [];
      current.push(finding); findingsByMember.set(key, current);
    }

    const blockerCodes = new Set<MaintainerGateCode>();
    if (!members.length) blockerCodes.add('EMPTY');
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(candidate.semanticVersion)) blockerCodes.add('VERSION');
    if (!candidate.rollbackPlan.trim()) blockerCodes.add('ROLLBACK');
    const smoke = await tx.releaseSmokeTest.findFirst({ where: { candidateId: id,
      testedContentVersion: locked.contentVersion }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: { outcome: true } });
    if (smoke?.outcome !== 'PASS') blockerCodes.add('SMOKE');

    const items = members.map(member => {
      const currentRevision = member.proposal.state === 'IN_RELEASE' &&
        member.proposal.currentRevisionId === member.revisionId &&
        member.proposal.currentAssignmentId === member.assignmentId &&
        member.proposal.releaseAttachmentRef === id;
      const approval = member.approval.decision === 'APPROVE' && !invalidated.has(member.approvalId);
      const requiredCoverage = (requiredByRevision.get(member.revisionId) ?? []).every(criterionId =>
        latestCoverage.get(criterionKey(member.proposalId, member.revisionId, member.assignmentId, criterionId))?.status === 'COVERED');
      const highCriticalFindings = !(findingsByMember.get(memberKey(member.proposalId, member.revisionId,
        member.assignmentId)) ?? []).some(finding => {
        const latest = finding.events[0];
        return (latest?.status ?? 'OPEN') === 'OPEN' &&
          ['HIGH', 'CRITICAL'].includes(latest?.severity ?? finding.severity);
      });
      if (!currentRevision) blockerCodes.add('REVISION');
      if (!approval) blockerCodes.add('APPROVAL');
      if (!requiredCoverage) blockerCodes.add('COVERAGE');
      if (!highCriticalFindings) blockerCodes.add('FINDING');
      return { itemId: member.id, title: member.proposal.title, revisionNumber: member.revision.number,
        submittedSummary: member.revision.summary, gateStatuses: {
          currentRevision: currentRevision ? 'PASS' as const : 'FAIL' as const,
          approval: approval ? 'PASS' as const : 'FAIL' as const,
          requiredCoverage: requiredCoverage ? 'PASS' as const : 'FAIL' as const,
          highCriticalFindings: highCriticalFindings ? 'PASS' as const : 'FAIL' as const,
        } };
    });
    return { scope: { candidateId: id, expectedVersion: input.expectedVersion,
      expectedContentVersion: input.expectedContentVersion, candidateItemCount: items.length },
    candidate: { versionLabel: candidate.semanticVersion, rollbackNote: candidate.rollbackPlan,
      dependencyNotes: candidate.dependencyNotes,
      blockerCodes: blockerOrder.filter(code => blockerCodes.has(code)) }, items };
  }

  async rejected(actor: BusinessActor, id: string, deadline: AiDeadline, error: unknown, requestId?: string) {
    const errorClass = error instanceof SafeAiError ? error.errorClass
      : error instanceof HttpException && error.getStatus() === 409 ? 'SCOPE_CHANGED'
      : error instanceof HttpException && [401, 403, 404].includes(error.getStatus()) ? 'ACCESS_LOST' : 'INTERNAL';
    const cleanup = new AiRequestDeadline(this.clock, Math.max(1, Math.min(100, deadline.remainingMs() || 100)));
    try {
      await this.accounting.bounded(cleanup, async tx => {
        if (requestId) {
          const stale = errorClass === 'SCOPE_CHANGED' &&
            await tx.aiOutboundAttempt.count({ where: { requestId } }) > 0;
          await tx.aiRequest.updateMany({ where: { id: requestId, actorId: actor.accountId,
            candidateId: id, feature: 'MAINTAINER' }, data: {
            outcome: stale ? 'STALE' : errorClass === 'DEADLINE' || errorClass === 'CANCELLED'
              ? 'CANCELLED' : 'REJECTED', errorClass, completedAt: this.clock.now(),
          } });
        }
        await tx.securityEvent.create({ data: { actorId: actor.accountId, target: id,
          action: 'AI_MAINTAINER_REJECTED', outcome: 'rejected', correlationId: actor.correlationId } });
      });
    } catch { /* Bounded operational cleanup cannot replace the primary denial. */ }
    finally { cleanup.close(); }
  }

  async readiness(actor: BusinessActor, id: string, input: MaintainerGateRequest,
    deadline: AiDeadline): Promise<MaintainerGateResponse> {
    let requestId: string | undefined; let attemptDenial: unknown;
    try {
      const context = await this.authorized(actor, id, deadline, async tx => {
        const locked = await this.access(tx, actor, id);
        return this.context(tx, id, input, locked);
      });
      const generated = await this.gateway.analyze(context, { actorId: actor.accountId, deadline,
        beforeAttempt: async tx => {
          try {
            const authorization = await lockBusinessContext(tx, actor, 'RELEASE_MAINTAINER');
            const locked = await this.access(tx, actor, id);
            this.exactOpen(locked, context.scope, await this.itemCount(tx, id));
            authorization.checkExpiry(); deadline.assertRemaining();
          } catch (error) {
            if (!(error instanceof HttpException) && !(error instanceof SafeAiError)) throw error;
            attemptDenial = error;
            throw error instanceof SafeAiError ? error
              : new SafeAiError(error.getStatus() === 409 ? 'SCOPE_CHANGED' : 'ACCESS_LOST');
          }
        } });
      requestId = generated.metadata.requestId;
      return await this.authorized(actor, id, deadline, async tx => {
        const locked = await this.access(tx, actor, id);
        const count = await this.itemCount(tx, id);
        const stale = locked.status !== 'OPEN' || locked.version !== context.scope.expectedVersion ||
          locked.contentVersion !== context.scope.expectedContentVersion || count !== context.scope.candidateItemCount;
        const response = maintainerGateResponseSchema.parse({ analyzedScope: context.scope,
          result: generated.result, ...(stale
            ? { status: 'STALE', staleReason: 'CANDIDATE_CHANGED' }
            : { status: 'CURRENT', staleReason: null }) });
        if (stale) await tx.aiRequest.updateMany({ where: { id: generated.metadata.requestId,
          actorId: actor.accountId, candidateId: id }, data: { outcome: 'STALE' } });
        deadline.assertRemaining();
        return response;
      });
    } catch (error) {
      const denial = attemptDenial ?? error;
      requestId ??= error instanceof SafeAiError ? error.requestId : undefined;
      await this.rejected(actor, id, deadline, denial, requestId);
      throw denial;
    }
  }
}
