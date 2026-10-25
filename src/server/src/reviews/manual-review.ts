import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import {
  coverageCommandResponseSchema, coverageHistoryResponseSchema, decisionCommandResponseSchema, decisionsResponseSchema,
  findingCommandResponseSchema, findingEventCommandResponseSchema, findingHistoryResponseSchema, findingsResponseSchema,
  humanReviewResponseSchema, type CoverageHistoryQuery, type CoverageWriteRequest, type CreateFindingRequest,
  type FindingAmendmentRequest, type FindingTransitionRequest, type HumanReviewPageQuery, type ReviewDecisionRequest,
} from '@specsentry/shared';
import type { Prisma } from '../generated/prisma/client';
import { ProposalsService } from '../proposals/proposals.service';
import { ActivityService } from '../activity/activity.service';
import { decodeCursor, encodeCursor, nextVersion, type ReviewerActor, type ReviewTransaction } from './reviewer-context';

const author = { select: { id: true, username: true } } as const;
const coverageInclude = { actor: author, evidence: { select: { evidenceId: true }, orderBy: { evidenceId: 'asc' as const } } };
const findingInclude = { actor: author, events: { orderBy: { mutationVersion: 'desc' as const }, take: 1 } };
type Coverage = Prisma.CoverageAssessmentGetPayload<{ include: typeof coverageInclude }>;
type Finding = Prisma.ReviewFindingGetPayload<{ include: typeof findingInclude }>;
type Event = Prisma.FindingEventGetPayload<{ include: { actor: typeof author } }>;
type Decision = Prisma.ReviewDecisionGetPayload<{ include: { actor: typeof author } }>;
type Root = Awaited<ReturnType<ProposalsService['assignedRoot']>>;
type WriteScope = { expectedVersion: number; revisionId: string; assignmentId: string; expectedAssignmentVersion: number };
const coverageDto = ({ actorId, evidence, createdAt, ...row }: Coverage) => {
  void actorId;
  return { ...row, evidenceIds: evidence.map((item) => item.evidenceId), createdAt: createdAt.toISOString() };
};
const findingDto = ({ actorId, events, createdAt, ...row }: Finding) => {
  void actorId;
  return { ...row, createdAt: createdAt.toISOString(), status: events[0]?.status ?? 'OPEN', currentSeverity: events[0]?.severity ?? row.severity };
};
const eventDto = ({ actorId, createdAt, ...row }: Event) => { void actorId; return { ...row, createdAt: createdAt.toISOString() }; };
const decisionDto = ({ actorId, createdAt, ...row }: Decision) => { void actorId; return { ...row, createdAt: createdAt.toISOString() }; };
const sha = (value: string) => createHash('sha256').update(value).digest('hex');

// All methods run inside the caller's enabled-account transaction. Protected
// record reads follow a root lock and current-assignment authorization.
export class ManualReviewService {
  constructor(private readonly proposals: ProposalsService, private readonly activity: ActivityService) {}

  private async writable(tx: ReviewTransaction, actor: ReviewerActor, id: string, body: WriteScope) {
    const root = await this.proposals.assignedRoot(tx, id, actor.accountId);
    this.checkWrite(root, body);
    return root;
  }
  private checkWrite(root: Root, body: WriteScope) {
    if (root.version !== body.expectedVersion || root.currentRevisionId !== body.revisionId ||
      root.currentAssignment!.id !== body.assignmentId || root.currentAssignment!.version !== body.expectedAssignmentVersion ||
      !['IN_REVIEW', 'CHANGES_REQUESTED'].includes(root.state)) throw new ConflictException();
  }
  private command(root: Root, version: number, state = root.state) {
    return { proposalId: root.id, revisionId: root.currentRevisionId!, assignmentId: root.currentAssignment!.id,
      state, version, assignmentVersion: root.currentAssignment!.version };
  }
  private async advance(tx: ReviewTransaction, root: Root, action: Prisma.ProposalActivityUncheckedCreateInput['action'],
    summary: string, detail: { state?: Root['state']; reason?: string | null } = {}) {
    const state = detail.state ?? root.state;
    const version = nextVersion(root.version);
    await tx.changeProposal.update({ where: { id: root.id }, data: { version, state } });
    await this.activity.append(tx, { proposalId: root.id, revisionId: root.currentRevisionId!, assignmentId: root.currentAssignment!.id,
      actorId: root.currentAssignment!.reviewerId, action, summary, reason: detail.reason });
    return this.command(root, version, state);
  }
  private async revision(tx: ReviewTransaction, root: Root, revisionId?: string) {
    const revision = await tx.proposalRevision.findFirst({ where: { proposalId: root.id, id: revisionId ?? root.currentRevisionId! },
      select: { id: true, criteria: { select: { id: true, required: true } } } });
    if (!revision) throw new NotFoundException();
    return revision;
  }
  private async effectiveCoverage(tx: ReviewTransaction, proposalId: string, revisionId: string) {
    const ids = await tx.$queryRaw<{ id: string }[]>`SELECT DISTINCT ON ("criterionId") "id" FROM "CoverageAssessment"
      WHERE "proposalId" = ${proposalId} AND "revisionId" = ${revisionId} ORDER BY "criterionId", "mutationVersion" DESC`;
    return tx.coverageAssessment.findMany({ where: { id: { in: ids.map((row) => row.id) } }, include: coverageInclude, orderBy: { criterionId: 'asc' } });
  }
  private async blockers(tx: ReviewTransaction, root: Root, revision: Awaited<ReturnType<ManualReviewService['revision']>>, coverage: Coverage[]) {
    const result: { code: 'STATE' | 'MISSING_ASSESSMENT' | 'UNCONFIRMED_ASSESSMENT' | 'REQUIRED_NOT_COVERED' | 'UNRESOLVED_HIGH_CRITICAL'; criterionId?: string }[] = [];
    if (root.state !== 'IN_REVIEW' || revision.id !== root.currentRevisionId) result.push({ code: 'STATE' });
    for (const criterion of revision.criteria) {
      const row = coverage.find((item) => item.criterionId === criterion.id);
      if (!row) result.push({ code: 'MISSING_ASSESSMENT', criterionId: criterion.id });
      else {
        if (row.assignmentId !== root.currentAssignment!.id) result.push({ code: 'UNCONFIRMED_ASSESSMENT', criterionId: criterion.id });
        if (criterion.required && row.status !== 'COVERED') result.push({ code: 'REQUIRED_NOT_COVERED', criterionId: criterion.id });
      }
    }
    const blockers = await tx.$queryRaw<{ id: string }[]>`SELECT f."id" FROM "ReviewFinding" f
      LEFT JOIN LATERAL (SELECT "severity", "status" FROM "FindingEvent" WHERE "findingId"=f."id" ORDER BY "mutationVersion" DESC LIMIT 1) e ON true
      WHERE f."proposalId"=${root.id} AND COALESCE(e."severity",f."severity") IN ('HIGH','CRITICAL')
      AND COALESCE(e."status",'OPEN'::"FindingStatus")='OPEN' LIMIT 1`;
    if (blockers.length) result.push({ code: 'UNRESOLVED_HIGH_CRITICAL' });
    return result;
  }
  async review(tx: ReviewTransaction, actor: ReviewerActor, id: string, query: { revisionId?: string }) {
    const root = await this.proposals.assignedRoot(tx, id, actor.accountId);
    const revision = await this.revision(tx, root, query.revisionId);
    const coverage = await this.effectiveCoverage(tx, id, revision.id);
    return humanReviewResponseSchema.parse({ proposalId: id, revisionId: revision.id, version: root.version,
      assignmentId: root.currentAssignment!.id, assignmentVersion: root.currentAssignment!.version,
      editable: revision.id === root.currentRevisionId && ['IN_REVIEW', 'CHANGES_REQUESTED'].includes(root.state),
      coverage: coverage.map((row) => ({ ...coverageDto(row), confirmed: row.assignmentId === root.currentAssignment!.id })),
      approvalBlockers: await this.blockers(tx, root, revision, coverage) });
  }
  async coverage(tx: ReviewTransaction, actor: ReviewerActor, id: string, criterionId: string, body: CoverageWriteRequest) {
    const root = await this.writable(tx, actor, id, body);
    if (!await tx.acceptanceCriterion.findFirst({ where: { id: criterionId, revisionId: body.revisionId }, select: { id: true } })) throw new UnprocessableEntityException();
    let status: Coverage['status']; let rationale: string | null; let evidenceIds: string[]; let sourceCoverageId: string | null = null;
    if (body.operation === 'CONFIRM') {
      const source = (await this.effectiveCoverage(tx, id, body.revisionId)).find((row) => row.criterionId === criterionId);
      if (!source || source.id !== body.sourceCoverageId || source.assignmentId === body.assignmentId) throw new ConflictException();
      status = source.status; rationale = source.rationale; evidenceIds = source.evidence.map((row) => row.evidenceId); sourceCoverageId = source.id;
    } else { status = body.status; rationale = body.rationale ?? null; evidenceIds = body.evidenceIds; }
    if (await tx.testEvidence.count({ where: { revisionId: body.revisionId, id: { in: evidenceIds } } }) !== evidenceIds.length) throw new UnprocessableEntityException();
    const row = await tx.coverageAssessment.create({ data: { proposalId: id, revisionId: body.revisionId, assignmentId: body.assignmentId,
      actorId: actor.accountId, criterionId, status, rationale, sourceCoverageId, mutationVersion: nextVersion(root.version),
      evidence: { create: evidenceIds.map((evidenceId) => ({ evidenceId })) } }, include: coverageInclude });
    const command = await this.advance(tx, root, body.operation === 'CONFIRM' ? 'COVERAGE_CONFIRMED' : 'COVERAGE_ASSESSED',
      body.operation === 'CONFIRM' ? `Criterion ${criterionId}: inherited assessment individually confirmed.` :
        `Criterion ${criterionId}: assessment recorded as ${status}.`, { reason: rationale });
    return coverageCommandResponseSchema.parse({ ...command, coverage: coverageDto(row) });
  }
  async createFinding(tx: ReviewTransaction, actor: ReviewerActor, id: string, body: CreateFindingRequest) {
    const root = await this.writable(tx, actor, id, body);
    if (body.criterionId && !await tx.acceptanceCriterion.findFirst({ where: { id: body.criterionId, revisionId: body.revisionId }, select: { id: true } })) throw new UnprocessableEntityException();
    const row = await tx.reviewFinding.create({ data: { proposalId: id, revisionId: body.revisionId, assignmentId: body.assignmentId,
      actorId: actor.accountId, severity: body.severity, description: body.description, criterionId: body.criterionId,
      diffLocation: body.diffLocation, mutationVersion: nextVersion(root.version) }, include: findingInclude });
    return findingCommandResponseSchema.parse({ ...await this.advance(tx, root, 'FINDING_CREATED',
      `Finding ${row.id}: human review finding recorded.`), finding: findingDto(row) });
  }
  private async scopedFinding(tx: ReviewTransaction, actor: ReviewerActor, findingId: string, body: WriteScope) {
    // Only an opaque proposal pointer is read before authorization. No finding content is retrieved.
    const pointer = await tx.reviewFinding.findUnique({ where: { id: findingId }, select: { proposalId: true } });
    if (!pointer) throw new NotFoundException();
    const root = await this.writable(tx, actor, pointer.proposalId, body);
    const finding = await tx.reviewFinding.findFirstOrThrow({ where: { id: findingId, proposalId: root.id }, include: findingInclude });
    return { root, finding };
  }
  async changeFinding(tx: ReviewTransaction, actor: ReviewerActor, findingId: string, body: FindingTransitionRequest | FindingAmendmentRequest) {
    const { root, finding } = await this.scopedFinding(tx, actor, findingId, body);
    const current = findingDto(finding);
    const operation = 'operation' in body ? body.operation : 'AMEND';
    if ((operation === 'RESOLVE' && current.status !== 'OPEN') || (operation === 'REOPEN' && current.status !== 'RESOLVED') ||
      (operation === 'CHANGE_SEVERITY' && 'severity' in body && body.severity === current.currentSeverity)) throw new ConflictException();
    const row = await tx.findingEvent.create({ data: { findingId, proposalId: root.id, revisionId: body.revisionId,
      assignmentId: body.assignmentId, actorId: actor.accountId, operation, reason: body.reason,
      description: 'description' in body ? body.description : null,
      severity: 'severity' in body ? body.severity : current.currentSeverity,
      status: operation === 'RESOLVE' ? 'RESOLVED' : operation === 'REOPEN' ? 'OPEN' : current.status,
      mutationVersion: nextVersion(root.version) }, include: { actor: author } });
    return findingEventCommandResponseSchema.parse({ ...await this.advance(tx, root, operation === 'AMEND' ? 'FINDING_AMENDED' : 'FINDING_TRANSITIONED',
      `Finding ${findingId}: ${operation === 'AMEND' ? 'correction appended' : operation + ' transition recorded'}.`,
      { reason: body.reason }), event: eventDto(row) });
  }
  private position(cursorValue: string | undefined, scope: string) { return decodeCursor(cursorValue, scope, 'number'); }
  private paged<T extends { id: string; mutationVersion: number }>(rows: T[], query: HumanReviewPageQuery, scope: string) {
    const items = rows.slice(0, query.limit); const last = items.at(-1);
    return { items, nextCursor: rows.length > query.limit && last ? encodeCursor(scope, { id: last.id, number: last.mutationVersion }) : null };
  }
  async findings(tx: ReviewTransaction, actor: ReviewerActor, id: string, query: HumanReviewPageQuery) {
    await this.proposals.assignedRoot(tx, id, actor.accountId);
    const scope = JSON.stringify(['human-findings', id]); const cursor = this.position(query.cursor, scope);
    const rows = await tx.reviewFinding.findMany({ where: { proposalId: id, ...(cursor ? { mutationVersion: { gt: cursor.number } } : {}) },
      orderBy: { mutationVersion: 'asc' }, take: query.limit + 1, include: findingInclude });
    return findingsResponseSchema.parse(this.paged(rows.map(findingDto), query, scope));
  }
  async decisions(tx: ReviewTransaction, actor: ReviewerActor, id: string, query: HumanReviewPageQuery) {
    await this.proposals.assignedRoot(tx, id, actor.accountId);
    const scope = JSON.stringify(['human-decisions', id]); const cursor = this.position(query.cursor, scope);
    const rows = await tx.reviewDecision.findMany({ where: { proposalId: id, ...(cursor ? { mutationVersion: { gt: cursor.number } } : {}) },
      orderBy: { mutationVersion: 'asc' }, take: query.limit + 1, include: { actor: author } });
    return decisionsResponseSchema.parse(this.paged(rows.map(decisionDto), query, scope));
  }
  async coverageHistory(tx: ReviewTransaction, actor: ReviewerActor, id: string, query: CoverageHistoryQuery) {
    const root = await this.proposals.assignedRoot(tx, id, actor.accountId);
    if (query.revisionId) await this.revision(tx, root, query.revisionId);
    if (query.criterionId && !await tx.acceptanceCriterion.findFirst({ where: { id: query.criterionId,
      revision: { proposalId: id }, ...(query.revisionId ? { revisionId: query.revisionId } : {}) }, select: { id: true } })) throw new NotFoundException();
    const scope = JSON.stringify(['human-coverage', id, query.revisionId ?? null, query.criterionId ?? null]); const cursor = this.position(query.cursor, scope);
    const rows = await tx.coverageAssessment.findMany({ where: { proposalId: id, revisionId: query.revisionId, criterionId: query.criterionId,
      ...(cursor ? { mutationVersion: { gt: cursor.number } } : {}) }, orderBy: { mutationVersion: 'asc' }, take: query.limit + 1, include: coverageInclude });
    return coverageHistoryResponseSchema.parse(this.paged(rows.map(coverageDto), query, scope));
  }
  async findingHistory(tx: ReviewTransaction, actor: ReviewerActor, proposalId: string, findingId: string, query: HumanReviewPageQuery) {
    await this.proposals.assignedRoot(tx, proposalId, actor.accountId);
    if (!await tx.reviewFinding.findFirst({ where: { id: findingId, proposalId }, select: { id: true } })) throw new NotFoundException();
    const scope = JSON.stringify(['human-finding-history', proposalId, findingId]); const cursor = this.position(query.cursor, scope);
    const rows = await tx.findingEvent.findMany({ where: { proposalId, findingId, ...(cursor ? { mutationVersion: { gt: cursor.number } } : {}) },
      orderBy: { mutationVersion: 'asc' }, take: query.limit + 1, include: { actor: author } });
    return findingHistoryResponseSchema.parse(this.paged(rows.map(eventDto), query, scope));
  }
  async decide(tx: ReviewTransaction, actor: ReviewerActor, id: string, body: ReviewDecisionRequest, key: string) {
    // Current access is checked before replay, while original expected versions
    // intentionally remain replayable after the committed decision advances them.
    const root = await this.proposals.assignedRoot(tx, id, actor.accountId);
    const keyHash = sha(key); const operation = 'REVIEW_DECISION';
    const requestHash = sha(JSON.stringify([body.expectedVersion, body.revisionId, body.assignmentId, body.expectedAssignmentVersion, body.decision, body.note ?? null]));
    const where = { actorId_operation_proposalId_keyHash: { actorId: actor.accountId, operation, proposalId: id, keyHash } };
    const replay = await tx.reviewIdempotency.findUnique({ where });
    if (replay && replay.expiresAt.getTime() > Date.now()) {
      if (replay.requestHash !== requestHash) throw new ConflictException();
      if (root.currentRevisionId !== body.revisionId || root.currentAssignment!.id !== body.assignmentId ||
        root.currentAssignment!.version !== body.expectedAssignmentVersion) throw new ConflictException();
      return decisionCommandResponseSchema.parse(replay.response);
    }
    this.checkWrite(root, body);
    if (root.state !== 'IN_REVIEW') throw new ConflictException();
    const revision = await this.revision(tx, root);
    if (body.decision === 'APPROVE') {
      const coverage = await this.effectiveCoverage(tx, id, revision.id);
      const blockers = await this.blockers(tx, root, revision, coverage);
      if (blockers.length) throw new ConflictException({ message: 'Approval blocked', approvalBlockers: blockers });
    } else if (!body.note && await tx.reviewFinding.count({ where: { proposalId: id } }) === 0) throw new UnprocessableEntityException();
    const row = await tx.reviewDecision.create({ data: { proposalId: id, revisionId: body.revisionId,
      assignmentId: body.assignmentId, actorId: actor.accountId, decision: body.decision, note: body.note,
      mutationVersion: nextVersion(root.version) }, include: { actor: author } });
    const state = body.decision === 'APPROVE' ? 'APPROVED' : 'CHANGES_REQUESTED';
    const response = decisionCommandResponseSchema.parse({ ...await this.advance(tx, root,
      body.decision === 'APPROVE' ? 'REVIEW_APPROVED' : 'CHANGES_REQUESTED',
      `Decision ${row.id}: ${body.decision === 'APPROVE' ? 'review approved' : 'reviewer requested changes'}.`,
      { state, reason: body.note }), decision: decisionDto(row) });
    // Expired entries can be replaced only after ordinary version/lifecycle checks.
    const data = { requestHash, response, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) };
    await tx.reviewIdempotency.upsert({ where, create: { proposalId: id, actorId: actor.accountId, operation, keyHash, ...data }, update: data });
    return response;
  }
}
