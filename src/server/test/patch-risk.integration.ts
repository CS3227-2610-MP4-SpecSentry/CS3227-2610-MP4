import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { type PatchRiskRequest, type ReviewCommandResponse, type WorkingContent } from '@specsentry/shared';
import { AppModule } from '../src/app.module';
import { AI_GATEWAY_OPTIONS, AI_TRANSPORT, VERIFIED_TOKEN_COUNTER, type AiTransportRequest } from '../src/ai/contracts';
import { PrismaAiAccounting, SystemAiClock, SafeAiError } from '../src/ai/gateway';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { configureHttp } from '../src/http';
import { AccountAdministrationService } from '../src/identity/account-administration.service';
import { hashPassword } from '../src/identity/identity.service';
import { ABSOLUTE_MS } from '../src/identity/session.store';
import { PatchRiskDeadline, PatchRiskService } from '../src/reviews/patch-risk.service';
import { ReviewsService } from '../src/reviews/reviews.service';
import { ProposalsService } from '../src/proposals/proposals.service';
import { persistedTestActor } from './business-fixtures';
import { aiTestOptions } from './ai-fixtures';

const tables = '"AiOutboundAttempt", "AiQueueLease", "AiRequest", "AiQuotaCoordinator", "Notification", "ApprovalInvalidation", "WorkingRevision", "CoverageEvidence", "CoverageAssessment", "FindingEvent", "ReviewFinding", "ReviewDecision", "ReviewIdempotency", "CriterionEvidenceLink", "ProposalActivity", "ReviewAssignment", "AcceptanceCriterion", "TestEvidence", "ProposalRevision", "ChangeProposal"';
const content: WorkingContent = { title: 'Synthetic patch', summary: 'Entire submitted summary', problem: 'Entire submitted problem', constraints: 'Entire constraints',
  expectedBehavior: 'Entire expected behavior', diffText: '--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n',
  criteria: Array.from({ length: 5 }, (_, i) => ({ statement: `Criterion ${i}`, required: true })), evidence: [{ text: 'Entire evidence one' }, { text: 'Entire evidence two' }] };
function barrier() { let open!: () => void; const promise = new Promise<void>(resolve => { open = resolve; }); return { promise, open }; }

describe('PostgreSQL Patch Risk integration', () => {
  let app: NestExpressApplication; let database: DatabaseService; let risks: PatchRiskService; let reviews: ReviewsService;
  let proposals: ProposalsService; let administration: AccountAdministrationService;
  const prefix = `ai-${randomUUID()}`; const password = 'synthetic-patch-risk-password';
  const ids = { owner: `${prefix}-owner`, a: `${prefix}-a`, b: `${prefix}-b`, maintainer: `${prefix}-m` };
  type Session = { agent: ReturnType<typeof request.agent>; token: string };
  type Case = { id: string; command: ReviewCommandResponse; criteria: string[]; workingRevisionId: string };
  let owner: Session; let a: Session; let b: Session; let maintainer: Session;
  let resultIds: string[] = []; let transportBehavior: (input: AiTransportRequest) => Promise<{ status: number; body: string; retryAfter: string | null }>;
  const transport = { complete: jest.fn((input: AiTransportRequest) => transportBehavior(input)) };
  const envelope = () => ({ status: 200, retryAfter: null, body: JSON.stringify({ choices: [{ index: 0, finish_reason: 'stop',
    message: { role: 'assistant', content: JSON.stringify({ coverage: resultIds.map(criterionId => ({ criterionId, status: 'COVERED', rationale: 'Synthetic evidence.' })),
      risks: [{ criterionIds: [resultIds[0]], severity: 'LOW', description: 'Human editable risk.' }], questions: [], suggestedTests: [], confidence: 'LOW' }) } }] }) });
  async function clean() {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL required');
    await database.client.$executeRawUnsafe(`TRUNCATE ${tables}`);
    await database.client.aiQuotaCoordinator.create({ data: { id: 'reviewer-patch-risk' } });
  }
  async function login(name: keyof typeof ids): Promise<Session> {
    const agent = request.agent(app.getHttpServer()); const csrf = await agent.get('/api/auth/csrf').expect(200);
    const response = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken).send({ username: `${prefix}-${name}`, password }).expect(200);
    return { agent, token: response.body.csrfToken as string };
  }
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL required');
    const module = await Test.createTestingModule({ imports: [AppModule.register(readConfig({ NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL,
      SESSION_SECRET: 'patch-risk-synthetic-secret-at-least-32-characters' }))] })
      .overrideProvider(AI_GATEWAY_OPTIONS).useValue(aiTestOptions).overrideProvider(AI_TRANSPORT).useValue(transport)
      .overrideProvider(VERIFIED_TOKEN_COUNTER).useValue({ model: 'synthetic-reviewer-model', verificationId: 'synthetic-counter-v1', countInput: () => 100 }).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false }); configureHttp(app); await app.init();
    database = app.get(DatabaseService); risks = app.get(PatchRiskService); reviews = app.get(ReviewsService); proposals = app.get(ProposalsService);
    administration = new AccountAdministrationService(database, reviews);
    const passwordHash = await hashPassword(password);
    await database.client.userAccount.createMany({ data: Object.entries(ids).map(([name, id]) => ({ id, username: `${prefix}-${name}`, passwordHash,
      role: name === 'owner' ? 'CONTRIBUTOR' as const : name === 'maintainer' ? 'RELEASE_MAINTAINER' as const : 'REVIEWER' as const })) });
  });
  beforeEach(async () => {
    await clean(); await database.client.userAccount.updateMany({ where: { id: { in: Object.values(ids) } }, data: { enabled: true, version: 1 } });
    owner = await login('owner'); a = await login('a'); b = await login('b'); maintainer = await login('maintainer');
    transport.complete.mockClear(); transportBehavior = async () => envelope();
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (database) {
      await clean(); await database.client.authSession.deleteMany({ where: { OR: Object.values(ids).map(id => ({ data: { contains: id } })) } });
      await database.client.securityEvent.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
      await database.client.userAccount.deleteMany({ where: { id: { in: Object.values(ids) } } });
    }
    await app?.close();
  });
  const post = (session: Session, path: string, body: object) => session.agent.post(`/api${path}`).set('x-csrf-token', session.token).send(body);
  const scope = (c: ReviewCommandResponse) => ({ revisionId: c.revisionId, assignmentId: c.assignmentId, expectedVersion: c.version, expectedAssignmentVersion: c.assignmentVersion });
  const input = (c: Case): PatchRiskRequest => ({ ...scope(c.command), selectedCriterionIds: c.criteria.slice(0, 1) });
  async function create(value = content): Promise<Case> {
    const draft = (await post(owner, '/proposals', value).expect(201)).body;
    const submitted = (await owner.agent.post(`/api/proposals/${draft.proposalId}/submit`).set('x-csrf-token', owner.token).set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: draft.version, workingRevisionId: draft.workingRevisionId }).expect(200)).body;
    const command = (await post(a, `/proposals/${draft.proposalId}/claim`, { expectedVersion: submitted.version }).expect(200)).body as ReviewCommandResponse;
    const criteria = (await database.client.acceptanceCriterion.findMany({ where: { revisionId: command.revisionId }, orderBy: { id: 'asc' } })).map(c => c.id);
    return { id: command.proposalId, command, criteria, workingRevisionId: draft.workingRevisionId as string };
  }
  function analyze(c: Case, body = input(c), session = a) {
    resultIds = body.selectedCriterionIds;
    return post(session, `/proposals/${c.id}/ai/patch-risk`, body);
  }
  async function snapshot(id: string) {
    return { root: await database.client.changeProposal.findUnique({ where: { id } }),
      revisions: await database.client.proposalRevision.findMany({ where: { proposalId: id }, orderBy: { number: 'asc' }, include: { criteria: true, evidence: true } }),
      working: await database.client.workingRevision.findUnique({ where: { proposalId: id } }),
      assignments: await database.client.reviewAssignment.findMany({ where: { proposalId: id }, orderBy: { assignedAt: 'asc' } }),
      findings: await database.client.reviewFinding.findMany({ where: { proposalId: id }, include: { events: true } }),
      coverage: await database.client.coverageAssessment.findMany({ where: { proposalId: id }, include: { evidence: true } }),
      decisions: await database.client.reviewDecision.findMany({ where: { proposalId: id } }),
      invalidations: await database.client.approvalInvalidation.findMany({ where: { proposalId: id } }),
      activity: await database.client.proposalActivity.findMany({ where: { proposalId: id }, orderBy: [{ timestamp: 'asc' }, { id: 'asc' }] }),
      notices: await database.client.notification.findMany({ where: { proposalId: id } }),
      keys: await database.client.reviewIdempotency.findMany({ where: { proposalId: id } }) };
  }
  async function cover(c: Case) {
    for (const criterion of c.criteria) c.command = (await a.agent.put(`/api/proposals/${c.id}/coverage/${criterion}`).set('x-csrf-token', a.token)
      .send({ ...scope(c.command), operation: 'ASSESS', status: 'COVERED' }).expect(200)).body as ReviewCommandResponse;
  }
  async function resubmit(c: Case) {
    const root = await database.client.changeProposal.findUniqueOrThrow({ where: { id: c.id } });
    c.command = (await owner.agent.post(`/api/proposals/${c.id}/submit`).set('x-csrf-token', owner.token).set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: root.version, workingRevisionId: c.workingRevisionId }).expect(200)).body as ReviewCommandResponse;
    c.criteria = (await database.client.acceptanceCriterion.findMany({ where: { revisionId: c.command.revisionId }, orderBy: { id: 'asc' } })).map(x => x.id);
  }
  const finding = (c: Case, original = scope(c.command)) => post(a, `/proposals/${c.id}/findings`, { ...original, severity: 'LOW', description: 'Explicitly edited human risk.' });
  type Event = 'drop' | 'withdrawal' | 'disablement' | 'new-revision' | 'drop-reclaim' | 'approval' | 'logout';
  async function event(kind: Event, c: Case) {
    if (kind === 'new-revision') { await resubmit(c); return; }
    if (kind === 'disablement') { await administration.disable(`${prefix}-a`); return; }
    if (kind === 'logout') { await a.agent.post('/api/auth/logout').set('x-csrf-token', a.token).expect(204); return; }
    if (kind === 'withdrawal') { await post(owner, `/proposals/${c.id}/withdraw`, { expectedVersion: c.command.version, confirmed: true, reason: 'Owner withdrew.' }).expect(200); return; }
    if (kind === 'approval') {
      c.command = (await a.agent.post(`/api/proposals/${c.id}/decision`).set('x-csrf-token', a.token).set('Idempotency-Key', randomUUID())
        .send({ ...scope(c.command), decision: 'APPROVE' }).expect(200)).body as ReviewCommandResponse; return;
    }
    c.command = (await post(a, `/proposals/${c.id}/drop`, scope(c.command)).expect(200)).body as ReviewCommandResponse;
    if (kind === 'drop-reclaim') c.command = (await post(a, `/proposals/${c.id}/claim`, { expectedVersion: c.command.version }).expect(200)).body as ReviewCommandResponse;
  }
  // Event-only control compares every business collection after normalizing only
  // generated identities, timestamps and request-specific idempotency digests.
  function semantics(value: unknown): unknown {
    const json = JSON.parse(JSON.stringify(value)) as unknown;
    const normalize = (v: unknown, key = ''): unknown => {
      if (/At$|Until$/.test(key) || ['timestamp', 'id', 'keyHash', 'requestHash', 'evidenceHash', 'contentHash'].includes(key)) return undefined;
      if (/Id$/.test(key) || key === 'accessGenerationId') return v === null ? null : 'identity';
      if (Array.isArray(v)) return v.map(x => normalize(x)).sort((x,y) => JSON.stringify(x).localeCompare(JSON.stringify(y)));
      if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k,x]) => [k, normalize(x,k)]).filter(([,x]) => x !== undefined));
      if (typeof v === 'string') return v.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g, 'identity');
      return v;
    };
    return normalize(json);
  }

  it('ai-selected-batch', async () => {
    const c = await create(); const before = await snapshot(c.id);
    for (const size of [1,5]) {
      const response = await analyze(c, { ...input(c), selectedCriterionIds: c.criteria.slice(0,size) }).expect(200);
      expect(response.body.status).toBe('CURRENT'); expect(response.body.analyzedScope).toEqual({ proposalId: c.id, ...scope(c.command) });
      expect(response.body.result.coverage.map((x: { criterionId: string }) => x.criterionId)).toEqual(c.criteria.slice(0,size));
      expect(JSON.stringify(response.body)).not.toContain('accessGenerationId');
    }
    expect(await snapshot(c.id)).toEqual(before);
  });
  it('ai-context-isolation', async () => {
    const c = await create(); const other = await create({ ...content, summary: 'UNRELATED_SUBMITTED_SECRET' });
    await owner.agent.patch(`/api/proposals/${c.id}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: c.command.version,
      content: { ...content, summary: 'UNSUBMITTED_PRIVATE_TEXT' } }).expect(200);
    const root = await database.client.changeProposal.findUniqueOrThrow({ where: { id: c.id } }); c.command.version = root.version;
    const evidence = await database.client.testEvidence.findMany({ where: { revisionId: c.command.revisionId } });
    await database.client.criterionEvidenceLink.create({ data: { revisionId: c.command.revisionId, criterionId: c.criteria[0]!, evidenceId: evidence[0]!.id } });
    await analyze(c).expect(200);
    const sent = JSON.stringify(transport.complete.mock.calls[0]![0].messages);
    for (const text of [content.summary, content.problem, content.constraints, content.expectedBehavior, ...content.criteria.map(x => x.statement),
      ...content.evidence.map(x => x.text), c.criteria[4]!, evidence[0]!.id]) expect(sent).toContain(text);
    expect(sent).not.toMatch(/UNSUBMITTED_PRIVATE_TEXT|UNRELATED_SUBMITTED_SECRET|passwordHash|coverageAssessment/);
    expect(sent).not.toContain(other.id);
    for (const selectedCriterionIds of [[], [...c.criteria, 'unknown'], [c.criteria[0], c.criteria[0]], ['unknown']])
      await analyze(c, { ...input(c), selectedCriterionIds } as PatchRiskRequest).expect(422);
    expect(transport.complete).toHaveBeenCalledTimes(1);
  });
  it('ai-http-access', async () => {
    const c=await create();const before=await snapshot(c.id);const body=input(c);
    await request(app.getHttpServer()).post(`/api/proposals/${c.id}/ai/patch-risk`).send(body).expect(401);
    for(const session of [owner,maintainer]) await analyze(c,body,session).expect(403);
    await analyze(c,body,b).expect(403);
    await a.agent.post(`/api/proposals/${c.id}/ai/patch-risk`).send(body).expect(403);
    await a.agent.post(`/api/proposals/${c.id}/ai/patch-risk`).set('x-csrf-token','0'.repeat(64)).send(body).expect(403);
    for(const extra of [{prompt:'injected'},{actorId:ids.b},{model:'evil'},{endpoint:'https://evil.example'}])
      await post(a,`/proposals/${c.id}/ai/patch-risk`,{...body,...extra}).expect(422);
    await post(a,'/proposals/unknown-id/ai/patch-risk',body).expect(404);
    // Expired and logged-out real persisted sessions cannot reach protected reads.
    const expired=await login('a');
    const sessionRows=await database.client.authSession.findMany({where:{data:{contains:ids.a}}});
    await database.client.authSession.updateMany({where:{id:{in:sessionRows.map(s=>s.id)}},data:{expiresAt:new Date(Date.now()-1)}});
    await analyze(c,body,expired).expect(401);
    a=await login('a');await a.agent.post('/api/auth/logout').set('x-csrf-token',a.token).expect(204);await analyze(c,body).expect(401);
    expect(transport.complete).not.toHaveBeenCalled();expect(await snapshot(c.id)).toEqual(before);
    expect(await database.client.securityEvent.count({where:{actorId:ids.a,outcome:'rejected'}})).toBeGreaterThan(0);
  });
  it('ai-changes-requested', async () => {
    const c = await create(); c.command = (await a.agent.post(`/api/proposals/${c.id}/decision`).set('x-csrf-token',a.token).set('Idempotency-Key',randomUUID())
      .send({ ...scope(c.command), decision:'REQUEST_CHANGES', note:'Clarify the boundary.' }).expect(200)).body as ReviewCommandResponse;
    const before = await snapshot(c.id); await analyze(c).expect(200); expect(await snapshot(c.id)).toEqual(before);
  });
  it('ai-lifecycle', async () => {
    const c = await create(); const original = input(c); await resubmit(c);
    await analyze(c, original).expect(409);
    for (const state of ['APPROVED','IN_RELEASE','RELEASED','WITHDRAWN','DRAFT'] as const) {
      await database.client.changeProposal.update({ where:{id:c.id}, data:{state} });
      await analyze(c).expect(403);
    }
    expect(transport.complete).not.toHaveBeenCalled();
  });
  it('ai-private-metadata', async () => {
    const c = await create(); await analyze(c).expect(200);
    const audit = await a.agent.get(`/api/proposals/${c.id}/ai/audit`).expect(200); expect(audit.body.items).toHaveLength(1);
    expect(JSON.stringify(audit.body)).not.toMatch(/Human editable risk|Entire submitted|accessGeneration|actorId|correlationId/);
    expect((await a.agent.get(`/api/proposals/${c.id}/activity`).expect(200)).text).not.toMatch(/AI_|contextHash|requestId/);
    c.command = (await post(a, `/proposals/${c.id}/drop`,scope(c.command)).expect(200)).body as ReviewCommandResponse;
    c.command = (await post(b, `/proposals/${c.id}/claim`,{expectedVersion:c.command.version}).expect(200)).body as ReviewCommandResponse;
    await a.agent.get(`/api/proposals/${c.id}/ai/audit`).expect(403);
    expect((await b.agent.get(`/api/proposals/${c.id}/ai/audit`).expect(200)).body).toEqual({items:[]});
    for (const s of [owner,maintainer]) await s.agent.get(`/api/proposals/${c.id}/ai/audit`).expect(403);
  });
  it('ai-size-fallback', async () => {
    const c = await create({ ...content, diffText: '--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+' + 'x'.repeat(20001) + '\n' }); const before = await snapshot(c.id);
    const response = await analyze(c).expect(422); expect(response.body).toMatchObject({code:'AI_UNAVAILABLE', reason:'INPUT_LIMIT'});
    expect(transport.complete).not.toHaveBeenCalled(); expect(await snapshot(c.id)).toEqual(before);
    await a.agent.get(`/api/proposals/${c.id}/review`).expect(200);
  });
  it('ai-failed-call-isolation', async () => {
    const c = await create(); const before = await snapshot(c.id);
    const failures = [async () => ({status:401,body:'private provider error',retryAfter:null}),
      async () => ({status:500,body:'private provider error',retryAfter:null}), async () => ({status:429,body:'quota exceeded',retryAfter:null}),
      async () => ({status:200,body:'not JSON',retryAfter:null}), async () => ({status:200,body:'x'.repeat(65537),retryAfter:null}),
      async () => { throw new SafeAiError('CANCELLED'); }, async () => { throw new SafeAiError('DEADLINE'); },
      async () => ({status:200,body:JSON.stringify({choices:[{finish_reason:'stop',message:{role:'assistant',refusal:'No',content:null}}]}),retryAfter:null})];
    for (const fail of failures) {
      await database.client.aiOutboundAttempt.deleteMany();
      transportBehavior = fail;
      const response = await analyze(c); expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.text).not.toMatch(/private provider|Human editable|Entire submitted|stack/);
      expect(await snapshot(c.id)).toEqual(before);
    }
  });
  it('ai-access-recheck', async () => {
    const c = await create(); const entered = barrier(); const release = barrier(); transportBehavior = async () => { entered.open(); await release.promise; return envelope(); };
    const pending = analyze(c).then(x => x); await entered.promise;
    await database.client.userAccount.update({where:{id:ids.a}, data:{role:'CONTRIBUTOR'}}); release.open();
    const response = await pending; expect(response.status).toBe(403); expect(response.body.result).toBeUndefined();
    await database.client.userAccount.update({where:{id:ids.a}, data:{role:'REVIEWER'}});
  });

  for (const kind of ['drop','withdrawal','disablement','new-revision','drop-reclaim','approval','logout'] as const) {
    for (const order of ['event-first','completion-first'] as const) it(`ai-response-${kind}-${order}`, async () => {
      // The control performs the same real event with no AI request at all.
      const control = await create(); if (kind === 'approval') await cover(control);
      await event(kind,control); const expected = semantics(await snapshot(control.id));
      if (kind === 'disablement') await database.client.userAccount.update({where:{id:ids.a},data:{enabled:true,version:1}});
      if (kind === 'disablement' || kind === 'logout') a = await login('a');
      const c = await create(); if (kind === 'approval') await cover(c);
      const original = scope(c.command); const entered = barrier(); const release = barrier();
      transportBehavior = async () => { entered.open(); await release.promise; return envelope(); };
      const pending = analyze(c).then(x => x); await entered.promise;
      if (order === 'event-first') await event(kind,c);
      release.open(); const response = await pending;
      if (order === 'completion-first') { expect(response.status).toBe(200); expect(response.body.status).toBe('CURRENT'); await event(kind,c); }
      else if (kind === 'new-revision') { expect(response.status).toBe(200); expect(response.body).toMatchObject({status:'STALE',staleReason:'NEW_REVISION'}); }
      else { expect(response.status).toBeGreaterThanOrEqual(400); expect(response.body.result).toBeUndefined(); }
      expect(semantics(await snapshot(c.id))).toEqual(expected);
      const beforeSave = await snapshot(c.id); const saved = await finding(c,original);
      expect(saved.status).toBeGreaterThanOrEqual(400); expect(await snapshot(c.id)).toEqual(beforeSave);
    });
  }
  for (const kind of ['new-revision','approval','drop-reclaim'] as const) {
    for (const order of ['event-first','save-first'] as const) it(`ai-save-${kind}-${order}`, async () => {
      // An uncontended winner supplies the complete expected business outcome,
      // including activity, notifications and idempotency records. The loser
      // must contribute none of those records when its original scope is stale.
      const control = await create(); if (kind === 'approval') await cover(control);
      if (order === 'save-first') await finding(control).expect(201);
      else await event(kind,control);
      const expected = semantics(await snapshot(control.id));
      const c = await create(); if(kind==='approval') await cover(c);
      const suggestion = (await analyze(c).expect(200)).body; const original = Object.freeze(scope(c.command));
      expect(suggestion.result.risks[0].severity).toBe('LOW');
      // Capture both commands before either operation runs. In particular a
      // save-first winner must not refresh the waiting lifecycle command.
      const submitBody = Object.freeze({ expectedVersion: original.expectedVersion, workingRevisionId: c.workingRevisionId });
      const approvalBody = Object.freeze({ ...original, decision: 'APPROVE' });
      const lifecycleKey = randomUUID();
      const lifecycle = () => kind === 'new-revision'
        ? owner.agent.post(`/api/proposals/${c.id}/submit`).set('x-csrf-token', owner.token).set('Idempotency-Key', lifecycleKey).send(submitBody)
        : kind === 'approval'
          ? a.agent.post(`/api/proposals/${c.id}/decision`).set('x-csrf-token', a.token).set('Idempotency-Key', lifecycleKey).send(approvalBody)
          : post(a, `/proposals/${c.id}/drop`, original);
      const before = await snapshot(c.id);
      const entered = barrier(); const release = barrier();
      const originalLock = proposals.lockRoot.bind(proposals); let blockerPid = 0;
      const spy = jest.spyOn(proposals,'lockRoot').mockImplementation(async (tx,id) => {
        const root = await originalLock(tx,id);
        if (id === c.id && !blockerPid) {
          const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
          blockerPid = backend!.pid; entered.open(); await release.promise;
        }
        return root;
      });
      const first = (order === 'save-first' ? finding(c,original) : lifecycle()).then(x => x);
      let second: Promise<request.Response> | undefined; let secondFinished = false;
      try {
        await Promise.race([entered.promise, first.then(() => { throw new Error('Winner missed the held-lock barrier'); })]);
        second = (order === 'save-first' ? lifecycle() : finding(c,original)).then(x => { secondFinished = true; return x; });
        // Same-reviewer writes serialize on UserAccount before lockRoot;
        // resubmission also locks the retained reviewer's account. Observe that
        // exact backend blocking the contender, not merely a request being slow.
        let observed = false; const observationDeadline = Date.now() + 2000;
        while (!observed && Date.now() < observationDeadline && !secondFinished) {
          const rows = await database.client.$queryRaw<{ pid: number; ungranted: boolean }[]>`
            SELECT waiter.pid, EXISTS (SELECT 1 FROM pg_locks l WHERE l.pid=waiter.pid AND NOT l.granted) AS ungranted
            FROM pg_stat_activity waiter WHERE waiter.datname=current_database() AND waiter.wait_event_type='Lock'
              AND ${blockerPid} = ANY(pg_blocking_pids(waiter.pid))
              AND position('UserAccount' in waiter.query)>0 AND position('FOR UPDATE' in waiter.query)>0`;
          observed = rows.some(row => row.pid !== blockerPid && row.ungranted);
        }
        expect(observed).toBe(true); expect(secondFinished).toBe(false);
        // Neither uncommitted winner writes nor waiting-loser artifacts are
        // visible while the transaction still owns account/session/root locks.
        expect(await snapshot(c.id)).toEqual(before);
      } finally {
        release.open(); await Promise.allSettled([first, ...(second ? [second] : [])]); spy.mockRestore();
      }
      const winner = await first; const loser = await second!;
      expect(winner.status).toBe(order === 'save-first' ? 201 : 200);
      // A dropped assignment removes full-content access (403); revision and
      // version changes, including a save before a drop/decision, conflict (409).
      expect(loser.status).toBe(order === 'event-first' && kind === 'drop-reclaim' ? 403 : 409);
      expect(loser.body.finding).toBeUndefined(); expect(loser.body.decision).toBeUndefined();
      if (order === 'event-first' && kind === 'drop-reclaim') {
        const dropped = await snapshot(c.id);
        expect(dropped.root).toMatchObject({ state: 'SUBMITTED', currentAssignmentId: null, version: original.expectedVersion + 1 });
        expect(dropped.findings).toEqual(before.findings); expect(dropped.notices).toEqual(before.notices);
        expect(dropped.activity.filter(x => !before.activity.some(previous => previous.id === x.id)).map(x => x.action)).toEqual(['DROPPED']);
        // Reclaim is a separate valid command based on the committed drop, not
        // a refresh of either of the two competing original-scope commands.
        await post(a, `/proposals/${c.id}/claim`, { expectedVersion: winner.body.version }).expect(200);
      }
      const after = await snapshot(c.id);
      expect(semantics(after)).toEqual(expected);
      expect(after.root!.version).toBe(original.expectedVersion + (order === 'event-first' && kind === 'drop-reclaim' ? 2 : 1));
      expect(after.revisions.slice(0,before.revisions.length)).toEqual(before.revisions);
      expect(after.coverage).toEqual(before.coverage); expect(after.invalidations).toEqual(before.invalidations);
      const activities = after.activity.filter(x => !before.activity.some(previous => previous.id === x.id));
      if (order === 'save-first') {
        expect(after.findings).toHaveLength(1);
        expect(after.findings[0]).toMatchObject({ revisionId: original.revisionId, assignmentId: original.assignmentId,
          actorId: ids.a, severity: 'LOW', description: 'Explicitly edited human risk.', mutationVersion: original.expectedVersion + 1 });
        expect(activities.map(x => x.action)).toEqual(['FINDING_CREATED']);
        expect(activities[0]).toMatchObject({ revisionId: original.revisionId, assignmentId: original.assignmentId, actorId: ids.a });
        expect(after.decisions).toEqual(before.decisions); expect(after.notices).toEqual(before.notices); expect(after.keys).toEqual(before.keys);
      } else {
        expect(after.findings).toEqual(before.findings);
        expect(activities.map(x => x.action).sort()).toEqual(kind === 'new-revision' ? ['NOTIFICATION_CREATED','RESUBMITTED']
          : kind === 'approval' ? ['REVIEW_APPROVED'] : ['CLAIMED','DROPPED']);
        if (kind === 'new-revision') {
          expect(after.revisions).toHaveLength(before.revisions.length + 1); expect(after.notices).toHaveLength(before.notices.length + 1);
          const notice = after.notices.find(x => !before.notices.some(previous => previous.id === x.id))!;
          expect(notice).toMatchObject({ recipientId: ids.a, kind: 'NEW_REVISION', revisionId: after.root!.currentRevisionId,
            assignmentId: after.root!.currentAssignmentId, readAt: null });
          expect(activities.find(x => x.id === notice.activityId)).toMatchObject({ action: 'NOTIFICATION_CREATED',
            revisionId: notice.revisionId, assignmentId: notice.assignmentId });
          expect(after.decisions).toEqual(before.decisions);
        } else if (kind === 'approval') {
          expect(after.root!.state).toBe('APPROVED'); expect(after.decisions).toHaveLength(1);
          expect(after.decisions[0]).toMatchObject({ decision: 'APPROVE', revisionId: original.revisionId,
            assignmentId: original.assignmentId, actorId: ids.a, mutationVersion: original.expectedVersion + 1 });
          expect(after.notices).toEqual(before.notices);
        } else {
          expect(after.assignments).toHaveLength(before.assignments.length + 1);
          const previous = before.assignments.find(x => x.id === original.assignmentId)!;
          const current = after.assignments.find(x => x.id === after.root!.currentAssignmentId)!;
          expect(current.reviewerId).toBe(ids.a); expect(current.accessGenerationId).not.toBe(previous.accessGenerationId);
          expect(after.assignments.find(x => x.id === original.assignmentId)).toMatchObject({ status: 'CLOSED', endReason: 'DROPPED' });
          expect(after.decisions).toEqual(before.decisions); expect(after.notices).toEqual(before.notices);
          // Even reacquiring the same proposal does not revive the original
          // suggestion's obsolete assignment coordinates.
          await finding(c,original).expect(409); expect(await snapshot(c.id)).toEqual(after);
        }
      }
    });
  }
  it('ai-save-rollback', async () => {
    const c = await create(); await analyze(c).expect(200);
    for(const table of ['ReviewFinding','ProposalActivity','ChangeProposal']) {
      const before=await snapshot(c.id); const name=`ai_fail_${randomUUID().replace(/-/g,'')}`;
      await database.client.$executeRawUnsafe(`CREATE FUNCTION "${name}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic save failure'; END $$`);
      await database.client.$executeRawUnsafe(`CREATE TRIGGER "${name}" BEFORE ${table==='ChangeProposal'?'UPDATE':'INSERT'} ON "${table}" FOR EACH ROW EXECUTE FUNCTION "${name}"()`);
      try { await finding(c).expect(500); expect(await snapshot(c.id)).toEqual(before); }
      finally { await database.client.$executeRawUnsafe(`DROP TRIGGER "${name}" ON "${table}"`); await database.client.$executeRawUnsafe(`DROP FUNCTION "${name}"()`); }
    }
  });
  it('ai-generation-lineage', async () => {
    const c=await create(); const initial=await database.client.reviewAssignment.findUniqueOrThrow({where:{id:c.command.assignmentId}});
    const entered=barrier(); const release=barrier(); transportBehavior=async()=>{entered.open();await release.promise;return envelope();};
    const pending=analyze(c).then(x=>x);await entered.promise;await resubmit(c);await resubmit(c);
    expect((await database.client.reviewAssignment.findUniqueOrThrow({where:{id:c.command.assignmentId}})).accessGenerationId).toBe(initial.accessGenerationId);
    release.open();expect((await pending).body).toMatchObject({status:'STALE',staleReason:'NEW_REVISION'});
    const entered2=barrier();const release2=barrier();transportBehavior=async()=>{entered2.open();await release2.promise;return envelope();};
    const second=analyze(c).then(x=>x);await entered2.promise;await event('drop-reclaim',c);await resubmit(c);
    expect((await database.client.reviewAssignment.findUniqueOrThrow({where:{id:c.command.assignmentId}})).accessGenerationId).not.toBe(initial.accessGenerationId);
    release2.open();const denied=await second;expect(denied.status).toBe(403);expect(denied.body.result).toBeUndefined();
  });

  async function heldLock(table: 'UserAccount'|'ChangeProposal'|'AiQuotaCoordinator', id: string) {
    const entered=barrier();const release=barrier();
    const finished=database.client.$transaction(async tx=>{
      await tx.$queryRawUnsafe(`SELECT "id" FROM "${table}" WHERE "id"=$1 FOR UPDATE`,id);entered.open();await release.promise;
    },{timeout:10000});await entered.promise;return{release:release.open,finished};
  }
  it('ai-whole-deadline', async () => {
    const c=await create();const actor=await persistedTestActor(database,ids.a);
    // A short injected deadline exercises the same production 20s contract without
    // adding minute-long integration runs. Real PG waits must honor remaining time.
    for(const table of ['UserAccount','ChangeProposal'] as const) for(const phase of ['initial','final'] as const) {
      const entered=barrier();const releaseProvider=barrier();let lock:Awaited<ReturnType<typeof heldLock>>|undefined;
      transportBehavior=async()=>{entered.open();await releaseProvider.promise;return envelope();};resultIds=input(c).selectedCriterionIds;
      if(phase==='initial') lock=await heldLock(table,table==='UserAccount'?ids.a:c.id);
      const deadline=new PatchRiskDeadline(new SystemAiClock(),200);const started=performance.now();
      const pending=risks.analyze(actor,c.id,input(c),deadline).then(()=>{throw new Error('Late output disclosed');},e=>e as unknown);
      try {
        if(phase==='final'){await entered.promise;lock=await heldLock(table,table==='UserAccount'?ids.a:c.id);releaseProvider.open();}
        const error=await pending;expect(error).toBeInstanceOf(SafeAiError);expect((error as SafeAiError).errorClass).toBe('DEADLINE');
        expect(performance.now()-started).toBeLessThan(1500);
      } finally{deadline.close();releaseProvider.open();lock?.release();await lock?.finished;}
    }
    expect(await database.client.aiQueueLease.count()).toBe(0);
  });
  it('ai-session-final-wait', async () => {
    const c=await create();
    for(const kind of ['idle','absolute','logout'] as const){
      const actor=await persistedTestActor(database,ids.a);const entered=barrier();const release=barrier();
      transportBehavior=async()=>{entered.open();await release.promise;return envelope();};resultIds=input(c).selectedCriterionIds;
      const deadline=new PatchRiskDeadline(new SystemAiClock());const pending=risks.analyze(actor,c.id,input(c),deadline).then(x=>x,e=>e as unknown);
      await entered.promise;const lock=await heldLock('ChangeProposal',c.id);
      try{
        if(kind==='logout')await database.client.authSession.delete({where:{id:actor.session!.digest}});
        if(kind==='idle')await database.client.authSession.update({where:{id:actor.session!.digest},data:{expiresAt:new Date(Date.now()+100)}});
        if(kind==='absolute'){
          actor.session!.issuedAt=Date.now()-ABSOLUTE_MS+100;
          const row=await database.client.authSession.findUniqueOrThrow({where:{id:actor.session!.digest}});
          await database.client.authSession.update({where:{id:actor.session!.digest},data:{data:JSON.stringify({...JSON.parse(row.data),issuedAt:actor.session!.issuedAt})}});
        }
        release.open();await new Promise(resolve=>setTimeout(resolve,150));lock.release();await lock.finished;
        const result=await pending;expect(result).toMatchObject({status:401});
      }finally{release.open();lock.release();await lock.finished;deadline.close();}
    }
  });

  for(const mode of ['user-window','user-day','global-window','queue'] as const) it(`ai-final-slot-${mode}`,async()=>{
    const c=await create();const clock=new SystemAiClock();const accountingA=new PrismaAiAccounting(database.client,clock);
    const accountingB=new PrismaAiAccounting(database.client,clock);
    async function record(actorId=ids.a){return database.client.aiRequest.create({data:{correlationId:randomUUID(),actorId,proposalId:c.id,
      revisionId:c.command.revisionId,assignmentId:c.command.assignmentId,accessGenerationId:'synthetic',expectedVersion:c.command.version,
      expectedAssignmentVersion:c.command.assignmentVersion,selectedCriterionCount:1,templateVersion:'synthetic'}});}
    const seed=mode==='queue'?9:mode==='user-window'?9:mode==='user-day'?59:29;
    const now=new Date();
    // Use the middle of an SGT day so daily exhaustion is independent of the
    // wall-clock time at which this integration suite happens to run.
    if(mode==='user-day') jest.spyOn(clock,'now').mockReturnValue(new Date('2026-10-26T04:00:00Z'));
    const dayAgo=mode==='user-day'?new Date('2026-10-26T03:00:00Z'):new Date(now.getTime()-20*60*1000);
    for(let i=0;i<seed;i++){
      const row=await record(mode==='global-window'?`synthetic-other-${i}`:ids.a);
      if(mode==='queue')await database.client.aiQueueLease.create({data:{requestId:row.id,actorId:ids.a,expiresAt:new Date(Date.now()+5000)}});
      else await database.client.aiOutboundAttempt.create({data:{requestId:row.id,actorId:row.actorId,ordinal:1,dispatchedAt:mode==='user-day'?dayAgo:now}});
    }
    const rowA=await record();const rowB=await record();
    const deadlineA=new PatchRiskDeadline(clock,500);const deadlineB=new PatchRiskDeadline(clock,500);
    const start=barrier();const call=async(accounting:PrismaAiAccounting,row:{id:string},deadline:PatchRiskDeadline)=>{
      await start.promise;return mode==='queue'?accounting.enqueue({requestId:row.id,actorId:ids.a,deadline}):accounting.reserveAttempt({requestId:row.id,actorId:ids.a,ordinal:1,deadline});};
    const first=call(accountingA,rowA,deadlineA);const second=call(accountingB,rowB,deadlineB);start.open();
    try{
      const results=await Promise.allSettled([first,second]);expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
      if(mode==='queue')expect(await database.client.aiQueueLease.count()).toBe(10);
      else expect(await database.client.aiOutboundAttempt.count()).toBe(seed+1);
    }finally{
      deadlineA.close();deadlineB.close();await accountingA.releaseQueue(rowA.id);await accountingB.releaseQueue(rowB.id);
    }
  });
});
