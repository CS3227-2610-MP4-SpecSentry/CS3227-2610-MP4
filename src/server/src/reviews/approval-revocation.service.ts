import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { revokeApprovalResponseSchema, type RevokeApprovalRequest } from '@specsentry/shared';
import { ActivityService } from '../activity/activity.service';
import { DatabaseService } from '../database/database.service';
import { businessTransaction, type BusinessActor } from '../identity/business-context';
import { NotificationsService } from '../notifications/notifications.service';
import { ProposalsService } from '../proposals/proposals.service';
import { lockReleaseCandidates, lockReleaseProposals } from '../releases/release-locks';
import { nextVersion } from './reviewer-context';

const sha = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class ApprovalRevocationService {
  constructor(private readonly database: DatabaseService, private readonly proposals: ProposalsService,
    private readonly activity: ActivityService, private readonly notifications: NotificationsService) {}

  async revoke(actor: BusinessActor, id: string, body: RevokeApprovalRequest, key: string) {
    // Only opaque lock pointers are read here. A candidate's responsibility may
    // change neither through this operation nor through any release command.
    const pointer = await this.database.client.releaseCandidateMember.findFirst({
      where: { proposalId: id, status: 'ATTACHED' },
      select: { id: true, candidateId: true, candidate: { select: { createdById: true } } },
    });
    return businessTransaction(this.database, actor, 'REVIEWER', id, 'APPROVAL_REVOKE', async tx => {
      if (pointer) await lockReleaseCandidates(tx, [pointer.candidateId]);
      await lockReleaseProposals(tx, [id]);
      const root = await this.proposals.assignedRoot(tx, id, actor.accountId);
      const assignment = root.currentAssignment!;
      const member = await tx.releaseCandidateMember.findFirst({ where: { proposalId: id, status: 'ATTACHED' },
        select: { id: true, candidateId: true, revisionId: true, assignmentId: true, approvalId: true } });
      if ((pointer?.id ?? null) !== (member?.id ?? null) ||
          (pointer?.candidateId ?? null) !== (member?.candidateId ?? null)) throw new ConflictException();
      if (member && root.releaseAttachmentRef !== member.candidateId) throw new ConflictException();
      if (!member && root.releaseAttachmentRef !== null) throw new ConflictException();

      const keyHash = sha(key); const operation = 'APPROVAL_REVOKE';
      const requestHash = sha(JSON.stringify([body.expectedVersion, body.revisionId, body.assignmentId,
        body.expectedAssignmentVersion, body.approvalId, body.expectedApprovalVersion, body.reason,
        body.candidateContext ? [body.candidateContext.candidateId, body.candidateContext.expectedCandidateVersion] : null]));
      const where = { actorId_operation_proposalId_keyHash: { actorId: actor.accountId, operation, proposalId: id, keyHash } };
      const replay = await tx.reviewIdempotency.findUnique({ where });
      if (replay && replay.expiresAt.getTime() > Date.now()) {
        // The assignment and attached candidate are checked before stored data
        // is returned. Removal ends the Reviewer's candidate scope for replay.
        const prior = revokeApprovalResponseSchema.parse(replay.response);
        if (prior.candidate && (!member || member.candidateId !== prior.candidate.id)) throw new ForbiddenException();
        if (replay.requestHash !== requestHash) throw new ConflictException();
        if (root.currentRevisionId !== body.revisionId || assignment.id !== body.assignmentId ||
            assignment.version !== body.expectedAssignmentVersion) throw new ConflictException();
        return prior;
      }

      if (member && body.candidateContext?.candidateId !== member.candidateId) throw new ConflictException();
      if (!member && body.candidateContext !== null) throw new ConflictException();

      if (root.version !== body.expectedVersion || root.currentRevisionId !== body.revisionId ||
          assignment.id !== body.assignmentId || assignment.version !== body.expectedAssignmentVersion ||
          !['APPROVED', 'IN_RELEASE'].includes(root.state)) throw new ConflictException();
      if (member && (root.state !== 'IN_RELEASE' || member.revisionId !== body.revisionId ||
          member.assignmentId !== body.assignmentId || member.approvalId !== body.approvalId)) throw new ConflictException();
      if (!member && root.state !== 'APPROVED') throw new ConflictException();
      const candidate = pointer ? await tx.releaseCandidate.findUnique({ where: { id: pointer.candidateId },
        select: { id: true, createdById: true, status: true, version: true } }) : null;
      if (pointer && (!candidate || candidate.createdById !== pointer.candidate.createdById ||
          candidate.status !== 'OPEN' || candidate.version !== body.candidateContext?.expectedCandidateVersion))
        throw new ConflictException();
      const approval = await tx.reviewDecision.findFirst({ where: { id: body.approvalId, proposalId: id,
        revisionId: body.revisionId, assignmentId: body.assignmentId, actorId: actor.accountId, decision: 'APPROVE' },
        select: { id: true, mutationVersion: true } });
      if (!approval || approval.mutationVersion !== body.expectedApprovalVersion ||
          await tx.approvalInvalidation.findUnique({ where: { decisionId: approval.id }, select: { id: true } }))
        throw new ConflictException();
      const version = nextVersion(root.version);
      const invalidation = await tx.approvalInvalidation.create({ data: { proposalId: id,
        revisionId: body.revisionId, assignmentId: body.assignmentId, decisionId: approval.id,
        actorId: actor.accountId, mutationVersion: version, cause: 'REVOKED', reason: body.reason,
        candidateId: candidate?.id ?? null } });
      await tx.changeProposal.update({ where: { id }, data: { version,
        state: candidate ? 'IN_RELEASE' : 'CHANGES_REQUESTED' } });
      let candidateVersion: number | null = null;
      if (candidate) {
        candidateVersion = nextVersion(candidate.version);
        await tx.releaseCandidate.update({ where: { id: candidate.id }, data: { version: candidateVersion } });
      }
      await this.activity.append(tx, { proposalId: id, revisionId: body.revisionId,
        assignmentId: body.assignmentId, candidateId: candidate?.id, actorId: actor.accountId,
        action: 'APPROVAL_REVOKED',
        summary: `Approval ${approval.id} revoked by invalidation ${invalidation.id}.`, reason: body.reason });
      if (candidate) await this.notifications.createApprovalRevocation(tx, { recipientId: candidate.createdById,
        proposalId: id, revisionId: body.revisionId, assignmentId: body.assignmentId, candidateId: candidate.id,
        invalidationId: invalidation.id, reviewerId: actor.accountId, reason: body.reason }, actor.accountId);
      const author = await tx.userAccount.findUniqueOrThrow({ where: { id: actor.accountId },
        select: { id: true, username: true } });
      const response = revokeApprovalResponseSchema.parse({ proposalId: id, revisionId: body.revisionId,
        assignmentId: body.assignmentId, state: candidate ? 'IN_RELEASE' : 'CHANGES_REQUESTED',
        version, assignmentVersion: assignment.version, effectiveApproval: false,
        invalidation: { id: invalidation.id, proposalId: id, revisionId: body.revisionId,
          assignmentId: body.assignmentId, decisionId: approval.id, actor: author,
          mutationVersion: version, cause: 'REVOKED', reason: body.reason,
          candidateId: candidate?.id ?? null, createdAt: invalidation.createdAt.toISOString() },
        candidate: candidate ? { id: candidate.id, version: candidateVersion!, ownInvalidApprovalBlocker: true } : null });
      const data = { requestHash, response, expiresAt: new Date(Date.now() + 86_400_000) };
      await tx.reviewIdempotency.upsert({ where, create: { proposalId: id, actorId: actor.accountId,
        operation, keyHash, ...data }, update: data });
      return response;
    }, pointer ? [pointer.candidate.createdById] : []);
  }
}
