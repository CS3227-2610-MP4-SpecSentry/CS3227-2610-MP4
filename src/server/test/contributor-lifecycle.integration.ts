import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { cloneLatestRequestSchema, draftResponseSchema, findingResponseCommandResponseSchema, findingResponsesResponseSchema,
  ownProposalsResponseSchema, proposalLifecycleResponseSchema, type ProposalLifecycleResponse, type WorkingContent } from '@specsentry/shared';
import { AppModule } from '../src/app.module';
import { ActivityService } from '../src/activity/activity.service';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { configureHttp } from '../src/http';
import { hashPassword } from '../src/identity/identity.service';

const tables = '"ReleaseAnnotation", "ReleasePublicationSnapshot", "ReleaseSmokeTest", "ReleaseCandidateMember", "Notification", "ApprovalInvalidation", "ReleaseCandidate", "WorkingRevision", "CoverageEvidence", "CoverageAssessment", "FindingResponse", "FindingEvent", "ReviewFinding", "ReviewDecision", "ReviewIdempotency", "CriterionEvidenceLink", "ProposalActivity", "ReviewAssignment", "AcceptanceCriterion", "TestEvidence", "ProposalRevision", "ChangeProposal"';
const content: WorkingContent = { title: 'Submitted title', summary: 'Submission summary', problem: 'Problem', constraints: 'Limits',
  expectedBehavior: 'Expected result', diffText: '--- a/f\n+++ b/f\n@@ -1 +1 @@\n-old\n+new\n',
  criteria: [{ statement: 'Required result', required: true }], evidence: [{ text: 'Optional evidence' }] };

describe('PostgreSQL Contributor discovery, explicit clone and finding responses', () => {
  let app: NestExpressApplication; let database: DatabaseService; let activity: ActivityService;
  const prefix = `con-cycle-${randomUUID()}`; const password = 'synthetic-contributor-cycle-password';
  const names = ['owner', 'other', 'reviewer', 'maintainer'] as const;
  type Session = { agent: ReturnType<typeof request.agent>; token: string };
  let owner: Session; let other: Session; let reviewer: Session; let maintainer: Session;
  async function login(name: typeof names[number]): Promise<Session> {
    const agent = request.agent(app.getHttpServer()); const csrf = await agent.get('/api/auth/csrf').expect(200);
    const response = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken)
      .send({ username: `${prefix}-${name}`, password }).expect(200);
    return { agent, token: response.body.csrfToken as string };
  }
  const post = (session: Session, path: string, body: object) => session.agent.post(`/api${path}`).set('x-csrf-token', session.token).send(body);
  async function create(session = owner) { return proposalLifecycleResponseSchema.parse((await post(session, '/proposals', content).expect(201)).body); }
  async function submit(root: ProposalLifecycleResponse) {
    return proposalLifecycleResponseSchema.parse((await owner.agent.post(`/api/proposals/${root.proposalId}/submit`)
      .set('x-csrf-token', owner.token).set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: root.version, workingRevisionId: root.workingRevisionId }).expect(200)).body);
  }
  async function draft(id: string) { return draftResponseSchema.parse((await owner.agent.get(`/api/proposals/${id}/draft`).expect(200)).body); }
  async function finding() {
    const root = await submit(await create());
    const claimed = (await post(reviewer, `/proposals/${root.proposalId}/claim`, { expectedVersion: root.version }).expect(200)).body;
    const found = (await post(reviewer, `/proposals/${root.proposalId}/findings`, { expectedVersion: claimed.version,
      revisionId: claimed.revisionId, assignmentId: claimed.assignmentId, expectedAssignmentVersion: claimed.assignmentVersion,
      severity: 'HIGH', description: 'Needs a Contributor answer.' }).expect(201)).body;
    return { root: { ...root, ...found } as ProposalLifecycleResponse, findingId: found.finding.id as string };
  }
  async function snapshot(id: string) {
    return { root: await database.client.changeProposal.findUniqueOrThrow({ where: { id } }),
      working: await database.client.workingRevision.findUnique({ where: { proposalId: id } }),
      responses: await database.client.findingResponse.findMany({ where: { proposalId: id }, orderBy: { id: 'asc' } }),
      events: await database.client.findingEvent.findMany({ where: { proposalId: id }, orderBy: { id: 'asc' } }),
      activity: await database.client.proposalActivity.findMany({ where: { proposalId: id }, orderBy: { id: 'asc' } }) };
  }
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL required');
    const module = await Test.createTestingModule({ imports: [AppModule.register(readConfig({ NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL, SESSION_SECRET: 'synthetic-contributor-cycle-session-secret' }))] }).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false }); configureHttp(app); await app.init();
    database = app.get(DatabaseService); activity = app.get(ActivityService);
    const passwordHash = await hashPassword(password);
    await database.client.userAccount.createMany({ data: names.map(name => ({ id: `${prefix}-${name}`, username: `${prefix}-${name}`,
      passwordHash, role: name === 'reviewer' ? 'REVIEWER' as const : name === 'maintainer' ? 'RELEASE_MAINTAINER' as const : 'CONTRIBUTOR' as const })) });
  });
  beforeEach(async () => {
    await database.client.$executeRawUnsafe(`TRUNCATE ${tables}`);
    [owner, other, reviewer, maintainer] = await Promise.all([login('owner'), login('other'), login('reviewer'), login('maintainer')]);
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (database) {
      await database.client.$executeRawUnsafe(`TRUNCATE ${tables}`);
      await database.client.authSession.deleteMany({ where: { OR: names.map(name => ({ data: { contains: `${prefix}-${name}` } })) } });
      await database.client.securityEvent.deleteMany({ where: { actorId: { startsWith: prefix } } });
      await database.client.userAccount.deleteMany({ where: { id: { startsWith: prefix } } });
    }
    await app?.close();
  });

  it('registers additive owned discovery, preserves old draft list and scopes equal-time cursor pages to the owner', async () => {
    const roots = [await create(), await submit(await create()), await submit(await create())]; await create(other);
    await database.client.changeProposal.update({ where: { id: roots[2]!.proposalId }, data: { state: 'WITHDRAWN' } });
    for (const state of ['IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'IN_RELEASE', 'RELEASED'] as const) {
      const root = await submit(await create()); roots.push(root);
      await database.client.changeProposal.update({ where: { id: root.proposalId }, data: { state } });
    }
    await database.client.changeProposal.updateMany({ where: { id: { in: roots.map(root => root.proposalId) } }, data: { createdAt: new Date('2026-11-01T00:00:00Z') } });
    const first = ownProposalsResponseSchema.parse((await owner.agent.get('/api/proposals/owned?limit=2').expect(200)).body);
    const items = [...first.items]; let cursor = first.nextCursor;
    while (cursor) {
      const page = ownProposalsResponseSchema.parse((await owner.agent.get(`/api/proposals/owned?limit=2&cursor=${cursor}`).expect(200)).body);
      items.push(...page.items); cursor = page.nextCursor;
    }
    expect(new Set(items.map(item => item.proposalId))).toEqual(new Set(roots.map(root => root.proposalId)));
    expect(items.map(item => item.state).sort()).toEqual(['DRAFT', 'SUBMITTED', 'WITHDRAWN', 'IN_REVIEW', 'CHANGES_REQUESTED', 'APPROVED', 'IN_RELEASE', 'RELEASED'].sort());
    expect(items.find(item => item.state === 'DRAFT')!.title).toBe(content.title);
    const old = await owner.agent.get('/api/proposals').expect(200); expect(old.body.items).toHaveLength(1);
    await other.agent.get(`/api/proposals/owned?cursor=${first.nextCursor}`).expect(422);
    for (const session of [reviewer, maintainer]) await session.agent.get('/api/proposals/owned').expect(403);
    await request(app.getHttpServer()).get('/api/proposals/owned').expect(401);
    await owner.agent.get('/api/proposals/owned?ownerId=forged').expect(422);
  });

  it('explicitly clones latest submitted content, restores original keys safely and regenerates evidence without changing snapshots or assignment', async () => {
    const { root } = await finding(); const original = await draft(root.proposalId);
    const saved = (await owner.agent.patch(`/api/proposals/${root.proposalId}/draft`).set('x-csrf-token', owner.token)
      .send({ expectedVersion: root.version, content: { ...original.content, title: 'Private changed title', criteria: [], evidence: [] } }).expect(200)).body;
    await owner.agent.patch(`/api/proposals/${root.proposalId}/draft`).set('x-csrf-token', owner.token)
      .send({ expectedVersion: saved.version, content: original.content }).expect(422);
    const before = await database.client.proposalRevision.findUniqueOrThrow({ where: { id: root.revisionId! }, include: { criteria: true, evidence: true } });
    const cloned = (await post(owner, `/proposals/${root.proposalId}/clone-latest`,
      { expectedVersion: saved.version, revisionId: root.revisionId, confirmed: true }).expect(200)).body;
    const current = await draft(root.proposalId);
    expect(current.content.title).toBe(content.title); expect(current.content.criteria).toEqual(original.content.criteria);
    expect(current.content.evidence[0]!.text).toBe(content.evidence[0]!.text);
    expect(current.content.evidence[0]!.id).not.toBe(original.content.evidence[0]!.id);
    expect(cloned).toMatchObject({ version: saved.version + 1, assignmentId: root.assignmentId, state: 'IN_REVIEW' });
    expect(await database.client.proposalRevision.findUniqueOrThrow({ where: { id: root.revisionId! }, include: { criteria: true, evidence: true } })).toEqual(before);
    const resubmitted = await submit({ ...root, version: cloned.version, workingRevisionId: current.workingRevisionId });
    const assignment = await database.client.reviewAssignment.findUniqueOrThrow({ where: { id: resubmitted.assignmentId! } });
    expect(assignment.reviewerId).toBe(`${prefix}-reviewer`);
    expect(await database.client.reviewFinding.count({ where: { proposalId: root.proposalId } })).toBe(1);
    expect(await database.client.findingEvent.count({ where: { proposalId: root.proposalId } })).toBe(0);
  });

  it('rejects clone ownership, confirmation, stale version/revision, attachment and frozen lifecycle without changing content', async () => {
    const root = await submit(await create());
    const body = cloneLatestRequestSchema.parse({ expectedVersion: root.version, revisionId: root.revisionId, confirmed: true });
    await post(other, `/proposals/${root.proposalId}/clone-latest`, body).expect(403);
    await owner.agent.post(`/api/proposals/${root.proposalId}/clone-latest`).send(body).expect(403);
    await post(owner, `/proposals/${root.proposalId}/clone-latest`, { ...body, confirmed: false }).expect(422);
    for (const changed of [{ expectedVersion: body.expectedVersion + 1 }, { revisionId: 'foreign' }]) {
      const before = await snapshot(root.proposalId);
      await post(owner, `/proposals/${root.proposalId}/clone-latest`, { ...body, ...changed }).expect(409);
      expect(await snapshot(root.proposalId)).toEqual(before);
    }
    for (const state of ['APPROVED', 'WITHDRAWN', 'RELEASED'] as const) {
      await database.client.changeProposal.update({ where: { id: root.proposalId }, data: { state } });
      const before = await snapshot(root.proposalId); await post(owner, `/proposals/${root.proposalId}/clone-latest`, body).expect(409);
      expect(await snapshot(root.proposalId)).toEqual(before);
    }
    await database.client.changeProposal.update({ where: { id: root.proposalId }, data: { state: 'CHANGES_REQUESTED', releaseAttachmentRef: 'synthetic-attachment' } });
    await post(owner, `/proposals/${root.proposalId}/clone-latest`, body).expect(409);
  });

  it('stores attributed plain text and transactional activity without resolving, and retains authorized reads after withdrawal', async () => {
    const { root, findingId } = await finding(); const text = '<img src=x onerror=alert(1)>\r\nOwner response';
    const result = findingResponseCommandResponseSchema.parse((await post(owner, `/findings/${findingId}/responses`,
      { expectedVersion: root.version, revisionId: root.revisionId, text }).expect(201)).body);
    expect(result.response).toMatchObject({ findingId, actor: { id: `${prefix}-owner` }, text: text.replace(/\r\n/g, '\n') });
    expect(result.version).toBe(root.version + 1);
    expect(await database.client.findingEvent.count({ where: { findingId } })).toBe(0);
    const findings = await owner.agent.get(`/api/proposals/${root.proposalId}/findings`).expect(200);
    expect(findings.body.items[0].status).toBe('OPEN');
    const timeline = await owner.agent.get(`/api/proposals/${root.proposalId}/activity`).expect(200);
    expect(timeline.body.items.some((event: { action: string }) => event.action === 'FINDING_RESPONDED')).toBe(true);
    for (const session of [owner, reviewer, maintainer]) {
      const responses = findingResponsesResponseSchema.parse((await session.agent.get(`/api/proposals/${root.proposalId}/responses`).expect(200)).body);
      expect(responses.items[0]!.text).toBe(result.response.text);
    }
    await other.agent.get(`/api/proposals/${root.proposalId}/responses`).expect(403);
    await post(owner, `/proposals/${root.proposalId}/withdraw`, { expectedVersion: result.version, confirmed: true, reason: 'Done' }).expect(200);
    await owner.agent.get(`/api/proposals/${root.proposalId}/responses`).expect(200);
    await maintainer.agent.get(`/api/proposals/${root.proposalId}/responses`).expect(200);
    await reviewer.agent.get(`/api/proposals/${root.proposalId}/responses`).expect(403);
  });

  it('denies response impersonation, role/CSRF, stale/foreign scope and terminal mutations without partial state', async () => {
    const { root, findingId } = await finding(); const body = { expectedVersion: root.version, revisionId: root.revisionId, text: 'Reply' };
    const before = await snapshot(root.proposalId);
    for (const session of [other, reviewer, maintainer]) await post(session, `/findings/${findingId}/responses`, body).expect(403);
    await owner.agent.post(`/api/findings/${findingId}/responses`).send(body).expect(403);
    await request(app.getHttpServer()).post(`/api/findings/${findingId}/responses`).send(body).expect(401);
    for (const extra of [{ actorId: 'forged' }, { status: 'RESOLVED' }, { text: '😀'.repeat(2001) }])
      await post(owner, `/findings/${findingId}/responses`, { ...body, ...extra }).expect(422);
    for (const extra of [{ expectedVersion: body.expectedVersion + 1 }, { revisionId: 'foreign' }])
      await post(owner, `/findings/${findingId}/responses`, { ...body, ...extra }).expect(409);
    expect(await snapshot(root.proposalId)).toEqual(before);
    for (const state of ['SUBMITTED', 'APPROVED', 'WITHDRAWN', 'RELEASED'] as const) {
      await database.client.changeProposal.update({ where: { id: root.proposalId }, data: { state } });
      const frozen = await snapshot(root.proposalId); await post(owner, `/findings/${findingId}/responses`, body).expect(409);
      expect(await snapshot(root.proposalId)).toEqual(frozen);
    }
  });

  it('allows a response to a historical same-proposal finding against the current revision, with conflict-safe retries and pagination', async () => {
    const found = await finding(); const findingId = found.findingId;
    const root = await submit(found.root);
    let version = root.version;
    for (const text of ['First', 'Second', 'Third']) {
      const result = await post(owner, `/findings/${findingId}/responses`, { expectedVersion: version, revisionId: root.revisionId, text }).expect(201);
      version = result.body.version;
    }
    await post(owner, `/findings/${findingId}/responses`, { expectedVersion: version - 1, revisionId: root.revisionId, text: 'Third' }).expect(409);
    const first = findingResponsesResponseSchema.parse((await owner.agent.get(`/api/proposals/${root.proposalId}/responses?limit=2`).expect(200)).body);
    const second = findingResponsesResponseSchema.parse((await owner.agent.get(`/api/proposals/${root.proposalId}/responses?limit=2&cursor=${first.nextCursor}`).expect(200)).body);
    expect([...first.items, ...second.items].map(item => item.text)).toEqual(['First', 'Second', 'Third']);
    expect(await database.client.findingEvent.count({ where: { findingId } })).toBe(0);
  });

  it('serializes concurrent response and clone writes at the proposal version and rolls back audit failure', async () => {
    const { root, findingId } = await finding(); const body = { expectedVersion: root.version, revisionId: root.revisionId, text: 'One reply' };
    const results = await Promise.all([post(owner, `/findings/${findingId}/responses`, body),
      post(owner, `/proposals/${root.proposalId}/clone-latest`, { expectedVersion: root.version, revisionId: root.revisionId, confirmed: true })]);
    expect(results.filter(result => result.status === 409)).toHaveLength(1);
    expect(results.filter(result => result.status === 200 || result.status === 201)).toHaveLength(1);
    const current = await database.client.changeProposal.findUniqueOrThrow({ where: { id: root.proposalId } });
    const before = await snapshot(root.proposalId);
    jest.spyOn(activity, 'append').mockRejectedValueOnce(new Error('Synthetic activity failure'));
    await post(owner, `/findings/${findingId}/responses`, { ...body, expectedVersion: current.version }).expect(500);
    expect(await snapshot(root.proposalId)).toEqual(before);
    jest.spyOn(activity, 'append').mockRejectedValueOnce(new Error('Synthetic clone activity failure'));
    await post(owner, `/proposals/${root.proposalId}/clone-latest`, { expectedVersion: current.version, revisionId: root.revisionId, confirmed: true }).expect(500);
    expect(await snapshot(root.proposalId)).toEqual(before);
  });

  it('enforces append-only response storage independently of HTTP and fails reads closed on audit failure', async () => {
    const { root, findingId } = await finding();
    const result = (await post(owner, `/findings/${findingId}/responses`, { expectedVersion: root.version, revisionId: root.revisionId, text: 'Permanent response' }).expect(201)).body;
    await expect(database.client.findingResponse.update({ where: { id: result.response.id }, data: { text: 'Changed' } })).rejects.toThrow();
    await expect(database.client.findingResponse.delete({ where: { id: result.response.id } })).rejects.toThrow();
    const trigger = `response_audit_${randomUUID().replace(/-/g, '')}`;
    await database.client.$executeRawUnsafe(`CREATE FUNCTION "${trigger}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."action"='FINDING_RESPONSES_VIEWED' THEN RAISE EXCEPTION 'Synthetic read audit failure'; END IF; RETURN NEW; END $$`);
    try {
      await database.client.$executeRawUnsafe(`CREATE TRIGGER "${trigger}" BEFORE INSERT ON "SecurityEvent" FOR EACH ROW EXECUTE FUNCTION "${trigger}"()`);
      const denied = await owner.agent.get(`/api/proposals/${root.proposalId}/responses`).expect(500);
      expect(JSON.stringify(denied.body)).not.toContain('Permanent response');
    } finally {
      await database.client.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "SecurityEvent"`);
      await database.client.$executeRawUnsafe(`DROP FUNCTION "${trigger}"()`);
    }
  });
});
