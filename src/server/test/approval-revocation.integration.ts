import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { configureHttp } from '../src/http';
import { hashPassword } from '../src/identity/identity.service';
import type { Prisma } from '../src/generated/prisma/client';

const businessTables = '"ReleasePublicationSnapshot", "ReleaseSmokeTest", "ReleaseCandidateMember", "Notification", "ApprovalInvalidation", "ReleaseCandidate", "WorkingRevision", "CoverageEvidence", "CoverageAssessment", "FindingEvent", "ReviewFinding", "ReviewDecision", "ReviewIdempotency", "CriterionEvidenceLink", "ProposalActivity", "ReviewAssignment", "AcceptanceCriterion", "TestEvidence", "ProposalRevision", "ChangeProposal"';
describe('PostgreSQL Reviewer approval revocation (REQ-REV-016)', () => {
  let app: NestExpressApplication;
  let db: DatabaseService;
  const prefix = `revoke-${randomUUID()}`;
  const users = { reviewer: `${prefix}-reviewer`, other: `${prefix}-other`, owner: `${prefix}-owner`, maintainer: `${prefix}-maintainer` };
  const password = 'synthetic-revocation-test-password';
  type Session = { agent: ReturnType<typeof request.agent>; csrf: string };
  let reviewer: Session; let other: Session; let owner: Session; let maintainer: Session;
  type Fixture = { proposalId: string; revisionId: string; assignmentId: string; approvalId: string;
    candidateId: string | null; version: number; candidateVersion: number | null };
  const body = (f: Fixture, extra: Record<string, unknown> = {}) => ({ expectedVersion: f.version,
    revisionId: f.revisionId, assignmentId: f.assignmentId, expectedAssignmentVersion: 0,
    approvalId: f.approvalId, expectedApprovalVersion: 1, reason: 'Needs another pass.',
    candidateContext: f.candidateId ? { candidateId: f.candidateId, expectedCandidateVersion: f.candidateVersion } : null,
    ...extra });
  const revoke = (s: Session, f: Fixture, payload = body(f), key = randomUUID()) => s.agent
    .post(`/api/proposals/${f.proposalId}/revoke-approval`).set('x-csrf-token', s.csrf)
    .set('Idempotency-Key', key).send(payload);
  async function login(name: keyof typeof users): Promise<Session> {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/auth/csrf').expect(200);
    const result = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken)
      .send({ username: users[name], password }).expect(200);
    return { agent, csrf: result.body.csrfToken as string };
  }
  async function clean() { await db.client.$executeRawUnsafe(`TRUNCATE ${businessTables}`); }
  async function graph(attached = false): Promise<Fixture> {
    const proposalId = randomUUID(); const revisionId = randomUUID(); const assignmentId = randomUUID();
    const approvalId = randomUUID(); const candidateId = attached ? randomUUID() : null;
    return db.client.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.changeProposal.create({ data: { id: proposalId, ownerId: users.owner, title: 'Revocation case',
        state: attached ? 'IN_RELEASE' : 'APPROVED', version: attached ? 2 : 1, firstSubmittedAt: new Date() } });
      await tx.proposalRevision.create({ data: { id: revisionId, proposalId, number: 1, summary: 'Submitted change',
        problem: 'Problem', constraints: '', expectedBehavior: 'Expected behavior', diffText: '+change',
        criteria: { create: { stableKey: 'required', statement: 'Expected behavior' } } } });
      await tx.reviewAssignment.create({ data: { id: assignmentId, proposalId, revisionId, reviewerId: users.reviewer } });
      await tx.changeProposal.update({ where: { id: proposalId }, data: {
        currentRevisionId: revisionId, currentAssignmentId: assignmentId, releaseAttachmentRef: candidateId } });
      await tx.reviewDecision.create({ data: { id: approvalId, proposalId, revisionId, assignmentId,
        actorId: users.reviewer, decision: 'APPROVE', mutationVersion: 1 } });
      if (candidateId) {
        await tx.releaseCandidate.create({ data: { id: candidateId, projectKey: 'specsentry',
          semanticVersion: `1.0.${Math.floor(Math.random() * 1_000_000_000)}`, createdById: users.maintainer,
          rollbackPlan: 'Revert publication', dependencyNotes: '' } });
        await tx.releaseCandidateMember.create({ data: { candidateId, proposalId, revisionId,
          assignmentId, approvalId } });
      }
      return { proposalId, revisionId, assignmentId, approvalId, candidateId,
        version: attached ? 2 : 1, candidateVersion: attached ? 0 : null };
    });
  }
  async function fragments(f: Fixture) {
    const [invalidations, activities, notices, keys] = await Promise.all([
      db.client.approvalInvalidation.count({ where: { proposalId: f.proposalId } }),
      db.client.proposalActivity.count({ where: { proposalId: f.proposalId, action: 'APPROVAL_REVOKED' } }),
      db.client.notification.count({ where: { proposalId: f.proposalId, kind: 'APPROVAL_REVOKED' } }),
      db.client.reviewIdempotency.count({ where: { proposalId: f.proposalId, operation: 'APPROVAL_REVOKE' } }),
    ]);
    return { invalidations, activities, notices, keys };
  }
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL is required');
    const module = await Test.createTestingModule({ imports: [AppModule.register(readConfig({ NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL, SESSION_SECRET: 'revocation-test-secret-at-least-32-characters' }))] }).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false }); configureHttp(app); await app.init();
    db = app.get(DatabaseService);
    const passwordHash = await hashPassword(password);
    await db.client.userAccount.createMany({ data: Object.entries(users).map(([name, id]) => ({ id,
      username: id, passwordHash, role: name === 'owner' ? 'CONTRIBUTOR' as const :
        name === 'maintainer' ? 'RELEASE_MAINTAINER' as const : 'REVIEWER' as const })) });
  });
  beforeEach(async () => {
    await clean();
    await db.client.authSession.deleteMany({ where: { OR: Object.values(users).map(id => ({ data: { contains: id } })) } });
    await db.client.userAccount.updateMany({ where: { id: { in: Object.values(users) } },
      data: { enabled: true, version: 1 } });
    reviewer = await login('reviewer'); other = await login('other'); owner = await login('owner'); maintainer = await login('maintainer');
  });
  afterEach(async () => {
    for (const table of ['ApprovalInvalidation', 'ChangeProposal', 'ProposalActivity', 'ReviewIdempotency', 'Notification'])
      await db.client.$executeRawUnsafe(`DROP TRIGGER IF EXISTS revoke_test_stage ON "${table}"`);
    await db.client.$executeRawUnsafe('DROP FUNCTION IF EXISTS revoke_test_abort()');
  });
  afterAll(async () => {
    if (db) {
      await clean();
      await db.client.authSession.deleteMany({ where: { OR: Object.values(users).map(id => ({ data: { contains: id } })) } });
      await db.client.securityEvent.deleteMany({ where: { OR: [{ actorId: { in: Object.values(users) } }, { target: { startsWith: prefix } }] } });
      await db.client.userAccount.deleteMany({ where: { id: { in: Object.values(users) } } });
    }
    await app?.close();
  });

  it('revoke-unattached: commits one invalidation, state, and activity while retaining approval and assignee', async () => {
    const f = await graph(); const result = (await revoke(reviewer, f).expect(200)).body;
    expect(result).toMatchObject({ state: 'CHANGES_REQUESTED', version: 2, assignmentVersion: 0,
      effectiveApproval: false, candidate: null, invalidation: { decisionId: f.approvalId, cause: 'REVOKED' } });
    expect(await fragments(f)).toEqual({ invalidations: 1, activities: 1, notices: 0, keys: 1 });
    expect(await db.client.changeProposal.findUniqueOrThrow({ where: { id: f.proposalId } }))
      .toMatchObject({ state: 'CHANGES_REQUESTED', currentAssignmentId: f.assignmentId });
    expect(await db.client.reviewDecision.findUniqueOrThrow({ where: { id: f.approvalId } })).toMatchObject({ decision: 'APPROVE' });
  });
  it('revoke-decision-round: refuses another decision on the old revision', async () => {
    const f = await graph(); await revoke(reviewer, f).expect(200);
    await reviewer.agent.post(`/api/proposals/${f.proposalId}/decision`).set('x-csrf-token', reviewer.csrf)
      .set('Idempotency-Key', randomUUID()).send({ expectedVersion: 2, revisionId: f.revisionId,
        assignmentId: f.assignmentId, expectedAssignmentVersion: 0, decision: 'REQUEST_CHANGES', note: 'Again' }).expect(409);
    expect(await db.client.reviewDecision.count({ where: { proposalId: f.proposalId } })).toBe(1);
  });
  it('revoke-history: keeps original decision and shows attributed reason, cause, and IDs to authorized viewers', async () => {
    const f = await graph(); const result = (await revoke(reviewer, f).expect(200)).body;
    const history = await reviewer.agent.get(`/api/proposals/${f.proposalId}/activity`).expect(200);
    expect(history.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'APPROVAL_REVOKED',
      reason: 'Needs another pass.', actor: expect.objectContaining({ id: users.reviewer }),
      summary: expect.stringContaining(result.invalidation.id), revisionId: f.revisionId })]));
    expect(history.body.items[0].summary).toContain(f.approvalId);
    const decisions = await reviewer.agent.get(`/api/proposals/${f.proposalId}/decisions`).expect(200);
    expect(decisions.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: f.approvalId, decision: 'APPROVE' })]));
    await other.agent.get(`/api/proposals/${f.proposalId}/activity`).expect(403);
  });
  it('revoke-access: denies nonassignee and other roles before business mutation', async () => {
    const f = await graph();
    for (const s of [other, owner, maintainer]) await revoke(s, f).expect(403);
    expect(await fragments(f)).toEqual({ invalidations: 0, activities: 0, notices: 0, keys: 0 });
  });
  it('revoke-session: denies missing, expired, disabled, mismatched and CSRF invalid sessions', async () => {
    const f = await graph();
    await request(app.getHttpServer()).post(`/api/proposals/${f.proposalId}/revoke-approval`)
      .set('Idempotency-Key', randomUUID()).send(body(f)).expect(401);
    await reviewer.agent.post(`/api/proposals/${f.proposalId}/revoke-approval`)
      .set('Idempotency-Key', randomUUID()).send(body(f)).expect(403);
    await reviewer.agent.post(`/api/proposals/${f.proposalId}/revoke-approval`).set('x-csrf-token', '0'.repeat(64))
      .set('Idempotency-Key', randomUUID()).send(body(f)).expect(403);
    const session = await db.client.authSession.findFirstOrThrow({ where: { data: { contains: users.reviewer } } });
    await db.client.authSession.update({ where: { id: session.id }, data: { expiresAt: new Date(0) } });
    await revoke(reviewer, f).expect(401);
    reviewer = await login('reviewer');
    await db.client.userAccount.update({ where: { id: users.reviewer }, data: { version: 2 } });
    await revoke(reviewer, f).expect(401);
    await db.client.userAccount.update({ where: { id: users.reviewer }, data: { enabled: false } });
    await revoke(reviewer, f).expect(401);
    expect(await fragments(f)).toEqual({ invalidations: 0, activities: 0, notices: 0, keys: 0 });
  });
  it('revoke-stale: rejects stale root, assignment, revision, approval and candidate versions', async () => {
    const f = await graph(true);
    for (const extra of [{ expectedVersion: 1 }, { expectedAssignmentVersion: 1 }, { assignmentId: randomUUID() }, { revisionId: randomUUID() },
      { expectedApprovalVersion: 2 }, { candidateContext: { candidateId: f.candidateId, expectedCandidateVersion: 1 } },
      { candidateContext: null }]) await revoke(reviewer, f, body(f, extra)).expect(409);
    expect(await fragments(f)).toEqual({ invalidations: 0, activities: 0, notices: 0, keys: 0 });
  });
  it('revoke-released: rejects released proposal and candidate without changing snapshot history', async () => {
    const f = await graph(true);
    await db.client.releaseCandidate.update({ where: { id: f.candidateId! }, data: { status: 'RELEASED', publishedAt: new Date() } });
    await revoke(reviewer, f).expect(409);
    await db.client.changeProposal.update({ where: { id: f.proposalId }, data: { state: 'RELEASED' } });
    await revoke(reviewer, f).expect(409);
    expect(await fragments(f)).toEqual({ invalidations: 0, activities: 0, notices: 0, keys: 0 });
  });
  it('revoke-invalid: rejects wrong and previously invalid approvals without duplicates', async () => {
    const f = await graph();
    await revoke(reviewer, f, body(f, { approvalId: randomUUID() })).expect(409);
    await revoke(reviewer, f).expect(200);
    await revoke(reviewer, f).expect(409);
    expect((await fragments(f)).invalidations).toBe(1);
  });
  it('revoke-idempotency: repeats identical live result, conflicts on changed body and revalidates expired key', async () => {
    const f = await graph(true); const key = randomUUID(); const payload = body(f);
    const first = (await revoke(reviewer, f, payload, key).expect(200)).body;
    expect((await revoke(reviewer, f, payload, key).expect(200)).body).toEqual(first);
    await revoke(reviewer, f, body(f, { reason: 'Different' }), key).expect(409);
    await db.client.reviewIdempotency.updateMany({ where: { proposalId: f.proposalId }, data: { expiresAt: new Date(0) } });
    await revoke(reviewer, f, payload, key).expect(409);
    expect(await fragments(f)).toEqual({ invalidations: 1, activities: 1, notices: 1, keys: 1 });
  });
  it('revoke-replay-access: denies replay after assignment or attached candidate scope loss', async () => {
    const f = await graph(true); const key = randomUUID(); const payload = body(f);
    await revoke(reviewer, f, payload, key).expect(200);
    await db.client.$transaction(async tx => {
      await tx.releaseCandidateMember.updateMany({ where: { proposalId: f.proposalId },
        data: { status: 'REMOVED', removedAt: new Date() } });
      await tx.changeProposal.update({ where: { id: f.proposalId },
        data: { releaseAttachmentRef: null, state: 'CHANGES_REQUESTED' } });
    });
    await revoke(reviewer, f, payload, key).expect(403);
    await db.client.$transaction(async tx => {
      await tx.reviewAssignment.update({ where: { id: f.assignmentId },
        data: { status: 'CLOSED', endReason: 'DROPPED', endedAt: new Date() } });
      await tx.changeProposal.update({ where: { id: f.proposalId }, data: { currentAssignmentId: null } });
    });
    await revoke(reviewer, f, payload, key).expect(403);
  });
  it('revoke-rollback: database failures at each write stage leave no business fragments', async () => {
    for (const table of ['ApprovalInvalidation', 'ChangeProposal', 'ProposalActivity', 'ReviewIdempotency', 'Notification']) {
      const f = await graph(table === 'Notification');
      await db.client.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION revoke_test_abort() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'revoke injection'; END; $$ LANGUAGE plpgsql`);
      await db.client.$executeRawUnsafe(`CREATE TRIGGER revoke_test_stage BEFORE ${table === 'ChangeProposal' ? 'UPDATE' : 'INSERT'} ON "${table}" FOR EACH ROW EXECUTE FUNCTION revoke_test_abort()`);
      try { await revoke(reviewer, f).expect(500); }
      finally {
        await db.client.$executeRawUnsafe(`DROP TRIGGER revoke_test_stage ON "${table}"`);
        await db.client.$executeRawUnsafe('DROP FUNCTION revoke_test_abort()');
      }
      expect(await fragments(f)).toEqual({ invalidations: 0, activities: 0, notices: 0, keys: 0 });
      expect(await db.client.proposalActivity.count({ where: { proposalId: f.proposalId } })).toBe(0);
    }
  });
});
