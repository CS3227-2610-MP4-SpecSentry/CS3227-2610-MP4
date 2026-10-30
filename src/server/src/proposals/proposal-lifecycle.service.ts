import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { draftResponseSchema, ownDraftsResponseSchema, proposalLifecycleResponseSchema, workingContentSchema,
  type OwnDraftsQuery, type WorkingContent } from '@specsentry/shared';
import { ActivityService } from '../activity/activity.service';
import { DatabaseService } from '../database/database.service';
import type { Prisma } from '../generated/prisma/client';
import { businessTransaction, type BusinessActor } from '../identity/business-context';
import { decodeCursor, encodeCursor } from '../reviews/reviewer-context';
import { ProposalsService } from './proposals.service';
import { prepareWorkingContent } from './working-revisions';

@Injectable()
export class ProposalLifecycleService {
  constructor(private readonly database: DatabaseService, private readonly proposals: ProposalsService,
    private readonly activity: ActivityService) {}

  create(actor: BusinessActor, input: WorkingContent) {
    return businessTransaction(this.database, actor, 'CONTRIBUTOR', 'proposal-create', 'PROPOSAL_CREATE', async tx => {
      const content = prepareWorkingContent(input);
      const root = await tx.changeProposal.create({ data: { ownerId: actor.accountId, title: 'Private working draft' } });
      const working = await tx.workingRevision.create({ data: { proposalId: root.id, content: content as Prisma.InputJsonValue } });
      await this.activity.append(tx, { proposalId: root.id, revisionId: null, actorId: actor.accountId,
        action: 'DRAFT_CREATED', summary: 'Private working draft created.' });
      return proposalLifecycleResponseSchema.parse({ proposalId: root.id, revisionId: null, workingRevisionId: working.id,
        assignmentId: null, assignmentVersion: null, state: root.state, version: root.version });
    });
  }

  draft(actor: BusinessActor, id: string) {
    return businessTransaction(this.database, actor, 'CONTRIBUTOR', id, 'PROPOSAL_DRAFT', async tx => {
      const root = await this.proposals.lockRoot(tx, id);
      if (root.ownerId !== actor.accountId) throw new ForbiddenException();
      const working = await tx.workingRevision.findUnique({ where: { proposalId: id } });
      if (!working) throw new NotFoundException();
      const result = draftResponseSchema.parse({ proposalId: id, workingRevisionId: working.id, version: root.version,
        state: root.state, content: working.content });
      await this.readAudit(tx, actor, 'PROPOSAL_DRAFT_VIEWED', id);
      return result;
    });
  }

  list(actor: BusinessActor, query: OwnDraftsQuery) {
    return businessTransaction(this.database, actor, 'CONTRIBUTOR', 'own-drafts', 'PROPOSAL_DRAFT_LIST', async tx => {
      const scope = JSON.stringify(['owner-drafts', actor.accountId]);
      const cursor = decodeCursor(query.cursor, scope, 'timestamp');
      const rows = await tx.changeProposal.findMany({ where: { ownerId: actor.accountId, state: 'DRAFT',
        currentRevisionId: null, firstSubmittedAt: null, ...(cursor ? { OR: [
          { createdAt: { lt: new Date(cursor.timestamp!) } },
          { createdAt: new Date(cursor.timestamp!), id: { gt: cursor.id } },
        ] } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: query.limit + 1,
        select: { id: true, state: true, version: true, createdAt: true } });
      const page = rows.slice(0, query.limit);
      const working = await tx.workingRevision.findMany({ where: { proposalId: { in: page.map(row => row.id) } },
        select: { id: true, proposalId: true, content: true } });
      const byProposal = new Map(working.map(row => [row.proposalId, row]));
      const last = page.at(-1);
      const result = ownDraftsResponseSchema.parse({ items: page.map(row => {
        const draft = byProposal.get(row.id);
        if (!draft) throw new Error('Working content unavailable');
        const content = workingContentSchema.parse(draft.content);
        return { proposalId: row.id, workingRevisionId: draft.id, title: content.title,
          state: row.state, version: row.version, createdAt: row.createdAt.toISOString() };
      }), nextCursor: rows.length > query.limit && last
        ? encodeCursor(scope, { id: last.id, timestamp: last.createdAt.toISOString() }) : null });
      await this.readAudit(tx, actor, 'PROPOSAL_DRAFT_LISTED', 'own-drafts');
      return result;
    });
  }

  private readAudit(tx: Prisma.TransactionClient, actor: BusinessActor, action: string, target: string) {
    return tx.securityEvent.create({ data: { actorId: actor.accountId, action, target,
      outcome: 'success', correlationId: actor.correlationId } });
  }
}
