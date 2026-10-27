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

describe('Owner/Maintainer submitted history and private draft boundary', () => {
  let app: NestExpressApplication; let db: DatabaseService;
  const prefix = `submitted-access-${randomUUID()}`;
  const password = 'synthetic-submitted-access-password';
  const roles = { owner: 'CONTRIBUTOR', stranger: 'CONTRIBUTOR', reviewer: 'REVIEWER', maintainer: 'RELEASE_MAINTAINER' } as const;
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable test DB required');
    const module = await Test.createTestingModule({ imports: [AppModule.register(readConfig({ NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL, SESSION_SECRET: 'synthetic-submitted-access-secret-32-characters' }))] }).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false }); configureHttp(app); await app.init(); db = app.get(DatabaseService);
    const passwordHash = await hashPassword(password);
    await db.client.userAccount.createMany({ data: Object.entries(roles).map(([name, role]) => ({ id: `${prefix}-${name}`, username: `${prefix}-${name}`, role, passwordHash })) });
  });
  afterAll(async () => {
    await db.client.$executeRawUnsafe('TRUNCATE "ReleasePublicationSnapshot", "ReleaseSmokeTest", "ReleaseCandidateMember", "Notification", "ApprovalInvalidation", "ReleaseCandidate", "WorkingRevision", "CoverageEvidence", "CoverageAssessment", "FindingEvent", "ReviewFinding", "ReviewDecision", "ReviewIdempotency", "CriterionEvidenceLink", "ProposalActivity", "ReviewAssignment", "AcceptanceCriterion", "TestEvidence", "ProposalRevision", "ChangeProposal"');
    await db.client.authSession.deleteMany({ where: { data: { contains: prefix } } });
    await db.client.securityEvent.deleteMany({ where: { actorId: { startsWith: prefix } } });
    await db.client.userAccount.deleteMany({ where: { id: { startsWith: prefix } } }); await app.close();
  });
  async function login(name: keyof typeof roles) {
    const agent = request.agent(app.getHttpServer()); const csrf = await agent.get('/api/auth/csrf').expect(200);
    const response = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken).send({ username: `${prefix}-${name}`, password }).expect(200);
    return { agent, token: response.body.csrfToken as string };
  }
  it('keeps working content private while owner and scoped Maintainer retain submitted/human history after withdrawal', async () => {
    const owner = await login('owner'); const stranger = await login('stranger'); const reviewer = await login('reviewer'); const maintainer = await login('maintainer');
    const content = { title: 'Public submitted title', summary: 'Public summary', problem: 'Submitted problem', constraints: '', expectedBehavior: 'Expected behavior',
      diffText: '--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-before\n+after\n', criteria: [{ statement: 'Required', required: true }], evidence: [] };
    const created = await owner.agent.post('/api/proposals').set('x-csrf-token', owner.token).send(content).expect(201);
    const id = created.body.proposalId as string;
    for (const session of [stranger, reviewer, maintainer]) {
      await session.agent.get(`/api/proposals/${id}/draft`).expect(403);
      await session.agent.get(`/api/proposals/${id}`).expect(403);
    }
    const submitted = await owner.agent.post(`/api/proposals/${id}/submit`).set('x-csrf-token', owner.token).set('Idempotency-Key', randomUUID())
      .send({ expectedVersion: created.body.version, workingRevisionId: created.body.workingRevisionId }).expect(200);
    const claimed = await reviewer.agent.post(`/api/proposals/${id}/claim`).set('x-csrf-token', reviewer.token).send({ expectedVersion: submitted.body.version }).expect(200);
    const finding = await reviewer.agent.post(`/api/proposals/${id}/findings`).set('x-csrf-token', reviewer.token).send({
      expectedVersion: claimed.body.version, revisionId: claimed.body.revisionId, assignmentId: claimed.body.assignmentId,
      expectedAssignmentVersion: claimed.body.assignmentVersion, severity: 'HIGH', description: 'Human concern' }).expect(201);
    const draft = await owner.agent.get(`/api/proposals/${id}/draft`).expect(200);
    const saved = await owner.agent.patch(`/api/proposals/${id}/draft`).set('x-csrf-token', owner.token).send({ expectedVersion: finding.body.version,
      content: { ...draft.body.content, title: 'PRIVATE UNSUBMITTED TITLE', summary: 'PRIVATE UNSUBMITTED SUMMARY', problem: 'PRIVATE DRAFT PROBLEM' } }).expect(200);
    for (const session of [owner, maintainer, reviewer]) {
      for (const path of ['', '/revisions', '/activity', '/findings', '/decisions', '/coverage-history']) {
        const response = await session.agent.get(`/api/proposals/${id}${path}`).expect(200);
        expect(JSON.stringify(response.body)).not.toContain('PRIVATE');
      }
    }
    for (const path of ['', '/revisions', '/activity', '/findings', '/decisions', '/coverage-history']) await stranger.agent.get(`/api/proposals/${id}${path}`).expect(403);
    await owner.agent.post(`/api/proposals/${id}/withdraw`).set('x-csrf-token', owner.token).send({ expectedVersion: saved.body.version, confirmed: true, reason: 'Withdraw safely' }).expect(200);
    for (const session of [owner, maintainer]) {
      const response = await session.agent.get(`/api/proposals/${id}`).expect(200); expect(response.body.state).toBe('WITHDRAWN');
      expect(response.body.assignment).toBeNull(); expect(response.body.revision.problem).toBe('Submitted problem');
    }
    await reviewer.agent.get(`/api/proposals/${id}`).expect(403);
  });
});
