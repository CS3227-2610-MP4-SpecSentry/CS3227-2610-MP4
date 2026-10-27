import { Injectable } from '@nestjs/common';
import { proposalActivityResponseSchema, REVIEWER_LIMITS } from '@specsentry/shared';
import type { Prisma } from '../generated/prisma/client';
import { decodeCursor, encodeCursor, type ReviewTransaction } from '../reviews/reviewer-context';

@Injectable()
export class ActivityService {
  append(tx: ReviewTransaction, data: Prisma.ProposalActivityUncheckedCreateInput) {
    return tx.proposalActivity.create({ data });
  }

  // Caller must hold the authorized proposal root lock throughout this query.
  async page(tx: ReviewTransaction, proposalId: string, cursorValue?: string) {
    const scope = JSON.stringify(['activity', proposalId]);
    const cursor = decodeCursor(cursorValue, scope, 'timestamp');
    const rows = await tx.proposalActivity.findMany({ where: { proposalId, ...(cursor ? { OR: [
      { timestamp: { gt: new Date(cursor.timestamp!) } }, { timestamp: new Date(cursor.timestamp!), id: { gt: cursor.id } },
    ] } : {}) }, take: REVIEWER_LIMITS.activityPage + 1, orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
    select: { id: true, actor: { select: { id: true, username: true } }, timestamp: true, action: true, proposalId: true,
      revisionId: true, assignmentId: true, candidateId: true, outcome: true, summary: true, reason: true } });
    const page = rows.slice(0, REVIEWER_LIMITS.activityPage);
    const last = page.at(-1);
    return proposalActivityResponseSchema.parse({ items: page.map((row) => ({ ...row, timestamp: row.timestamp.toISOString() })),
      nextCursor: rows.length > page.length && last ? encodeCursor(scope, { id: last.id, timestamp: last.timestamp.toISOString() }) : null });
  }
}
