import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { acknowledgeNotificationResponseSchema, notificationsResponseSchema,
  type AcknowledgeNotificationRequest, type NotificationsQuery } from '@specsentry/shared';
import { Prisma } from '../generated/prisma/client';
import { ActivityService } from '../activity/activity.service';
import { DatabaseService } from '../database/database.service';
import { businessTransaction, type BusinessActor } from '../identity/business-context';
import { ProposalsService } from '../proposals/proposals.service';
import { decodeCursor, encodeCursor } from '../reviews/reviewer-context';

type Notice = { id: string; recipientId: string; kind: 'NEW_REVISION' | 'WITHDRAWN'; proposalId: string;
  revisionId: string; assignmentId: string; activityId: string; createdAt: Date; readAt: Date | null };
type Creation = Pick<Notice, 'recipientId' | 'kind' | 'proposalId' | 'revisionId' | 'assignmentId'>;

// Both kinds require immutable creation provenance. The withdrawal exception also
// requires the real withdrawal event; a closed assignment alone grants nothing.
const visibleNotice = Prisma.sql`
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

  async list(actor: BusinessActor, query: NotificationsQuery) {
    return businessTransaction(this.database, actor, 'REVIEWER', 'notifications', 'NOTIFICATIONS_LIST', async tx => {
      const scope = JSON.stringify(['notifications', actor.accountId]);
      const cursor = decodeCursor(query.cursor, scope, 'timestamp');
      const position = cursor ? Prisma.sql`AND (n."createdAt" < ${new Date(cursor.timestamp!)}
        OR (n."createdAt" = ${new Date(cursor.timestamp!)} AND n."id" > ${cursor.id}))` : Prisma.empty;
      const eligible = Prisma.sql`n."recipientId" = ${actor.accountId} ${position} AND ${visibleNotice}`;
      // Page only after access filtering. Pre-read opaque pointers, then lock the
      // bounded page's roots in order and reauthorize. Lifecycle changes affecting
      // this recipient serialize on the account already held by this transaction.
      const pointers = await tx.$queryRaw<{ proposalId: string }[]>(Prisma.sql`SELECT n."proposalId" FROM "Notification" n
        WHERE ${eligible} ORDER BY n."createdAt" DESC, n."id" ASC LIMIT ${query.limit + 1}`);
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
        ...(row.kind === 'NEW_REVISION' ? { revisionId: row.revisionId } : {}) })),
        nextCursor: rows.length > query.limit && last ? encodeCursor(scope, { id: last.id, timestamp: last.createdAt.toISOString() }) : null });
    });
  }

  async acknowledge(actor: BusinessActor, id: string, body: AcknowledgeNotificationRequest) {
    return businessTransaction(this.database, actor, 'REVIEWER', 'notification', 'NOTIFICATION_ACKNOWLEDGE', async tx => {
      const pointer = await tx.notification.findFirst({ where: { id, recipientId: actor.accountId }, select: { proposalId: true } });
      if (!pointer) throw new NotFoundException();
      const root = await this.proposals.lockRoot(tx, pointer.proposalId);
      const notices = await tx.$queryRaw<Notice[]>(Prisma.sql`SELECT n.* FROM "Notification" n
        WHERE n."id" = ${id} AND n."recipientId" = ${actor.accountId} AND ${visibleNotice}`);
      const notice = notices[0];
      if (!notice) throw new ForbiddenException();
      if (notice.kind !== body.kind) throw new ConflictException();
      if (body.kind === 'NEW_REVISION' && (notice.revisionId !== body.revisionId ||
          root.currentAssignment?.id !== body.assignmentId || root.currentAssignment.version !== body.expectedAssignmentVersion))
        throw new ConflictException();
      const result = notice.readAt ? notice : await tx.notification.update({ where: { id: notice.id }, data: { readAt: new Date() } });
      await tx.securityEvent.create({ data: { actorId: actor.accountId, action: 'NOTIFICATION_ACKNOWLEDGED',
        target: notice.id, outcome: 'success', correlationId: actor.correlationId } });
      return acknowledgeNotificationResponseSchema.parse({ id: result.id, readAt: result.readAt!.toISOString() });
    });
  }
}
