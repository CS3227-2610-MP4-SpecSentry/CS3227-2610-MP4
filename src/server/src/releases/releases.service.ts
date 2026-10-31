import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { releaseCandidateCommandResponseSchema, releaseCandidateDetailResponseSchema,
  releasePublicationResponseSchema, reviewerReleaseContextSchema,
  type AddReleaseMemberRequest, type AppendReleaseSmokeTestRequest,
  type CreateReleaseCandidateRequest, type PublishReleaseCandidateRequest,
  type RemoveReleaseMemberRequest, type UpdateReleaseCandidateRequest } from '@specsentry/shared';
import { Prisma, type ReleaseCandidate } from '../generated/prisma/client';
import { ActivityService } from '../activity/activity.service';
import { DatabaseService } from '../database/database.service';
import { businessTransaction, type BusinessActor } from '../identity/business-context';
import { nextVersion } from '../reviews/reviewer-context';
import { lockCandidateMemberProposals, lockReleaseCandidates, lockReleaseProposals, RELEASE_PROJECT_KEY } from './release-locks';

type Tx = Prisma.TransactionClient;
type Blocker = { code: 'EMPTY' | 'VERSION' | 'ROLLBACK' | 'SMOKE' | 'REVISION' | 'APPROVAL' | 'COVERAGE' | 'FINDING'; proposalId?: string };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class ReleasesService {
  constructor(private readonly database: DatabaseService, private readonly activity: ActivityService) {}

  private async locked(tx: Tx, id: string) {
    await lockReleaseCandidates(tx, [id]);
    return tx.releaseCandidate.findUniqueOrThrow({ where: { id } });
  }
  private owner(candidate: ReleaseCandidate, actor: BusinessActor) {
    if (candidate.createdById !== actor.accountId) throw new ForbiddenException();
    if (candidate.status !== 'OPEN') throw new ConflictException('Candidate is released');
  }
  private command(candidate: ReleaseCandidate) {
    return releaseCandidateCommandResponseSchema.parse({ candidateId: candidate.id, version: candidate.version,
      contentVersion: candidate.contentVersion, status: candidate.status });
  }
  private async activeMembers(tx: Tx, id: string) {
    return tx.releaseCandidateMember.findMany({ where: { candidateId: id, status: 'ATTACHED' },
      orderBy: [{ proposalId: 'asc' }, { id: 'asc' }] });
  }
  private async blockers(tx: Tx, candidate: ReleaseCandidate) {
    const members = await this.activeMembers(tx, candidate.id);
    const blockers: Blocker[] = [];
    if (!members.length) blockers.push({ code: 'EMPTY' });
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(candidate.semanticVersion)) blockers.push({ code: 'VERSION' });
    if (!candidate.rollbackPlan.trim()) blockers.push({ code: 'ROLLBACK' });
    const smoke = await tx.releaseSmokeTest.findFirst({ where: { candidateId: candidate.id,
      testedContentVersion: candidate.contentVersion }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { outcome: true } });
    if (smoke?.outcome !== 'PASS') blockers.push({ code: 'SMOKE' });
    for (const member of members) {
      const proposal = await tx.changeProposal.findUniqueOrThrow({ where: { id: member.proposalId },
        select: { state: true, currentRevisionId: true, currentAssignmentId: true, releaseAttachmentRef: true } });
      if (proposal.state !== 'IN_RELEASE' || proposal.currentRevisionId !== member.revisionId ||
          proposal.currentAssignmentId !== member.assignmentId || proposal.releaseAttachmentRef !== candidate.id)
        blockers.push({ code: 'REVISION', proposalId: member.proposalId });
      const approval = await tx.reviewDecision.findFirst({ where: { id: member.approvalId, proposalId: member.proposalId,
        revisionId: member.revisionId, assignmentId: member.assignmentId, decision: 'APPROVE' }, select: { id: true } });
      const invalidation = await tx.approvalInvalidation.findUnique({ where: { decisionId: member.approvalId }, select: { id: true } });
      if (!approval || invalidation) blockers.push({ code: 'APPROVAL', proposalId: member.proposalId });
      const criteria = await tx.acceptanceCriterion.findMany({ where: { revisionId: member.revisionId, required: true }, select: { id: true } });
      for (const criterion of criteria) {
        const latest = await tx.coverageAssessment.findFirst({ where: { proposalId: member.proposalId,
          revisionId: member.revisionId, assignmentId: member.assignmentId, criterionId: criterion.id },
          orderBy: [{ mutationVersion: 'desc' }, { id: 'desc' }], select: { status: true } });
        if (!latest || latest.status !== 'COVERED') {
          blockers.push({ code: 'COVERAGE', proposalId: member.proposalId }); break;
        }
      }
      const findings = await tx.reviewFinding.findMany({ where: { proposalId: member.proposalId,
        revisionId: member.revisionId, assignmentId: member.assignmentId }, select: { id: true, severity: true } });
      for (const finding of findings) {
        const latest = await tx.findingEvent.findFirst({ where: { findingId: finding.id },
          orderBy: [{ mutationVersion: 'desc' }, { id: 'desc' }], select: { status: true, severity: true } });
        if ((latest?.status ?? 'OPEN') === 'OPEN' && ['HIGH', 'CRITICAL'].includes(latest?.severity ?? finding.severity)) {
          blockers.push({ code: 'FINDING', proposalId: member.proposalId }); break;
        }
      }
    }
    return blockers;
  }

  create(actor: BusinessActor, body: CreateReleaseCandidateRequest) {
    return businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', 'release-candidate', 'RELEASE_CREATE', async tx => {
      const candidate = await tx.releaseCandidate.create({ data: { projectKey: RELEASE_PROJECT_KEY,
        semanticVersion: body.versionLabel, rollbackPlan: body.rollbackNote,
        dependencyNotes: body.dependencyNotes, createdById: actor.accountId } });
      return this.command(candidate);
    });
  }

  detail(actor: BusinessActor, id: string) {
    const role = actor.role === 'REVIEWER' ? 'REVIEWER' : 'RELEASE_MAINTAINER';
    return businessTransaction(this.database, actor, role, id, 'RELEASE_DETAIL', async tx => {
      const candidate = await this.locked(tx, id);
      if (role === 'REVIEWER') {
        const own = await tx.releaseCandidateMember.findFirst({ where: { candidateId: id, status: 'ATTACHED',
          assignment: { reviewerId: actor.accountId, status: 'ACTIVE' } }, select: { approvalId: true } });
        if (!own) throw new ForbiddenException();
        const invalidation = await tx.approvalInvalidation.findUnique({ where: { decisionId: own.approvalId }, select: { id: true } });
        return reviewerReleaseContextSchema.parse({ candidateId: id, candidateVersion: candidate.version,
          ownInvalidApprovalBlocker: !!invalidation });
      }
      const members = await tx.releaseCandidateMember.findMany({ where: { candidateId: id }, orderBy: { attachedAt: 'asc' } });
      const smokeTests = await tx.releaseSmokeTest.findMany({ where: { candidateId: id }, orderBy: { createdAt: 'asc' } });
      const blockers = await this.blockers(tx, candidate);
      return releaseCandidateDetailResponseSchema.parse({ id, projectKey: candidate.projectKey,
        createdById: candidate.createdById, status: candidate.status, versionLabel: candidate.semanticVersion,
        rollbackNote: candidate.rollbackPlan, dependencyNotes: candidate.dependencyNotes,
        version: candidate.version, contentVersion: candidate.contentVersion,
        members: members.map(m => ({ id: m.id, proposalId: m.proposalId, revisionId: m.revisionId,
          assignmentId: m.assignmentId, approvalId: m.approvalId, status: m.status,
          attachedAt: m.attachedAt.toISOString(), removedAt: m.removedAt?.toISOString() ?? null })),
        smokeTests: smokeTests.map(s => ({ id: s.id, testedContentVersion: s.testedContentVersion,
          outcome: s.outcome, procedure: s.procedure, results: s.results, actorId: s.actorId,
          createdAt: s.createdAt.toISOString() })), blockers, publishedAt: candidate.publishedAt?.toISOString() ?? null });
    });
  }

  edit(actor: BusinessActor, id: string, body: UpdateReleaseCandidateRequest) {
    return businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', id, 'RELEASE_EDIT', async tx => {
      const candidate = await this.locked(tx, id); this.owner(candidate, actor);
      if (candidate.version !== body.expectedVersion) throw new ConflictException();
      const updated = await tx.releaseCandidate.update({ where: { id }, data: { semanticVersion: body.versionLabel,
        rollbackPlan: body.rollbackNote, dependencyNotes: body.dependencyNotes, version: nextVersion(candidate.version) } });
      return this.command(updated);
    });
  }

  smoke(actor: BusinessActor, id: string, body: AppendReleaseSmokeTestRequest) {
    return businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', id, 'RELEASE_SMOKE', async tx => {
      const candidate = await this.locked(tx, id); this.owner(candidate, actor);
      if (candidate.version !== body.expectedVersion || candidate.contentVersion !== body.testedContentVersion) throw new ConflictException();
      await tx.releaseSmokeTest.create({ data: { candidateId: id, actorId: actor.accountId,
        testedContentVersion: body.testedContentVersion, procedure: body.procedure,
        results: body.results, outcome: body.outcome } });
      return this.command(await tx.releaseCandidate.update({ where: { id }, data: { version: nextVersion(candidate.version) } }));
    });
  }

  async add(actor: BusinessActor, id: string, body: AddReleaseMemberRequest) {
    const pointer = await this.database.client.reviewAssignment.findUnique({ where: { id: body.assignmentId },
      select: { reviewerId: true } });
    if (!pointer) throw new NotFoundException();
    return businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', id, 'RELEASE_ADD', async (tx, accounts) => {
      const candidate = await this.locked(tx, id); this.owner(candidate, actor);
      await lockReleaseProposals(tx, [body.proposalId]);
      const proposal = await tx.changeProposal.findUniqueOrThrow({ where: { id: body.proposalId } });
      const assignment = await tx.reviewAssignment.findUnique({ where: { id: body.assignmentId } });
      if (candidate.version !== body.expectedCandidateVersion || candidate.contentVersion !== body.expectedContentVersion ||
          proposal.version !== body.expectedProposalVersion || proposal.state !== 'APPROVED' || proposal.releaseAttachmentRef ||
          proposal.currentRevisionId !== body.revisionId || proposal.currentAssignmentId !== body.assignmentId ||
          !assignment || assignment.proposalId !== body.proposalId || assignment.revisionId !== body.revisionId ||
          assignment.reviewerId !== pointer.reviewerId || assignment.status !== 'ACTIVE' ||
          assignment.version !== body.expectedAssignmentVersion ||
          !accounts.some(a => a.id === assignment.reviewerId && a.enabled && a.role === 'REVIEWER')) throw new ConflictException();
      const approval = await tx.reviewDecision.findFirst({ where: { proposalId: body.proposalId,
        revisionId: body.revisionId, assignmentId: body.assignmentId, decision: 'APPROVE' }, select: { id: true } });
      if (!approval || await tx.approvalInvalidation.findUnique({ where: { decisionId: approval.id } }) ||
          await tx.releaseCandidateMember.findFirst({ where: { proposalId: body.proposalId, status: 'ATTACHED' } }))
        throw new ConflictException();
      await tx.releaseCandidateMember.create({ data: { candidateId: id, proposalId: body.proposalId,
        revisionId: body.revisionId, assignmentId: body.assignmentId, approvalId: approval.id } });
      await tx.changeProposal.update({ where: { id: body.proposalId }, data: { state: 'IN_RELEASE',
        releaseAttachmentRef: id, version: nextVersion(proposal.version) } });
      await this.activity.append(tx, { proposalId: body.proposalId, revisionId: body.revisionId,
        assignmentId: body.assignmentId, candidateId: id, actorId: actor.accountId,
        action: 'RELEASE_ATTACHED', summary: 'Approved proposal attached to release candidate.' });
      return this.command(await tx.releaseCandidate.update({ where: { id }, data: {
        version: nextVersion(candidate.version), contentVersion: nextVersion(candidate.contentVersion) } }));
    }, [pointer.reviewerId]);
  }

  async remove(actor: BusinessActor, id: string, body: RemoveReleaseMemberRequest) {
    const pointer = await this.database.client.releaseCandidateMember.findUnique({ where: { id: body.memberId },
      select: { candidateId: true, proposalId: true, assignment: { select: { reviewerId: true } } } });
    if (!pointer || pointer.candidateId !== id) throw new NotFoundException();
    // The affected Reviewer account is always locked, including when already disabled.
    return businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', id, 'RELEASE_REMOVE', async (tx, accounts) => {
      const candidate = await this.locked(tx, id); this.owner(candidate, actor);
      await lockReleaseProposals(tx, [pointer.proposalId]);
      const member = await tx.releaseCandidateMember.findUniqueOrThrow({ where: { id: body.memberId } });
      const proposal = await tx.changeProposal.findUniqueOrThrow({ where: { id: pointer.proposalId } });
      const assignment = await tx.reviewAssignment.findUniqueOrThrow({ where: { id: member.assignmentId } });
      if (member.candidateId !== id || member.status !== 'ATTACHED' || member.proposalId !== pointer.proposalId ||
          assignment.reviewerId !== pointer.assignment.reviewerId || candidate.version !== body.expectedCandidateVersion ||
          candidate.contentVersion !== body.expectedContentVersion || proposal.version !== body.expectedProposalVersion ||
          proposal.state !== 'IN_RELEASE' || proposal.releaseAttachmentRef !== id ||
          proposal.currentRevisionId !== member.revisionId || proposal.currentAssignmentId !== member.assignmentId)
        throw new ConflictException();
      const revoked = !!await tx.approvalInvalidation.findUnique({ where: { decisionId: member.approvalId } });
      const reviewer = accounts.find(a => a.id === assignment.reviewerId);
      if (!reviewer) throw new ConflictException();
      const releaseAssignment = revoked && !reviewer.enabled;
      if (releaseAssignment && assignment.status === 'ACTIVE') {
        await tx.reviewAssignment.update({ where: { id: assignment.id }, data: { status: 'CLOSED',
          endReason: 'ACCOUNT_DISABLED', endedAt: new Date(), version: nextVersion(assignment.version) } });
      }
      await tx.releaseCandidateMember.update({ where: { id: member.id }, data: { status: 'REMOVED', removedAt: new Date() } });
      await tx.changeProposal.update({ where: { id: proposal.id }, data: { state: revoked ? 'CHANGES_REQUESTED' : 'APPROVED',
        releaseAttachmentRef: null, currentAssignmentId: releaseAssignment ? null : member.assignmentId,
        version: nextVersion(proposal.version) } });
      await this.activity.append(tx, { proposalId: proposal.id, revisionId: member.revisionId,
        assignmentId: member.assignmentId, candidateId: id, actorId: actor.accountId,
        action: 'RELEASE_REMOVED', summary: 'Proposal explicitly removed from release candidate.' });
      if (releaseAssignment) await this.activity.append(tx, { proposalId: proposal.id, revisionId: member.revisionId,
        assignmentId: member.assignmentId, actorId: actor.accountId, action: 'ASSIGNMENT_RELEASED',
        summary: 'Unavailable reviewer assignment released after revoked member removal.' });
      return this.command(await tx.releaseCandidate.update({ where: { id }, data: {
        version: nextVersion(candidate.version), contentVersion: nextVersion(candidate.contentVersion) } }));
    }, [pointer.assignment.reviewerId]);
  }

  async publish(actor: BusinessActor, id: string, body: PublishReleaseCandidateRequest, key: string) {
    const pointers = await this.database.client.releaseCandidateMember.findMany({ where: { candidateId: id, status: 'ATTACHED' },
      select: { assignment: { select: { reviewerId: true } } } });
    const reviewerIds = [...new Set(pointers.map(p => p.assignment.reviewerId))];
    return businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', id, 'RELEASE_PUBLISH', async (tx, accounts) => {
      const candidate = await this.locked(tx, id);
      if (candidate.createdById !== actor.accountId) throw new ForbiddenException();
      const keyHash = digest(key);
      const requestHash = digest(JSON.stringify(body));
      if (candidate.status === 'RELEASED') {
        const snapshot = await tx.releasePublicationSnapshot.findUnique({ where: { candidateId: id } });
        const evidence = snapshot?.evidence as Record<string, unknown> | undefined;
        const replay = evidence?.idempotency as Record<string, unknown> | undefined;
        if (replay?.keyHash === keyHash && typeof replay.expiresAt === 'string' &&
            new Date(replay.expiresAt).getTime() > Date.now()) {
          if (replay.requestHash !== requestHash) throw new ConflictException('Idempotency key body mismatch');
          return releasePublicationResponseSchema.parse(replay.response);
        }
        throw new ConflictException('Candidate is released');
      }
      this.owner(candidate, actor);
      if (candidate.version !== body.expectedVersion || candidate.contentVersion !== body.expectedContentVersion)
        throw new ConflictException();
      await lockCandidateMemberProposals(tx, id);
      const members = await this.activeMembers(tx, id);
      if (!members.length) throw new ConflictException('Candidate is empty');
      const assignments = await tx.reviewAssignment.findMany({ where: { id: { in: members.map(m => m.assignmentId) } },
        select: { id: true, reviewerId: true, status: true } });
      if (assignments.length !== members.length || assignments.some(a => a.status !== 'ACTIVE' ||
          !reviewerIds.includes(a.reviewerId) ||
          !accounts.some(account => account.id === a.reviewerId && account.role === 'REVIEWER')))
        throw new ConflictException('Assignment graph changed');
      const blockers = await this.blockers(tx, candidate);
      if (blockers.length) throw new ConflictException('Release readiness gates failed');
      const latestSmoke = await tx.releaseSmokeTest.findFirstOrThrow({ where: { candidateId: id,
        testedContentVersion: candidate.contentVersion }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
      if (latestSmoke.outcome !== 'PASS') throw new ConflictException('Latest smoke test failed');
      const memberEvidence = await Promise.all(members.map(async m => {
        const revision = await tx.proposalRevision.findUniqueOrThrow({ where: { id: m.revisionId },
          select: { id: true, number: true, submittedAt: true, criteria: { select: { id: true, required: true } } } });
        const coverage = await tx.coverageAssessment.findMany({ where: { proposalId: m.proposalId,
          revisionId: m.revisionId, assignmentId: m.assignmentId },
          orderBy: [{ mutationVersion: 'desc' }, { id: 'desc' }],
          select: { id: true, criterionId: true, status: true } });
        const findings = await tx.reviewFinding.findMany({ where: { proposalId: m.proposalId,
          revisionId: m.revisionId, assignmentId: m.assignmentId },
          select: { id: true, severity: true, events: { orderBy: [{ mutationVersion: 'desc' }, { id: 'desc' }],
            take: 1, select: { id: true, status: true, severity: true } } } });
        return { memberId: m.id, proposalId: m.proposalId, revisionId: m.revisionId,
          assignmentId: m.assignmentId, approvalId: m.approvalId,
          revisionNumber: revision.number, submittedAt: revision.submittedAt.toISOString(),
          criteria: revision.criteria, coverage: coverage.filter((row, index) =>
            coverage.findIndex(other => other.criterionId === row.criterionId) === index),
          findings: findings.map(f => ({ id: f.id, severity: f.severity,
            latestEvent: f.events[0] ?? null })) };
      }));
      const now = new Date();
      const response = releasePublicationResponseSchema.parse({ candidateId: id,
        version: nextVersion(candidate.version), contentVersion: candidate.contentVersion, status: 'RELEASED',
        snapshotId: randomUUID(), publishedAt: now.toISOString() });
      const snapshot = await tx.releasePublicationSnapshot.create({ data: { id: response.snapshotId, candidateId: id,
        actorId: actor.accountId, candidateVersion: candidate.version, contentVersion: candidate.contentVersion,
        evidence: { projectKey: candidate.projectKey, semanticVersion: candidate.semanticVersion,
          rollbackPlan: candidate.rollbackPlan, dependencyNotes: candidate.dependencyNotes,
          idempotency: { actorId: actor.accountId, operation: 'RELEASE_PUBLISH', keyHash, requestHash,
            expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(), response },
          smokeTest: { id: latestSmoke.id, testedContentVersion: latestSmoke.testedContentVersion,
            outcome: latestSmoke.outcome, procedure: latestSmoke.procedure, results: latestSmoke.results },
          members: memberEvidence } } });
      for (const member of members) {
        await tx.releaseCandidateMember.update({ where: { id: member.id }, data: { status: 'RELEASED' } });
        await tx.changeProposal.update({ where: { id: member.proposalId }, data: { state: 'RELEASED', version: { increment: 1 } } });
        await this.activity.append(tx, { proposalId: member.proposalId, revisionId: member.revisionId,
          assignmentId: member.assignmentId, candidateId: id, actorId: actor.accountId,
          action: 'RELEASE_PUBLISHED', summary: 'Release candidate published.' });
      }
      const updated = await tx.releaseCandidate.update({ where: { id }, data: { status: 'RELEASED', publishedAt: now,
        version: nextVersion(candidate.version) } });
      if (snapshot.id !== response.snapshotId || updated.version !== response.version) throw new ConflictException();
      return response;
    }, reviewerIds);
  }
}
