import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { proposalDetailResponseSchema, submittedRevisionsResponseSchema, type SubmittedRevisionsQuery } from '@specsentry/shared';
import { decodeCursor, encodeCursor, type ReviewTransaction } from '../reviews/reviewer-context';

export const rootSelect = {
  id: true, ownerId: true, title: true, state: true, version: true, currentRevisionId: true,
  currentAssignmentId: true, firstSubmittedAt: true,
  owner: { select: { id: true, username: true } },
  currentRevision: { select: { id: true, summary: true, submittedAt: true } },
  currentAssignment: { select: { id: true, revisionId: true, reviewerId: true, status: true, version: true,
    reviewer: { select: { id: true, username: true } } } },
} as const;

@Injectable()
export class ProposalsService {
  async lockRoot(tx: ReviewTransaction, id: string) {
    const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "ChangeProposal" WHERE "id" = ${id} FOR UPDATE`;
    if (!rows.length) throw new NotFoundException();
    return tx.changeProposal.findUniqueOrThrow({ where: { id }, select: rootSelect });
  }

  async assignedRoot(tx: ReviewTransaction, id: string, accountId: string) {
    const root = await this.lockRoot(tx, id);
    if (root.currentAssignment?.reviewerId !== accountId || root.currentAssignment.status !== 'ACTIVE' ||
        !['IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'IN_RELEASE', 'RELEASED'].includes(root.state)) throw new ForbiddenException();
    return root;
  }

  async detail(tx: ReviewTransaction, id: string, accountId: string, revisionId?: string) {
    const root = await this.assignedRoot(tx, id, accountId);
    const revision = await tx.proposalRevision.findFirst({ where: { proposalId: id, id: revisionId ?? root.currentRevisionId! },
      select: { id: true, number: true, summary: true, problem: true, constraints: true, expectedBehavior: true,
        diffText: true, submittedAt: true,
        criteria: { orderBy: { id: 'asc' }, select: { id: true, stableKey: true, statement: true, required: true,
          evidenceLinks: { orderBy: { evidenceId: 'asc' }, select: { criterionId: true, evidenceId: true } } } },
        evidence: { orderBy: { id: 'asc' }, select: { id: true, text: true, evidenceHash: true } },
      } });
    if (!revision) throw new NotFoundException();
    return proposalDetailResponseSchema.parse({ id: root.id, version: root.version, title: root.title, state: root.state,
      author: root.owner, firstSubmittedAt: root.firstSubmittedAt!.toISOString(), latestSubmittedAt: root.currentRevision!.submittedAt.toISOString(),
      assignment: { id: root.currentAssignment!.id, revisionId: root.currentAssignment!.revisionId,
        version: root.currentAssignment!.version, reviewer: root.currentAssignment!.reviewer },
      revision: { ...revision, submittedAt: revision.submittedAt.toISOString(),
        criterionEvidenceLinks: revision.criteria.flatMap((criterion) => criterion.evidenceLinks),
        criteria: revision.criteria.map(({ id, stableKey, statement, required }) => ({ id, stableKey, statement, required })) },
    });
  }

  async revisions(tx: ReviewTransaction, id: string, accountId: string, query: SubmittedRevisionsQuery) {
    await this.assignedRoot(tx, id, accountId);
    const scope = JSON.stringify(['revisions', id]);
    const cursor = decodeCursor(query.cursor, scope, 'number');
    const rows = await tx.proposalRevision.findMany({ where: { proposalId: id, ...(cursor ? { OR: [
      { number: { lt: cursor.number } }, { number: cursor.number, id: { gt: cursor.id } },
    ] } : {}) }, orderBy: [{ number: 'desc' }, { id: 'asc' }], take: query.limit + 1,
    select: { id: true, number: true, summary: true, submittedAt: true } });
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    return submittedRevisionsResponseSchema.parse({ items: page.map((row) => ({ ...row, submittedAt: row.submittedAt.toISOString() })),
      nextCursor: rows.length > query.limit && last ? encodeCursor(scope, { id: last.id, number: last.number }) : null });
  }
}
