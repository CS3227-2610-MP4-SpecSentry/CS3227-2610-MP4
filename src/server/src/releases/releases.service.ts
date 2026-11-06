import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { eligibleReleaseProposalsResponseSchema, RELEASE_LIMITS, releaseAnnotationSchema,
  releaseAnnotationsResponseSchema, releaseCandidateCommandResponseSchema, releaseCandidateDetailResponseSchema,
  releaseCandidatesResponseSchema, releasePublicationResponseSchema, releaseSmokeTestsResponseSchema,
  normalizeReviewerText, reviewerReleaseContextSchema, REVIEWER_LIMITS,
  type AddReleaseMemberRequest, type AppendReleaseAnnotationRequest, type AppendReleaseSmokeTestRequest,
  type CreateReleaseCandidateRequest, type EligibleReleaseProposalsQuery, type PublishReleaseCandidateRequest,
  type ReleaseAnnotationsQuery, type ReleaseCandidatesQuery, type ReleaseSmokeTestsQuery, type RemoveReleaseMemberRequest,
  type UpdateReleaseCandidateRequest } from '@specsentry/shared';
import { Prisma, type ReleaseCandidate } from '../generated/prisma/client';
import { ActivityService } from '../activity/activity.service';
import { DatabaseService } from '../database/database.service';
import { businessTransaction, type BusinessActor } from '../identity/business-context';
import { decodeCursor, encodeCursor, nextVersion } from '../reviews/reviewer-context';
import { lockCandidateMemberProposals, lockReleaseCandidates, lockReleaseProposals, RELEASE_PROJECT_KEY } from './release-locks';

type Tx = Prisma.TransactionClient;
type Blocker = { code: 'EMPTY' | 'VERSION' | 'ROLLBACK' | 'SMOKE' | 'REVISION' | 'APPROVAL' | 'COVERAGE' | 'FINDING'; proposalId?: string };
type EligibleProposalRow = {
  proposalId: string; title: string; ownerId: string; ownerUsername: string; proposalVersion: number;
  revisionId: string; revisionNumber: number; submittedAt: Date; assignmentId: string;
  assignmentVersion: number; reviewerId: string; reviewerUsername: string;
};
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
  private releasedOwner(candidate: ReleaseCandidate, actor: BusinessActor) {
    if (candidate.createdById !== actor.accountId) throw new ForbiddenException();
    if (candidate.status !== 'RELEASED') throw new ConflictException('Candidate is not released');
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

  list(actor: BusinessActor, query: ReleaseCandidatesQuery) {
    const scope = JSON.stringify(['release-candidates', RELEASE_PROJECT_KEY, query.status ?? null]);
    return businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', 'release-candidates', 'RELEASE_LIST', async tx => {
      const cursor = decodeCursor(query.cursor, scope, 'timestamp');
      const rows = await tx.releaseCandidate.findMany({
        where: { projectKey: RELEASE_PROJECT_KEY, status: query.status,
          ...(cursor ? { OR: [{ createdAt: { lt: new Date(cursor.timestamp!) } },
            { createdAt: new Date(cursor.timestamp!), id: { lt: cursor.id } }] } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: query.limit + 1,
        select: { id: true, semanticVersion: true, status: true, createdById: true,
          createdAt: true, publishedAt: true, version: true, contentVersion: true },
      });
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);
      return releaseCandidatesResponseSchema.parse({
        items: page.map(candidate => ({ id: candidate.id, versionLabel: candidate.semanticVersion,
          status: candidate.status, createdById: candidate.createdById,
          createdAt: candidate.createdAt.toISOString(), publishedAt: candidate.publishedAt?.toISOString() ?? null,
          version: candidate.version, contentVersion: candidate.contentVersion })),
        nextCursor: rows.length > query.limit && last
          ? encodeCursor(scope, { id: last.id, timestamp: last.createdAt.toISOString() }) : null,
      });
    });
  }

  eligible(actor: BusinessActor, id: string, query: EligibleReleaseProposalsQuery) {
    const scope = JSON.stringify(['eligible-release-proposals', id]);
    return businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', id, 'RELEASE_ELIGIBLE_LIST', async tx => {
      const candidate = await this.locked(tx, id); this.owner(candidate, actor);
      const cursor = decodeCursor(query.cursor, scope, 'timestamp');
      const cursorClause = cursor ? Prisma.sql`AND (
        r."submittedAt" < ${new Date(cursor.timestamp!)} OR
        (r."submittedAt" = ${new Date(cursor.timestamp!)} AND p."id" < ${cursor.id})
      )` : Prisma.empty;
      const rows = await tx.$queryRaw<EligibleProposalRow[]>(Prisma.sql`
        SELECT p."id" AS "proposalId", p."title", p."ownerId", owner."username" AS "ownerUsername",
          p."version" AS "proposalVersion", r."id" AS "revisionId", r."number" AS "revisionNumber",
          r."submittedAt", a."id" AS "assignmentId", a."version" AS "assignmentVersion",
          reviewer."id" AS "reviewerId", reviewer."username" AS "reviewerUsername"
        FROM "ChangeProposal" p
        JOIN "ProposalRevision" r
          ON r."proposalId" = p."id" AND r."id" = p."currentRevisionId"
        JOIN "ReviewAssignment" a
          ON a."proposalId" = p."id" AND a."revisionId" = r."id" AND a."id" = p."currentAssignmentId"
        JOIN "UserAccount" owner ON owner."id" = p."ownerId"
        JOIN "UserAccount" reviewer ON reviewer."id" = a."reviewerId"
        JOIN "ReviewDecision" d
          ON d."proposalId" = p."id" AND d."revisionId" = r."id"
          AND d."assignmentId" = a."id" AND d."decision" = 'APPROVE'
        LEFT JOIN "ApprovalInvalidation" invalidation ON invalidation."decisionId" = d."id"
        WHERE p."state" = 'APPROVED'
          AND p."releaseAttachmentRef" IS NULL
          AND a."status" = 'ACTIVE'
          AND reviewer."role" = 'REVIEWER'
          AND invalidation."id" IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM "ReleaseCandidateMember" member
            WHERE member."proposalId" = p."id" AND member."status" <> 'REMOVED'
          )
          ${cursorClause}
        ORDER BY r."submittedAt" DESC, p."id" DESC
        LIMIT ${query.limit + 1}
      `);
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);
      return eligibleReleaseProposalsResponseSchema.parse({
        items: page.map(row => ({ proposalId: row.proposalId, title: row.title,
          owner: { id: row.ownerId, username: row.ownerUsername }, proposalVersion: row.proposalVersion,
          revisionId: row.revisionId, revisionNumber: row.revisionNumber,
          submittedAt: row.submittedAt.toISOString(), assignmentId: row.assignmentId,
          assignmentVersion: row.assignmentVersion,
          reviewer: { id: row.reviewerId, username: row.reviewerUsername } })),
        nextCursor: rows.length > query.limit && last
          ? encodeCursor(scope, { id: last.proposalId, timestamp: last.submittedAt.toISOString() }) : null,
      });
    });
  }

  detail(actor: BusinessActor, id: string) {
    const role = actor.role === 'REVIEWER' ? 'REVIEWER' : 'RELEASE_MAINTAINER';
    return businessTransaction(this.database, actor, role, id, 'RELEASE_DETAIL', async tx => {
      const candidate = await this.locked(tx, id);
      if (role === 'REVIEWER') {
        const own = await tx.releaseCandidateMember.findFirst({ where: { candidateId: id, status: { in: ['ATTACHED', 'RELEASED'] },
          assignment: { reviewerId: actor.accountId, status: 'ACTIVE' } }, select: { approvalId: true } });
        if (!own) throw new ForbiddenException();
        const invalidation = await tx.approvalInvalidation.findUnique({ where: { decisionId: own.approvalId }, select: { id: true } });
        return reviewerReleaseContextSchema.parse({ candidateId: id, candidateVersion: candidate.version,
          ownInvalidApprovalBlocker: !!invalidation });
      }
      const members = await tx.releaseCandidateMember.findMany({
        where: { candidateId: id, status: { in: ['ATTACHED', 'RELEASED'] } },
        orderBy: [{ attachedAt: 'asc' }, { id: 'asc' }], take: 1_001,
        select: { id: true, proposalId: true, revisionId: true, assignmentId: true, status: true,
          attachedAt: true, removedAt: true,
          proposal: { select: { title: true, version: true } }, revision: { select: { number: true } } },
      });
      if (members.length > 1_000) throw new ConflictException('Candidate member limit exceeded');
      const smokeRows = await tx.releaseSmokeTest.findMany({ where: { candidateId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 2 });
      const smokeTests = smokeRows.slice(0, 1);
      const publication = await tx.releasePublicationSnapshot.findUnique({ where: { candidateId: id },
        select: { id: true, actorId: true, candidateVersion: true, contentVersion: true, createdAt: true } });
      const unreadRows = candidate.createdById === actor.accountId
        ? await tx.notification.findMany({ where: { recipientId: actor.accountId, candidateId: id,
          kind: 'APPROVAL_REVOKED', readAt: null }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: REVIEWER_LIMITS.pageMax + 1,
          select: { id: true, proposalId: true, revisionId: true, invalidationId: true,
            reviewerId: true, reason: true, createdAt: true } }) : [];
      const unreadRevocationNotices = unreadRows.slice(0, REVIEWER_LIMITS.pageMax);
      const blockers = candidate.status === 'RELEASED' ? [] : await this.blockers(tx, candidate);
      return releaseCandidateDetailResponseSchema.parse({ id, projectKey: candidate.projectKey,
        createdById: candidate.createdById, status: candidate.status, versionLabel: candidate.semanticVersion,
        rollbackNote: candidate.rollbackPlan, dependencyNotes: candidate.dependencyNotes,
        version: candidate.version, contentVersion: candidate.contentVersion,
        members: members.map(m => ({ id: m.id, proposalId: m.proposalId,
          proposalTitle: m.proposal.title, proposalVersion: m.proposal.version,
          revisionId: m.revisionId, revisionNumber: m.revision.number,
          assignmentId: m.assignmentId, status: m.status,
          attachedAt: m.attachedAt.toISOString(), removedAt: m.removedAt?.toISOString() ?? null })),
        smokeTests: smokeTests.map(s => ({ id: s.id, testedContentVersion: s.testedContentVersion,
          outcome: s.outcome, procedure: s.procedure, results: s.results, actorId: s.actorId,
          createdAt: s.createdAt.toISOString() })), smokeTestsTruncated: smokeRows.length > 1,
        blockers: blockers.slice(0, 1_000),
        publishedAt: candidate.publishedAt?.toISOString() ?? null,
        publication: publication ? { snapshotId: publication.id, actorId: publication.actorId,
          candidateVersion: publication.candidateVersion, contentVersion: publication.contentVersion,
          createdAt: publication.createdAt.toISOString() } : null,
        unreadRevocationNotices: unreadRevocationNotices.map(notice => ({ id: notice.id,
          proposalId: notice.proposalId, revisionId: notice.revisionId,
          invalidationId: notice.invalidationId, reviewerId: notice.reviewerId,
          reason: notice.reason, createdAt: notice.createdAt.toISOString() })),
        unreadRevocationNoticesTruncated: unreadRows.length > REVIEWER_LIMITS.pageMax });
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

  smokeHistory(actor: BusinessActor, id: string, query: ReleaseSmokeTestsQuery) {
    const scope = JSON.stringify(['release-smoke-tests', id]);
    return businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', id,
      'RELEASE_SMOKE_HISTORY', async tx => {
        await this.locked(tx, id);
        const cursor = decodeCursor(query.cursor, scope, 'timestamp');
        const rows = await tx.releaseSmokeTest.findMany({ where: { candidateId: id,
          ...(cursor ? { OR: [{ createdAt: { lt: new Date(cursor.timestamp!) } },
            { createdAt: new Date(cursor.timestamp!), id: { lt: cursor.id } }] } : {}) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit + 1,
        select: { id: true, testedContentVersion: true, outcome: true, procedure: true,
          results: true, actorId: true, createdAt: true } });
        const page: typeof rows = []; let contentBytes = 0;
        for (const row of rows.slice(0, query.limit)) {
          const rowBytes = Buffer.byteLength(row.procedure, 'utf8') + Buffer.byteLength(row.results, 'utf8');
          if (page.length && contentBytes + rowBytes > RELEASE_LIMITS.smokeHistoryContentBytes) break;
          page.push(row); contentBytes += rowBytes;
        }
        const last = page.at(-1);
        return releaseSmokeTestsResponseSchema.parse({ items: page.map(row => ({ ...row,
          createdAt: row.createdAt.toISOString() })), contentBytes,
        nextCursor: last && rows.length > page.length
          ? encodeCursor(scope, { id: last.id, timestamp: last.createdAt.toISOString() }) : null });
      });
  }

  annotations(actor: BusinessActor, id: string, query: ReleaseAnnotationsQuery) {
    const scope = JSON.stringify(['release-annotations', id]);
    return businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', id, 'RELEASE_ANNOTATIONS_LIST', async tx => {
      const candidate = await this.locked(tx, id);
      if (candidate.status !== 'RELEASED') throw new ConflictException('Candidate is not released');
      const cursor = decodeCursor(query.cursor, scope, 'timestamp');
      const rows = await tx.releaseAnnotation.findMany({ where: { candidateId: id,
        ...(cursor ? { OR: [{ createdAt: { lt: new Date(cursor.timestamp!) } },
          { createdAt: new Date(cursor.timestamp!), id: { lt: cursor.id } }] } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit + 1,
      select: { id: true, candidateId: true, text: true, createdAt: true,
        actor: { select: { id: true, username: true } } } });
      const page = rows.slice(0, query.limit);
      const last = page.at(-1);
      return releaseAnnotationsResponseSchema.parse({ items: page.map(row => ({ ...row,
        createdAt: row.createdAt.toISOString() })), nextCursor: rows.length > query.limit && last
        ? encodeCursor(scope, { id: last.id, timestamp: last.createdAt.toISOString() }) : null });
    });
  }

  annotate(actor: BusinessActor, id: string, body: AppendReleaseAnnotationRequest) {
    return businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', id, 'RELEASE_ANNOTATE', async tx => {
      const candidate = await this.locked(tx, id); this.releasedOwner(candidate, actor);
      if (candidate.version !== body.expectedVersion) throw new ConflictException('Candidate version changed');
      const snapshot = await tx.releasePublicationSnapshot.findUnique({ where: { id: body.snapshotId },
        select: { id: true, candidateId: true } });
      if (!snapshot || snapshot.candidateId !== id) throw new ConflictException('Publication snapshot changed');
      const annotation = await tx.releaseAnnotation.create({ data: { candidateId: id,
        snapshotId: snapshot.id, actorId: actor.accountId, candidateVersion: candidate.version,
        text: normalizeReviewerText(body.text) },
      select: { id: true, candidateId: true, text: true, createdAt: true,
        actor: { select: { id: true, username: true } } } });
      await tx.securityEvent.create({ data: { actorId: actor.accountId, action: 'RELEASE_ANNOTATED',
        target: id, outcome: 'success', correlationId: actor.correlationId } });
      return releaseAnnotationSchema.parse({ ...annotation, createdAt: annotation.createdAt.toISOString() });
    });
  }

  async add(actor: BusinessActor, id: string, body: AddReleaseMemberRequest) {
    const pointer = await businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', id,
      'RELEASE_ADD_POINTER', async tx => {
        this.owner(await this.locked(tx, id), actor);
        const found = await tx.reviewAssignment.findUnique({ where: { id: body.assignmentId },
          select: { reviewerId: true } });
        if (!found) throw new NotFoundException();
        return found;
      });
    return businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', id, 'RELEASE_ADD', async (tx, accounts) => {
      const candidate = await this.locked(tx, id); this.owner(candidate, actor);
      await lockReleaseProposals(tx, [body.proposalId]);
      const proposal = await tx.changeProposal.findUniqueOrThrow({ where: { id: body.proposalId } });
      const assignment = await tx.reviewAssignment.findUnique({ where: { id: body.assignmentId } });
      const memberCount = await tx.releaseCandidateMember.count({ where: { candidateId: id,
        status: { in: ['ATTACHED', 'RELEASED'] } } });
      if (candidate.version !== body.expectedCandidateVersion || candidate.contentVersion !== body.expectedContentVersion ||
          memberCount >= 1_000 ||
          proposal.version !== body.expectedProposalVersion || proposal.state !== 'APPROVED' || proposal.releaseAttachmentRef ||
          proposal.currentRevisionId !== body.revisionId || proposal.currentAssignmentId !== body.assignmentId ||
          !assignment || assignment.proposalId !== body.proposalId || assignment.revisionId !== body.revisionId ||
          assignment.reviewerId !== pointer.reviewerId || assignment.status !== 'ACTIVE' ||
          assignment.version !== body.expectedAssignmentVersion ||
          !accounts.some(a => a.id === assignment.reviewerId && a.role === 'REVIEWER')) throw new ConflictException();
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
    const pointer = await businessTransaction(this.database, actor, 'RELEASE_MAINTAINER', id,
      'RELEASE_REMOVE_POINTER', async tx => {
        this.owner(await this.locked(tx, id), actor);
        const found = await tx.releaseCandidateMember.findUnique({ where: { id: body.memberId },
          select: { candidateId: true, proposalId: true, assignment: { select: { reviewerId: true } } } });
        if (!found || found.candidateId !== id) throw new NotFoundException();
        return found;
      });
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
