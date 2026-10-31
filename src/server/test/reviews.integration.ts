import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { assignedReviewsResponseSchema, proposalActivityResponseSchema, proposalDetailResponseSchema,
  reviewPoolResponseSchema, submittedRevisionsResponseSchema, type ProposalState } from '@specsentry/shared';
import { AppModule } from '../src/app.module';
import { ActivityService } from '../src/activity/activity.service';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { configureHttp } from '../src/http';
import { AccountAdministrationService } from '../src/identity/account-administration.service';
import { hashPassword } from '../src/identity/identity.service';
import { ReviewsService } from '../src/reviews/reviews.service';
import { reviewerFixtureRevision } from '../src/reviews/seed-reviewer';
import { persistedTestActor } from './business-fixtures';
import type { ReviewerActor } from '../src/reviews/reviewer-context';

describe('PostgreSQL Reviewer intake acceptance (INT-01–11)', () => {
  let app: NestExpressApplication;
  let database: DatabaseService;
  let reviews: ReviewsService;
  let activity: ActivityService;
  let administration: AccountAdministrationService;
  let a: ReviewerActor;
  let b: ReviewerActor;
  const prefix = `intake-${randomUUID()}`;
  const ownerId = `${prefix}-owner`;
  const password = 'synthetic-reviewer-integration-password';
  let sequence = 0;
  const businessTables = '"ReleasePublicationSnapshot", "ReleaseSmokeTest", "ReleaseCandidateMember", "Notification", "ApprovalInvalidation", "ReleaseCandidate", "WorkingRevision", "CoverageEvidence", "CoverageAssessment", "FindingEvent", "ReviewFinding", "ReviewDecision", "ReviewIdempotency", "CriterionEvidenceLink", "ProposalActivity", "ReviewAssignment", "AcceptanceCriterion", "TestEvidence", "ProposalRevision", "ChangeProposal"';
  async function clearBusiness() {
    // Explicit disposable TEST_DATABASE_URL is mandatory; never truncate authentication tables.
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL is required');
    await database.client.$executeRawUnsafe(`TRUNCATE ${businessTables}`);
  }
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL is required');
    const config = readConfig({ NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL,
      SESSION_SECRET: 'reviewer-integration-test-secret-at-least-32' });
    const module = await Test.createTestingModule({ imports: [AppModule.register(config)] }).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false }); configureHttp(app); await app.init();
    database = app.get(DatabaseService); reviews = app.get(ReviewsService); activity = app.get(ActivityService);
    administration = new AccountAdministrationService(database, reviews);
    const passwordHash = await hashPassword(password);
    await database.client.userAccount.createMany({ data: [
      { id: ownerId, username: `${prefix}-owner`, role: 'CONTRIBUTOR', passwordHash },
      { id: `${prefix}-a`, username: `${prefix}-a`, role: 'REVIEWER', passwordHash },
      { id: `${prefix}-b`, username: `${prefix}-b`, role: 'REVIEWER', passwordHash },
    ] });
    a = await persistedTestActor(database, `${prefix}-a`, prefix);
    b = await persistedTestActor(database, `${prefix}-b`, prefix);
  });
  beforeEach(async () => {
    await clearBusiness();
    await database.client.userAccount.updateMany({ where: { id: { in: [a.accountId, b.accountId] } }, data: { enabled: true, version: 1, role: 'REVIEWER' } });
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (database) {
      await clearBusiness();
      await database.client.authSession.deleteMany({ where: { OR: [{ data: { contains: a.accountId } }, { data: { contains: b.accountId } }] } });
      await database.client.securityEvent.deleteMany({ where: { OR: [{ correlationId: prefix }, { target: { startsWith: prefix } }, { actorId: { startsWith: prefix } }] } });
      await database.client.userAccount.deleteMany({ where: { id: { startsWith: prefix } } });
    }
    await app?.close();
  });
  async function proposal(options: { state?: ProposalState; assignee?: ReviewerActor; assignedAt?: Date; revisions?: number; date?: Date; owner?: string; large?: boolean; id?: string } = {}) {
    const id = options.id ?? `review-case-${sequence++}`;
    const date = options.date ?? new Date('2026-01-01T00:00:00.000Z');
    return database.client.$transaction(async (tx) => {
      await tx.changeProposal.create({ data: { id, title: `Safe title ${id}`, ownerId: options.owner ?? ownerId,
        state: options.state ?? (options.assignee ? 'IN_REVIEW' : 'SUBMITTED'), firstSubmittedAt: date } });
      let revisionId = '';
      for (let number = 1; number <= (options.revisions ?? 1); number++) {
        const revision = reviewerFixtureRevision(id, number, new Date(date.getTime() + (number - 1) * 86400000), options.large);
        revisionId = revision.id;
        const { criteria, evidence, criterionEvidenceLinks, submittedAt, ...fields } = revision;
        await tx.proposalRevision.create({ data: { ...fields, proposalId: id, submittedAt: new Date(submittedAt),
          criteria: { create: criteria }, evidence: { create: evidence } } });
        await tx.criterionEvidenceLink.createMany({ data: criterionEvidenceLinks.map((link) => ({ ...link, revisionId })) });
        await tx.proposalActivity.create({ data: { id: `${revisionId}-submitted`, proposalId: id, revisionId, actorId: ownerId,
          action: number === 1 ? 'SUBMITTED' : 'RESUBMITTED', summary: 'Synthetic submitted snapshot.', timestamp: date } });
      }
      await tx.changeProposal.update({ where: { id }, data: { currentRevisionId: revisionId } });
      let assignmentId: string | undefined;
      if (options.assignee) {
        const assignment = await tx.reviewAssignment.create({ data: { proposalId: id, revisionId, reviewerId: options.assignee.accountId, assignedAt: options.assignedAt } });
        assignmentId = assignment.id;
        await tx.changeProposal.update({ where: { id }, data: { currentAssignmentId: assignmentId } });
      }
      return { id, revisionId, assignmentId };
    });
  }
  const dropBody = (command: Awaited<ReturnType<ReviewsService['claim']>>) => ({ expectedVersion: command.version,
    revisionId: command.revisionId, assignmentId: command.assignmentId, expectedAssignmentVersion: command.assignmentVersion });

  it('INT-02/03 scopes safe pool projections, author/age filters and timestamp-ID keyset pages', async () => {
    const date = new Date(Date.now() - 10 * 86400000);
    await proposal({ id: 'paging-a', date }); await proposal({ id: 'paging-b', date }); await proposal({ id: 'paging-c', date });
    await proposal({ state: 'DRAFT' }); await proposal({ state: 'WITHDRAWN' }); await proposal({ assignee: b });
    await proposal({ date: new Date(Date.now() - 30 * 86400000) });
    const query = { limit: 1, authorId: ownerId, minAgeDays: 5, maxAgeDays: 20 };
    const first = reviewPoolResponseSchema.parse(await reviews.queue(a, query));
    expect(first.items.map((item) => item.id)).toEqual(['paging-a']);
    expect(Object.keys(first.items[0]!).sort()).toEqual(['author', 'awaitingRevision', 'firstSubmittedAt', 'id', 'latestSubmittedAt', 'summary', 'title', 'version']);
    expect(JSON.stringify(first)).not.toMatch(/diffText|problem|criteria|evidence|passwordHash|reviewerId|totalCount/);
    const second = reviewPoolResponseSchema.parse(await reviews.queue(a, { ...query, cursor: first.nextCursor! }));
    expect(second.items.map((item) => item.id)).toEqual(['paging-b']);
    const third = reviewPoolResponseSchema.parse(await reviews.queue(a, { ...query, cursor: second.nextCursor! }));
    expect(third.items.map((item) => item.id)).toEqual(['paging-c']); expect(third.nextCursor).toBeNull();
    await expect(reviews.queue(a, { ...query, authorId: 'another', cursor: first.nextCursor! })).rejects.toMatchObject({ status: 422 });
    await expect(reviews.queue(a, { ...query, cursor: 'tampered!' })).rejects.toMatchObject({ status: 422 });
    await expect(reviews.queue(a, { ...query, cursor: first.nextCursor! }, true)).rejects.toMatchObject({ status: 422 });
  });
  it('INT-03 preserves original age versus latest revision age and scopes own assigned state filters', async () => {
    const root = await proposal({ assignee: a, revisions: 3 }); await proposal({ assignee: b });
    await proposal({ assignee: a, state: 'APPROVED' });
    const result = assignedReviewsResponseSchema.parse(await reviews.queue(a, { limit: 20, state: 'IN_REVIEW' }, true));
    expect(result.items).toHaveLength(1); expect(result.items[0]!.id).toBe(root.id);
    expect(new Date(result.items[0]!.latestSubmittedAt).getTime() - new Date(result.items[0]!.firstSubmittedAt).getTime()).toBe(2 * 86400000);
    expect(result.items[0]!.assignmentId).toBe(root.assignmentId);
    const empty = await reviews.queue(b, { limit: 20, state: 'APPROVED' }, true); expect(empty.items).toEqual([]);
  });
  it('INT-04 exactly one concurrent claimant wins and writes one active assignment/activity', async () => {
    const root = await proposal();
    const results = await Promise.allSettled([reviews.claim(a, root.id, { expectedVersion: 0 }), reviews.claim(b, root.id, { expectedVersion: 0 })]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((item) => item.status === 'rejected')[0]).toMatchObject({ reason: { status: 409 } });
    expect(await database.client.reviewAssignment.count({ where: { proposalId: root.id, status: 'ACTIVE' } })).toBe(1);
    expect(await database.client.proposalActivity.count({ where: { proposalId: root.id, action: 'CLAIMED' } })).toBe(1);
    expect((await database.client.changeProposal.findUniqueOrThrow({ where: { id: root.id } })).state).toBe('IN_REVIEW');
  });
  it('INT-04/06 preserves CHANGES_REQUESTED through claim and drop', async () => {
    const root = await proposal({ state: 'CHANGES_REQUESTED' });
    const claim = await reviews.claim(a, root.id, { expectedVersion: 0 }); expect(claim.state).toBe('CHANGES_REQUESTED');
    const drop = await reviews.drop(a, root.id, dropBody(claim)); expect(drop.state).toBe('CHANGES_REQUESTED');
    expect((await reviews.queue(b, { limit: 20 })).items[0]!.awaitingRevision).toBe(true);
    expect(await database.client.reviewAssignment.findUnique({ where: { id: claim.assignmentId } })).toMatchObject({ status: 'CLOSED', endReason: 'DROPPED', version: 1 });
  });
  it('INT-05/06/07 permits only current-assignee submitted content, rejects cross-proposal revision links and stale drops after same-reviewer reclaim', async () => {
    const root = await proposal({ revisions: 3 }); const other = await proposal();
    await expect(reviews.detail(a, root.id)).rejects.toMatchObject({ status: 403 });
    const claim = await reviews.claim(a, root.id, { expectedVersion: 0 });
    const detail = proposalDetailResponseSchema.parse(await reviews.detail(a, root.id)); expect(detail.revision.id).toBe(root.revisionId);
    expect(detail.revision.criteria[0]!.required).toBe(true); expect(detail.revision.evidence[0]!.text).toContain('<script>');
    const old = await reviews.detail(a, root.id, `${root.id}-r1`); expect(old.revision.number).toBe(1);
    await expect(reviews.detail(a, root.id, other.revisionId)).rejects.toMatchObject({ status: 404 });
    await expect(reviews.detail(b, root.id)).rejects.toMatchObject({ status: 403 });
    await expect(reviews.drop(b, root.id, dropBody(claim))).rejects.toMatchObject({ status: 403 });
    await expect(reviews.drop(a, root.id, { ...dropBody(claim), revisionId: other.revisionId })).rejects.toMatchObject({ status: 409 });
    const dropped = await reviews.drop(a, root.id, dropBody(claim)); expect(dropped.state).toBe('SUBMITTED');
    for (const read of [() => reviews.detail(a, root.id), () => reviews.revisions(a, root.id, { limit: 20 }), () => reviews.timeline(a, root.id)]) {
      await expect(read()).rejects.toMatchObject({ status: 403 });
    }
    const next = await reviews.claim(a, root.id, { expectedVersion: dropped.version }); expect(next.assignmentId).not.toBe(claim.assignmentId);
    await expect(reviews.drop(a, root.id, dropBody(claim))).rejects.toMatchObject({ status: 409 });
    expect(await database.client.reviewAssignment.count({ where: { proposalId: root.id } })).toBe(2);
  });
  it('INT-05/09 bounds history and activity pages, scopes cursors, reauthorizes revoked pages and keeps operational pruning separate', async () => {
    const root = await proposal({ assignee: a, revisions: 3 });
    const other = await proposal({ assignee: a });
    const page1 = submittedRevisionsResponseSchema.parse(await reviews.revisions(a, root.id, { limit: 1 }));
    const page2 = await reviews.revisions(a, root.id, { limit: 1, cursor: page1.nextCursor! });
    expect([page1.items[0]!.number, page2.items[0]!.number]).toEqual([3, 2]);
    expect(Object.keys(page1.items[0]!).sort()).toEqual(['id', 'number', 'submittedAt', 'summary']);
    await expect(reviews.revisions(a, other.id, { limit: 1, cursor: page1.nextCursor! })).rejects.toMatchObject({ status: 422 });
    const timestamp = new Date('2026-02-01T00:00:00.000Z');
    await database.client.proposalActivity.createMany({ data: Array.from({ length: 53 }, (_, index) => ({ id: `timeline-${String(index).padStart(3, '0')}`,
      proposalId: root.id, revisionId: root.revisionId, actorId: a.accountId, action: 'CLAIMED', summary: 'Safe synthetic event.', timestamp })) });
    const first = proposalActivityResponseSchema.parse(await reviews.timeline(a, root.id));
    const second = await reviews.timeline(a, root.id, first.nextCursor!);
    expect(first.items).toHaveLength(50); expect(second.items).toHaveLength(6);
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(56);
    expect(first.items[0]!.actor).toEqual({ id: ownerId, username: `${prefix}-owner` });
    await expect(reviews.timeline(a, other.id, first.nextCursor!)).rejects.toMatchObject({ status: 422 });
    const count = await database.client.proposalActivity.count();
    await database.client.securityEvent.create({ data: { action: 'OLD_TEST', target: prefix, outcome: 'success', timestamp: new Date('2000-01-01') } });
    await database.client.securityEvent.deleteMany({ where: { timestamp: { lt: new Date(Date.now() - 90 * 86400000) } } });
    expect(await database.client.proposalActivity.count()).toBe(count);
    await reviews.drop(a, root.id, { expectedVersion: 0, revisionId: root.revisionId, assignmentId: root.assignmentId!, expectedAssignmentVersion: 0 });
    await expect(reviews.timeline(a, root.id, first.nextCursor!)).rejects.toMatchObject({ status: 403 });
    await expect(reviews.revisions(a, root.id, { limit: 1, cursor: page1.nextCursor! })).rejects.toMatchObject({ status: 403 });
  });
  it('INT-06/07 actual drop/reclaim race preserves one active row and rejects the old form', async () => {
    const root = await proposal(); const claim = await reviews.claim(a, root.id, { expectedVersion: 0 });
    const results = await Promise.allSettled([reviews.drop(a, root.id, dropBody(claim)), reviews.claim(b, root.id, { expectedVersion: 2 })]);
    expect(results[0]!.status).toBe('fulfilled');
    if (results[1]!.status === 'rejected') await reviews.claim(b, root.id, { expectedVersion: 2 });
    const active = await database.client.reviewAssignment.findMany({ where: { proposalId: root.id, status: 'ACTIVE' } });
    expect(active).toHaveLength(1); expect(active[0]!.reviewerId).toBe(b.accountId);
    await expect(reviews.drop(a, root.id, dropBody(claim))).rejects.toMatchObject({ status: 403 });
    expect(await database.client.reviewAssignment.count({ where: { proposalId: root.id, status: 'CLOSED' } })).toBe(1);
  });
  it('INT-08 atomically disables/releases unfinished assignments and preserves frozen assignments', async () => {
    const unfinished = await proposal({ assignee: a }); const awaiting = await proposal({ assignee: a, state: 'CHANGES_REQUESTED' });
    const frozen = await proposal({ assignee: a, state: 'APPROVED' });
    expect(await administration.disable(`${prefix}-a`)).toEqual({ released: 2 });
    expect(await database.client.userAccount.findUnique({ where: { id: a.accountId } })).toMatchObject({ enabled: false, version: 2 });
    for (const [root, state] of [[unfinished, 'SUBMITTED'], [awaiting, 'CHANGES_REQUESTED']] as const) {
      expect(await database.client.changeProposal.findUnique({ where: { id: root.id } })).toMatchObject({ state, currentAssignmentId: null, version: 1 });
      expect(await database.client.reviewAssignment.findUnique({ where: { id: root.assignmentId } })).toMatchObject({ status: 'CLOSED', endReason: 'ACCOUNT_DISABLED' });
    }
    expect(await database.client.changeProposal.findUnique({ where: { id: frozen.id } })).toMatchObject({ state: 'APPROVED', currentAssignmentId: frozen.assignmentId, version: 0 });
    expect(await database.client.proposalActivity.count({ where: { action: 'ASSIGNMENT_RELEASED' } })).toBe(2);
    await expect(reviews.detail(a, frozen.id)).rejects.toMatchObject({ status: 401 });
    expect((await reviews.queue(b, { limit: 20 })).items).toHaveLength(2);
  });
  it('INT-08 claim versus disable leaves the disabled actor with no unfinished assignment', async () => {
    const root = await proposal();
    const results = await Promise.allSettled([reviews.claim(a, root.id, { expectedVersion: 0 }), administration.disable(`${prefix}-a`)]);
    expect(results[1]!.status).toBe('fulfilled');
    if (results[0]!.status === 'rejected') expect(results[0]).toMatchObject({ reason: { status: 401 } });
    expect(await database.client.reviewAssignment.count({ where: { reviewerId: a.accountId, status: 'ACTIVE' } })).toBe(0);
    expect(await database.client.changeProposal.findUnique({ where: { id: root.id } })).toMatchObject({ state: 'SUBMITTED', currentAssignmentId: null });
    await expect(reviews.claim(a, root.id, { expectedVersion: 0 })).rejects.toMatchObject({ status: 401 });
  });
  it('INT-08 drop versus disable closes the assignment exactly once and denies all later content requests', async () => {
    const root = await proposal(); const claim = await reviews.claim(a, root.id, { expectedVersion: 0 });
    await Promise.allSettled([reviews.drop(a, root.id, dropBody(claim)), administration.disable(`${prefix}-a`)]);
    expect(await database.client.reviewAssignment.count({ where: { proposalId: root.id, status: 'ACTIVE' } })).toBe(0);
    expect(await database.client.proposalActivity.count({ where: { proposalId: root.id, action: { in: ['DROPPED', 'ASSIGNMENT_RELEASED'] } } })).toBe(1);
    await expect(reviews.detail(a, root.id)).rejects.toMatchObject({ status: 401 });
  });
  it('INT-08 checks session version/role inside the transaction after a guard could have passed', async () => {
    const root = await proposal({ assignee: a });
    await database.client.userAccount.update({ where: { id: a.accountId }, data: { version: 2 } });
    await expect(reviews.detail(a, root.id)).rejects.toMatchObject({ status: 401 });
    await expect(reviews.queue(a, { limit: 20 })).rejects.toMatchObject({ status: 401 });
    await database.client.userAccount.update({ where: { id: a.accountId }, data: { version: 1, role: 'CONTRIBUTOR' } });
    await expect(reviews.detail(a, root.id)).rejects.toMatchObject({ status: 403 });
  });
  it('INT-08 rolls back account disable and earlier releases when PostgreSQL rejects an assignment closure', async () => {
    await proposal({ id: 'failure-root-a', assignee: a });
    // An otherwise valid ACTIVE fixture has a future provenance timestamp. Closing
    // it now violates the real DB closure CHECK; no production failure hook exists.
    await proposal({ id: 'failure-root-b', assignee: a, assignedAt: new Date(Date.now() + 86400000) });
    const securityBefore = await database.client.securityEvent.count({ where: { target: a.accountId, action: 'ACCOUNT_DISABLED' } });
    await expect(administration.disable(`${prefix}-a`)).rejects.toThrow();
    expect(await database.client.userAccount.findUnique({ where: { id: a.accountId } })).toMatchObject({ enabled: true, version: 1 });
    expect(await database.client.reviewAssignment.count({ where: { status: 'ACTIVE', reviewerId: a.accountId } })).toBe(2);
    expect(await database.client.changeProposal.count({ where: { version: 0, state: 'IN_REVIEW', currentAssignmentId: { not: null } } })).toBe(2);
    expect(await database.client.proposalActivity.count({ where: { action: 'ASSIGNMENT_RELEASED' } })).toBe(0);
    expect(await database.client.securityEvent.count({ where: { target: a.accountId, action: 'ACCOUNT_DISABLED' } })).toBe(securityBefore);
  });
  it('INT-08/09 rolls back claim/drop and a multi-root disable when business activity fails', async () => {
    const root = await proposal();
    jest.spyOn(activity, 'append').mockRejectedValueOnce(new Error('Synthetic activity failure'));
    await expect(reviews.claim(a, root.id, { expectedVersion: 0 })).rejects.toThrow('Synthetic activity failure');
    expect(await database.client.reviewAssignment.count()).toBe(0);
    expect(await database.client.changeProposal.findUnique({ where: { id: root.id } })).toMatchObject({ version: 0, state: 'SUBMITTED', currentAssignmentId: null });
    const claim = await reviews.claim(a, root.id, { expectedVersion: 0 });
    jest.spyOn(activity, 'append').mockRejectedValueOnce(new Error('Synthetic drop failure'));
    await expect(reviews.drop(a, root.id, dropBody(claim))).rejects.toThrow('Synthetic drop failure');
    expect(await database.client.reviewAssignment.findUnique({ where: { id: claim.assignmentId } })).toMatchObject({ status: 'ACTIVE', version: 0 });
    await proposal({ assignee: a });
    jest.restoreAllMocks();
    const append = activity.append.bind(activity);
    jest.spyOn(activity, 'append').mockImplementationOnce(append).mockRejectedValueOnce(new Error('Synthetic second release failure'));
    await expect(administration.disable(`${prefix}-a`)).rejects.toThrow('Synthetic second release failure');
    expect(await database.client.userAccount.findUnique({ where: { id: a.accountId } })).toMatchObject({ enabled: true, version: 1 });
    expect(await database.client.reviewAssignment.count({ where: { status: 'ACTIVE' } })).toBe(2);
    expect(await database.client.proposalActivity.count({ where: { action: 'ASSIGNMENT_RELEASED' } })).toBe(0);
  });
  it('INT-07/11 refuses frozen/terminal claims and drops and version overflow without changing history', async () => {
    for (const state of ['APPROVED', 'IN_RELEASE', 'RELEASED'] as const) {
      const root = await proposal({ state, assignee: a });
      expect((await reviews.detail(a, root.id)).state).toBe(state);
      await expect(reviews.drop(a, root.id, { expectedVersion: 0, revisionId: root.revisionId, assignmentId: root.assignmentId!, expectedAssignmentVersion: 0 })).rejects.toMatchObject({ status: 409 });
      await expect(reviews.claim(b, root.id, { expectedVersion: 0 })).rejects.toMatchObject({ status: 409 });
    }
    for (const state of ['DRAFT', 'WITHDRAWN'] as const) {
      const root = await proposal({ state }); await expect(reviews.claim(a, root.id, { expectedVersion: 0 })).rejects.toMatchObject({ status: 409 });
    }
    const overflow = await proposal();
    await database.client.changeProposal.update({ where: { id: overflow.id }, data: { version: 2147483647 } });
    await expect(reviews.claim(a, overflow.id, { expectedVersion: 2147483647 })).rejects.toMatchObject({ status: 409 });
    expect(await database.client.reviewAssignment.count({ where: { proposalId: overflow.id } })).toBe(0);
  });
  it('INT-09 enforces immutable snapshots and append-only activity in real PostgreSQL', async () => {
    const root = await proposal({ assignee: a });
    await expect(database.client.proposalRevision.update({ where: { id: root.revisionId }, data: { problem: 'overwrite' } })).rejects.toThrow();
    await expect(database.client.acceptanceCriterion.update({ where: { id: `${root.revisionId}-criterion` }, data: { statement: 'overwrite' } })).rejects.toThrow();
    await expect(database.client.proposalActivity.deleteMany({ where: { proposalId: root.id } })).rejects.toThrow();
    expect((await reviews.detail(a, root.id)).revision.problem).toContain('Demonstrate');
  });
  it('F-004 records exactly one restricted validation audit, no business changes, and singly audits service conflicts', async () => {
    const root = await proposal();
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/auth/csrf');
    const login = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken).send({ username: `${prefix}-a`, password }).expect(200);
    const token = login.body.csrfToken as string;
    const secret = 'synthetic-confidential-payload-never-log';
    const originalRoot = await database.client.changeProposal.findUniqueOrThrow({ where: { id: root.id } });
    const originalRevision = await database.client.proposalRevision.findUniqueOrThrow({ where: { id: root.revisionId } });
    const originalActivity = await database.client.proposalActivity.findMany({ where: { proposalId: root.id }, orderBy: { id: 'asc' } });
    const invalidRequests = [
      () => agent.post(`/api/proposals/${root.id}/claim`).set('x-csrf-token', token).send({ expectedVersion: 0, reviewerId: secret }),
      () => agent.post(`/api/proposals/${root.id}/drop`).set('x-csrf-token', token).send({ expectedVersion: 0, assignmentId: secret }),
      () => agent.post(`/api/proposals/${secret.repeat(4)}/claim`).set('x-csrf-token', token).send({ expectedVersion: 0 }),
      () => agent.get(`/api/review-pool?password=${secret}`),
      () => agent.get(`/api/reviews/assignments?state=${secret}`),
      () => agent.get(`/api/proposals/${secret.repeat(4)}`),
      () => agent.get(`/api/proposals/${root.id}?unknown=${secret}`),
      () => agent.get(`/api/proposals/${root.id}/revisions?limit=0&cursor=${secret}`),
      () => agent.get(`/api/proposals/${root.id}/activity?unknown=${secret}`),
    ];
    for (const send of invalidRequests) {
      const response = await send().expect(422);
      const events = await database.client.securityEvent.findMany({ where: { correlationId: response.body.correlationId } });
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ actorId: a.accountId, outcome: 'rejected',
        action: expect.stringMatching(/^REVIEW_(POOL|ASSIGNED|CLAIM|DROP|DETAIL|REVISIONS|ACTIVITY)_VALIDATION_REJECTED$/),
        target: expect.stringMatching(/^(review-pool|assigned-reviews|proposal-(claim|drop|detail|revisions|activity))$/) });
      expect(JSON.stringify(events)).not.toContain(secret);
      await database.client.securityEvent.deleteMany({ where: { correlationId: response.body.correlationId } });
    }
    expect(await database.client.changeProposal.findUniqueOrThrow({ where: { id: root.id } })).toEqual(originalRoot);
    expect(await database.client.proposalRevision.findUniqueOrThrow({ where: { id: root.revisionId } })).toEqual(originalRevision);
    expect(await database.client.reviewAssignment.count({ where: { proposalId: root.id } })).toBe(0);
    expect(await database.client.proposalActivity.findMany({ where: { proposalId: root.id }, orderBy: { id: 'asc' } })).toEqual(originalActivity);
    const valid = await agent.get('/api/review-pool').expect(200);
    expect(await database.client.securityEvent.findMany({ where: { correlationId: valid.body.correlationId ?? valid.headers['x-request-id'] } })).toMatchObject([{ action: 'REVIEW_VIEWED' }]);
    const conflict = await agent.post(`/api/proposals/${root.id}/claim`).set('x-csrf-token', token).send({ expectedVersion: 1 }).expect(409);
    expect(await database.client.securityEvent.findMany({ where: { correlationId: conflict.body.correlationId } })).toMatchObject([{ action: 'REVIEW_CLAIM_REJECTED', outcome: 'rejected' }]);
    // Well-shaped but invalid cursor encoding is rejected inside the service's
    // existing transaction boundary and must not acquire a second controller event.
    const cursorFailure = await agent.get('/api/review-pool?cursor=invalid!').expect(422);
    expect(await database.client.securityEvent.findMany({ where: { correlationId: cursorFailure.body.correlationId } })).toMatchObject([{ action: 'REVIEW_VIEW_REJECTED' }]);
    for (const correlationId of [valid.headers['x-request-id'], conflict.body.correlationId, cursorFailure.body.correlationId]) {
      await database.client.securityEvent.deleteMany({ where: { correlationId } });
    }
    expect(await database.client.proposalActivity.findMany({ where: { proposalId: root.id }, orderBy: { id: 'asc' } })).toEqual(originalActivity);
  });
  it('INT-01/05/10/11 real authenticated HTTP flow returns strict large content and loses access after drop', async () => {
    const root = await proposal({ large: true });
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/auth/csrf');
    const login = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken).send({ username: `${prefix}-a`, password }).expect(200);
    const token = login.body.csrfToken as string;
    const pool = await agent.get('/api/review-pool').expect(200); expect(reviewPoolResponseSchema.safeParse(pool.body).success).toBe(true);
    await agent.get(`/api/proposals/${root.id}`).expect(403);
    const claimed = await agent.post(`/api/proposals/${root.id}/claim`).set('x-csrf-token', token).send({ expectedVersion: 0 }).expect(200);
    const detail = await agent.get(`/api/proposals/${root.id}`).expect(200);
    expect(detail.headers['cache-control']).toBe('no-store');
    expect(proposalDetailResponseSchema.parse(detail.body).revision.diffText.length).toBeGreaterThan(90000);
    await agent.post(`/api/proposals/${root.id}/drop`).set('x-csrf-token', token).send(dropBody(claimed.body)).expect(200);
    for (const path of ['', '/revisions', '/activity']) {
      const denied = await agent.get(`/api/proposals/${root.id}${path}`).expect(403);
      expect(denied.body).toMatchObject({ code: 'FORBIDDEN', correlationId: expect.any(String) });
    }
  });
});
