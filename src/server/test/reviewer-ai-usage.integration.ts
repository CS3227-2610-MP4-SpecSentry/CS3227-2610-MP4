import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { Pool } from 'pg';
import { reviewerAiUsageResponseSchema, type AiOutcome, type ReviewCommandResponse, type WorkingContent } from '@specsentry/shared';
import { AppModule } from '../src/app.module';
import { AI_CLOCK, AI_GATEWAY_OPTIONS, AI_TRANSPORT, INPUT_BUDGET_COUNTER, type AiTransportRequest } from '../src/ai/contracts';
import { SystemAiClock } from '../src/ai/gateway';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import type { Prisma } from '../src/generated/prisma/client';
import { configureHttp } from '../src/http';
import { hashPassword } from '../src/identity/identity.service';
import { ReviewerAiUsageService } from '../src/reviews/reviewer-ai-usage.service';
import { persistedTestActor } from './business-fixtures';
import { aiTestOptions } from './ai-fixtures';

const content: WorkingContent = { title: 'Usage synthetic proposal', summary: 'Synthetic summary', problem: 'Check boundaries.', constraints: '',
  expectedBehavior: 'Valid behavior.', diffText: '--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n', criteria: [{ statement: 'Reject invalid input.', required: true }], evidence: [] };
const tables = '"AiOutboundAttempt", "AiQueueLease", "AiRequest", "ReleasePublicationSnapshot", "ReleaseSmokeTest", "ReleaseCandidateMember", "Notification", "ApprovalInvalidation", "ReleaseCandidate", "WorkingRevision", "CoverageEvidence", "CoverageAssessment", "FindingResponse", "FindingEvent", "ReviewFinding", "ReviewDecision", "ReviewIdempotency", "CriterionEvidenceLink", "ProposalActivity", "ReviewAssignment", "AcceptanceCriterion", "TestEvidence", "ProposalRevision", "ChangeProposal"';
function barrier() { let open!: () => void; const promise = new Promise<void>(yes => { open = yes; }); return { promise, open }; }

describe('Reviewer usage PostgreSQL integration', () => {
  let app: NestExpressApplication; let database: DatabaseService; let pool: Pool;
  const prefix = `usage-${randomUUID()}`; const ids = { a: `${prefix}-a`, b: `${prefix}-b`, owner: `${prefix}-owner`, maintainer: `${prefix}-maintainer` };
  const password = 'synthetic-usage-password'; const clock = new SystemAiClock(); let now = new Date();
  type Session = { agent: ReturnType<typeof request.agent>; token: string };
  let a: Session; let b: Session; let owner: Session; let maintainer: Session;
  const transport = { complete: jest.fn(async (input: AiTransportRequest) => {
    const raw = input.messages[1]!.content.match(/\n(.*)\n<\/submitted_context>/s)?.[1];
    const selected = (JSON.parse(raw ?? '{}') as { selectedCriterionIds: string[] }).selectedCriterionIds;
    return { status: 200, retryAfter: null, body: JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify({
      coverage: selected.map(criterionId => ({ criterionId, status: 'COVERED', rationale: 'Synthetic evidence.' })), risks: [], questions: [], suggestedTests: [], confidence: 'LOW',
    }) } }], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5, prompt_tokens_details: { cached_tokens: 0 } } }) };
  }) };
  async function login(name: keyof typeof ids): Promise<Session> {
    const agent = request.agent(app.getHttpServer()); const csrf = await agent.get('/api/auth/csrf').expect(200);
    const response = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken).send({ username: ids[name], password }).expect(200);
    return { agent, token: response.body.csrfToken as string };
  }
  const getUsage = async (session = a) => reviewerAiUsageResponseSchema.parse((await session.agent.get('/api/reviews/ai/usage').expect(200)).body);
  const post = (session: Session, path: string, body: object) => session.agent.post(`/api${path}`).set('x-csrf-token', session.token).send(body);
  async function seed(requestedAt: Date, attempts: Prisma.AiOutboundAttemptCreateWithoutRequestInput[] = [],
    options: { actorId?: string; feature?: 'REVIEWER' | 'CONTRIBUTOR'; outcome?: AiOutcome } = {}) {
    const actorId = options.actorId ?? ids.a; const feature = options.feature ?? 'REVIEWER';
    return database.client.aiRequest.create({ data: { correlationId: 'synthetic', actorId, feature, proposalId: 'private-proposal', expectedVersion: 0,
      ...(feature === 'REVIEWER' ? { revisionId: 'private-revision', assignmentId: 'private-assignment', accessGenerationId: 'private-generation', expectedAssignmentVersion: 0, selectedCriterionCount: 1 }
        : { workingRevisionId: 'private-working' }),
      templateVersion: 'private-template', requestedAt, outcome: options.outcome ?? 'SUCCESS', attempts: { create: attempts } } });
  }
  const attempt = (dispatchedAt = now, extra: Partial<Prisma.AiOutboundAttemptCreateWithoutRequestInput> = {}): Prisma.AiOutboundAttemptCreateWithoutRequestInput => ({
    actorId: ids.a, ordinal: 1, dispatchedAt, completedAt: dispatchedAt, outcome: 'SUCCESS', promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0, ...extra,
  });
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test')) throw new Error('Explicit disposable test database required');
    jest.spyOn(clock, 'now').mockImplementation(() => now);
    const module = await Test.createTestingModule({ imports: [AppModule.register(readConfig({ NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL,
      SESSION_SECRET: 'synthetic-reviewer-usage-secret-32-characters' }))] })
      .overrideProvider(AI_CLOCK).useValue(clock).overrideProvider(AI_GATEWAY_OPTIONS).useValue(aiTestOptions).overrideProvider(AI_TRANSPORT).useValue(transport)
      .overrideProvider(INPUT_BUDGET_COUNTER).useValue({ model: 'synthetic-reviewer-model', methodId: 'synthetic-counter-v1', countUnits: () => 100 }).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false }); configureHttp(app); await app.init(); database = app.get(DatabaseService);
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 3 }); const passwordHash = await hashPassword(password);
    await database.client.userAccount.createMany({ data: Object.entries(ids).map(([name, id]) => ({ id, username: id, passwordHash,
      role: name === 'owner' ? 'CONTRIBUTOR' as const : name === 'maintainer' ? 'RELEASE_MAINTAINER' as const : 'REVIEWER' as const })) });
  });
  beforeEach(async () => {
    now = new Date(); await database.client.$executeRawUnsafe(`TRUNCATE ${tables}`);
    await database.client.userAccount.updateMany({ where: { id: { in: Object.values(ids) } }, data: { enabled: true, version: 1 } });
    await database.client.securityEvent.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
    [a, b, owner, maintainer] = await Promise.all([login('a'), login('b'), login('owner'), login('maintainer')]); transport.complete.mockClear();
  });
  afterAll(async () => {
    if (database) {
      await database.client.$executeRawUnsafe(`TRUNCATE ${tables}`);
      await database.client.authSession.deleteMany({ where: { OR: Object.values(ids).map(id => ({ data: { contains: id } })) } });
      await database.client.securityEvent.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
      await database.client.userAccount.deleteMany({ where: { id: { in: Object.values(ids) } } });
    }
    await pool?.end(); await app?.close();
  });

  it('Reviewer usage fixture readiness', async () => {
    const identity = await pool.query<{ database: string }>('SELECT current_database() AS database');
    expect(identity.rows[0]!.database).toBe('specsentry_test');
    const accounts = await database.client.userAccount.findMany({ where: { id: { in: Object.values(ids) } }, orderBy: { id: 'asc' },
      select: { id: true, username: true, role: true, enabled: true } });
    expect(accounts).toHaveLength(4);
    for (const account of accounts) { expect(account.username).toBe(account.username.trim().toLowerCase()); expect(account.enabled).toBe(true); }
    expect(new Set(accounts.map(account => account.role))).toEqual(new Set(['REVIEWER', 'CONTRIBUTOR', 'RELEASE_MAINTAINER']));
    // This isolated suite truncates the full business FK graph before/after each test and removes its own sessions/accounts at closure.
    const expectedTables = ['AiOutboundAttempt', 'AiQueueLease', 'AiRequest', 'WorkingRevision', 'FindingResponse', 'FindingEvent', 'ReviewFinding', 'ReviewDecision',
      'CoverageEvidence', 'CoverageAssessment', 'ReviewIdempotency', 'CriterionEvidenceLink', 'ProposalActivity', 'ReviewAssignment', 'AcceptanceCriterion',
      'TestEvidence', 'ProposalRevision', 'ChangeProposal', 'Notification', 'ReleaseCandidate', 'ReleaseCandidateMember', 'ApprovalInvalidation', 'ReleasePublicationSnapshot', 'ReleaseSmokeTest'];
    for (const table of expectedTables) {
      expect(tables).toContain(`"${table}"`);
      expect(Number((await pool.query<{ count: string }>(`SELECT count(*) FROM "${table}"`)).rows[0]!.count)).toBe(0);
    }
    expect(await database.client.authSession.count({ where: { data: { contains: prefix } } })).toBeGreaterThanOrEqual(4);
    const fixture = await seed(now, [attempt()]);
    await database.client.aiRequest.delete({ where: { id: fixture.id } });
    expect(await database.client.aiOutboundAttempt.count({ where: { requestId: fixture.id } })).toBe(0);
  });

  it('filters actor AND request feature, rejects all selectors and returns no private identifiers or content', async () => {
    expect(await getUsage()).toMatchObject({ requests: 0, attempts: 0, failureRate: null,
      usage: { promptTokens: null, completionTokens: null, totalTokens: null, cachedTokens: null } });
    await seed(now, [attempt()]); await seed(now, [attempt(now, { actorId: ids.b })], { actorId: ids.b });
    await seed(now, [attempt()], { feature: 'CONTRIBUTOR' });
    const usage = await getUsage(); expect(usage).toMatchObject({ requests: 1, attempts: 1, failureRate: 0, usage: { totalTokens: 0 } });
    for (const secret of ['private-', ids.a, ids.b, 'templateVersion', 'contextHash', 'selectedCriterionCount']) expect(JSON.stringify(usage)).not.toContain(secret);
    expect((await getUsage(b)).attempts).toBe(1);
    for (const session of [owner, maintainer]) await session.agent.get('/api/reviews/ai/usage').expect(403);
    await request(app.getHttpServer()).get('/api/reviews/ai/usage').expect(401);
    for (const selector of ['actorId', 'proposalId', 'date', 'provider']) await a.agent.get(`/api/reviews/ai/usage?${selector}=forged`).expect(422);
    expect((await a.agent.get('/api/reviews/ai/usage').expect(200)).headers['cache-control']).toBe('no-store');
  });

  it('uses independent half-open SGT request/dispatch boundaries, including yesterday-parent retry-today and full-relation preflight detection', async () => {
    now = new Date('2026-11-04T16:00:00.000Z'); const before = new Date(now.getTime() - 1); const end = new Date(now.getTime() + 86400000);
    await seed(before, [attempt(before), attempt(now, { ordinal: 2 })]);
    await seed(now, [attempt(end)], { outcome: 'REJECTED' });
    await seed(now, [], { outcome: 'REJECTED' }); await seed(end, [attempt(end)]);
    expect(await getUsage()).toMatchObject({ startedAt: now.toISOString(), resetsAt: end.toISOString(), requests: 2, attempts: 1, retries: 1, preflightRejections: 1 });
  });

  it('separates failed and incomplete outcomes, genuine-zero tokens and all-or-unknown field coverage', async () => {
    await seed(now, [attempt()]);
    for (const errorClass of ['TRANSPORT', 'PROVIDER_REQUEST', 'INVALID_OUTPUT', 'PROVIDER_AUTH'] as const) await seed(now, [attempt(now, { outcome: 'FAILED', errorClass, promptTokens: null })]);
    await seed(now, [attempt(now, { outcome: null, completedAt: null, cachedTokens: null })]);
    expect(await getUsage()).toMatchObject({ attempts: 6, completedAttempts: 5, failedAttempts: 4, failureRate: 0.8,
      usage: { promptTokens: null, completionTokens: 0, totalTokens: 0, cachedTokens: null }, usageReportedAttempts: 6 });
  });

  async function claimed() {
    const draft = (await post(owner, '/proposals', content).expect(201)).body;
    const submitted = (await owner.agent.post(`/api/proposals/${draft.proposalId}/submit`).set('x-csrf-token', owner.token).set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: draft.version, workingRevisionId: draft.workingRevisionId }).expect(200)).body;
    const command = (await post(a, `/proposals/${draft.proposalId}/claim`, { expectedVersion: submitted.version }).expect(200)).body as ReviewCommandResponse;
    const criterion = await database.client.acceptanceCriterion.findFirstOrThrow({ where: { revisionId: command.revisionId } });
    return { command, input: { revisionId: command.revisionId, assignmentId: command.assignmentId, expectedVersion: command.version, expectedAssignmentVersion: command.assignmentVersion, selectedCriterionIds: [criterion.id] } };
  }
  it.each(['drop', 'disable', 'logout', 'expiry'] as const)('usage-success-delivery-denial: provider success remains outbound success when %s denies delivery', async operation => {
    const { command, input } = await claimed(); const entered = barrier(); const release = barrier();
    const complete = transport.complete.getMockImplementation()!;
    transport.complete.mockImplementationOnce(async request => { entered.open(); await release.promise; return complete(request); });
    const pending = post(a, `/proposals/${command.proposalId}/ai/patch-risk`, input).then(response => response); await entered.promise;
    try {
      if (operation === 'drop') await post(a, `/proposals/${command.proposalId}/drop`, { ...input, selectedCriterionIds: undefined }).expect(200);
      if (operation === 'disable') await database.client.userAccount.update({ where: { id: ids.a }, data: { enabled: false, version: 2 } });
      if (operation === 'logout') await a.agent.post('/api/auth/logout').set('x-csrf-token', a.token).expect(204);
      if (operation === 'expiry') await database.client.authSession.updateMany({ where: { data: { contains: ids.a } }, data: { expiresAt: new Date(0) } });
    } finally { release.open(); }
    const denied = await pending; expect([401, 403, 404, 409]).toContain(denied.status); expect(denied.body).not.toHaveProperty('result');
    expect(await database.client.aiOutboundAttempt.findFirstOrThrow({ where: { actorId: ids.a } })).toMatchObject({ outcome: 'SUCCESS' });
    expect(await database.client.aiRequest.findFirstOrThrow({ where: { actorId: ids.a } })).toMatchObject({ outcome: 'REJECTED', errorClass: 'ACCESS_LOST' });
    if (operation === 'disable') await database.client.userAccount.update({ where: { id: ids.a }, data: { enabled: true } });
    if (operation !== 'drop') a = await login('a');
    expect(await getUsage()).toMatchObject({ attempts: 1, completedAttempts: 1, failedAttempts: 0, failureRate: 0 });
    if (operation === 'drop') {
      await a.agent.get(`/api/proposals/${command.proposalId}/ai/audit`).expect(403);
      expect(await database.client.reviewAssignment.findUniqueOrThrow({ where: { id: command.assignmentId! } })).toMatchObject({ status: 'CLOSED' });
      const root = await database.client.changeProposal.findUniqueOrThrow({ where: { id: command.proposalId } });
      await post(b, `/proposals/${command.proposalId}/claim`, { expectedVersion: root.version }).expect(200);
      await a.agent.get(`/api/proposals/${command.proposalId}/ai/audit`).expect(403);
      expect((await b.agent.get(`/api/proposals/${command.proposalId}/ai/audit`).expect(200)).body.items).toEqual([]);
      expect(await getUsage()).toMatchObject({ requests: 1, attempts: 1 });
    }
  });

  it('fails closed and rolls back its usage-view audit if PostgreSQL refuses that event, without business writes', async () => {
    await seed(now, [attempt()]); const fn = `usage_audit_${randomUUID().replaceAll('-', '')}`;
    await pool.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='AI_USAGE_VIEWED' THEN RAISE EXCEPTION 'synthetic usage audit failure'; END IF; RETURN NEW; END $$`);
    await pool.query(`CREATE TRIGGER ${fn} BEFORE INSERT ON "SecurityEvent" FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
    const before = await database.client.aiRequest.findMany({ where: { actorId: ids.a }, include: { attempts: true } });
    try {
      const response = await a.agent.get('/api/reviews/ai/usage').expect(500); expect(response.body).not.toHaveProperty('usage');
      expect(await database.client.securityEvent.count({ where: { actorId: ids.a, action: 'AI_USAGE_VIEWED' } })).toBe(0);
      expect(await database.client.aiRequest.findMany({ where: { actorId: ids.a }, include: { attempts: true } })).toEqual(before);
    } finally { await pool.query(`DROP TRIGGER ${fn} ON "SecurityEvent"`); await pool.query(`DROP FUNCTION ${fn}()`); }
  });

  it.each(['logout', 'disable'] as const)('fresh locked authorization rejects a usage read when committed %s wins the account lock', async operation => {
    const actor = await persistedTestActor(database, ids.a); const holder = await pool.connect(); let pending: Promise<unknown> | undefined;
    try {
      await holder.query('BEGIN'); const pid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() pid')).rows[0]!.pid;
      await holder.query('SELECT id FROM "UserAccount" WHERE id=$1 FOR UPDATE', [ids.a]);
      pending = app.get(ReviewerAiUsageService).usage(actor); const rejected = expect(pending).rejects.toMatchObject({ status: 401 });
      let blocked = false; const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        if ((await pool.query('SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))', [pid])).rowCount) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      if (operation === 'logout') await holder.query('DELETE FROM "AuthSession" WHERE id=$1', [actor.session!.digest]);
      else await holder.query('UPDATE "UserAccount" SET enabled=false,version=version+1 WHERE id=$1', [ids.a]);
      await holder.query('COMMIT'); await rejected;
      expect(await database.client.securityEvent.count({ where: { actorId: ids.a, action: 'AI_USAGE_VIEWED' } })).toBe(0);
    } finally { await holder.query('ROLLBACK'); holder.release(); await pending?.catch(() => undefined); }
  });
});
