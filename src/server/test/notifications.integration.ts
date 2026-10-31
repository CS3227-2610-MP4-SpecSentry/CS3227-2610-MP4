import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { notificationsResponseSchema, type ReviewCommandResponse } from '@specsentry/shared';
import { AppModule } from '../src/app.module';
import { ActivityService } from '../src/activity/activity.service';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { configureHttp } from '../src/http';
import { hashPassword } from '../src/identity/identity.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import type { Prisma } from '../src/generated/prisma/client';

describe('PostgreSQL exact-revision notifications (REQ-REV-008; SEC-I2-003/006/007)', () => {
  let app: NestExpressApplication; let database: DatabaseService; let notifications: NotificationsService; let activity: ActivityService;
  const prefix = `notice-${randomUUID()}`;
  const ids = { owner: `${prefix}-owner`, a: `${prefix}-a`, b: `${prefix}-b` };
  const password = 'synthetic-notification-test-password';
  type Session = { agent: ReturnType<typeof request.agent>; token: string };
  type Fixture = { id: string; revisionId: string; assignmentId: string; noticeId: string };
  let a: Session; let b: Session; let owner: Session;
  async function clean() {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL is required');
    // The coordinator serializes this suite with every other disposable-DB suite.
    await database.client.$executeRawUnsafe('TRUNCATE "ReleasePublicationSnapshot", "ReleaseSmokeTest", "ReleaseCandidateMember", "Notification", "ApprovalInvalidation", "ReleaseCandidate", "WorkingRevision", "CoverageEvidence", "CoverageAssessment", "FindingEvent", "ReviewFinding", "ReviewDecision", "ReviewIdempotency", "CriterionEvidenceLink", "ProposalActivity", "ReviewAssignment", "AcceptanceCriterion", "TestEvidence", "ProposalRevision", "ChangeProposal"');
  }
  async function login(name: keyof typeof ids): Promise<Session> {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/auth/csrf').expect(200);
    const response = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken)
      .send({ username: `${prefix}-${name}`, password }).expect(200);
    return { agent, token: response.body.csrfToken as string };
  }
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL is required');
    const module = await Test.createTestingModule({ imports: [AppModule.register(readConfig({ NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL,
      SESSION_SECRET: 'notification-test-secret-at-least-32-characters' }))] }).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false }); configureHttp(app); await app.init();
    database = app.get(DatabaseService); notifications = app.get(NotificationsService); activity = app.get(ActivityService);
    const passwordHash = await hashPassword(password);
    await database.client.userAccount.createMany({ data: Object.entries(ids).map(([name, id]) => ({ id, username: `${prefix}-${name}`, passwordHash,
      role: name === 'owner' ? 'CONTRIBUTOR' as const : 'REVIEWER' as const })) });
  });
  beforeEach(async () => {
    await clean();
    await database.client.userAccount.updateMany({ where: { id: { in: [ids.a, ids.b] } }, data: { enabled: true, version: 1, role: 'REVIEWER' } });
    a = await login('a'); b = await login('b'); owner = await login('owner');
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (database) {
      await clean();
      await database.client.authSession.deleteMany({ where: { OR: Object.values(ids).map(id => ({ data: { contains: id } })) } });
      await database.client.securityEvent.deleteMany({ where: { actorId: { in: Object.values(ids) } } });
      await database.client.userAccount.deleteMany({ where: { id: { in: Object.values(ids) } } });
    }
    await app?.close();
  });
  async function revision(tx: Prisma.TransactionClient, proposalId: string, number: number) {
    return tx.proposalRevision.create({ data: { proposalId, number, summary: 'Sensitive submitted summary', problem: 'Sensitive problem', constraints: '',
      expectedBehavior: 'Expected behavior', diffText: '+ sensitive diff', criteria: { create: { stableKey: 'required', statement: 'Required behavior' } } } });
  }
  async function fixture(recipientId = ids.a): Promise<Fixture> {
    return database.client.$transaction(async tx => {
      const root = await tx.changeProposal.create({ data: { ownerId: ids.owner, title: 'Sensitive title', state: 'IN_REVIEW', firstSubmittedAt: new Date() } });
      const rev = await revision(tx, root.id, 1);
      const assignment = await tx.reviewAssignment.create({ data: { proposalId: root.id, revisionId: rev.id, reviewerId: recipientId } });
      await tx.changeProposal.update({ where: { id: root.id }, data: { currentRevisionId: rev.id, currentAssignmentId: assignment.id } });
      const notice = await notifications.create(tx, { recipientId, kind: 'NEW_REVISION', proposalId: root.id, revisionId: rev.id, assignmentId: assignment.id }, ids.owner);
      return { id: root.id, revisionId: rev.id, assignmentId: assignment.id, noticeId: notice.id };
    });
  }
  const ackBody = (root: Fixture) => ({ kind: 'NEW_REVISION', revisionId: root.revisionId, assignmentId: root.assignmentId, expectedAssignmentVersion: 0 });
  const acknowledge = (session: Session, id: string, body: object) => session.agent.post(`/api/notifications/${id}/acknowledge`).set('x-csrf-token', session.token).send(body);
  async function replace(root: Fixture): Promise<Fixture> {
    return database.client.$transaction(tx => replacement(tx, root));
  }
  async function replacement(tx: Prisma.TransactionClient, root: Fixture): Promise<Fixture> {
      await tx.reviewAssignment.update({ where: { id: root.assignmentId }, data: { status: 'CLOSED', endReason: 'REVISION_REPLACED', endedAt: new Date(), version: { increment: 1 } } });
      const rev = await revision(tx, root.id, 2);
      const assignment = await tx.reviewAssignment.create({ data: { proposalId: root.id, revisionId: rev.id, reviewerId: ids.a } });
      await tx.changeProposal.update({ where: { id: root.id }, data: { currentRevisionId: rev.id, currentAssignmentId: assignment.id, version: { increment: 1 } } });
      const notice = await notifications.create(tx, { recipientId: ids.a, kind: 'NEW_REVISION', proposalId: root.id, revisionId: rev.id, assignmentId: assignment.id }, ids.owner);
      return { id: root.id, revisionId: rev.id, assignmentId: assignment.id, noticeId: notice.id };
  }
  async function withdraw(root: Fixture, realEvent = true) {
    return database.client.$transaction(async tx => {
      await tx.reviewAssignment.update({ where: { id: root.assignmentId }, data: { status: 'CLOSED', endReason: 'WITHDRAWN', endedAt: new Date(), version: { increment: 1 } } });
      await tx.changeProposal.update({ where: { id: root.id }, data: { state: 'WITHDRAWN', currentAssignmentId: null, version: { increment: 1 } } });
      if (realEvent) await activity.append(tx, { proposalId: root.id, revisionId: root.revisionId, assignmentId: root.assignmentId,
        actorId: ids.owner, action: 'WITHDRAWN', summary: 'Proposal withdrawn.', reason: 'Sensitive withdrawal reason' });
      return notifications.create(tx, { recipientId: ids.a, kind: 'WITHDRAWN', proposalId: root.id, revisionId: root.revisionId, assignmentId: root.assignmentId }, ids.owner);
    });
  }
  it('filters inaccessible rows before a bounded stable recipient-scoped cursor page and never acknowledges on GET', async () => {
    const visible = [await fixture(), await fixture()];
    await fixture(ids.b);
    for (let i = 0; i < 3; i++) {
      const hidden = await fixture();
      await a.agent.post(`/api/proposals/${hidden.id}/drop`).set('x-csrf-token', a.token).send({ expectedVersion: 0,
        revisionId: hidden.revisionId, assignmentId: hidden.assignmentId, expectedAssignmentVersion: 0 }).expect(200);
    }
    const first = notificationsResponseSchema.parse((await a.agent.get('/api/notifications?limit=1').expect(200)).body);
    expect(first.items).toHaveLength(1); expect(first.nextCursor).toEqual(expect.any(String));
    const second = notificationsResponseSchema.parse((await a.agent.get(`/api/notifications?limit=1&cursor=${encodeURIComponent(first.nextCursor!)}`).expect(200)).body);
    expect(second.items).toHaveLength(1); expect(second.nextCursor).toBeNull();
    expect(new Set([...first.items, ...second.items].map(item => item.id))).toEqual(new Set(visible.map(item => item.noticeId)));
    await b.agent.get(`/api/notifications?cursor=${encodeURIComponent(first.nextCursor!)}`).expect(422);
    expect(await database.client.notification.count({ where: { readAt: { not: null } } })).toBe(0);
    await a.agent.get(`/api/notifications/${visible[0]!.noticeId}/acknowledge`).expect(404);
    await a.agent.get('/api/notifications?recipientId=other').expect(422);
  });
  it('acks only exact r1 using the current r2 assignment; stale submit/ack cannot clear r2 or advance business versions', async () => {
    const r1 = await fixture(); const r2 = await replace(r1);
    const before = await database.client.changeProposal.findUniqueOrThrow({ where: { id: r1.id } });
    await acknowledge(a, r1.noticeId, ackBody(r1)).expect(409);
    await acknowledge(a, r1.noticeId, ackBody(r2)).expect(409);
    await acknowledge(a, r1.noticeId, { ...ackBody(r2), revisionId: r1.revisionId }).expect(200);
    const read = await database.client.notification.findUniqueOrThrow({ where: { id: r1.noticeId } });
    expect(read.readAt).not.toBeNull();
    expect((await database.client.notification.findUniqueOrThrow({ where: { id: r2.noticeId } })).readAt).toBeNull();
    await acknowledge(a, r1.noticeId, { ...ackBody(r2), revisionId: r1.revisionId }).expect(200);
    expect((await database.client.notification.findUniqueOrThrow({ where: { id: r1.noticeId } })).readAt).toEqual(read.readAt);
    expect(await database.client.changeProposal.findUniqueOrThrow({ where: { id: r1.id } })).toEqual(before);
    expect((await database.client.reviewAssignment.findUniqueOrThrow({ where: { id: r2.assignmentId } })).version).toBe(0);
    await acknowledge(a, r2.noticeId, ackBody(r2)).expect(200);
    expect(await database.client.proposalActivity.count({ where: { action: 'NOTIFICATION_CREATED' } })).toBe(2);
    expect(await database.client.securityEvent.count({ where: { actorId: ids.a, action: 'NOTIFICATION_ACKNOWLEDGED' } })).toBe(3);
  });
  it('denies wrong recipient, CSRF, role and disabled account without changing notice state', async () => {
    const root = await fixture();
    await acknowledge(b, root.noticeId, ackBody(root)).expect(404);
    await acknowledge(owner, root.noticeId, ackBody(root)).expect(403);
    await owner.agent.get('/api/notifications').expect(403);
    await a.agent.post(`/api/notifications/${root.noticeId}/acknowledge`).send(ackBody(root)).expect(403);
    await acknowledge(a, root.noticeId, { ...ackBody(root), recipientId: ids.a }).expect(422);
    await a.agent.post(`/api/notifications/${root.noticeId}/acknowledge?read=true`).set('x-csrf-token', a.token).send(ackBody(root)).expect(422);
    await database.client.userAccount.update({ where: { id: ids.a }, data: { enabled: false, version: { increment: 1 } } });
    await a.agent.get('/api/notifications').expect(401);
    await acknowledge(a, root.noticeId, ackBody(root)).expect(401);
    expect((await database.client.notification.findUniqueOrThrow({ where: { id: root.noticeId } })).readAt).toBeNull();
  });
  it('serializes a concurrent submit before a waiting old-coordinate acknowledgement, preserving the new unread notice', async () => {
    const r1 = await fixture();
    let ready!: () => void; let release!: () => void;
    const locked = new Promise<void>(resolve => { ready = resolve; });
    const proceed = new Promise<void>(resolve => { release = resolve; });
    const submit = database.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "UserAccount" WHERE "id"=${ids.a} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "ChangeProposal" WHERE "id"=${r1.id} FOR UPDATE`;
      ready(); await proceed;
      return replacement(tx, r1);
    });
    await locked;
    const pendingAck = acknowledge(a, r1.noticeId, ackBody(r1)).then(response => response);
    release();
    const [r2, response] = await Promise.all([submit, pendingAck]);
    expect(response.status).toBe(409);
    expect(await database.client.notification.count({ where: { id: { in: [r1.noticeId, r2.noticeId] }, readAt: null } })).toBe(2);
    await acknowledge(a, r1.noticeId, { ...ackBody(r2), revisionId: r1.revisionId }).expect(200);
    expect((await database.client.notification.findUniqueOrThrow({ where: { id: r2.noticeId } })).readAt).toBeNull();
  });
  it('hides notices on drop/reassignment and rejects obsolete acknowledgement after reclaim', async () => {
    const root = await fixture();
    const dropped = (await a.agent.post(`/api/proposals/${root.id}/drop`).set('x-csrf-token', a.token).send({ expectedVersion: 0,
      revisionId: root.revisionId, assignmentId: root.assignmentId, expectedAssignmentVersion: 0 }).expect(200)).body as ReviewCommandResponse;
    expect((await a.agent.get('/api/notifications').expect(200)).body.items).toEqual([]);
    await acknowledge(a, root.noticeId, ackBody(root)).expect(403);
    const reclaimed = (await a.agent.post(`/api/proposals/${root.id}/claim`).set('x-csrf-token', a.token).send({ expectedVersion: dropped.version }).expect(200)).body as ReviewCommandResponse;
    await acknowledge(a, root.noticeId, ackBody(root)).expect(409);
    await acknowledge(a, root.noticeId, { ...ackBody(root), assignmentId: reclaimed.assignmentId, expectedAssignmentVersion: reclaimed.assignmentVersion }).expect(200);
  });
  it('exposes only an anchored recipient withdrawal status and never grants withdrawn content', async () => {
    const root = await fixture(); const notice = await withdraw(root);
    const result = (await a.agent.get('/api/notifications').expect(200)).body;
    expect(result.items).toEqual([{ id: notice.id, kind: 'WITHDRAWN', proposalId: root.id, createdAt: notice.createdAt.toISOString(), readAt: null }]);
    expect(JSON.stringify(result)).not.toMatch(/Sensitive|revisionId|assignmentId|title|author|reason|url|diffText/);
    expect((await b.agent.get('/api/notifications').expect(200)).body.items).toEqual([]);
    await acknowledge(b, notice.id, { kind: 'WITHDRAWN' }).expect(404);
    await acknowledge(a, root.noticeId, ackBody(root)).expect(403);
    await acknowledge(a, notice.id, { kind: 'WITHDRAWN' }).expect(200);
    for (const path of ['', '/revisions', '/activity', '/review']) await a.agent.get(`/api/proposals/${root.id}${path}`).expect(403);
  });
  it('rejects a forged withdrawal closure without an actual withdrawal event atomically', async () => {
    const root = await fixture();
    await expect(withdraw(root, false)).rejects.toThrow();
    expect((await database.client.changeProposal.findUniqueOrThrow({ where: { id: root.id } })).state).toBe('IN_REVIEW');
    expect(await database.client.notification.count({ where: { kind: 'WITHDRAWN' } })).toBe(0);
  });
  it('rolls lifecycle/activity/notice back for activity failure, duplicate notice insertion and later caller failure', async () => {
    const root = await fixture();
    const initial = await database.client.changeProposal.findUniqueOrThrow({ where: { id: root.id } });
    const activityCount = await database.client.proposalActivity.count();
    const input = { recipientId: ids.a, kind: 'NEW_REVISION' as const, proposalId: root.id, revisionId: root.revisionId, assignmentId: root.assignmentId };
    jest.spyOn(activity, 'append').mockRejectedValueOnce(new Error('injected activity failure'));
    await expect(database.client.$transaction(async tx => {
      await tx.changeProposal.update({ where: { id: root.id }, data: { version: { increment: 1 } } });
      await notifications.create(tx, input, ids.owner);
    })).rejects.toThrow('injected activity failure');
    await expect(database.client.$transaction(async tx => {
      await tx.changeProposal.update({ where: { id: root.id }, data: { version: { increment: 1 } } });
      await notifications.create(tx, input, ids.owner);
    })).rejects.toThrow();
    await expect(database.client.$transaction(async tx => {
      await tx.reviewAssignment.update({ where: { id: root.assignmentId }, data: { status: 'CLOSED', endReason: 'WITHDRAWN', endedAt: new Date() } });
      await tx.changeProposal.update({ where: { id: root.id }, data: { state: 'WITHDRAWN', currentAssignmentId: null, version: { increment: 1 } } });
      await activity.append(tx, { proposalId: root.id, revisionId: root.revisionId, assignmentId: root.assignmentId, actorId: ids.owner, action: 'WITHDRAWN', summary: 'Proposal withdrawn.' });
      await notifications.create(tx, { ...input, kind: 'WITHDRAWN' }, ids.owner);
      throw new Error('injected caller failure');
    })).rejects.toThrow('injected caller failure');
    expect(await database.client.changeProposal.findUniqueOrThrow({ where: { id: root.id } })).toEqual(initial);
    expect(await database.client.proposalActivity.count()).toBe(activityCount);
    expect(await database.client.notification.count()).toBe(1);
    await expect(database.client.notification.update({ where: { id: root.noticeId }, data: { recipientId: ids.b } })).rejects.toThrow();
  });
});
