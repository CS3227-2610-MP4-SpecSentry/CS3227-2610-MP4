import { ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { draftResponseSchema, proposalLifecycleResponseSchema, workingContentSchema, type WorkingContent,
  type SaveDraftRequest, type SubmitProposalRequest, type WithdrawProposalRequest, type ReopenProposalRequest } from '@specsentry/shared';
import { ActivityService } from '../activity/activity.service';
import { DatabaseService } from '../database/database.service';
import type { Prisma } from '../generated/prisma/client';
import { businessTransaction, type BusinessActor } from '../identity/business-context';
import { NotificationsService } from '../notifications/notifications.service';
import { nextVersion } from '../reviews/reviewer-context';
import { ProposalsService } from './proposals.service';
import { prepareWorkingContent, submittedDiff } from './working-revisions';

type Root = Awaited<ReturnType<ProposalsService['lockRoot']>>;
type LockedAccount = { id: string; enabled: boolean; role: string; version: number };
const editable = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'CHANGES_REQUESTED'];
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

@Injectable()
export class ProposalLifecycleService {
  constructor(private readonly database: DatabaseService, private readonly proposals: ProposalsService,
    private readonly activity: ActivityService, private readonly notifications: NotificationsService) {}

  private owner(root: Root, actor: BusinessActor) {
    if (root.ownerId !== actor.accountId) throw new ForbiddenException();
  }
  private editable(root: Root, actor: BusinessActor, expectedVersion?: number) {
    this.owner(root, actor);
    if (!editable.includes(root.state) || root.releaseAttachmentRef !== null ||
      (expectedVersion !== undefined && root.version !== expectedVersion)) throw new ConflictException();
  }
  private response(root: Root, workingRevisionId: string | null, overrides: Record<string, unknown> = {}) {
    return proposalLifecycleResponseSchema.parse({ proposalId: root.id, revisionId: root.currentRevisionId,
      workingRevisionId, assignmentId: root.currentAssignmentId, assignmentVersion: root.currentAssignment?.version ?? null,
      version: root.version, state: root.state, ...overrides });
  }
  private async pointer(id: string) {
    // Only the opaque account pointer is read before account/session/root locks.
    const row = await this.database.client.changeProposal.findUnique({ where: { id },
      select: { currentAssignment: { select: { reviewerId: true } } } });
    return row?.currentAssignment?.reviewerId;
  }
  private retained(root: Root, accounts: LockedAccount[]) {
    const assignment = root.currentAssignment;
    if (!assignment) return null;
    const reviewer = accounts.find(a => a.id === assignment.reviewerId);
    if (!reviewer || !reviewer.enabled || reviewer.role !== 'REVIEWER' || assignment.status !== 'ACTIVE' ||
      assignment.revisionId !== root.currentRevisionId) throw new ConflictException();
    return assignment;
  }
  private async sources(tx: Prisma.TransactionClient, root: Root) {
    const saved = await tx.workingRevision.findUnique({ where: { proposalId: root.id } });
    const current = root.currentRevisionId ? await tx.proposalRevision.findFirst({ where: { id: root.currentRevisionId, proposalId: root.id },
      select: { criteria: { select: { stableKey: true, statement: true } }, evidence: { select: { id: true, text: true } } } }) : null;
    return [ ...(current ? [current] : []), ...(saved ? [workingContentSchema.parse(saved.content)] : []) ];
  }
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
      this.owner(root, actor);
      const working = await tx.workingRevision.findUnique({ where: { proposalId: id } });
      if (!working) throw new NotFoundException();
      return draftResponseSchema.parse({ proposalId: id, workingRevisionId: working.id, version: root.version,
        state: root.state, content: working.content });
    });
  }
  save(actor: BusinessActor, id: string, body: SaveDraftRequest) {
    return businessTransaction(this.database, actor, 'CONTRIBUTOR', id, 'PROPOSAL_SAVE', async tx => {
      const root = await this.proposals.lockRoot(tx, id);
      this.editable(root, actor, body.expectedVersion);
      const content = prepareWorkingContent(body.content, await this.sources(tx, root));
      const working = await tx.workingRevision.upsert({ where: { proposalId: id },
        create: { proposalId: id, content: content as Prisma.InputJsonValue }, update: { content: content as Prisma.InputJsonValue } });
      const version = nextVersion(root.version);
      await tx.changeProposal.update({ where: { id }, data: { version } });
      await this.activity.append(tx, { proposalId: id, revisionId: root.currentRevisionId, actorId: actor.accountId,
        action: 'DRAFT_SAVED', summary: 'Private working draft saved.' });
      return this.response(root, working.id, { version });
    });
  }
  async submit(actor: BusinessActor, id: string, body: SubmitProposalRequest, key: string) {
    const reviewer = await this.pointer(id);
    return businessTransaction(this.database, actor, 'CONTRIBUTOR', id, 'PROPOSAL_SUBMIT', async (tx, accounts) => {
      const root = await this.proposals.lockRoot(tx, id);
      this.owner(root, actor);
      const keyHash = hash(key); const requestHash = hash(JSON.stringify({ expectedVersion: body.expectedVersion, workingRevisionId: body.workingRevisionId }));
      const scope = { actorId: actor.accountId, operation: 'SUBMIT', proposalId: id, keyHash };
      const prior = await tx.reviewIdempotency.findUnique({ where: { actorId_operation_proposalId_keyHash: scope } });
      if (prior && prior.expiresAt.getTime() > Date.now()) {
        if (prior.requestHash !== requestHash) throw new ConflictException();
        return proposalLifecycleResponseSchema.parse(prior.response);
      }
      this.editable(root, actor, body.expectedVersion);
      const assignment = this.retained(root, accounts);
      const working = await tx.workingRevision.findFirst({ where: { id: body.workingRevisionId, proposalId: id } });
      if (!working) throw new UnprocessableEntityException();
      const content = workingContentSchema.parse(working.content);
      if (!content.summary.trim() || content.criteria.length < 1 || !content.criteria.some(c => c.required)) throw new UnprocessableEntityException();
      const diffText = submittedDiff(content.diffText);
      const version = nextVersion(root.version);
      const revision = await tx.proposalRevision.create({ data: { proposalId: id, number: nextVersion(root.currentRevision?.number ?? 0),
        summary: content.summary, problem: content.problem, constraints: content.constraints, expectedBehavior: content.expectedBehavior, diffText,
        criteria: { create: content.criteria.map(c => ({ stableKey: c.stableKey!, statement: c.statement, required: c.required })) },
        evidence: { create: content.evidence.map(e => ({ text: e.text, evidenceHash: hash(e.text) })) } } });
      let newAssignment = null;
      if (assignment) {
        await tx.reviewAssignment.update({ where: { id: assignment.id }, data: { status: 'CLOSED', endReason: 'REVISION_REPLACED',
          endedAt: new Date(), version: nextVersion(assignment.version) } });
        newAssignment = await tx.reviewAssignment.create({ data: { proposalId: id, revisionId: revision.id, reviewerId: assignment.reviewerId,
          accessGenerationId: assignment.accessGenerationId } });
      }
      const state = newAssignment ? 'IN_REVIEW' : 'SUBMITTED';
      await tx.changeProposal.update({ where: { id }, data: { version, state, title: content.title,
        currentRevisionId: revision.id, currentAssignmentId: newAssignment?.id ?? null, firstSubmittedAt: root.firstSubmittedAt ?? revision.submittedAt } });
      await this.activity.append(tx, { proposalId: id, revisionId: revision.id, assignmentId: newAssignment?.id,
        actorId: actor.accountId, action: root.currentRevisionId ? 'RESUBMITTED' : 'SUBMITTED', summary: 'Submitted revision published for review.' });
      if (newAssignment) await this.notifications.create(tx, { recipientId: newAssignment.reviewerId, kind: 'NEW_REVISION',
        proposalId: id, revisionId: revision.id, assignmentId: newAssignment.id }, actor.accountId);
      const response = this.response(root, working.id, { revisionId: revision.id, assignmentId: newAssignment?.id ?? null,
        assignmentVersion: newAssignment?.version ?? null, version, state });
      if (prior) await tx.reviewIdempotency.delete({ where: { id: prior.id } });
      await tx.reviewIdempotency.create({ data: { ...scope, requestHash, response, expiresAt: new Date(Date.now() + 86400000) } });
      return response;
    }, reviewer ? [reviewer] : []);
  }
  async withdraw(actor: BusinessActor, id: string, body: WithdrawProposalRequest) {
    const reviewer = await this.pointer(id);
    return businessTransaction(this.database, actor, 'CONTRIBUTOR', id, 'PROPOSAL_WITHDRAW', async (tx, accounts) => {
      const root = await this.proposals.lockRoot(tx, id);
      this.editable(root, actor, body.expectedVersion);
      const assignment = this.retained(root, accounts);
      const version = nextVersion(root.version);
      if (assignment) await tx.reviewAssignment.update({ where: { id: assignment.id }, data: { status: 'CLOSED', endReason: 'WITHDRAWN',
        endedAt: new Date(), version: nextVersion(assignment.version) } });
      await tx.changeProposal.update({ where: { id }, data: { state: 'WITHDRAWN', currentAssignmentId: null, version } });
      await this.activity.append(tx, { proposalId: id, revisionId: root.currentRevisionId, assignmentId: assignment?.id,
        actorId: actor.accountId, action: 'WITHDRAWN', summary: 'Proposal withdrawn by its owner.', reason: body.reason });
      if (assignment) await this.notifications.create(tx, { recipientId: assignment.reviewerId, kind: 'WITHDRAWN',
        proposalId: id, revisionId: root.currentRevisionId!, assignmentId: assignment.id }, actor.accountId);
      return this.response(root, null, { state: 'WITHDRAWN', assignmentId: null, assignmentVersion: null, version });
    }, reviewer ? [reviewer] : []);
  }
  async reopen(actor: BusinessActor, id: string, body: ReopenProposalRequest) {
    const reviewer = await this.pointer(id);
    return businessTransaction(this.database, actor, 'CONTRIBUTOR', id, 'PROPOSAL_REOPEN', async (tx, accounts) => {
      const root = await this.proposals.lockRoot(tx, id);
      this.owner(root, actor);
      if (root.state !== 'APPROVED' || root.releaseAttachmentRef !== null || root.version !== body.expectedVersion ||
        !root.currentRevisionId || !root.currentAssignment || root.currentAssignment.status !== 'ACTIVE') throw new ConflictException();
      // A completed approval keeps its original assignee on account disablement.
      // Once reopened, unfinished work must no longer retain an unavailable one.
      const account = accounts.find(locked => locked.id === root.currentAssignment!.reviewerId);
      if (!account) throw new ConflictException();
      const releaseAssignment = !account.enabled || account.role !== 'REVIEWER';
      const decision = await tx.reviewDecision.findFirst({ where: { proposalId: id, revisionId: root.currentRevisionId,
        assignmentId: root.currentAssignment.id, decision: 'APPROVE' } });
      if (!decision || await tx.approvalInvalidation.findUnique({ where: { decisionId: decision.id } })) throw new ConflictException();
      const version = nextVersion(root.version);
      await tx.approvalInvalidation.create({ data: { proposalId: id, revisionId: root.currentRevisionId,
        assignmentId: root.currentAssignment.id, decisionId: decision.id, actorId: actor.accountId, mutationVersion: version } });
      if (releaseAssignment) await tx.reviewAssignment.update({ where: { id: root.currentAssignment.id }, data: {
        status: 'CLOSED', endReason: 'ACCOUNT_DISABLED', endedAt: new Date(), version: nextVersion(root.currentAssignment.version) } });
      await tx.changeProposal.update({ where: { id }, data: { state: 'CHANGES_REQUESTED', version,
        currentAssignmentId: releaseAssignment ? null : root.currentAssignment.id } });
      await this.activity.append(tx, { proposalId: id, revisionId: root.currentRevisionId, assignmentId: root.currentAssignment.id,
        actorId: actor.accountId, action: 'REOPENED', summary: 'Approval invalidated; owner reopened proposal for revision.' });
      if (releaseAssignment) await this.activity.append(tx, { proposalId: id, revisionId: root.currentRevisionId,
        assignmentId: root.currentAssignment.id, actorId: actor.accountId, action: 'ASSIGNMENT_RELEASED',
        summary: 'Assignment released because the reviewer account was unavailable.', reason: 'Reviewer account unavailable.' });
      const working = await tx.workingRevision.findUnique({ where: { proposalId: id }, select: { id: true } });
      return this.response(root, working?.id ?? null, { state: 'CHANGES_REQUESTED', version,
        assignmentId: releaseAssignment ? null : root.currentAssignment.id,
        assignmentVersion: releaseAssignment ? null : root.currentAssignment.version });
    }, reviewer ? [reviewer] : []);
  }
}
