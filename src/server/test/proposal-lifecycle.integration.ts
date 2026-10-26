import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { IncomingMessage, Server } from 'node:http';
import { draftResponseSchema, proposalLifecycleResponseSchema, type ProposalLifecycleResponse, type WorkingContent } from '@specsentry/shared';
import { AppModule } from '../src/app.module';
import { ActivityService } from '../src/activity/activity.service';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { configureHttp } from '../src/http';
import { AccountAdministrationService } from '../src/identity/account-administration.service';
import { hashPassword } from '../src/identity/identity.service';
import { ProposalLifecycleService } from '../src/proposals/proposal-lifecycle.service';
import { ProposalsService } from '../src/proposals/proposals.service';
import { ReviewsService } from '../src/reviews/reviews.service';

const businessTables = '"Notification", "ApprovalInvalidation", "WorkingRevision", "CoverageEvidence", "CoverageAssessment", "FindingEvent", "ReviewFinding", "ReviewDecision", "ReviewIdempotency", "CriterionEvidenceLink", "ProposalActivity", "ReviewAssignment", "AcceptanceCriterion", "TestEvidence", "ProposalRevision", "ChangeProposal"';
const content: WorkingContent = { title: 'Private synthetic title', summary: 'Frozen summary', problem: 'Synthetic problem', constraints: '',
  expectedBehavior: 'Expected behavior', diffText: '--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n',
  criteria: [{ statement: 'Required result', required: true }], evidence: [{ text: 'Optional text evidence' }] };

describe('PostgreSQL owner revision lifecycle (REQ-CON-001/002/004/005/006/007/009, REQ-REV-006/008)', () => {
  let app: NestExpressApplication; let database: DatabaseService; let activity: ActivityService; let lifecycle: ProposalLifecycleService; let proposals: ProposalsService;
  let administration: AccountAdministrationService;
  const prefix = `lifecycle-${randomUUID()}`;
  const ids = { owner: `${prefix}-owner`, earlyOwner: `${prefix}-0-owner`, other: `${prefix}-other`, a: `${prefix}-a`, b: `${prefix}-b`, maintainer: `${prefix}-maintainer` };
  const password = 'synthetic-lifecycle-password';
  type Session = { agent: ReturnType<typeof request.agent>; token: string };
  let owner: Session; let other: Session; let a: Session; let b: Session; let maintainer: Session;
  type Command = { proposalId: string; revisionId: string; assignmentId: string; version: number; assignmentVersion: number };
  const scope = (command: Command) => ({ expectedVersion: command.version, revisionId: command.revisionId,
    assignmentId: command.assignmentId, expectedAssignmentVersion: command.assignmentVersion });
  async function clean() {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL required');
    await database.client.$executeRawUnsafe(`TRUNCATE ${businessTables}`);
  }
  async function login(name: keyof typeof ids): Promise<Session> {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/auth/csrf').expect(200);
    const result = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken).send({ username: `${prefix}-${name}`, password }).expect(200);
    return { agent, token: result.body.csrfToken as string };
  }
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL required');
    const module = await Test.createTestingModule({ imports: [AppModule.register(readConfig({ NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL,
      SESSION_SECRET: 'lifecycle-test-secret-at-least-32-characters' }))] }).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false }); configureHttp(app); await app.init();
    database = app.get(DatabaseService); activity = app.get(ActivityService); lifecycle = app.get(ProposalLifecycleService);
    proposals = app.get(ProposalsService);
    administration = new AccountAdministrationService(database, app.get(ReviewsService));
    const passwordHash = await hashPassword(password);
    await database.client.userAccount.createMany({ data: Object.entries(ids).map(([name, id]) => ({ id, username: `${prefix}-${name}`.toLowerCase(), passwordHash,
      role: name === 'owner' || name === 'earlyOwner' || name === 'other' ? 'CONTRIBUTOR' as const : name === 'maintainer' ? 'RELEASE_MAINTAINER' as const : 'REVIEWER' as const })) });
  });
  beforeEach(async () => {
    await clean();
    await database.client.userAccount.updateMany({ where: { id: { in: Object.values(ids) } }, data: { enabled: true, version: 1 } });
    owner = await login('owner'); other = await login('other'); a = await login('a'); b = await login('b'); maintainer = await login('maintainer');
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (database) {
      await clean();
      await database.client.authSession.deleteMany({ where: { OR: Object.values(ids).map(id => ({ data: { contains: id } })) } });
      await database.client.securityEvent.deleteMany({ where: { OR: [{ actorId: { in: Object.values(ids) } }, { target: { startsWith: prefix } }] } });
      await database.client.userAccount.deleteMany({ where: { id: { in: Object.values(ids) } } });
    }
    await app?.close();
  });
  const post = (session: Session, path: string, body: object) => session.agent.post(`/api/proposals${path}`).set('x-csrf-token', session.token).send(body);
  async function create(input: WorkingContent = content) {
    return proposalLifecycleResponseSchema.parse((await post(owner, '', input).expect(201)).body);
  }
  const submit = (root: ProposalLifecycleResponse, key = randomUUID(), session = owner) => session.agent.post(`/api/proposals/${root.proposalId}/submit`)
    .set('x-csrf-token', session.token).set('Idempotency-Key', key).send({ expectedVersion: root.version, workingRevisionId: root.workingRevisionId });
  async function saved(root: ProposalLifecycleResponse, input?: WorkingContent) {
    const draft = draftResponseSchema.parse((await owner.agent.get(`/api/proposals/${root.proposalId}/draft`).expect(200)).body);
    return proposalLifecycleResponseSchema.parse((await owner.agent.patch(`/api/proposals/${root.proposalId}/draft`).set('x-csrf-token', owner.token)
      .send({ expectedVersion: root.version, content: input ?? draft.content }).expect(200)).body);
  }
  async function claim(root: ProposalLifecycleResponse, session = a): Promise<Command> {
    return (await post(session, `/${root.proposalId}/claim`, { expectedVersion: root.version }).expect(200)).body as Command;
  }
  async function submitted() { return proposalLifecycleResponseSchema.parse((await submit(await create()).expect(200)).body); }
  async function assigned() {
    const root = await submitted(); const command = await claim(root);
    return { root: { ...root, ...command } as ProposalLifecycleResponse, command };
  }
  async function approve() {
    let { root, command } = await assigned();
    const criterion = await database.client.acceptanceCriterion.findFirstOrThrow({ where: { revisionId: root.revisionId! } });
    command = (await a.agent.put(`/api/proposals/${root.proposalId}/coverage/${criterion.id}`).set('x-csrf-token', a.token)
      .send({ ...scope(command), operation: 'ASSESS', status: 'COVERED' }).expect(200)).body as Command;
    const key = randomUUID(); const body = { ...scope(command), decision: 'APPROVE' };
    const decision = await a.agent.post(`/api/proposals/${root.proposalId}/decision`).set('x-csrf-token', a.token).set('Idempotency-Key', key).send(body).expect(200);
    root = { ...root, ...decision.body } as ProposalLifecycleResponse;
    return { root, key, body, decisionId: decision.body.decision.id as string };
  }
  async function snapshot(id: string) {
    const revisions = await database.client.proposalRevision.findMany({ where: { proposalId: id }, orderBy: { number: 'asc' },
      include: { criteria: { orderBy: { id: 'asc' } }, evidence: { orderBy: { id: 'asc' } } } });
    return { root: await database.client.changeProposal.findUnique({ where: { id } }), revisions,
      working: await database.client.workingRevision.findUnique({ where: { proposalId: id } }),
      assignments: await database.client.reviewAssignment.findMany({ where: { proposalId: id }, orderBy: { id: 'asc' } }),
      activity: await database.client.proposalActivity.findMany({ where: { proposalId: id }, orderBy: { id: 'asc' } }),
      notices: await database.client.notification.findMany({ where: { proposalId: id }, orderBy: { id: 'asc' } }),
      keys: await database.client.reviewIdempotency.findMany({ where: { proposalId: id }, orderBy: { id: 'asc' } }),
      invalidations: await database.client.approvalInvalidation.findMany({ where: { proposalId: id }, orderBy: { id: 'asc' } }) };
  }
  // Real storage failures in each dependent table prove PostgreSQL rollback, not
  // merely that a mocked service was called. The entire suite is DB-serialized.
  async function failWrite(table: string, operation: 'INSERT' | 'UPDATE', work: () => Promise<unknown>) {
    const name = `lifecycle_failure_${randomUUID().replace(/-/g, '')}`;
    await database.client.$executeRawUnsafe(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''Synthetic lifecycle write failure''; END'`);
    try {
      await database.client.$executeRawUnsafe(`CREATE TRIGGER "${name}" BEFORE ${operation} ON "${table}" FOR EACH ROW EXECUTE FUNCTION "${name}"()`);
      try { await work(); }
      finally { await database.client.$executeRawUnsafe(`DROP TRIGGER "${name}" ON "${table}"`); }
    } finally { await database.client.$executeRawUnsafe(`DROP FUNCTION "${name}"()`); }
  }

  it('creates private owner drafts, issues IDs and guards role, ownership, CSRF and injected fields', async () => {
    await request(app.getHttpServer()).post('/api/proposals').send(content).expect(401);
    for (const session of [a, maintainer]) await post(session, '', content).expect(403);
    await owner.agent.post('/api/proposals').send(content).expect(403);
    await post(owner, '', { ...content, ownerId: ids.other }).expect(422);
    const root = await create();
    expect(root).toMatchObject({ state: 'DRAFT', version: 0, revisionId: null, assignmentId: null });
    expect(await database.client.changeProposal.findUniqueOrThrow({ where: { id: root.proposalId } })).toMatchObject({ ownerId: ids.owner, title: 'Private working draft' });
    const draft = draftResponseSchema.parse((await owner.agent.get(`/api/proposals/${root.proposalId}/draft`).expect(200)).body);
    expect(draft.content).toMatchObject(content); expect(draft.content.criteria[0]!.stableKey).toEqual(expect.any(String));
    for (const session of [other, a, maintainer]) {
      const denied = await session.agent.get(`/api/proposals/${root.proposalId}/draft`).expect(403);
      expect(JSON.stringify(denied.body)).not.toContain(content.title);
    }
    const event = await database.client.proposalActivity.findFirstOrThrow({ where: { proposalId: root.proposalId } });
    expect(event).toMatchObject({ action: 'DRAFT_CREATED', revisionId: null, assignmentId: null });
    expect(JSON.stringify(event)).not.toContain(content.title);
    await other.agent.patch(`/api/proposals/${root.proposalId}/draft`).set('x-csrf-token', other.token).send({ expectedVersion: 0, content }).expect(403);
    await submit(root, randomUUID(), other).expect(403);
    await post(other, `/${root.proposalId}/withdraw`, { expectedVersion: 0, confirmed: true, reason: 'No ownership' }).expect(403);
    await post(other, `/${root.proposalId}/reopen`, { expectedVersion: 0 }).expect(403);
  });
  it('requires valid required criteria, sanitized unified diff and proposal-scoped working references', async () => {
    for (const input of [{ ...content, criteria: [] }, { ...content, criteria: [{ statement: 'Optional', required: false }] },
      { ...content, summary: '' }, { ...content, summary: ' \n\t ' }, { ...content, diffText: '' },
      { ...content, diffText: '+ not a unified patch' }, { ...content, diffText: content.diffText + '\u001b[31m' }]) {
      const root = await create(input); const before = await snapshot(root.proposalId);
      await submit(root).expect(422); expect(await snapshot(root.proposalId)).toEqual(before);
    }
    const root = await create(); const foreign = await create();
    await submit({ ...root, workingRevisionId: foreign.workingRevisionId }).expect(422);
    const draft = draftResponseSchema.parse((await owner.agent.get(`/api/proposals/${foreign.proposalId}/draft`).expect(200)).body);
    await owner.agent.patch(`/api/proposals/${root.proposalId}/draft`).set('x-csrf-token', owner.token)
      .send({ expectedVersion: root.version, content: draft.content }).expect(422);
    await owner.agent.post(`/api/proposals/${root.proposalId}/submit`).set('x-csrf-token', owner.token)
      .send({ expectedVersion: root.version, workingRevisionId: root.workingRevisionId }).expect(422);
    const emptyEvidence = await create({ ...content, evidence: [] }); await submit(emptyEvidence).expect(200);
  });
  it('publishes immutable revisions, retains reviewer with a new round, clears coverage and carries original findings', async () => {
    let { root, command } = await assigned();
    const original = await database.client.proposalRevision.findUniqueOrThrow({ where: { id: root.revisionId! }, include: { criteria: true, evidence: true } });
    command = (await a.agent.put(`/api/proposals/${root.proposalId}/coverage/${original.criteria[0]!.id}`).set('x-csrf-token', a.token)
      .send({ ...scope(command), operation: 'ASSESS', status: 'COVERED' }).expect(200)).body as Command;
    const finding = await post(a, `/${root.proposalId}/findings`, { ...scope(command), criterionId: original.criteria[0]!.id,
      severity: 'HIGH', description: 'Unresolved finding survives rewrite.' }).expect(201); command = finding.body as Command;
    const decision = await a.agent.post(`/api/proposals/${root.proposalId}/decision`).set('x-csrf-token', a.token).set('Idempotency-Key', randomUUID())
      .send({ ...scope(command), decision: 'REQUEST_CHANGES' }).expect(200); root = { ...root, ...decision.body } as ProposalLifecycleResponse;
    const draft = draftResponseSchema.parse((await owner.agent.get(`/api/proposals/${root.proposalId}/draft`).expect(200)).body);
    const next = await saved(root, { ...draft.content, title: 'Unpublished replacement title', summary: 'New summary',
      criteria: [{ ...draft.content.criteria[0]!, statement: 'Materially rewritten result' }] });
    expect((await a.agent.get(`/api/proposals/${root.proposalId}`).expect(200)).body.title).toBe(content.title);
    root = proposalLifecycleResponseSchema.parse((await submit(next).expect(200)).body);
    expect(root).toMatchObject({ state: 'IN_REVIEW', assignmentVersion: 0 }); expect(root.assignmentId).not.toBe(command.assignmentId);
    const revised = await database.client.proposalRevision.findUniqueOrThrow({ where: { id: root.revisionId! }, include: { criteria: true, evidence: true } });
    expect(revised.number).toBe(2); expect(revised.criteria[0]!.stableKey).not.toBe(original.criteria[0]!.stableKey);
    expect(revised.evidence[0]!.id).not.toBe(original.evidence[0]!.id);
    expect(await database.client.proposalRevision.findUniqueOrThrow({ where: { id: original.id }, include: { criteria: true, evidence: true } })).toEqual(original);
    expect(await database.client.changeProposal.findUniqueOrThrow({ where: { id: root.proposalId } })).toMatchObject({ firstSubmittedAt: original.submittedAt });
    expect(await database.client.reviewAssignment.findUniqueOrThrow({ where: { id: command.assignmentId } })).toMatchObject({ status: 'CLOSED', endReason: 'REVISION_REPLACED' });
    const review = await a.agent.get(`/api/proposals/${root.proposalId}/review`).expect(200);
    expect(review.body.coverage).toEqual([]); expect(review.body.approvalBlockers).toEqual(expect.arrayContaining([{ code: 'UNRESOLVED_HIGH_CRITICAL' }]));
    const findings = await a.agent.get(`/api/proposals/${root.proposalId}/findings`).expect(200);
    expect(findings.body.items[0]).toMatchObject({ id: finding.body.finding.id, revisionId: original.id, criterionId: original.criteria[0]!.id, status: 'OPEN' });
    expect(await database.client.notification.count({ where: { proposalId: root.proposalId, revisionId: root.revisionId!, kind: 'NEW_REVISION', recipientId: ids.a } })).toBe(1);
    await a.agent.put(`/api/proposals/${root.proposalId}/coverage/${original.criteria[0]!.id}`).set('x-csrf-token', a.token)
      .send({ ...scope(command), operation: 'ASSESS', status: 'COVERED' }).expect(409);
    await expect(database.client.proposalRevision.update({ where: { id: original.id }, data: { summary: 'Rewrite' } })).rejects.toThrow();
  });
  it('serializes identical submission keys, binds body, expires at 24h and never duplicates after expiry', async () => {
    const root = await create(); const key = randomUUID();
    const results = await Promise.all([submit(root, key), submit(root, key)]);
    expect(results.map(r => r.status)).toEqual([200, 200]); expect(results[0]!.body).toEqual(results[1]!.body);
    expect(await database.client.proposalRevision.count({ where: { proposalId: root.proposalId } })).toBe(1);
    expect(await database.client.proposalActivity.count({ where: { proposalId: root.proposalId, action: 'SUBMITTED' } })).toBe(1);
    await submit({ ...root, version: 999 }, key).expect(409);
    const stored = await database.client.reviewIdempotency.findFirstOrThrow({ where: { proposalId: root.proposalId } });
    expect(stored.keyHash).not.toBe(key); expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBeGreaterThan(23 * 3600000);
    expect(stored.expiresAt.getTime() - stored.createdAt.getTime()).toBeLessThan(24 * 3600000 + 60000);
    await post(owner, `/${root.proposalId}/withdraw`, { expectedVersion: results[0]!.body.version, confirmed: true, reason: 'Completed owner withdrawal' }).expect(200);
    expect((await submit(root, key).expect(200)).body).toEqual(results[0]!.body);
    await database.client.reviewIdempotency.update({ where: { id: stored.id }, data: { expiresAt: new Date('2000-01-01') } });
    await submit(root, key).expect(409); expect(await database.client.proposalRevision.count({ where: { proposalId: root.proposalId } })).toBe(1);
    await administration.disable(`${prefix}-owner`); await submit(root, key).expect(401);
  });
  it('serializes saves and conflicting lifecycle commands without duplicate revisions or dangling assignments', async () => {
    const draft = await create();
    const saves = await Promise.all([owner.agent.patch(`/api/proposals/${draft.proposalId}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: 0, content }),
      owner.agent.patch(`/api/proposals/${draft.proposalId}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: 0, content })]);
    expect(saves.map(r => r.status).sort()).toEqual([200, 409]);
    const root = await create();
    const submissions = await Promise.all([submit(root), submit(root)]); expect(submissions.map(r => r.status).sort()).toEqual([200, 409]);
    const assignedCase = await assigned();
    const raced = await Promise.all([submit(assignedCase.root), post(owner, `/${assignedCase.root.proposalId}/withdraw`,
      { expectedVersion: assignedCase.root.version, confirmed: true, reason: 'Concurrent withdrawal' })]);
    expect(raced.map(r => r.status).sort()).toEqual([200, 409]);
    const final = await database.client.changeProposal.findUniqueOrThrow({ where: { id: assignedCase.root.proposalId } });
    const active = await database.client.reviewAssignment.findMany({ where: { proposalId: final.id, status: 'ACTIVE' } });
    expect(active).toHaveLength(final.state === 'WITHDRAWN' ? 0 : 1);
    if (active[0]) expect(active[0]).toMatchObject({ id: final.currentAssignmentId, revisionId: final.currentRevisionId });
    const pool = await submitted();
    const claimWithdraw = await Promise.all([post(a, `/${pool.proposalId}/claim`, { expectedVersion: pool.version }),
      post(owner, `/${pool.proposalId}/withdraw`, { expectedVersion: pool.version, confirmed: true, reason: 'Concurrent pool withdrawal' })]);
    expect(claimWithdraw.map(r => r.status).sort()).toEqual([200, 409]);
  });
  it('rechecks reviewer lock sets after the pre-read and serializes drop/disable with submission', async () => {
    const { root, command } = await assigned();
    // A changed assignee is introduced before the account-lock transaction starts.
    // This models the pointer-read race without changing production lock ordering.
    const pointerReader = lifecycle as unknown as { pointer(id: string): Promise<string | undefined> };
    const originalPointerRead = pointerReader.pointer.bind(lifecycle);
    jest.spyOn(pointerReader, 'pointer').mockImplementationOnce(async id => {
      const value = await originalPointerRead(id);
      const dropped = await post(a, `/${root.proposalId}/drop`, scope(command)).expect(200);
      await post(b, `/${root.proposalId}/claim`, { expectedVersion: dropped.body.version }).expect(200);
      return value;
    });
    const beforeCount = await database.client.proposalRevision.count({ where: { proposalId: root.proposalId } });
    await submit(root).expect(409);
    expect(await database.client.proposalRevision.count({ where: { proposalId: root.proposalId } })).toBe(beforeCount);
    jest.restoreAllMocks();
    const second = await assigned();
    const race = await Promise.all([submit(second.root), administration.disable(`${prefix}-a`)]);
    expect([200, 409]).toContain((race[0] as request.Response).status);
    const final = await database.client.changeProposal.findUniqueOrThrow({ where: { id: second.root.proposalId } });
    expect(final.currentAssignmentId).toBeNull();
    expect(await database.client.reviewAssignment.count({ where: { proposalId: final.id, status: 'ACTIVE' } })).toBe(0);
  });
  it.each([
    { operation: 'decision', winner: 'submit', ownerFirst: true },
    { operation: 'decision', winner: 'reviewer', ownerFirst: true },
    { operation: 'drop', winner: 'submit', ownerFirst: true },
    { operation: 'drop', winner: 'reviewer', ownerFirst: true },
    { operation: 'decision', winner: 'submit', ownerFirst: false },
    { operation: 'decision', winner: 'reviewer', ownerFirst: false },
    { operation: 'drop', winner: 'submit', ownerFirst: false },
    { operation: 'drop', winner: 'reviewer', ownerFirst: false },
  ] as const)('serializes overlapping submit/$operation with $winner first and ownerFirst=$ownerFirst', async ({ operation, winner, ownerFirst }) => {
    const raceOwner = ownerFirst ? await login('earlyOwner') : owner;
    expect((ownerFirst ? ids.earlyOwner : ids.owner) < ids.a).toBe(ownerFirst);
    const draft = proposalLifecycleResponseSchema.parse((await post(raceOwner, '', content).expect(201)).body);
    const first = proposalLifecycleResponseSchema.parse((await submit(draft, randomUUID(), raceOwner).expect(200)).body);
    const firstAssignment = await claim(first);
    const original = await a.agent.post(`/api/proposals/${first.proposalId}/decision`).set('x-csrf-token', a.token).set('Idempotency-Key', randomUUID())
      .send({ ...scope(firstAssignment), decision: 'REQUEST_CHANGES', note: 'Earlier immutable decision.' }).expect(200);
    const originalDecision = await database.client.reviewDecision.findUniqueOrThrow({ where: { id: original.body.decision.id as string } });
    const root = proposalLifecycleResponseSchema.parse((await submit({ ...first, ...original.body } as ProposalLifecycleResponse, randomUUID(), raceOwner).expect(200)).body);
    const command: Command = { proposalId: root.proposalId, revisionId: root.revisionId!, assignmentId: root.assignmentId!,
      assignmentVersion: root.assignmentVersion!, version: root.version };
    const before = await snapshot(root.proposalId);
    const submission = submit(root, randomUUID(), raceOwner);
    const reviewerCommand = operation === 'drop' ? post(a, `/${root.proposalId}/drop`, scope(command))
      : a.agent.post(`/api/proposals/${root.proposalId}/decision`).set('x-csrf-token', a.token).set('Idempotency-Key', randomUUID())
        .send({ ...scope(command), decision: 'REQUEST_CHANGES', note: 'Concurrent current revision decision.' });

    let rootAcquired!: () => void; let releaseRoot!: () => void;
    const acquired = new Promise<void>(resolve => { rootAcquired = resolve; });
    const release = new Promise<void>(resolve => { releaseRoot = resolve; });
    const originalLock = proposals.lockRoot.bind(proposals);
    const lock = jest.spyOn(proposals, 'lockRoot').mockImplementationOnce(async (...args) => {
      const locked = await originalLock(...args); rootAcquired(); await release; return locked;
    });
    const server = app.getHttpServer() as Server;
    const firstRequest = (winner === 'submit' ? submission : reviewerCommand).then(result => result);
    let secondRequest: Promise<request.Response> | undefined;
    let arrival: ((request: IncomingMessage) => void) | undefined;
    let results!: request.Response[];
    try {
      await Promise.race([acquired, firstRequest.then(() => { throw new Error('First command ended before the root-lock barrier'); })]);
      const secondPath = `/api/proposals/${root.proposalId}/${winner === 'submit' ? operation : 'submit'}`;
      const arrived = new Promise<void>(resolve => {
        arrival = incoming => { if (incoming.url === secondPath) resolve(); };
        server.on('request', arrival);
      });
      secondRequest = (winner === 'submit' ? reviewerCommand : submission).then(result => result);
      // The second real HTTP request arrives while the first transaction owns
      // its account/session/root locks. No sleep or scheduling guess is needed.
      await Promise.race([arrived, secondRequest.then(() => { throw new Error('Contender ended before the root-lock barrier was released'); })]);
      releaseRoot();
      results = await Promise.all([firstRequest, secondRequest]);
    } finally {
      releaseRoot();
      if (arrival) server.off('request', arrival);
      await Promise.allSettled([firstRequest, ...(secondRequest ? [secondRequest] : [])]);
      lock.mockRestore();
    }
    expect(results.map(result => result.status)).toEqual([200, 409]);
    const after = await snapshot(root.proposalId);
    expect(after.root).toMatchObject({ version: root.version + 1, firstSubmittedAt: before.root!.firstSubmittedAt });
    expect(after.working).toEqual(before.working);
    expect(after.revisions.slice(0, before.revisions.length)).toEqual(before.revisions);
    expect(after.assignments.filter(assignment => assignment.id !== command.assignmentId && before.assignments.some(previous => previous.id === assignment.id)))
      .toEqual(before.assignments.filter(assignment => assignment.id !== command.assignmentId));
    const newActivity = after.activity.filter(event => !before.activity.some(previous => previous.id === event.id));
    const active = after.assignments.filter(assignment => assignment.status === 'ACTIVE');
    const decisions = await database.client.reviewDecision.findMany({ where: { proposalId: root.proposalId } });
    expect(await database.client.reviewDecision.findUniqueOrThrow({ where: { id: originalDecision.id } })).toEqual(originalDecision);
    if (winner === 'submit') {
      expect(after.root).toMatchObject({ state: 'IN_REVIEW' });
      expect(after.root!.currentRevisionId).not.toBe(command.revisionId);
      expect(after.revisions).toHaveLength(before.revisions.length + 1);
      expect(after.revisions.at(-1)!.number).toBe(before.revisions.at(-1)!.number + 1);
      expect(after.assignments).toHaveLength(before.assignments.length + 1);
      expect(after.assignments.find(assignment => assignment.id === command.assignmentId))
        .toMatchObject({ status: 'CLOSED', endReason: 'REVISION_REPLACED', version: command.assignmentVersion + 1 });
      expect(active).toHaveLength(1); expect(active[0]).toMatchObject({ id: after.root!.currentAssignmentId, revisionId: after.root!.currentRevisionId, reviewerId: ids.a });
      expect(newActivity.map(event => event.action).sort()).toEqual(['NOTIFICATION_CREATED', 'RESUBMITTED']);
      expect(after.notices).toHaveLength(before.notices.length + 1);
      expect(after.notices.filter(notice => !before.notices.some(previous => previous.id === notice.id)))
        .toEqual([expect.objectContaining({ revisionId: after.root!.currentRevisionId, assignmentId: after.root!.currentAssignmentId, recipientId: ids.a })]);
      expect(after.keys).toHaveLength(before.keys.length + 1); expect(decisions).toHaveLength(1);
    } else {
      expect(after.revisions).toEqual(before.revisions); expect(after.notices).toEqual(before.notices);
      expect(after.root).toMatchObject({ currentRevisionId: command.revisionId, state: operation === 'drop' ? 'SUBMITTED' : 'CHANGES_REQUESTED',
        currentAssignmentId: operation === 'drop' ? null : command.assignmentId });
      expect(after.assignments).toHaveLength(before.assignments.length);
      expect(active).toHaveLength(operation === 'drop' ? 0 : 1);
      if (operation === 'drop') expect(after.assignments.find(assignment => assignment.id === command.assignmentId))
        .toMatchObject({ status: 'CLOSED', endReason: 'DROPPED', version: command.assignmentVersion + 1 });
      else expect(after.assignments).toEqual(before.assignments);
      expect(newActivity.map(event => event.action)).toEqual([operation === 'drop' ? 'DROPPED' : 'CHANGES_REQUESTED']);
      expect(after.keys).toHaveLength(before.keys.length + (operation === 'decision' ? 1 : 0));
      expect(decisions).toHaveLength(operation === 'decision' ? 2 : 1);
      if (operation === 'decision') expect(decisions.find(decision => decision.id !== originalDecision.id))
        .toMatchObject({ revisionId: command.revisionId, assignmentId: command.assignmentId, decision: 'REQUEST_CHANGES' });
    }
    const history = await raceOwner.agent.get(`/api/proposals/${root.proposalId}/decisions`).expect(200);
    expect(history.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: originalDecision.id, revisionId: first.revisionId })]));
  });
  it('withdraws draft and assigned work durably, removes access and sends only a safe status notice', async () => {
    const draft = await create();
    await post(owner, `/${draft.proposalId}/withdraw`, { expectedVersion: 0, confirmed: false, reason: 'No confirmation' }).expect(422);
    await post(owner, `/${draft.proposalId}/withdraw`, { expectedVersion: 0, confirmed: true, reason: 'Draft withdrawn' }).expect(200);
    expect(await database.client.proposalRevision.count({ where: { proposalId: draft.proposalId } })).toBe(0);
    expect(await database.client.proposalActivity.findFirst({ where: { proposalId: draft.proposalId, action: 'WITHDRAWN' } })).toMatchObject({ revisionId: null, assignmentId: null, reason: 'Draft withdrawn' });
    const { root, command } = await assigned();
    await post(owner, `/${root.proposalId}/withdraw`, { expectedVersion: root.version, confirmed: true, reason: 'Owner audit reason' }).expect(200);
    expect(await database.client.reviewAssignment.findUniqueOrThrow({ where: { id: command.assignmentId } })).toMatchObject({ status: 'CLOSED', endReason: 'WITHDRAWN' });
    const notice = await database.client.notification.findFirstOrThrow({ where: { proposalId: root.proposalId, kind: 'WITHDRAWN' } });
    expect(notice.recipientId).toBe(ids.a);
    const listed = await a.agent.get('/api/notifications').expect(200);
    expect(listed.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: notice.id, kind: 'WITHDRAWN' })]));
    expect(JSON.stringify(listed.body)).not.toMatch(/Owner audit reason|Private synthetic title|Frozen summary/);
    for (const path of ['', '/review', '/activity', '/revisions']) await a.agent.get(`/api/proposals/${root.proposalId}${path}`).expect(403);
    await post(a, `/${root.proposalId}/findings`, { ...scope(command), severity: 'LOW', description: 'Stale finding' }).expect(403);
    await submit({ ...root, version: root.version + 1 }).expect(409);
    await owner.agent.patch(`/api/proposals/${root.proposalId}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: root.version + 1, content }).expect(409);
  });
  it('invalidates the exact immutable approval on reopen, rejects replay and requires resubmission', async () => {
    const { root, key, body, decisionId } = await approve();
    expect((await a.agent.get(`/api/proposals/${root.proposalId}`).expect(200)).body.effectiveApproval).toBe(true);
    const decision = await database.client.reviewDecision.findUniqueOrThrow({ where: { id: decisionId } });
    const reopened = proposalLifecycleResponseSchema.parse((await post(owner, `/${root.proposalId}/reopen`, { expectedVersion: root.version }).expect(200)).body);
    expect(reopened).toMatchObject({ state: 'CHANGES_REQUESTED', assignmentId: root.assignmentId, revisionId: root.revisionId });
    expect(await database.client.reviewDecision.findUniqueOrThrow({ where: { id: decisionId } })).toEqual(decision);
    const invalidation = await database.client.approvalInvalidation.findUniqueOrThrow({ where: { decisionId } });
    expect(invalidation).toMatchObject({ proposalId: root.proposalId, revisionId: root.revisionId, assignmentId: root.assignmentId, actorId: ids.owner, mutationVersion: reopened.version });
    await expect(database.client.approvalInvalidation.update({ where: { id: invalidation.id }, data: { actorId: ids.other } })).rejects.toThrow();
    await a.agent.post(`/api/proposals/${root.proposalId}/decision`).set('x-csrf-token', a.token).set('Idempotency-Key', key).send(body).expect(409);
    const review = await a.agent.get(`/api/proposals/${root.proposalId}/review`).expect(200);
    expect(review.body.approvalBlockers).toEqual(expect.arrayContaining([{ code: 'STATE' }]));
    for (const session of [owner, a, maintainer])
      expect((await session.agent.get(`/api/proposals/${root.proposalId}`).expect(200)).body.effectiveApproval).toBe(false);
    await post(owner, `/${root.proposalId}/reopen`, { expectedVersion: reopened.version }).expect(409);
    const revised = proposalLifecycleResponseSchema.parse((await submit(await saved(reopened)).expect(200)).body);
    expect(revised.revisionId).not.toBe(root.revisionId); expect(revised.state).toBe('IN_REVIEW');
  });
  it.each([
    { unavailable: 'disabled', next: 'submit' }, { unavailable: 'disabled', next: 'withdraw' },
    { unavailable: 'changed-role', next: 'submit' }, { unavailable: 'changed-role', next: 'withdraw' },
  ] as const)('releases the completed $unavailable assignee when reopening so the owner can $next', async ({ unavailable, next }) => {
    const { root, decisionId } = await approve();
    const decision = await database.client.reviewDecision.findUniqueOrThrow({ where: { id: decisionId } });
    if (unavailable === 'disabled') expect(await administration.disable(`${prefix}-a`)).toEqual({ released: 0 });
    else await database.client.userAccount.update({ where: { id: ids.a }, data: { role: 'CONTRIBUTOR', version: 2 } });
    try {
      const before = await snapshot(root.proposalId);
      expect(before.root).toMatchObject({ state: 'APPROVED', currentAssignmentId: root.assignmentId });
      expect(before.assignments.find(assignment => assignment.id === root.assignmentId)).toMatchObject({ status: 'ACTIVE' });
      const reopened = proposalLifecycleResponseSchema.parse((await post(owner, `/${root.proposalId}/reopen`, { expectedVersion: root.version }).expect(200)).body);
      expect(reopened).toMatchObject({ state: 'CHANGES_REQUESTED', assignmentId: null, assignmentVersion: null, version: root.version + 1 });
      const after = await snapshot(root.proposalId);
      expect(after.root).toMatchObject({ state: 'CHANGES_REQUESTED', currentAssignmentId: null, currentRevisionId: root.revisionId });
      expect(after.revisions).toEqual(before.revisions); expect(after.notices).toEqual(before.notices);
      expect(after.assignments.find(assignment => assignment.id === root.assignmentId)).toMatchObject({ status: 'CLOSED',
        endReason: 'ACCOUNT_DISABLED', version: root.assignmentVersion! + 1, endedAt: expect.any(Date) });
      expect(after.invalidations).toEqual([expect.objectContaining({ decisionId, revisionId: root.revisionId, assignmentId: root.assignmentId, mutationVersion: reopened.version })]);
      expect(after.activity.filter(event => !before.activity.some(previous => previous.id === event.id)).map(event => event.action).sort())
        .toEqual(['ASSIGNMENT_RELEASED', 'REOPENED']);
      expect(await database.client.reviewDecision.findUniqueOrThrow({ where: { id: decisionId } })).toEqual(decision);
      await a.agent.get(`/api/proposals/${root.proposalId}`).expect(401);
      expect((await owner.agent.get(`/api/proposals/${root.proposalId}`).expect(200)).body.effectiveApproval).toBe(false);
      if (next === 'submit') {
        const submitted = proposalLifecycleResponseSchema.parse((await submit(reopened).expect(200)).body);
        expect(submitted).toMatchObject({ state: 'SUBMITTED', assignmentId: null }); expect(submitted.revisionId).not.toBe(root.revisionId);
      } else {
        const withdrawn = await post(owner, `/${root.proposalId}/withdraw`, { expectedVersion: reopened.version, confirmed: true, reason: 'Owner can withdraw reopened work.' }).expect(200);
        expect(withdrawn.body).toMatchObject({ state: 'WITHDRAWN', assignmentId: null });
      }
      expect(await database.client.reviewAssignment.count({ where: { proposalId: root.proposalId, status: 'ACTIVE' } })).toBe(0);
      expect(await database.client.reviewDecision.findUniqueOrThrow({ where: { id: decisionId } })).toEqual(decision);
    } finally {
      await database.client.userAccount.update({ where: { id: ids.a }, data: { role: 'REVIEWER' } });
    }
  });
  it.each(['disable', 'reopen'] as const)('serializes account disablement and owner reopening with %s first', async first => {
    const { root, decisionId } = await approve();
    const decision = await database.client.reviewDecision.findUniqueOrThrow({ where: { id: decisionId } });
    const before = await snapshot(root.proposalId);
    const reviews = app.get(ReviewsService);
    let entered!: () => void; let release!: () => void;
    const held = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    const originalRoot = proposals.lockRoot.bind(proposals); const originalRelease = reviews.releaseDisabledAssignments.bind(reviews);
    const barrier = first === 'reopen'
      ? jest.spyOn(proposals, 'lockRoot').mockImplementationOnce(async (...args) => {
        const locked = await originalRoot(...args); entered(); await gate; return locked;
      })
      : jest.spyOn(reviews, 'releaseDisabledAssignments').mockImplementationOnce(async (...args) => {
        // Administrative disablement already owns the reviewer account lock.
        entered(); await gate; return originalRelease(...args);
      });
    let disabled!: Promise<{ released: number }>; let reopened!: Promise<request.Response>;
    if (first === 'reopen') reopened = post(owner, `/${root.proposalId}/reopen`, { expectedVersion: root.version }).then(result => result);
    else disabled = administration.disable(`${prefix}-a`);
    try {
      await Promise.race([held, (first === 'reopen' ? reopened : disabled).then(() => { throw new Error('First command missed the lock barrier'); })]);
      if (first === 'reopen') disabled = administration.disable(`${prefix}-a`);
      else reopened = post(owner, `/${root.proposalId}/reopen`, { expectedVersion: root.version }).then(result => result);
      let blocked = false;
      // Observe a real PostgreSQL account-row lock wait before releasing the
      // winner. Each round trip yields to the contender without timing sleeps.
      for (let attempt = 0; attempt < 100 && !blocked; attempt++) {
        const rows = await database.client.$queryRaw<{ count: number }[]>`SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock'
          AND position('UserAccount' in query)>0 AND position('FOR UPDATE' in query)>0`;
        blocked = rows[0]!.count > 0;
      }
      expect(blocked).toBe(true);
    } finally {
      release();
      await Promise.allSettled([...(disabled ? [disabled] : []), ...(reopened ? [reopened] : [])]);
      barrier.mockRestore();
    }
    expect(await disabled).toEqual({ released: first === 'disable' ? 0 : 1 });
    const response = await reopened; expect(response.status).toBe(200);
    const after = await snapshot(root.proposalId);
    expect(after.root).toMatchObject({ state: 'CHANGES_REQUESTED', currentAssignmentId: null,
      version: root.version + (first === 'disable' ? 1 : 2) });
    expect(after.revisions).toEqual(before.revisions); expect(after.notices).toEqual(before.notices);
    expect(after.invalidations).toEqual([expect.objectContaining({ decisionId, mutationVersion: root.version + 1 })]);
    expect(after.assignments.find(assignment => assignment.id === root.assignmentId)).toMatchObject({ status: 'CLOSED',
      endReason: 'ACCOUNT_DISABLED', version: root.assignmentVersion! + 1 });
    expect(after.activity.filter(event => !before.activity.some(previous => previous.id === event.id)).map(event => event.action).sort())
      .toEqual(['ASSIGNMENT_RELEASED', 'REOPENED']);
    expect(await database.client.reviewDecision.findUniqueOrThrow({ where: { id: decisionId } })).toEqual(decision);
    await a.agent.get(`/api/proposals/${root.proposalId}`).expect(401);
    const next = proposalLifecycleResponseSchema.parse(response.body);
    expect((await submit({ ...next, version: after.root!.version }).expect(200)).body).toMatchObject({ state: 'SUBMITTED', assignmentId: null });
  });
  it('rolls back unavailable-assignee cleanup together with approval invalidation, root and both activities', async () => {
    const { root } = await approve(); await administration.disable(`${prefix}-a`);
    const before = await snapshot(root.proposalId);
    for (const [table, operation] of [['ApprovalInvalidation', 'INSERT'], ['ReviewAssignment', 'UPDATE'], ['ChangeProposal', 'UPDATE'], ['ProposalActivity', 'INSERT']] as const) {
      await failWrite(table, operation, async () => { await post(owner, `/${root.proposalId}/reopen`, { expectedVersion: root.version }).expect(500); });
      expect(await snapshot(root.proposalId)).toEqual(before);
    }
    const appender = activity as unknown as { append: (...args: Parameters<ActivityService['append']>) => Promise<Awaited<ReturnType<ActivityService['append']>>> };
    const append = appender.append.bind(activity);
    const failingReleaseActivity = jest.spyOn(appender, 'append').mockImplementation(async (...args) => {
      if (args[1].action === 'ASSIGNMENT_RELEASED') throw new Error('Synthetic release-activity failure');
      return append(...args);
    });
    try { await post(owner, `/${root.proposalId}/reopen`, { expectedVersion: root.version }).expect(500); }
    finally { failingReleaseActivity.mockRestore(); }
    expect(await snapshot(root.proposalId)).toEqual(before);
  });
  it('blocks save, submit, withdrawal and reopening at the attachment seam and terminal release states', async () => {
    for (const state of ['APPROVED', 'IN_RELEASE', 'RELEASED'] as const) {
      const { root } = await approve();
      await database.client.changeProposal.update({ where: { id: root.proposalId }, data: { state, releaseAttachmentRef: 'synthetic-candidate' } });
      await owner.agent.patch(`/api/proposals/${root.proposalId}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: root.version, content }).expect(409);
      await submit(root).expect(409);
      await post(owner, `/${root.proposalId}/withdraw`, { expectedVersion: root.version, confirmed: true, reason: 'Attached item' }).expect(409);
      await post(owner, `/${root.proposalId}/reopen`, { expectedVersion: root.version }).expect(409);
      expect(await database.client.approvalInvalidation.count({ where: { proposalId: root.proposalId } })).toBe(0);
    }
    const root = await submitted();
    await database.client.changeProposal.update({ where: { id: root.proposalId }, data: { releaseAttachmentRef: 'inconsistent-state-marker' } });
    await submit(root).expect(409);
    await owner.agent.patch(`/api/proposals/${root.proposalId}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: root.version, content }).expect(409);
    await post(owner, `/${root.proposalId}/withdraw`, { expectedVersion: root.version, confirmed: true, reason: 'Guard marker' }).expect(409);
  });
  it('does not create draft state during GET for legacy submitted fixtures; explicit save creates scoped working content', async () => {
    const root = await submitted(); await database.client.workingRevision.deleteMany({ where: { proposalId: root.proposalId } });
    const before = await snapshot(root.proposalId);
    await owner.agent.get(`/api/proposals/${root.proposalId}/draft`).expect(404); expect(await snapshot(root.proposalId)).toEqual(before);
    const result = await owner.agent.patch(`/api/proposals/${root.proposalId}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: root.version, content }).expect(200);
    expect(result.body.workingRevisionId).toEqual(expect.any(String));
  });
  it('rolls back create/save on every root, working-content and activity write failure', async () => {
    for (const table of ['ChangeProposal', 'WorkingRevision', 'ProposalActivity']) {
      const count = await database.client.changeProposal.count();
      await failWrite(table, 'INSERT', async () => { await post(owner, '', content).expect(500); });
      expect(await database.client.changeProposal.count()).toBe(count);
    }
    const root = await create(); const before = await snapshot(root.proposalId);
    for (const [table, operation] of [['WorkingRevision', 'UPDATE'], ['ChangeProposal', 'UPDATE'], ['ProposalActivity', 'INSERT']] as const) {
      await failWrite(table, operation, async () => { await owner.agent.patch(`/api/proposals/${root.proposalId}/draft`).set('x-csrf-token', owner.token)
        .send({ expectedVersion: root.version, content }).expect(500); });
      expect(await snapshot(root.proposalId)).toEqual(before);
    }
  });
  it('rolls back the full retained-reviewer submit for every dependent storage failure', async () => {
    const { root } = await assigned(); const before = await snapshot(root.proposalId); const key = randomUUID();
    for (const [table, operation] of [['ProposalRevision', 'INSERT'], ['AcceptanceCriterion', 'INSERT'], ['TestEvidence', 'INSERT'],
      ['ReviewAssignment', 'UPDATE'], ['ReviewAssignment', 'INSERT'], ['ChangeProposal', 'UPDATE'], ['ProposalActivity', 'INSERT'],
      ['Notification', 'INSERT'], ['ReviewIdempotency', 'INSERT']] as const) {
      await failWrite(table, operation, async () => {
        const result = await submit(root, key).expect(500); expect(JSON.stringify(result.body)).not.toContain('Synthetic lifecycle');
      });
      expect(await snapshot(root.proposalId)).toEqual(before);
    }
    await submit(root, key).expect(200);
    expect(await database.client.reviewIdempotency.count({ where: { proposalId: root.proposalId, operation: 'SUBMIT' } })).toBe(2);
  });
  it('rolls back withdrawal and approval invalidation with their assignment/root/activity/notification writes', async () => {
    const { root } = await assigned(); const before = await snapshot(root.proposalId);
    for (const [table, operation] of [['ReviewAssignment', 'UPDATE'], ['ChangeProposal', 'UPDATE'], ['ProposalActivity', 'INSERT'], ['Notification', 'INSERT']] as const) {
      await failWrite(table, operation, async () => { await post(owner, `/${root.proposalId}/withdraw`, { expectedVersion: root.version, confirmed: true, reason: 'Rollback reason' }).expect(500); });
      expect(await snapshot(root.proposalId)).toEqual(before);
    }
    const approved = await approve(); const approvedBefore = await snapshot(approved.root.proposalId);
    for (const [table, operation] of [['ApprovalInvalidation', 'INSERT'], ['ChangeProposal', 'UPDATE'], ['ProposalActivity', 'INSERT']] as const) {
      await failWrite(table, operation, async () => { await post(owner, `/${approved.root.proposalId}/reopen`, { expectedVersion: approved.root.version }).expect(500); });
      expect(await snapshot(approved.root.proposalId)).toEqual(approvedBefore);
    }
  });
  it('rolls back if absolute session expiry occurs after business writes but before transaction return', async () => {
    const root = await create(); const before = await snapshot(root.proposalId);
    const appender = activity as unknown as { append: (...args: Parameters<ActivityService['append']>) => Promise<Awaited<ReturnType<ActivityService['append']>>> };
    const append = appender.append.bind(activity); const future = Date.now() + 9 * 3600000;
    jest.spyOn(appender, 'append').mockImplementationOnce(async (...args) => {
      const result = await append(...args); jest.spyOn(Date, 'now').mockReturnValue(future); return result;
    });
    await submit(root).expect(401); jest.restoreAllMocks();
    expect(await snapshot(root.proposalId)).toEqual(before);
  });
});
