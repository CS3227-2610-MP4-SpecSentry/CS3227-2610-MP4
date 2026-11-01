import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { findingResponseCommandResponseSchema, findingResponsesResponseSchema, type FindingResponseRequest,
  type OwnProposalsQuery } from '@specsentry/shared';
import { ActivityService } from '../activity/activity.service';
import { DatabaseService } from '../database/database.service';
import { businessTransaction, type BusinessActor } from '../identity/business-context';
import { decodeCursor, encodeCursor, nextVersion } from '../reviews/reviewer-context';
import { ProposalsService } from './proposals.service';

const responseSelect = { id: true, proposalId: true, findingId: true, revisionId: true,
  actor: { select: { id: true, username: true } }, text: true, mutationVersion: true, createdAt: true } as const;

@Injectable()
export class FindingResponsesService {
  constructor(private readonly database: DatabaseService, private readonly proposals: ProposalsService,
    private readonly activity: ActivityService) {}

  async add(actor: BusinessActor, findingId: string, body: FindingResponseRequest) {
    // Only the opaque proposal pointer is read before authenticated account/session/root locks.
    const pointer = await this.database.client.reviewFinding.findUnique({ where: { id: findingId }, select: { proposalId: true } });
    return businessTransaction(this.database, actor, 'CONTRIBUTOR', findingId, 'FINDING_RESPONSE', async tx => {
      if (!pointer) throw new NotFoundException();
      const root = await this.proposals.lockRoot(tx, pointer.proposalId);
      if (root.ownerId !== actor.accountId) throw new ForbiddenException();
      if (!['IN_REVIEW', 'CHANGES_REQUESTED'].includes(root.state) || root.version !== body.expectedVersion ||
        root.currentRevisionId !== body.revisionId) throw new ConflictException();
      const finding = await tx.reviewFinding.findFirst({ where: { id: findingId, proposalId: root.id }, select: { id: true } });
      if (!finding) throw new NotFoundException();
      const version = nextVersion(root.version);
      const response = await tx.findingResponse.create({ data: { proposalId: root.id, findingId,
        revisionId: body.revisionId, actorId: actor.accountId, text: body.text, mutationVersion: version }, select: responseSelect });
      await tx.changeProposal.update({ where: { id: root.id }, data: { version } });
      await this.activity.append(tx, { proposalId: root.id, revisionId: body.revisionId, actorId: actor.accountId,
        action: 'FINDING_RESPONDED', summary: `Contributor response added to finding ${findingId}.` });
      return findingResponseCommandResponseSchema.parse({ proposalId: root.id, version,
        response: { ...response, createdAt: response.createdAt.toISOString() } });
    });
  }

  list(actor: BusinessActor, proposalId: string, query: OwnProposalsQuery) {
    const role = actor.role ?? 'CONTRIBUTOR';
    return businessTransaction(this.database, actor, role, proposalId, 'FINDING_RESPONSES_READ', async tx => {
      await this.proposals.viewerRoot(tx, proposalId, actor.accountId, role);
      const scope = JSON.stringify(['finding-responses', proposalId]);
      const cursor = decodeCursor(query.cursor, scope, 'timestamp');
      const rows = await tx.findingResponse.findMany({ where: { proposalId, ...(cursor ? { OR: [
        { createdAt: { gt: new Date(cursor.timestamp!) } }, { createdAt: new Date(cursor.timestamp!), id: { gt: cursor.id } },
      ] } : {}) }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: query.limit + 1, select: responseSelect });
      const page = rows.slice(0, query.limit); const last = page.at(-1);
      const result = findingResponsesResponseSchema.parse({ items: page.map(row => ({ ...row, createdAt: row.createdAt.toISOString() })),
        nextCursor: rows.length > query.limit && last ? encodeCursor(scope, { id: last.id, timestamp: last.createdAt.toISOString() }) : null });
      await tx.securityEvent.create({ data: { actorId: actor.accountId, target: proposalId, action: 'FINDING_RESPONSES_VIEWED',
        outcome: 'success', correlationId: actor.correlationId } });
      return result;
    });
  }
}
