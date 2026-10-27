import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { acknowledgeNotificationResponseSchema, notificationsResponseSchema,
  type AcknowledgeNotificationRequest, type NotificationsQuery } from '@specsentry/shared';
import { Prisma } from '../generated/prisma/client';
import { ActivityService } from '../activity/activity.service';
import { DatabaseService } from '../database/database.service';
import { businessTransaction, type BusinessActor } from '../identity/business-context';
import { ProposalsService } from '../proposals/proposals.service';
import { decodeCursor, encodeCursor } from '../reviews/reviewer-context';
import { lockReleaseCandidates } from '../releases/release-locks';

type Notice = { id: string; recipientId: string; kind: 'NEW_REVISION' | 'WITHDRAWN' | 'APPROVAL_REVOKED'; proposalId: string;
  revisionId: string; assignmentId: string; activityId: string; createdAt: Date; readAt: Date | null;
  candidateId: string | null; invalidationId: string | null; reviewerId: string | null; reason: string | null };
type Creation = Pick<Notice, 'recipientId' | 'proposalId' | 'revisionId' | 'assignmentId'> &
  { kind: 'NEW_REVISION' | 'WITHDRAWN' };

// Both kinds require immutable creation provenance. The withdrawal exception also
// requires the real withdrawal event; a closed assignment alone grants nothing.
const reviewerNotice = Prisma.sql`
  EXISTS (SELECT 1 FROM "ChangeProposal" p
    JOIN "ReviewAssignment" provenance ON provenance."id" = n."assignmentId"
      AND provenance."proposalId" = n."proposalId" AND provenance."revisionId" = n."revisionId"
      AND provenance."reviewerId" = n."recipientId"
    JOIN "ProposalActivity" creation ON creation."id" = n."activityId"
      AND creation."proposalId" = n."proposalId" AND creation."revisionId" = n."revisionId"
      AND creation."assignmentId" = n."assignmentId" AND creation."action" = 'NOTIFICATION_CREATED'
      AND creation."outcome" = 'SUCCESS'
    WHERE p."id" = n."proposalId" AND (
      (n."kind" = 'NEW_REVISION' AND p."state" IN ('IN_REVIEW','CHANGES_REQUESTED','APPROVED','IN_RELEASE','RELEASED')
        AND EXISTS (SELECT 1 FROM "ReviewAssignment" current_assignment
          WHERE current_assignment."id" = p."currentAssignmentId" AND current_assignment."proposalId" = p."id"
          AND current_assignment."revisionId" = p."currentRevisionId" AND current_assignment."status" = 'ACTIVE'
          AND current_assignment."reviewerId" = n."recipientId"))
      OR (n."kind" = 'WITHDRAWN' AND p."state" = 'WITHDRAWN' AND p."currentAssignmentId" IS NULL
        AND p."currentRevisionId" = n."revisionId" AND provenance."status" = 'CLOSED'
        AND provenance."endReason" = 'WITHDRAWN' AND provenance."endedAt" IS NOT NULL
        AND EXISTS (SELECT 1 FROM "ProposalActivity" withdrawal
          WHERE withdrawal."proposalId" = n."proposalId" AND withdrawal."revisionId" = n."revisionId"
          AND withdrawal."assignmentId" = n."assignmentId" AND withdrawal."action" = 'WITHDRAWN'
          AND withdrawal."outcome" = 'SUCCESS' AND withdrawal."timestamp" <= n."createdAt"))))`;
const visibleNotice = Prisma.sql`(${reviewerNotice} OR (
  n."kind" = 'APPROVAL_REVOKED' AND n."candidateId" IS NOT NULL AND n."invalidationId" IS NOT NULL
  AND EXISTS (SELECT 1 FROM "ReleaseCandidate" c JOIN "ApprovalInvalidation" i ON i."id"=n."invalidationId"
    JOIN "ProposalActivity" a ON a."id"=n."activityId" WHERE c."id"=n."candidateId"
    AND c."createdById"=n."recipientId" AND i."candidateId"=c."id" AND i."cause"='REVOKED'
    AND i."proposalId"=n."proposalId" AND i."revisionId"=n."revisionId"
    AND i."assignmentId"=n."assignmentId" AND i."actorId"=n."reviewerId" AND i."reason"=n."reason"
    AND a."candidateId"=c."id" AND a."proposalId"=n."proposalId"
    AND a."action"='NOTIFICATION_CREATED' AND a."outcome"='SUCCESS')))`;

@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService, private readonly proposals: ProposalsService,
    private readonly activity: ActivityService) {}

  // The lifecycle caller owns the transaction and root/account locks. Never
  // swallow a dependent-write failure: the entire lifecycle mutation must roll back.
  async create(tx: Prisma.TransactionClient, input: Creation, actorId?: string) {
    const assignment = await tx.reviewAssignment.findFirst({ where: { id: input.assignmentId,
      proposalId: input.proposalId, revisionId: input.revisionId, reviewerId: input.recipientId } });
    const root = await tx.changeProposal.findUnique({ where: { id: input.proposalId },
      select: { state: true, currentRevisionId: true, currentAssignmentId: true } });
    if (!assignment || !root) throw new ConflictException();
    if (input.kind === 'NEW_REVISION') {
      if (assignment.status !== 'ACTIVE' || root.currentRevisionId !== input.revisionId ||
          root.currentAssignmentId !== input.assignmentId || !['IN_REVIEW','CHANGES_REQUESTED','APPROVED','IN_RELEASE','RELEASED'].includes(root.state))
        throw new ConflictException();
    } else {
      if (root.state !== 'WITHDRAWN' || root.currentAssignmentId !== null || root.currentRevisionId !== input.revisionId ||
          assignment.status !== 'CLOSED' || assignment.endReason !== 'WITHDRAWN' || !assignment.endedAt ||
          !await tx.proposalActivity.findFirst({ where: { proposalId: input.proposalId, revisionId: input.revisionId,
            assignmentId: input.assignmentId, action: 'WITHDRAWN', outcome: 'SUCCESS' }, select: { id: true } }))
        throw new ConflictException();
    }
    const event = await this.activity.append(tx, { proposalId: input.proposalId, revisionId: input.revisionId,
      assignmentId: input.assignmentId, actorId, action: 'NOTIFICATION_CREATED',
      summary: input.kind === 'NEW_REVISION' ? 'New revision notification created.' : 'Withdrawal notification created.' });
    return tx.notification.create({ data: { ...input, activityId: event.id } });
  }

  async createApprovalRevocation(tx: Prisma.TransactionClient, input: {
    recipientId: string; proposalId: string; revisionId: string; assignmentId: string;
    candidateId: string; invalidationId: string; reviewerId: string; reason: string;
  }, actorId?: string) {
    const [candidate, invalidation, member] = await Promise.all([
      tx.releaseCandidate.findUnique({ where: { id: input.candidateId }, select: { createdById: true, status: true } }),
      tx.approvalInvalidation.findUnique({ where: { id: input.invalidationId } }),
      tx.releaseCandidateMember.findFirst({ where: { candidateId: input.candidateId, proposalId: input.proposalId,
        revisionId: input.revisionId, assignmentId: input.assignmentId, status: 'ATTACHED' }, select: { id: true } }),
    ]);
    if (!candidate || candidate.createdById !== input.recipientId || candidate.status !== 'OPEN' || !member ||
        !invalidation || invalidation.cause !== 'REVOKED' || invalidation.proposalId !== input.proposalId ||
        invalidation.revisionId !== input.revisionId || invalidation.assignmentId !== input.assignmentId ||
        invalidation.candidateId !== input.candidateId || invalidation.actorId !== input.reviewerId ||
        invalidation.reason !== input.reason) throw new ConflictException();
    const event = await this.activity.append(tx, { proposalId: input.proposalId, revisionId: input.revisionId,
      assignmentId: input.assignmentId, candidateId: input.candidateId, actorId,
      action: 'NOTIFICATION_CREATED', summary: 'Approval revocation notification created.' });
    return tx.notification.create({ data: { ...input, kind: 'APPROVAL_REVOKED', activityId: event.id } });
  }

  async list(actor: BusinessActor, query: NotificationsQuery) {
    return businessTransaction(this.database, actor, actor.role === 'RELEASE_MAINTAINER' ? 'RELEASE_MAINTAINER' : 'REVIEWER', 'notifications', 'NOTIFICATIONS_LIST', async tx => {
      const scope = JSON.stringify(['notifications', actor.accountId]);
      const cursor = decodeCursor(query.cursor, scope, 'timestamp');
      const position = cursor ? Prisma.sql`AND (n."createdAt" < ${new Date(cursor.timestamp!)}
        OR (n."createdAt" = ${new Date(cursor.timestamp!)} AND n."id" > ${cursor.id}))` : Prisma.empty;
      const eligible = Prisma.sql`n."recipientId" = ${actor.accountId} ${position} AND ${visibleNotice}`;
      // Page only after access filtering. Pre-read opaque pointers, then lock the
      // bounded page's roots in order and reauthorize. Lifecycle changes affecting
      // this recipient serialize on the account already held by this transaction.
      const pointers = await tx.$queryRaw<{ proposalId: string; candidateId: string | null }[]>(Prisma.sql`SELECT n."proposalId",n."candidateId" FROM "Notification" n
        WHERE ${eligible} ORDER BY n."createdAt" DESC, n."id" ASC LIMIT ${query.limit + 1}`);
      await lockReleaseCandidates(tx, pointers.flatMap(row => row.candidateId ? [row.candidateId] : []));
      const roots = [...new Set(pointers.map(row => row.proposalId))].sort();
      for (const id of roots) await this.proposals.lockRoot(tx, id);
      const rows = roots.length ? await tx.$queryRaw<Notice[]>(Prisma.sql`SELECT n.* FROM "Notification" n
        WHERE ${eligible} AND n."proposalId" IN (${Prisma.join(roots)})
        ORDER BY n."createdAt" DESC, n."id" ASC LIMIT ${query.limit + 1}`) : [];
      const page = rows.slice(0, query.limit); const last = page.at(-1);
      await tx.securityEvent.create({ data: { actorId: actor.accountId, action: 'NOTIFICATIONS_LISTED',
        target: 'notifications', outcome: 'success', correlationId: actor.correlationId } });
      return notificationsResponseSchema.parse({ items: page.map(row => ({ id: row.id, kind: row.kind,
        proposalId: row.proposalId, createdAt: row.createdAt.toISOString(), readAt: row.readAt?.toISOString() ?? null,
        ...(row.kind === 'NEW_REVISION' ? { revisionId: row.revisionId } : {}),
        ...(row.kind === 'APPROVAL_REVOKED' ? { revisionId: row.revisionId, candidateId: row.candidateId,
          invalidationId: row.invalidationId, reviewerId: row.reviewerId, reason: row.reason } : {}) })),
        nextCursor: rows.length > query.limit && last ? encodeCursor(scope, { id: last.id, timestamp: last.createdAt.toISOString() }) : null });
    });
  }

  async acknowledge(actor: BusinessActor, id: string, body: AcknowledgeNotificationRequest) {
    return businessTransaction(this.database, actor, actor.role === 'RELEASE_MAINTAINER' ? 'RELEASE_MAINTAINER' : 'REVIEWER', 'notification', 'NOTIFICATION_ACKNOWLEDGE', async tx => {
      const pointer = await tx.notification.findFirst({ where: { id, recipientId: actor.accountId }, select: { proposalId: true, candidateId: true } });
      if (!pointer) throw new NotFoundException();
      if (pointer.candidateId) await lockReleaseCandidates(tx, [pointer.candidateId]);
      const root = await this.proposals.lockRoot(tx, pointer.proposalId);
      const notices = await tx.$queryRaw<Notice[]>(Prisma.sql`SELECT n.* FROM "Notification" n
        WHERE n."id" = ${id} AND n."recipientId" = ${actor.accountId} AND ${visibleNotice}`);
      const notice = notices[0];
      if (!notice) throw new ForbiddenException();
      if (notice.kind !== body.kind) throw new ConflictException();
      if (body.kind === 'NEW_REVISION' && (notice.revisionId !== body.revisionId ||
          root.currentAssignment?.id !== body.assignmentId || root.currentAssignment.version !== body.expectedAssignmentVersion))
        throw new ConflictException();
      if (body.kind === 'APPROVAL_REVOKED' && (notice.candidateId !== body.candidateId ||
          notice.invalidationId !== body.invalidationId)) throw new ConflictException();
      const result = notice.readAt ? notice : await tx.notification.update({ where: { id: notice.id }, data: { readAt: new Date() } });
      await tx.securityEvent.create({ data: { actorId: actor.accountId, action: 'NOTIFICATION_ACKNOWLEDGED',
        target: notice.id, outcome: 'success', correlationId: actor.correlationId } });
      return acknowledgeNotificationResponseSchema.parse({ id: result.id, readAt: result.readAt!.toISOString() });
    });
  }
}
