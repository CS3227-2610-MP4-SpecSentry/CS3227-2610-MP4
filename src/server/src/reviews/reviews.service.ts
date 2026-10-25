import { ConflictException, ForbiddenException, HttpException, Injectable } from '@nestjs/common';
import { assignedReviewsResponseSchema, reviewCommandResponseSchema, reviewPoolResponseSchema,
  type AssignedReviewsQuery, type ClaimProposalRequest, type DropProposalRequest, type ReviewPoolQuery } from '@specsentry/shared';
import { ActivityService } from '../activity/activity.service';
import { DatabaseService } from '../database/database.service';
import type { Prisma } from '../generated/prisma/client';
import { ProposalsService, rootSelect } from '../proposals/proposals.service';
import { decodeCursor, encodeCursor, lockReviewer, nextVersion, type ReviewerActor, type ReviewTransaction } from './reviewer-context';

@Injectable()
export class ReviewsService {
  constructor(private readonly database: DatabaseService, private readonly proposals: ProposalsService,
    private readonly activity: ActivityService) {}

  private async authorized<T>(actor: ReviewerActor, target: string, operation: string, work: (tx: ReviewTransaction) => Promise<T>): Promise<T> {
    try {
      return await this.database.client.$transaction(async (tx) => {
        await lockReviewer(tx, actor);
        const result = await work(tx);
        if (operation === 'VIEW') await tx.securityEvent.create({ data: { actorId: actor.accountId,
          action: 'REVIEW_VIEWED', target, outcome: 'success', correlationId: actor.correlationId } });
        return result;
      }, { maxWait: 5000, timeout: 10000 });
    } catch (error) {
      await this.database.client.securityEvent.create({ data: { actorId: actor.accountId, action: `REVIEW_${operation}_REJECTED`,
        target, outcome: 'rejected', correlationId: actor.correlationId } });
      if (error instanceof HttpException) throw error;
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (['P2002', 'P2034', 'P2028'].includes(String(code))) throw new ConflictException();
      throw error;
    }
  }

  queue(actor: ReviewerActor, query: ReviewPoolQuery | AssignedReviewsQuery, assigned = false) {
    return this.authorized(actor, assigned ? 'assigned-reviews' : 'review-pool', 'VIEW', async (tx) => {
      const state = 'state' in query ? query.state : undefined;
      const scope = JSON.stringify([assigned ? 'assigned' : 'pool', assigned ? actor.accountId : null,
        query.authorId ?? null, query.minAgeDays ?? null, query.maxAgeDays ?? null, state ?? null]);
      const cursor = decodeCursor(query.cursor, scope, 'timestamp');
      const now = Date.now();
      const firstSubmittedAt = { not: null,
        ...(query.minAgeDays !== undefined ? { lte: new Date(now - query.minAgeDays * 86400000) } : {}),
        ...(query.maxAgeDays !== undefined ? { gte: new Date(now - query.maxAgeDays * 86400000) } : {}) };
      const where: Prisma.ChangeProposalWhereInput = { ownerId: query.authorId, firstSubmittedAt,
        currentRevisionId: { not: null },
        ...(assigned ? { state: state ?? { in: ['IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'IN_RELEASE', 'RELEASED'] },
          currentAssignment: { is: { reviewerId: actor.accountId, status: 'ACTIVE' } } }
          : { state: { in: ['SUBMITTED', 'CHANGES_REQUESTED'] }, currentAssignmentId: null }),
        ...(cursor ? { OR: [{ firstSubmittedAt: { gt: new Date(cursor.timestamp!) } },
          { firstSubmittedAt: new Date(cursor.timestamp!), id: { gt: cursor.id } }] } : {}),
      };
      const rows = await tx.changeProposal.findMany({ where, orderBy: [{ firstSubmittedAt: 'asc' }, { id: 'asc' }], take: query.limit + 1,
        select: rootSelect });
      const page = rows.slice(0, query.limit);
      const items = page.map((row) => ({ id: row.id, version: row.version, title: row.title, author: row.owner,
        summary: row.currentRevision!.summary, firstSubmittedAt: row.firstSubmittedAt!.toISOString(),
        latestSubmittedAt: row.currentRevision!.submittedAt.toISOString(), awaitingRevision: row.state === 'CHANGES_REQUESTED',
        ...(assigned ? { state: row.state, assignmentId: row.currentAssignment!.id,
          revisionId: row.currentAssignment!.revisionId, assignmentVersion: row.currentAssignment!.version } : {}),
      }));
      const last = page.at(-1);
      const result = { items, nextCursor: rows.length > query.limit && last ?
        encodeCursor(scope, { id: last.id, timestamp: last.firstSubmittedAt!.toISOString() }) : null };
      return assigned ? assignedReviewsResponseSchema.parse(result) : reviewPoolResponseSchema.parse(result);
    });
  }

  claim(actor: ReviewerActor, id: string, body: ClaimProposalRequest) {
    return this.authorized(actor, id, 'CLAIM', async (tx) => {
      const root = await this.proposals.lockRoot(tx, id);
      if (root.version !== body.expectedVersion || root.currentAssignmentId || !root.currentRevisionId ||
          !['SUBMITTED', 'CHANGES_REQUESTED'].includes(root.state)) throw new ConflictException();
      const version = nextVersion(root.version);
      const assignment = await tx.reviewAssignment.create({ data: { proposalId: id, revisionId: root.currentRevisionId, reviewerId: actor.accountId } });
      const state = root.state === 'SUBMITTED' ? 'IN_REVIEW' : 'CHANGES_REQUESTED';
      await tx.changeProposal.update({ where: { id }, data: { currentAssignmentId: assignment.id, state, version } });
      await this.activity.append(tx, { proposalId: id, revisionId: root.currentRevisionId, assignmentId: assignment.id,
        actorId: actor.accountId, action: 'CLAIMED', summary: 'Proposal claimed for review.' });
      return reviewCommandResponseSchema.parse({ proposalId: id, revisionId: root.currentRevisionId, assignmentId: assignment.id,
        state, version, assignmentVersion: assignment.version });
    });
  }

  drop(actor: ReviewerActor, id: string, body: DropProposalRequest) {
    return this.authorized(actor, id, 'DROP', async (tx) => {
      const root = await this.proposals.lockRoot(tx, id);
      if (root.currentAssignment && root.currentAssignment.reviewerId !== actor.accountId) throw new ForbiddenException();
      const assignment = root.currentAssignment;
      if (!assignment || assignment.status !== 'ACTIVE' || assignment.id !== body.assignmentId || root.currentRevisionId !== body.revisionId ||
          root.version !== body.expectedVersion || assignment.version !== body.expectedAssignmentVersion ||
          !['IN_REVIEW', 'CHANGES_REQUESTED'].includes(root.state)) throw new ConflictException();
      const version = nextVersion(root.version);
      const assignmentVersion = nextVersion(assignment.version);
      const state = root.state === 'IN_REVIEW' ? 'SUBMITTED' : 'CHANGES_REQUESTED';
      await tx.reviewAssignment.update({ where: { id: assignment.id }, data: { status: 'CLOSED', endReason: 'DROPPED', endedAt: new Date(), version: assignmentVersion } });
      await tx.changeProposal.update({ where: { id }, data: { currentAssignmentId: null, state, version } });
      await this.activity.append(tx, { proposalId: id, revisionId: body.revisionId, assignmentId: assignment.id,
        actorId: actor.accountId, action: 'DROPPED', summary: 'Reviewer returned the proposal to the review pool.' });
      return reviewCommandResponseSchema.parse({ proposalId: id, revisionId: body.revisionId, assignmentId: assignment.id,
        state, version, assignmentVersion });
    });
  }

  detail(actor: ReviewerActor, id: string, revisionId?: string) {
    return this.authorized(actor, id, 'VIEW', (tx) => this.proposals.detail(tx, id, actor.accountId, revisionId));
  }

  revisions(actor: ReviewerActor, id: string, query: { limit: number; cursor?: string }) {
    return this.authorized(actor, id, 'VIEW', (tx) => this.proposals.revisions(tx, id, actor.accountId, query));
  }

  timeline(actor: ReviewerActor, id: string, cursor?: string) {
    return this.authorized(actor, id, 'VIEW', async (tx) => {
      await this.proposals.assignedRoot(tx, id, actor.accountId);
      return this.activity.page(tx, id, cursor);
    });
  }

  // Account administration already owns the disabled account lock. Never starts a nested transaction.
  async releaseDisabledAssignments(tx: ReviewTransaction, accountId: string): Promise<number> {
    const roots = await tx.changeProposal.findMany({ where: { state: { in: ['IN_REVIEW', 'CHANGES_REQUESTED'] },
      currentAssignment: { is: { reviewerId: accountId, status: 'ACTIVE' } } }, select: { id: true }, orderBy: { id: 'asc' } });
    for (const { id } of roots) {
      const root = await this.proposals.lockRoot(tx, id);
      const assignment = root.currentAssignment;
      if (!assignment || assignment.reviewerId !== accountId || assignment.status !== 'ACTIVE' ||
          !['IN_REVIEW', 'CHANGES_REQUESTED'].includes(root.state)) continue;
      await tx.reviewAssignment.update({ where: { id: assignment.id }, data: { status: 'CLOSED', endReason: 'ACCOUNT_DISABLED',
        endedAt: new Date(), version: nextVersion(assignment.version) } });
      await tx.changeProposal.update({ where: { id }, data: { currentAssignmentId: null,
        state: root.state === 'IN_REVIEW' ? 'SUBMITTED' : 'CHANGES_REQUESTED', version: nextVersion(root.version) } });
      await this.activity.append(tx, { proposalId: id, revisionId: assignment.revisionId, assignmentId: assignment.id,
        action: 'ASSIGNMENT_RELEASED', summary: 'Assignment released because the reviewer account was disabled.', reason: 'Reviewer account disabled.' });
    }
    return roots.length;
  }
}
