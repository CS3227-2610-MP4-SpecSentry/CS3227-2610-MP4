import 'reflect-metadata';
import { createHash, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { coverageCommandResponseSchema, decisionCommandResponseSchema, findingCommandResponseSchema,
  findingEventCommandResponseSchema, findingsResponseSchema, humanReviewResponseSchema, type ProposalState,
  type ReviewCommandResponse } from '@specsentry/shared';
import { AppModule } from '../src/app.module';
import { ActivityService } from '../src/activity/activity.service';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { configureHttp } from '../src/http';
import { AccountAdministrationService } from '../src/identity/account-administration.service';
import { hashPassword } from '../src/identity/identity.service';
import { ReviewsService } from '../src/reviews/reviews.service';
import type { Prisma } from '../src/generated/prisma/client';

// The suite uses only its explicitly supplied disposable PostgreSQL database.
const businessTables = '"CoverageEvidence", "CoverageAssessment", "FindingEvent", "ReviewFinding", "ReviewDecision", "ReviewIdempotency", "CriterionEvidenceLink", "ProposalActivity", "ReviewAssignment", "AcceptanceCriterion", "TestEvidence", "ProposalRevision", "ChangeProposal"';
describe('PostgreSQL manual Reviewer acceptance (REQ-REV-001/002/004/005/006/007/009/010/011/015)', () => {
  let app: NestExpressApplication;
  let database: DatabaseService;
  let activity: ActivityService;
  let administration: AccountAdministrationService;
  const prefix = `manual-${randomUUID()}`;
  const ids = { owner: `${prefix}-owner`, a: `${prefix}-a`, b: `${prefix}-b` };
  const password = 'synthetic-manual-review-test-password';
  type Session = { agent: ReturnType<typeof request.agent>; token: string };
  let a: Session; let b: Session;
  type Case = { id: string; revisionId: string; required: string; optional: string; evidence: string };
  async function clean() {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL is required');
    await database.client.$executeRawUnsafe(`TRUNCATE ${businessTables}`);
  }
  async function login(name: 'a' | 'b' | 'owner'): Promise<Session> {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/auth/csrf').expect(200);
    const response = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken)
      .send({ username: `${prefix}-${name}`, password }).expect(200);
    return { agent, token: response.body.csrfToken as string };
  }
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL is required');
    const module = await Test.createTestingModule({ imports: [AppModule.register(readConfig({ NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL,
      SESSION_SECRET: 'manual-review-test-secret-at-least-32-characters' }))] }).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false }); configureHttp(app); await app.init();
    database = app.get(DatabaseService); activity = app.get(ActivityService);
    administration = new AccountAdministrationService(database, app.get(ReviewsService));
    const passwordHash = await hashPassword(password);
    await database.client.userAccount.createMany({ data: Object.entries(ids).map(([name, id]) => ({ id, username: `${prefix}-${name}`, passwordHash,
      role: name === 'owner' ? 'CONTRIBUTOR' as const : 'REVIEWER' as const })) });
  });
  beforeEach(async () => {
    await clean();
    await database.client.userAccount.updateMany({ where: { id: { in: [ids.a, ids.b] } }, data: { enabled: true, version: 1, role: 'REVIEWER' } });
    a = await login('a'); b = await login('b');
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (database) {
      await clean();
      await database.client.authSession.deleteMany({ where: { OR: Object.values(ids).map((id) => ({ data: { contains: id } })) } });
      await database.client.securityEvent.deleteMany({ where: { OR: [{ actorId: { in: Object.values(ids) } }, { target: { startsWith: prefix } }] } });
      await database.client.userAccount.deleteMany({ where: { id: { in: Object.values(ids) } } });
    }
    await app?.close();
  });
  async function revision(tx: Prisma.TransactionClient, id: string, number: number) {
    const revisionId = `${id}-r${number}`; const required = `${revisionId}-required`; const optional = `${revisionId}-optional`; const evidence = `${revisionId}-evidence`;
    await tx.proposalRevision.create({ data: { id: revisionId, proposalId: id, number, summary: 'Synthetic submitted summary', problem: 'Submitted problem',
      constraints: '', expectedBehavior: 'Expected behavior', diffText: '+ human review',
      criteria: { create: [{ id: required, stableKey: 'required', statement: 'Required behavior' }, { id: optional, stableKey: 'optional', statement: 'Optional behavior', required: false }] },
      evidence: { create: { id: evidence, text: 'Shared optional evidence', evidenceHash: createHash('sha256').update('Shared optional evidence').digest('hex') } } } });
    return { id, revisionId, required, optional, evidence };
  }
  async function proposal(state: ProposalState = 'SUBMITTED'): Promise<Case> {
    const id = `${prefix}-${randomUUID()}`;
    return database.client.$transaction(async (tx) => {
      await tx.changeProposal.create({ data: { id, ownerId: ids.owner, title: 'Manual review case', state, firstSubmittedAt: new Date('2026-01-01') } });
      const result = await revision(tx, id, 1);
      await tx.changeProposal.update({ where: { id }, data: { currentRevisionId: result.revisionId } });
      return result;
    });
  }
  async function claim(session: Session, root: Case, expectedVersion = 0): Promise<ReviewCommandResponse> {
    return (await session.agent.post(`/api/proposals/${root.id}/claim`).set('x-csrf-token', session.token).send({ expectedVersion }).expect(200)).body as ReviewCommandResponse;
  }
  const scope = (command: ReviewCommandResponse) => ({ expectedVersion: command.version, revisionId: command.revisionId,
    assignmentId: command.assignmentId, expectedAssignmentVersion: command.assignmentVersion });
  async function assess(session: Session, root: Case, command: ReviewCommandResponse, criterionId = root.required,
    extra: Record<string, unknown> = {}) {
    return coverageCommandResponseSchema.parse((await session.agent.put(`/api/proposals/${root.id}/coverage/${criterionId}`).set('x-csrf-token', session.token)
      .send({ ...scope(command), operation: 'ASSESS', status: 'COVERED', ...extra }).expect(200)).body);
  }
  async function finding(session: Session, root: Case, command: ReviewCommandResponse, severity = 'HIGH') {
    return findingCommandResponseSchema.parse((await session.agent.post(`/api/proposals/${root.id}/findings`).set('x-csrf-token', session.token)
      .send({ ...scope(command), severity, description: 'Original immutable description.' }).expect(201)).body);
  }
  const decision = (session: Session, root: Case, body: object, key = randomUUID()) => session.agent.post(`/api/proposals/${root.id}/decision`)
    .set('x-csrf-token', session.token).set('Idempotency-Key', key).send(body);
  async function review(session: Session, root: Case, query = '') {
    return humanReviewResponseSchema.parse((await session.agent.get(`/api/proposals/${root.id}/review${query}`).expect(200)).body);
  }
  async function complete(root: Case, command: ReviewCommandResponse) {
    return assess(a, root, await assess(a, root, command), root.optional, { status: 'NOT_APPLICABLE', rationale: 'Optional for this patch.' });
  }

  it('accepts covered without evidence, shared evidence, optional rationale and rejects cross-revision references atomically', async () => {
    const root = await proposal(); const other = await proposal(); let command = await claim(a, root);
    const missing = await review(a, root); expect(missing.approvalBlockers.map((item) => item.code)).toEqual(['MISSING_ASSESSMENT', 'MISSING_ASSESSMENT']);
    command = await assess(a, root, command); expect((await review(a, root)).coverage[0]!.evidenceIds).toEqual([]);
    const before = await database.client.changeProposal.findUniqueOrThrow({ where: { id: root.id } });
    for (const body of [{ status: 'PARTIALLY_COVERED' }, { evidenceIds: [other.evidence] }]) {
      await a.agent.put(`/api/proposals/${root.id}/coverage/${root.optional}`).set('x-csrf-token', a.token)
        .send({ ...scope(command), operation: 'ASSESS', status: 'COVERED', ...body }).expect(422);
    }
    await a.agent.put(`/api/proposals/${root.id}/coverage/${other.required}`).set('x-csrf-token', a.token)
      .send({ ...scope(command), operation: 'ASSESS', status: 'COVERED' }).expect(422);
    expect(await database.client.changeProposal.findUniqueOrThrow({ where: { id: root.id } })).toEqual(before);
    command = await assess(a, root, command, root.required, { evidenceIds: [root.evidence] });
    command = await assess(a, root, command, root.optional, { status: 'NOT_COVERED', rationale: 'Optional unmet.', evidenceIds: [root.evidence] });
    const activityPage = await a.agent.get(`/api/proposals/${root.id}/activity`).expect(200);
    expect(activityPage.body.items).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'COVERAGE_ASSESSED', summary: expect.stringContaining(root.optional), reason: 'Optional unmet.' })]));
    await expect(database.client.coverageEvidence.deleteMany({ where: { revisionId: root.revisionId } })).rejects.toThrow();
    await expect(database.client.acceptanceCriterion.update({ where: { id: root.required }, data: { required: false } })).rejects.toThrow();
    expect((await review(a, root)).approvalBlockers).toEqual([]);
    expect((await decision(a, root, { ...scope(command), decision: 'APPROVE' }).expect(200)).body.state).toBe('APPROVED');
    expect(await database.client.acceptanceCriterion.findUniqueOrThrow({ where: { id: root.required } })).toMatchObject({ required: true });
  });
  it('blocks each non-covered required status, missing assessment and unresolved HIGH/CRITICAL, while LOW/MEDIUM permit approval', async () => {
    for (const severity of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) {
      const root = await proposal(); let command = await claim(a, root);
      await decision(a, root, { ...scope(command), decision: 'APPROVE' }).expect(409);
      for (const status of ['PARTIALLY_COVERED', 'NOT_COVERED', 'NOT_APPLICABLE']) {
        command = await assess(a, root, command, root.required, { status, rationale: 'Reasoned human assessment.' });
        expect((await review(a, root)).approvalBlockers).toEqual(expect.arrayContaining([{ code: 'REQUIRED_NOT_COVERED', criterionId: root.required }]));
        await decision(a, root, { ...scope(command), decision: 'APPROVE' }).expect(409);
      }
      command = await complete(root, command); command = await finding(a, root, command, severity);
      if (['HIGH', 'CRITICAL'].includes(severity)) {
        expect((await review(a, root)).approvalBlockers).toEqual(expect.arrayContaining([{ code: 'UNRESOLVED_HIGH_CRITICAL' }]));
        await decision(a, root, { ...scope(command), decision: 'APPROVE' }).expect(409);
      } else await decision(a, root, { ...scope(command), decision: 'APPROVE' }).expect(200);
    }
  });
  it('preserves takeover provenance and requires a separate confirmation for every inherited assessment', async () => {
    const root = await proposal();
    let command: ReviewCommandResponse = await assess(a, root, await claim(a, root), root.required, { evidenceIds: [root.evidence] });
    command = await assess(a, root, command, root.optional, { status: 'NOT_APPLICABLE', rationale: 'Optional inherited rationale.', evidenceIds: [root.evidence] });
    const inherited = (await review(a, root)).coverage;
    const dropped = (await a.agent.post(`/api/proposals/${root.id}/drop`).set('x-csrf-token', a.token).send(scope(command)).expect(200)).body as ReviewCommandResponse;
    const replacement = await claim(b, root, dropped.version); command = replacement;
    expect((await review(b, root)).coverage.every((item) => !item.confirmed && item.actor.id === ids.a)).toBe(true);
    for (const source of inherited) {
      await decision(b, root, { ...scope(command), decision: 'APPROVE' }).expect(409);
      command = coverageCommandResponseSchema.parse((await b.agent.put(`/api/proposals/${root.id}/coverage/${source.criterionId}`).set('x-csrf-token', b.token)
        .send({ ...scope(command), operation: 'CONFIRM', sourceCoverageId: source.id }).expect(200)).body);
      expect((command as ReturnType<typeof coverageCommandResponseSchema.parse>).coverage).toMatchObject({ actor: { id: ids.b }, sourceCoverageId: source.id, status: source.status, evidenceIds: source.evidenceIds, rationale: source.rationale });
    }
    expect((await review(b, root)).approvalBlockers).toEqual([]);
    await decision(b, root, { ...scope(command), decision: 'APPROVE' }).expect(200);
    const history = await b.agent.get(`/api/proposals/${root.id}/coverage-history?limit=1`).expect(200);
    expect(history.body.items).toHaveLength(1); expect(history.body.nextCursor).toEqual(expect.any(String));
    const second = await b.agent.get(`/api/proposals/${root.id}/coverage-history?limit=3&cursor=${encodeURIComponent(history.body.nextCursor as string)}`).expect(200);
    expect(second.body.items).toHaveLength(3); expect(second.body.nextCursor).toBeNull();
    expect(new Set([history.body.items[0].id, ...second.body.items.map((item: { id: string }) => item.id)]).size).toBe(4);
    await b.agent.get(`/api/proposals/${root.id}/coverage-history?criterionId=${root.required}&cursor=${encodeURIComponent(history.body.nextCursor as string)}`).expect(422);
    for (const path of ['review', 'findings', 'decisions', 'coverage-history']) await a.agent.get(`/api/proposals/${root.id}/${path}`).expect(403);
    await decision(a, root, { ...scope(replacement), decision: 'APPROVE' }).expect(403);
  });
  it('preserves inherited finding origin with reasoned severity/resolve/reopen transitions and append-only amendments', async () => {
    const root = await proposal(); const created = await finding(a, root, await claim(a, root));
    const dropped = (await a.agent.post(`/api/proposals/${root.id}/drop`).set('x-csrf-token', a.token).send(scope(created)).expect(200)).body as ReviewCommandResponse;
    let command = await claim(b, root, dropped.version);
    await a.agent.post(`/api/findings/${created.finding.id}/transitions`).set('x-csrf-token', a.token).send({ ...scope(command), operation: 'RESOLVE', reason: 'Former reviewer.' }).expect(403);
    await a.agent.post(`/api/findings/${created.finding.id}/amendments`).set('x-csrf-token', a.token).send({ ...scope(command), description: 'Former reviewer.', reason: 'Reason.' }).expect(403);
    for (const extra of [{ operation: 'CHANGE_SEVERITY', severity: 'MEDIUM' }, { operation: 'RESOLVE' }, { operation: 'REOPEN' }]) {
      await b.agent.post(`/api/findings/${created.finding.id}/transitions`).set('x-csrf-token', b.token).send({ ...scope(command), ...extra }).expect(422);
      const response = findingEventCommandResponseSchema.parse((await b.agent.post(`/api/findings/${created.finding.id}/transitions`).set('x-csrf-token', b.token)
        .send({ ...scope(command), ...extra, reason: `Human reason for ${extra.operation}.` }).expect(200)).body);
      expect(response.event.actor.id).toBe(ids.b); command = response;
    }
    const amended = findingEventCommandResponseSchema.parse((await b.agent.post(`/api/findings/${created.finding.id}/amendments`).set('x-csrf-token', b.token)
      .send({ ...scope(command), description: 'Appended clarification.', reason: 'Clarifies original concern.' }).expect(200)).body);
    expect(amended.event.operation).toBe('AMEND');
    const result = findingsResponseSchema.parse((await b.agent.get(`/api/proposals/${root.id}/findings`).expect(200)).body);
    expect(result.items[0]).toMatchObject({ actor: { id: ids.a }, description: 'Original immutable description.', severity: 'HIGH', currentSeverity: 'MEDIUM', status: 'OPEN', assignmentId: created.assignmentId });
    const history = await b.agent.get(`/api/proposals/${root.id}/findings/${created.finding.id}/history?limit=2`).expect(200);
    expect(history.body.items).toHaveLength(2); expect(history.body.nextCursor).toEqual(expect.any(String));
    const next = await b.agent.get(`/api/proposals/${root.id}/findings/${created.finding.id}/history?limit=2&cursor=${encodeURIComponent(history.body.nextCursor as string)}`).expect(200);
    expect(next.body.items).toHaveLength(2); expect(next.body.items[1]).toMatchObject({ operation: 'AMEND', description: 'Appended clarification.' });
    const timeline = await b.agent.get(`/api/proposals/${root.id}/activity`).expect(200);
    expect(timeline.body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'FINDING_CREATED', summary: expect.stringContaining(created.finding.id), reason: null }),
      expect.objectContaining({ action: 'FINDING_TRANSITIONED', summary: expect.stringContaining(created.finding.id), reason: 'Human reason for CHANGE_SEVERITY.' }),
      expect.objectContaining({ action: 'FINDING_AMENDED', summary: expect.stringContaining(created.finding.id), reason: 'Clarifies original concern.' }),
    ]));
    expect(JSON.stringify(timeline.body)).not.toMatch(/Original immutable description|Appended clarification|inputHash|templateVersion|rawPrompt|workingDraft/);
    await b.agent.delete(`/api/findings/${created.finding.id}`).set('x-csrf-token', b.token).expect(404);
    await expect(database.client.reviewFinding.update({ where: { id: created.finding.id }, data: { description: 'Silent rewrite' } })).rejects.toThrow();
    await expect(database.client.findingEvent.deleteMany({ where: { findingId: created.finding.id } })).rejects.toThrow();
  });
  it('request-changes needs a finding or note, accepts incomplete coverage and remains final after drop/reclaim', async () => {
    const root = await proposal(); const claimed = await claim(a, root);
    await decision(a, root, { ...scope(claimed), decision: 'REQUEST_CHANGES' }).expect(422);
    const result = decisionCommandResponseSchema.parse((await decision(a, root, { ...scope(claimed), decision: 'REQUEST_CHANGES', note: 'Please address the missing behavior.' }).expect(200)).body);
    expect(result.state).toBe('CHANGES_REQUESTED'); expect((await review(a, root)).coverage).toEqual([]);
    expect((await a.agent.get(`/api/proposals/${root.id}/activity`).expect(200)).body.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ action: 'CHANGES_REQUESTED', reason: 'Please address the missing behavior.' }),
    ]));
    await decision(a, root, { ...scope(result), decision: 'REQUEST_CHANGES', note: 'Second decision.' }).expect(409);
    const edited = await assess(a, root, result);
    const dropped = (await a.agent.post(`/api/proposals/${root.id}/drop`).set('x-csrf-token', a.token).send(scope(edited)).expect(200)).body as ReviewCommandResponse;
    const replacement = await claim(b, root, dropped.version); expect(replacement.state).toBe('CHANGES_REQUESTED');
    await decision(b, root, { ...scope(replacement), decision: 'APPROVE' }).expect(409);
    await decision(b, root, { ...scope(replacement), decision: 'REQUEST_CHANGES', note: 'Cannot repeat final round.' }).expect(409);
    expect((await b.agent.get(`/api/proposals/${root.id}/decisions`).expect(200)).body.items).toHaveLength(1);
    const withFinding = await proposal(); const concern = await finding(a, withFinding, await claim(a, withFinding));
    await decision(a, withFinding, { ...scope(concern), decision: 'REQUEST_CHANGES' }).expect(200);
  });
  it('new revision has fresh coverage and decision, carries open and resolved findings, and rejects the stale revision/root/generation', async () => {
    const root = await proposal(); let command: ReviewCommandResponse = await complete(root, await claim(a, root));
    const open = await finding(a, root, command, 'CRITICAL'); command = open;
    const resolved = await finding(a, root, command, 'HIGH'); command = resolved;
    command = findingEventCommandResponseSchema.parse((await a.agent.post(`/api/findings/${resolved.finding.id}/transitions`).set('x-csrf-token', a.token)
      .send({ ...scope(command), operation: 'RESOLVE', reason: 'Already corrected.' }).expect(200)).body);
    const old = command;
    const requested = decisionCommandResponseSchema.parse((await decision(a, root, { ...scope(command), decision: 'REQUEST_CHANGES' }).expect(200)).body);
    const current = await database.client.$transaction(async (tx) => {
      const next = await revision(tx, root.id, 2);
      await tx.reviewAssignment.update({ where: { id: requested.assignmentId }, data: { status: 'CLOSED', endReason: 'REVISION_REPLACED', endedAt: new Date(), version: 1 } });
      const assignment = await tx.reviewAssignment.create({ data: { proposalId: root.id, revisionId: next.revisionId, reviewerId: ids.a } });
      await tx.changeProposal.update({ where: { id: root.id }, data: { currentRevisionId: next.revisionId, currentAssignmentId: assignment.id, state: 'IN_REVIEW', version: requested.version + 1 } });
      return { root: next, command: { proposalId: root.id, revisionId: next.revisionId, assignmentId: assignment.id, assignmentVersion: assignment.version, version: requested.version + 1, state: 'IN_REVIEW' as const } };
    });
    const fresh = await review(a, current.root); expect(fresh.coverage).toEqual([]);
    expect(fresh.approvalBlockers).toEqual(expect.arrayContaining([{ code: 'UNRESOLVED_HIGH_CRITICAL' }]));
    const inherited = findingsResponseSchema.parse((await a.agent.get(`/api/proposals/${root.id}/findings`).expect(200)).body).items;
    expect(inherited.find((item) => item.id === open.finding.id)).toMatchObject({ status: 'OPEN', revisionId: root.revisionId });
    expect(inherited.find((item) => item.id === resolved.finding.id)).toMatchObject({ status: 'RESOLVED', revisionId: root.revisionId });
    expect((await review(a, root, `?revisionId=${root.revisionId}`)).coverage).toHaveLength(2);
    for (const stale of [scope(old), { ...scope(current.command), revisionId: root.revisionId }, { ...scope(current.command), expectedAssignmentVersion: 1 }]) {
      await decision(a, root, { ...stale, decision: 'APPROVE' }).expect(409);
      await a.agent.put(`/api/proposals/${root.id}/coverage/${current.root.required}`).set('x-csrf-token', a.token)
        .send({ ...stale, operation: 'ASSESS', status: 'COVERED' }).expect(409);
    }
    const reopened = findingEventCommandResponseSchema.parse((await a.agent.post(`/api/findings/${resolved.finding.id}/transitions`).set('x-csrf-token', a.token)
      .send({ ...scope(current.command), operation: 'REOPEN', reason: 'The issue recurred in revision two.' }).expect(200)).body);
    await decision(a, root, { ...scope(reopened), decision: 'REQUEST_CHANGES' }).expect(200);
    const decisionPage = await a.agent.get(`/api/proposals/${root.id}/decisions?limit=1`).expect(200);
    const nextDecisions = await a.agent.get(`/api/proposals/${root.id}/decisions?limit=1&cursor=${encodeURIComponent(decisionPage.body.nextCursor as string)}`).expect(200);
    expect(decisionPage.body.items[0].revisionId).toBe(root.revisionId); expect(nextDecisions.body.items[0].revisionId).toBe(current.root.revisionId);
    expect(nextDecisions.body.nextCursor).toBeNull();
    expect((await database.client.reviewAssignment.findUniqueOrThrow({ where: { id: current.command.assignmentId } })).reviewerId).toBe(ids.a);
  });
  it.each(['APPROVED', 'IN_RELEASE', 'RELEASED'] as const)('freezes every ordinary mutation in %s', async (state) => {
    const root = await proposal(); const created = await finding(a, root, await claim(a, root), 'LOW');
    await database.client.changeProposal.update({ where: { id: root.id }, data: { state } });
    const body = scope(created);
    await a.agent.put(`/api/proposals/${root.id}/coverage/${root.required}`).set('x-csrf-token', a.token).send({ ...body, operation: 'ASSESS', status: 'COVERED' }).expect(409);
    await a.agent.post(`/api/proposals/${root.id}/findings`).set('x-csrf-token', a.token).send({ ...body, severity: 'LOW', description: 'Frozen write.' }).expect(409);
    await a.agent.post(`/api/findings/${created.finding.id}/transitions`).set('x-csrf-token', a.token).send({ ...body, operation: 'RESOLVE', reason: 'Frozen write.' }).expect(409);
    await a.agent.post(`/api/findings/${created.finding.id}/amendments`).set('x-csrf-token', a.token).send({ ...body, description: 'Frozen write.', reason: 'Reason.' }).expect(409);
    await decision(a, root, { ...body, decision: 'REQUEST_CHANGES', note: 'Frozen write.' }).expect(409);
    expect((await review(a, root)).editable).toBe(false);
  });
  it('separates unresolved-severity queue matches and binds cursors to the selected severity', async () => {
    const first = await proposal(); const second = await proposal(); const third = await proposal();
    const firstFinding = await finding(a, first, await claim(a, first), 'HIGH');
    await finding(a, second, await claim(a, second), 'HIGH');
    const resolved = await finding(a, third, await claim(a, third), 'HIGH');
    await a.agent.post(`/api/findings/${resolved.finding.id}/transitions`).set('x-csrf-token', a.token)
      .send({ ...scope(resolved), operation: 'RESOLVE', reason: 'Resolved concerns do not match.' }).expect(200);
    const page = await a.agent.get('/api/reviews/assignments?severity=HIGH&limit=1').expect(200);
    expect(page.body.items).toHaveLength(1); expect(page.body.nextCursor).toEqual(expect.any(String));
    const next = await a.agent.get(`/api/reviews/assignments?severity=HIGH&limit=1&cursor=${encodeURIComponent(page.body.nextCursor as string)}`).expect(200);
    expect(new Set([page.body.items[0].id, next.body.items[0].id])).toEqual(new Set([first.id, second.id])); expect(next.body.nextCursor).toBeNull();
    await a.agent.get(`/api/reviews/assignments?severity=LOW&limit=1&cursor=${encodeURIComponent(page.body.nextCursor as string)}`).expect(422);
    expect((await b.agent.get('/api/reviews/assignments?severity=HIGH').expect(200)).body.items).toEqual([]);
    await a.agent.post(`/api/findings/${firstFinding.finding.id}/transitions`).set('x-csrf-token', a.token)
      .send({ ...scope(firstFinding), operation: 'CHANGE_SEVERITY', severity: 'LOW', reason: 'Reassessed impact.' }).expect(200);
    expect((await a.agent.get('/api/reviews/assignments?severity=LOW').expect(200)).body.items.map((item: { id: string }) => item.id)).toEqual([first.id]);
  });
  it('serializes identical retries, binds changed bodies, preserves immutable decisions and reauthorizes every replay', async () => {
    const root = await proposal(); const command = await complete(root, await claim(a, root));
    const key = randomUUID(); const body = { ...scope(command), decision: 'APPROVE' };
    const results = await Promise.all([decision(a, root, body, key), decision(a, root, body, key)]);
    expect(results.map((item) => item.status)).toEqual([200, 200]); expect(results[0]!.body).toEqual(results[1]!.body);
    const replay = await decision(a, root, body, key).expect(200); expect(replay.body).toEqual(results[0]!.body);
    await decision(a, root, { decision: 'APPROVE', assignmentId: body.assignmentId, expectedAssignmentVersion: body.expectedAssignmentVersion,
      revisionId: body.revisionId, expectedVersion: body.expectedVersion }, key).expect(200);
    await a.agent.post(`/api/proposals/${root.id}/decision`).set('Idempotency-Key', key).send(body).expect(403);
    await decision(a, root, { ...body, note: 'Changed body' }, key).expect(409);
    expect(await database.client.reviewDecision.count({ where: { proposalId: root.id } })).toBe(1);
    expect(await database.client.reviewIdempotency.count({ where: { proposalId: root.id } })).toBe(1);
    const storedKey = await database.client.reviewIdempotency.findFirstOrThrow({ where: { proposalId: root.id } });
    expect(storedKey.keyHash).not.toBe(key); expect(storedKey.keyHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedKey.expiresAt.getTime() - storedKey.createdAt.getTime()).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(storedKey.expiresAt.getTime() - storedKey.createdAt.getTime()).toBeLessThan(24 * 60 * 60 * 1000 + 60_000);
    const activityRows = await database.client.proposalActivity.findMany({ where: { proposalId: root.id } });
    expect(activityRows).toHaveLength(4); // claim, two assessments, one decision
    const decisionId = results[0]!.body.decision.id as string;
    await expect(database.client.reviewDecision.update({ where: { id: decisionId }, data: { note: 'Rewrite history' } })).rejects.toThrow();
    await expect(database.client.coverageAssessment.updateMany({ where: { proposalId: root.id }, data: { status: 'NOT_COVERED' } })).rejects.toThrow();
    await expect(database.client.coverageAssessment.deleteMany({ where: { proposalId: root.id } })).rejects.toThrow();
    await administration.disable(`${prefix}-a`);
    expect(await database.client.changeProposal.findUniqueOrThrow({ where: { id: root.id } })).toMatchObject({ state: 'APPROVED', currentAssignmentId: command.assignmentId });
    expect(await database.client.reviewDecision.findUniqueOrThrow({ where: { id: decisionId } })).toMatchObject({ decision: 'APPROVE' });
    await decision(a, root, body, key).expect(401);
  });
  it('requires authentication, role and CSRF before all manual routes, including replay', async () => {
    const root = await proposal(); const command = await claim(a, root); const owner = await login('owner');
    const paths = ['review', 'findings', 'decisions', 'coverage-history', 'findings/unknown/history'];
    for (const path of paths) {
      await request(app.getHttpServer()).get(`/api/proposals/${root.id}/${path}`).expect(401);
      await owner.agent.get(`/api/proposals/${root.id}/${path}`).expect(403);
      await b.agent.get(`/api/proposals/${root.id}/${path}`).expect(403);
    }
    await a.agent.post(`/api/proposals/${root.id}/decision`).set('Idempotency-Key', randomUUID()).send({ ...scope(command), decision: 'REQUEST_CHANGES', note: 'Human note' }).expect(403);
    await a.agent.post(`/api/proposals/${root.id}/decision`).set('x-csrf-token', a.token).send({ ...scope(command), decision: 'REQUEST_CHANGES', note: 'Human note' }).expect(422);
    const noCSRF = await a.agent.put(`/api/proposals/${root.id}/coverage/${root.required}`).send({ ...scope(command), operation: 'ASSESS', status: 'COVERED' }).expect(403);
    expect(noCSRF.body).toMatchObject({ code: 'FORBIDDEN', correlationId: expect.any(String) });
    expect((await review(a, root)).coverage).toEqual([]);
  });
  it('replay cannot reveal a committed response after assignment loss and expiry cannot duplicate a decision', async () => {
    const root = await proposal(); const command = await claim(a, root);
    const key = randomUUID(); const body = { ...scope(command), decision: 'REQUEST_CHANGES', note: 'Request without completed coverage.' };
    const result = decisionCommandResponseSchema.parse((await decision(a, root, body, key).expect(200)).body);
    const dropped = (await a.agent.post(`/api/proposals/${root.id}/drop`).set('x-csrf-token', a.token).send(scope(result)).expect(200)).body as ReviewCommandResponse;
    const reclaimed = await claim(a, root, dropped.version);
    await decision(a, root, body, key).expect(409);
    const redropped = (await a.agent.post(`/api/proposals/${root.id}/drop`).set('x-csrf-token', a.token).send(scope(reclaimed)).expect(200)).body as ReviewCommandResponse;
    await claim(b, root, redropped.version);
    await decision(a, root, body, key).expect(403);
    const history = await b.agent.get(`/api/proposals/${root.id}/decisions`).expect(200);
    expect(history.body.items[0]).toMatchObject({ actor: { id: ids.a }, note: body.note });
    expect(JSON.stringify(history.body)).not.toMatch(/passwordHash|inputHash|templateVersion|rawPrompt|workingDraft/);
    const expiring = await proposal(); const claimed = await claim(a, expiring); const expiredKey = randomUUID();
    const expiredBody = { ...scope(claimed), decision: 'REQUEST_CHANGES', note: 'A different completed command.' };
    await decision(a, expiring, expiredBody, expiredKey).expect(200);
    await database.client.reviewIdempotency.updateMany({ where: { proposalId: expiring.id }, data: { expiresAt: new Date('2000-01-01') } });
    await decision(a, expiring, expiredBody, expiredKey).expect(409);
    expect(await database.client.reviewDecision.count({ where: { proposalId: expiring.id } })).toBe(1);
  });
  it('rolls back assessment/finding/transition/amendment/decision and idempotency when transactional activity fails', async () => {
    const root = await proposal(); let command = await claim(a, root);
    const rootBefore = await database.client.changeProposal.findUniqueOrThrow({ where: { id: root.id } });
    const fail = () => jest.spyOn(activity, 'append').mockRejectedValueOnce(new Error('Synthetic activity storage failure'));
    fail(); await a.agent.put(`/api/proposals/${root.id}/coverage/${root.required}`).set('x-csrf-token', a.token).send({ ...scope(command), operation: 'ASSESS', status: 'COVERED' }).expect(500);
    expect(await database.client.coverageAssessment.count()).toBe(0);
    fail(); await a.agent.post(`/api/proposals/${root.id}/findings`).set('x-csrf-token', a.token).send({ ...scope(command), severity: 'LOW', description: 'Must roll back.' }).expect(500);
    expect(await database.client.reviewFinding.count()).toBe(0);
    expect(await database.client.changeProposal.findUniqueOrThrow({ where: { id: root.id } })).toEqual(rootBefore);
    const created = await finding(a, root, command, 'LOW'); command = created;
    for (const [path, extra] of [['transitions', { operation: 'RESOLVE', reason: 'Reason.' }], ['amendments', { description: 'Correction.', reason: 'Reason.' }]] as const) {
      fail(); await a.agent.post(`/api/findings/${created.finding.id}/${path}`).set('x-csrf-token', a.token).send({ ...scope(command), ...extra }).expect(500);
      expect(await database.client.findingEvent.count()).toBe(0);
    }
    const key = randomUUID(); const body = { ...scope(command), decision: 'REQUEST_CHANGES' };
    fail(); const rejected = await decision(a, root, body, key).expect(500); expect(JSON.stringify(rejected.body)).not.toContain('Synthetic activity');
    expect(await database.client.reviewDecision.count()).toBe(0); expect(await database.client.reviewIdempotency.count()).toBe(0);
    expect(await database.client.changeProposal.findUniqueOrThrow({ where: { id: root.id } })).toMatchObject({ state: 'IN_REVIEW', version: command.version });
    await decision(a, root, body, key).expect(200);
    expect(await database.client.proposalActivity.count({ where: { proposalId: root.id } })).toBe(3);
  });
  it('finding pages never hide approval blockers, reject cross-scope cursors and reauthorize later pages', async () => {
    const root = await proposal(); const other = await proposal(); let command: ReviewCommandResponse = await complete(root, await claim(a, root)); await claim(a, other);
    for (let index = 0; index < 21; index++) command = await finding(a, root, command, index === 20 ? 'CRITICAL' : 'LOW');
    const first = await a.agent.get(`/api/proposals/${root.id}/findings?limit=20`).expect(200);
    expect(first.body.items).toHaveLength(20); expect(first.body.items.every((item: { currentSeverity: string }) => item.currentSeverity === 'LOW')).toBe(true);
    expect((await review(a, root)).approvalBlockers).toEqual([{ code: 'UNRESOLVED_HIGH_CRITICAL' }]);
    await decision(a, root, { ...scope(command), decision: 'APPROVE' }).expect(409);
    const second = await a.agent.get(`/api/proposals/${root.id}/findings?limit=20&cursor=${encodeURIComponent(first.body.nextCursor as string)}`).expect(200);
    expect(second.body.items).toHaveLength(1); expect(second.body.items[0].currentSeverity).toBe('CRITICAL');
    await a.agent.get(`/api/proposals/${other.id}/findings?limit=20&cursor=${encodeURIComponent(first.body.nextCursor as string)}`).expect(422);
    await a.agent.post(`/api/proposals/${root.id}/drop`).set('x-csrf-token', a.token).send(scope(command)).expect(200);
    await a.agent.get(`/api/proposals/${root.id}/findings?limit=20&cursor=${encodeURIComponent(first.body.nextCursor as string)}`).expect(403);
  });
  it('assignment generation prevents old forms reviving after same-reviewer reclaim and rejects unrelated confirmation sources', async () => {
    const root = await proposal(); const other = await proposal();
    const original = await assess(a, root, await claim(a, root));
    const changed = await assess(a, root, original, root.required, { rationale: 'Replacement assessment.' });
    const foreign = await assess(a, other, await claim(a, other));
    const dropped = (await a.agent.post(`/api/proposals/${root.id}/drop`).set('x-csrf-token', a.token).send(scope(changed)).expect(200)).body as ReviewCommandResponse;
    const reclaimed = await claim(a, root, dropped.version);
    const stale = { ...scope(original), expectedVersion: reclaimed.version };
    await a.agent.put(`/api/proposals/${root.id}/coverage/${root.required}`).set('x-csrf-token', a.token)
      .send({ ...stale, operation: 'ASSESS', status: 'COVERED' }).expect(409);
    await a.agent.post(`/api/proposals/${root.id}/findings`).set('x-csrf-token', a.token)
      .send({ ...stale, severity: 'LOW', description: 'Old assignment form.' }).expect(409);
    await decision(a, root, { ...stale, decision: 'REQUEST_CHANGES', note: 'Old assignment form.' }).expect(409);
    for (const sourceCoverageId of [original.coverage.id, foreign.coverage.id]) {
      await a.agent.put(`/api/proposals/${root.id}/coverage/${root.required}`).set('x-csrf-token', a.token)
        .send({ ...scope(reclaimed), operation: 'CONFIRM', sourceCoverageId }).expect(409);
    }
    const untouched = await review(a, root);
    expect(untouched.version).toBe(reclaimed.version); expect(untouched.coverage[0]).toMatchObject({ id: changed.coverage.id, confirmed: false });
  });
  it('disable releases unfinished work atomically while preserving human findings, coverage and decisions for the next assignee', async () => {
    const root = await proposal(); let command: ReviewCommandResponse = await assess(a, root, await claim(a, root));
    const created = await finding(a, root, command); command = created;
    const requested = decisionCommandResponseSchema.parse((await decision(a, root, { ...scope(command), decision: 'REQUEST_CHANGES' }).expect(200)).body);
    expect(await administration.disable(`${prefix}-a`)).toEqual({ released: 1 });
    expect(await database.client.changeProposal.findUniqueOrThrow({ where: { id: root.id } })).toMatchObject({ state: 'CHANGES_REQUESTED', currentAssignmentId: null });
    for (const path of ['review', 'findings', 'decisions', 'coverage-history']) await a.agent.get(`/api/proposals/${root.id}/${path}`).expect(401);
    const replacement = await claim(b, root, requested.version + 1);
    expect((await review(b, root)).coverage[0]).toMatchObject({ actor: { id: ids.a }, confirmed: false });
    expect((await b.agent.get(`/api/proposals/${root.id}/findings`).expect(200)).body.items[0]).toMatchObject({ id: created.finding.id, actor: { id: ids.a }, status: 'OPEN' });
    expect((await b.agent.get(`/api/proposals/${root.id}/decisions`).expect(200)).body.items[0]).toMatchObject({ actor: { id: ids.a }, decision: 'REQUEST_CHANGES' });
    await decision(b, root, { ...scope(replacement), decision: 'APPROVE' }).expect(409);
    expect((await b.agent.get(`/api/proposals/${root.id}/activity`).expect(200)).body.items).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'ASSIGNMENT_RELEASED' })]));
  });
});
