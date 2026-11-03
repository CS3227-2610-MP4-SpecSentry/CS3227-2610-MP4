import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { Pool } from 'pg';
import { contributorAiUsageResponseSchema, contributorDraftResponseSchema, type WorkingContent } from '@specsentry/shared';
import { AppModule } from '../src/app.module';
import { AI_GATEWAY_OPTIONS, AI_TRANSPORT, INPUT_BUDGET_COUNTER, type AiTransport } from '../src/ai/contracts';
import { PrismaAiAccounting, SystemAiClock } from '../src/ai/gateway';
import { AiRequestDeadline } from '../src/ai/deadline';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { configureHttp } from '../src/http';
import { hashPassword } from '../src/identity/identity.service';
import { ProposalLifecycleService } from '../src/proposals/proposal-lifecycle.service';
import { ContributorAssistantService } from '../src/proposals/contributor-assistant.service';
import { persistedTestActor } from './business-fixtures';
import { aiTestOptions } from './ai-fixtures';

const tables = '"AiOutboundAttempt", "AiQueueLease", "AiRequest", "ReleasePublicationSnapshot", "ReleaseSmokeTest", "ReleaseCandidateMember", "Notification", "ApprovalInvalidation", "ReleaseCandidate", "WorkingRevision", "CoverageEvidence", "CoverageAssessment", "FindingResponse", "FindingEvent", "ReviewFinding", "ReviewDecision", "ReviewIdempotency", "CriterionEvidenceLink", "ProposalActivity", "ReviewAssignment", "AcceptanceCriterion", "TestEvidence", "ProposalRevision", "ChangeProposal"';
const content: WorkingContent = { title: 'Synthetic AI draft', summary: 'Saved summary', problem: 'Validate a synthetic input.', constraints: 'Local validation only.',
  expectedBehavior: 'Reject invalid values.', diffText: 'PRIVATE_PATCH_NOT_AI_CONTEXT',
  criteria: [{ statement: 'Reject invalid input.', required: true }], evidence: [{ text: 'PRIVATE_EVIDENCE_NOT_AI_CONTEXT' }] };
const result = { objective: 'Validate input safely.', acceptanceCriteria: ['Reject invalid values.'], edgeCases: ['Empty input.'], ambiguities: [], testIdeas: ['Check boundaries.'] };
const envelope = (value: unknown = result, usage: object = { prompt_tokens: 120, completion_tokens: 80, total_tokens: 200 }) => JSON.stringify({
  choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: JSON.stringify(value) } }], usage,
});
function barrier() { let open!: () => void; const promise = new Promise<void>(resolve => { open = resolve; }); return { promise, open }; }

describe('PostgreSQL Contributor Spec Draft Assistant security and resource integration', () => {
  let app: NestExpressApplication; let database: DatabaseService; let lifecycle: ProposalLifecycleService; let pool: Pool;
  const prefix = `con-ai-${randomUUID()}`; const password = 'synthetic-contributor-ai-password';
  const names = ['owner', 'other', 'reviewer', 'maintainer'] as const;
  type Session = { agent: ReturnType<typeof request.agent>; token: string };
  let owner: Session; let other: Session; let reviewer: Session; let maintainer: Session;
  const transport: AiTransport = { complete: jest.fn(async () => ({ status: 200, body: envelope(), retryAfter: null })) };
  const options = { ...aiTestOptions };
  const counter = { model: aiTestOptions.mode === 'test' ? aiTestOptions.model : '', methodId: 'synthetic-counter-v1', countUnits: jest.fn(() => 100) };
  async function login(name: typeof names[number]): Promise<Session> {
    const agent = request.agent(app.getHttpServer()); const csrf = await agent.get('/api/auth/csrf').expect(200);
    const response = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken).send({ username: `${prefix}-${name}`, password }).expect(200);
    return { agent, token: response.body.csrfToken as string };
  }
  async function create(input: WorkingContent = content) {
    return (await owner.agent.post('/api/proposals').set('x-csrf-token', owner.token).send(input).expect(201)).body as {
      proposalId: string; workingRevisionId: string; version: number;
    };
  }
  const generate = (root: { proposalId: string; workingRevisionId: string; version: number }, session = owner, extra: object = {}) =>
    session.agent.post(`/api/proposals/${root.proposalId}/ai/draft`).set('x-csrf-token', session.token)
      .send({ expectedVersion: root.version, workingRevisionId: root.workingRevisionId, ...extra });
  async function businessSnapshot(id: string) {
    return { root: await database.client.changeProposal.findUnique({ where: { id } }),
      working: await database.client.workingRevision.findUnique({ where: { proposalId: id } }),
      activity: await database.client.proposalActivity.findMany({ where: { proposalId: id }, orderBy: { id: 'asc' } }),
      revisions: await database.client.proposalRevision.count({ where: { proposalId: id } }) };
  }
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL required');
    const module = await Test.createTestingModule({ imports: [AppModule.register(readConfig({ NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL, SESSION_SECRET: 'synthetic-contributor-ai-session-secret' }))] })
      .overrideProvider(AI_GATEWAY_OPTIONS).useValue(options).overrideProvider(AI_TRANSPORT).useValue(transport)
      .overrideProvider(INPUT_BUDGET_COUNTER).useValue(counter).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false }); configureHttp(app); await app.init();
    database = app.get(DatabaseService); lifecycle = app.get(ProposalLifecycleService);
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 3 });
    const passwordHash = await hashPassword(password);
    await database.client.userAccount.createMany({ data: names.map(name => ({ id: `${prefix}-${name}`, username: `${prefix}-${name}`, passwordHash,
      role: name === 'reviewer' ? 'REVIEWER' as const : name === 'maintainer' ? 'RELEASE_MAINTAINER' as const : 'CONTRIBUTOR' as const })) });
  });
  beforeEach(async () => {
    await database.client.$executeRawUnsafe(`TRUNCATE ${tables}`);
    await database.client.userAccount.updateMany({ where: { id: { startsWith: prefix } }, data: { enabled: true, version: 1 } });
    Object.assign(options, aiTestOptions); counter.countUnits.mockReturnValue(100);
    jest.mocked(transport.complete).mockReset().mockResolvedValue({ status: 200, body: envelope(), retryAfter: null });
    [owner, other, reviewer, maintainer] = await Promise.all([login('owner'), login('other'), login('reviewer'), login('maintainer')]);
  });
  afterAll(async () => {
    if (database) {
      await database.client.$executeRawUnsafe(`TRUNCATE ${tables}`);
      await database.client.authSession.deleteMany({ where: { OR: names.map(name => ({ data: { contains: `${prefix}-${name}` } })) } });
      await database.client.securityEvent.deleteMany({ where: { actorId: { startsWith: prefix } } });
      await database.client.userAccount.deleteMany({ where: { id: { startsWith: prefix } } });
    }
    await pool?.end(); await app?.close();
  });

  it('returns a typed suggestion without business changes and excludes unrelated context and identifiers from transport', async () => {
    const root = await create(); const before = await businessSnapshot(root.proposalId);
    const response = contributorDraftResponseSchema.parse((await generate(root).expect(200)).body);
    expect(response.result).toEqual(result); expect(await businessSnapshot(root.proposalId)).toEqual(before);
    const outbound = JSON.stringify(jest.mocked(transport.complete).mock.calls[0]![0].messages);
    for (const excluded of [root.proposalId, root.workingRevisionId, 'PRIVATE_PATCH_NOT_AI_CONTEXT', 'PRIVATE_EVIDENCE_NOT_AI_CONTEXT', `${prefix}-other`])
      expect(outbound).not.toContain(excluded);
    const audit = await database.client.aiRequest.findFirstOrThrow({ where: { actorId: `${prefix}-owner` } });
    expect(audit).toMatchObject({ feature: 'CONTRIBUTOR', workingRevisionId: root.workingRevisionId, revisionId: null,
      assignmentId: null, accessGenerationId: null, selectedCriterionCount: null, outcome: 'SUCCESS' });
    expect(JSON.stringify(audit)).not.toContain(content.problem); expect(JSON.stringify(audit)).not.toContain(result.objective);
  });

  it('authorizes role, ownership, session/CSRF and exact saved version before any protected context/outbound call', async () => {
    const root = await create(); const body = { expectedVersion: root.version, workingRevisionId: root.workingRevisionId };
    for (const session of [other, reviewer, maintainer]) await generate(root, session).expect(403);
    await request(app.getHttpServer()).post(`/api/proposals/${root.proposalId}/ai/draft`).send(body).expect(401);
    await owner.agent.post(`/api/proposals/${root.proposalId}/ai/draft`).send(body).expect(403);
    for (const extra of [{ actorId: 'forged' }, { model: 'forged' }, { context: content.problem }]) await generate(root, owner, extra).expect(422);
    await generate(root, owner, { expectedVersion: 1 }).expect(409);
    await generate(root, owner, { workingRevisionId: 'foreign' }).expect(404);
    expect(transport.complete).not.toHaveBeenCalled();
  });

  it('rejects attached, approved and terminal drafts without outbound calls or business mutation', async () => {
    const root = await create();
    for (const state of ['APPROVED', 'IN_RELEASE', 'WITHDRAWN', 'RELEASED'] as const) {
      await database.client.changeProposal.update({ where: { id: root.proposalId }, data: { state } });
      const before = await businessSnapshot(root.proposalId); await generate(root).expect(409);
      expect(await businessSnapshot(root.proposalId)).toEqual(before);
    }
    await database.client.changeProposal.update({ where: { id: root.proposalId }, data: { state: 'CHANGES_REQUESTED', releaseAttachmentRef: 'synthetic-attachment' } });
    await generate(root).expect(409); expect(transport.complete).not.toHaveBeenCalled();
  });

  it('keeps disabled, secret, oversized, malformed provider and token-limit failures separate from manual content', async () => {
    const root = await create(); const before = await businessSnapshot(root.proposalId);
    Object.assign(options, { mode: 'disabled' }); const disabled = await generate(root).expect(503);
    expect(disabled.body.reason).toBe('DISABLED'); Object.assign(options, aiTestOptions);
    counter.countUnits.mockReturnValue(4001); await generate(root).expect(422); counter.countUnits.mockReturnValue(100);
    jest.mocked(transport.complete).mockResolvedValue({ status: 200, body: envelope({ ...result, lifecycle: 'APPROVED' }), retryAfter: null });
    await generate(root).expect(503); expect(await businessSnapshot(root.proposalId)).toEqual(before);
    const secret = await create({ ...content, problem: 'Authorization: Bearer synthetic-only-secret' });
    await generate(secret).expect(422);
    const oversized = await create({ ...content, constraints: 'x'.repeat(6001) }); await generate(oversized).expect(422);
    expect(transport.complete).toHaveBeenCalledTimes(1);
  });

  it('reauthorizes after provider I/O and withholds stale results while retaining committed manual edits', async () => {
    const root = await create(); const actor = await persistedTestActor(database, `${prefix}-owner`);
    const entered = barrier(); const release = barrier();
    jest.mocked(transport.complete).mockImplementationOnce(async () => { entered.open(); await release.promise; return { status: 200, body: envelope(), retryAfter: null }; });
    const pending = generate(root).then(response => response); await entered.promise;
    const saved = await lifecycle.save(actor, root.proposalId, { expectedVersion: root.version, content: { ...content, problem: 'Human changed the draft.' } });
    release.open(); const response = await pending; expect(response.status).toBe(409);
    const current = await owner.agent.get(`/api/proposals/${root.proposalId}/draft`).expect(200);
    expect(current.body.content.problem).toBe('Human changed the draft.'); expect(current.body.version).toBe(saved.version);
    expect(response.body).not.toHaveProperty('result');
    expect(await database.client.aiRequest.findFirstOrThrow({ where: { proposalId: root.proposalId } })).toMatchObject({ outcome: 'STALE', errorClass: 'SCOPE_CHANGED' });
  });

  it.each(['logout', 'disable'] as const)('withholds late protected results after %s without business mutation', async operation => {
    const root = await create(); const before = await businessSnapshot(root.proposalId);
    const entered = barrier(); const release = barrier();
    jest.mocked(transport.complete).mockImplementationOnce(async () => { entered.open(); await release.promise; return { status: 200, body: envelope(), retryAfter: null }; });
    const pending = generate(root).then(response => response); await entered.promise;
    if (operation === 'logout') await owner.agent.post('/api/auth/logout').set('x-csrf-token', owner.token).expect(204);
    else await database.client.userAccount.update({ where: { id: `${prefix}-owner` }, data: { enabled: false, version: 2 } });
    release.open(); const response = await pending; expect(response.status).toBe(401); expect(response.body).not.toHaveProperty('result');
    expect(await businessSnapshot(root.proposalId)).toEqual(before);
  });

  it('shares real per-user attempt quota across Reviewer and Contributor feature metadata without leaking another actor usage', async () => {
    const root = await create();
    const now = new Date();
    for (let requestIndex = 0; requestIndex < 5; requestIndex++) {
      await database.client.aiRequest.create({ data: { id: `${prefix}-reviewer-request-${requestIndex}`, correlationId: 'synthetic', actorId: `${prefix}-owner`,
        feature: 'REVIEWER', proposalId: 'opaque-previous-scope', revisionId: 'r', assignmentId: 'a', accessGenerationId: 'g',
        expectedVersion: 0, expectedAssignmentVersion: 0, selectedCriterionCount: 1, templateVersion: 'reviewer-risk-v1', requestedAt: now,
        attempts: { create: [1, 2].map(ordinal => ({ actorId: `${prefix}-owner`, ordinal,
          dispatchedAt: now, completedAt: now, outcome: requestIndex === 0 && ordinal === 1 ? 'FAILED' as const : 'SUCCESS' as const })) } } });
    }
    const response = await generate(root).expect(429); expect(response.body.reason).toBe('RATE_LIMIT'); expect(transport.complete).not.toHaveBeenCalled();
    const usage = contributorAiUsageResponseSchema.parse((await owner.agent.get('/api/contributor/ai/usage').expect(200)).body);
    expect(usage).toMatchObject({ requests: 6, attempts: 10, completedAttempts: 10, failedAttempts: 1, retries: 5,
      failureRate: 0.1, preflightRejections: 1, applicationCache: 'DISABLED', usageReportedAttempts: 0 });
    expect(usage.usage.totalTokens).toBeNull();
    const others = contributorAiUsageResponseSchema.parse((await other.agent.get('/api/contributor/ai/usage').expect(200)).body);
    expect(others).toMatchObject({ requests: 0, attempts: 0, failureRate: null });
    for (const session of [reviewer, maintainer]) await session.agent.get('/api/contributor/ai/usage').expect(403);
    await owner.agent.get('/api/contributor/ai/usage?actorId=other').expect(422);
  });

  it('reports provider usage only when supplied and enforces exact feature-aware metadata shape in PostgreSQL', async () => {
    const root = await create(); await generate(root).expect(200);
    const usage = contributorAiUsageResponseSchema.parse((await owner.agent.get('/api/contributor/ai/usage').expect(200)).body);
    expect(usage).toMatchObject({ requests: 1, attempts: 1, failureRate: 0, usageReportedAttempts: 1,
      usage: { promptTokens: 120, completionTokens: 80, totalTokens: 200, cachedTokens: null } });
    expect(new Date(usage.startedAt).getUTCHours()).toBe(16);
    const base = { correlationId: 'synthetic', actorId: `${prefix}-owner`, proposalId: root.proposalId, expectedVersion: 0, templateVersion: 'synthetic' };
    await expect(database.client.aiRequest.create({ data: { ...base, feature: 'CONTRIBUTOR' } })).rejects.toThrow();
    await expect(database.client.aiRequest.create({ data: { ...base, feature: 'CONTRIBUTOR', workingRevisionId: root.workingRevisionId, revisionId: 'wrong' } })).rejects.toThrow();
    await expect(database.client.aiRequest.create({ data: { ...base, feature: 'REVIEWER' } })).rejects.toThrow();
  });

  it.each(['logout', 'save'] as const)('P004: denies dispatch when %s wins during a real post-enqueue quota-row wait', async operation => {
    const root = await create(); const actor = await persistedTestActor(database, `${prefix}-owner`);
    const before = await businessSnapshot(root.proposalId); const holder = await pool.connect();
    const entered = barrier(); let holderPid = 0;
    const reserve = PrismaAiAccounting.prototype.reserveAttempt;
    const spy = jest.spyOn(PrismaAiAccounting.prototype, 'reserveAttempt').mockImplementationOnce(async function (this: PrismaAiAccounting, input) {
      await holder.query('BEGIN');
      holderPid = (await holder.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
      await holder.query('SELECT id FROM "AiQuotaCoordinator" WHERE id=$1 FOR UPDATE', ['reviewer-patch-risk']);
      entered.open(); return reserve.call(this, input);
    });
    const pending = generate(root).then(response => response);
    try {
      await entered.promise;
      const until = Date.now() + 4000; let blocked = false;
      while (Date.now() < until) {
        const waiters = await pool.query('SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND $1=ANY(pg_blocking_pids(pid))', [holderPid]);
        if (waiters.rowCount) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      if (operation === 'logout') await owner.agent.post('/api/auth/logout').set('x-csrf-token', owner.token).expect(204);
      else await lifecycle.save(actor, root.proposalId, { expectedVersion: root.version, content: { ...content, problem: 'Manual edit during quota wait.' } });
      await holder.query('COMMIT');
      const response = await pending; expect(response.status).toBe(operation === 'logout' ? 401 : 409);
      expect(response.body).not.toHaveProperty('result'); expect(transport.complete).not.toHaveBeenCalled();
      expect(await database.client.aiOutboundAttempt.count({ where: { actorId: `${prefix}-owner` } })).toBe(0);
      expect(await database.client.aiQueueLease.count()).toBe(0);
      const audit = await database.client.aiRequest.findFirstOrThrow({ where: { proposalId: root.proposalId } });
      expect(audit).toMatchObject({ outcome: 'REJECTED',
        errorClass: operation === 'logout' ? 'ACCESS_LOST' : 'SCOPE_CHANGED' });
      const resumed = operation === 'logout' ? await login('owner') : owner;
      const usage = contributorAiUsageResponseSchema.parse((await resumed.agent.get('/api/contributor/ai/usage').expect(200)).body);
      expect(usage).toMatchObject({ attempts: 0, preflightRejections: 1, failureRate: null });
      if (operation === 'logout') expect(await businessSnapshot(root.proposalId)).toEqual(before);
      else {
        const working = await database.client.workingRevision.findUniqueOrThrow({ where: { proposalId: root.proposalId } });
        expect(working.content).toMatchObject({ problem: 'Manual edit during quota wait.' });
      }
    } finally {
      await holder.query('ROLLBACK'); holder.release(); spy.mockRestore(); await pending;
    }
  }, 15000);

  it('P004: admits five concurrent requests with the five-connection pool without nested authorization connections', async () => {
    const root = await create();
    const responses = await Promise.all(Array.from({ length: 5 }, () => generate(root)));
    expect(responses.map(response => response.status)).toEqual([200, 200, 200, 200, 200]);
    expect(transport.complete).toHaveBeenCalledTimes(5);
    expect(await database.client.aiOutboundAttempt.count({ where: { actorId: `${prefix}-owner` } })).toBe(5);
  }, 15000);

  it('P004: releases account, session and proposal locks before provider I/O', async () => {
    const root = await create();
    jest.mocked(transport.complete).mockImplementationOnce(async () => {
      const observer = await pool.connect();
      try {
        await observer.query('BEGIN'); await observer.query("SET LOCAL lock_timeout='250ms'");
        await observer.query('SELECT id FROM "UserAccount" WHERE id=$1 FOR UPDATE', [`${prefix}-owner`]);
        await observer.query('SELECT id FROM "AuthSession" WHERE data::jsonb->>\'userId\'=$1 FOR UPDATE', [`${prefix}-owner`]);
        await observer.query('SELECT id FROM "ChangeProposal" WHERE id=$1 FOR UPDATE', [root.proposalId]);
      } finally { await observer.query('ROLLBACK'); observer.release(); }
      return { status: 200, body: envelope(), retryAfter: null };
    });
    await generate(root).expect(200); expect(transport.complete).toHaveBeenCalledTimes(1);
  });

  it('P004: a post-admission authorization lock deadline returns503 and preserves valid session/manual content', async () => {
    const root = await create(); const before = await businessSnapshot(root.proposalId);
    const holder = await pool.connect(); const reserve = PrismaAiAccounting.prototype.reserveAttempt;
    const deadline = jest.spyOn(app.get(ContributorAssistantService), 'deadline').mockImplementation(() => new AiRequestDeadline(new SystemAiClock(), 500));
    const spy = jest.spyOn(PrismaAiAccounting.prototype, 'reserveAttempt').mockImplementationOnce(async function (this: PrismaAiAccounting, input) {
      await holder.query('BEGIN');
      await holder.query('SELECT id FROM "UserAccount" WHERE id=$1 FOR UPDATE', [`${prefix}-owner`]);
      return reserve.call(this, input);
    });
    try {
      const response = await generate(root).expect(503); expect(response.body.reason).toBe('DEADLINE');
      expect(transport.complete).not.toHaveBeenCalled(); expect(await database.client.aiOutboundAttempt.count()).toBe(0);
    } finally {
      await holder.query('ROLLBACK'); holder.release(); spy.mockRestore(); deadline.mockRestore();
    }
    await owner.agent.get(`/api/proposals/${root.proposalId}/draft`).expect(200);
    expect(await businessSnapshot(root.proposalId)).toEqual(before);
  }, 5000);
});
