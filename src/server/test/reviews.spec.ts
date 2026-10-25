import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MemoryStore } from 'express-session';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { configureHttp } from '../src/http';
import { IdentityService } from '../src/identity/identity.service';
import { PostgresSessionStore } from '../src/identity/session.store';
import { ReviewsService } from '../src/reviews/reviews.service';

describe('Reviewer HTTP authorization and validation (INT-01/07/11)', () => {
  let app: NestExpressApplication;
  const accounts = ['REVIEWER', 'CONTRIBUTOR', 'RELEASE_MAINTAINER'].map((role, index) => ({
    id: `http-review-${index}`, username: `http${index}`, role, enabled: true, version: 7,
  }));
  const service = { queue: jest.fn().mockResolvedValue({ items: [], nextCursor: null }),
    claim: jest.fn().mockResolvedValue({}), drop: jest.fn().mockResolvedValue({}), detail: jest.fn().mockResolvedValue({}),
    revisions: jest.fn().mockResolvedValue({ items: [], nextCursor: null }), timeline: jest.fn().mockResolvedValue({ items: [], nextCursor: null }) };
  const audit = jest.fn().mockResolvedValue({});
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule.register(readConfig({ NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost/test', SESSION_SECRET: 'review-http-synthetic-secret-at-least-32' }))] })
      .overrideProvider(DatabaseService).useValue({ client: { userAccount: { findUnique: async ({ where }: { where: { id: string } }) => accounts.find((account) => account.id === where.id) },
        securityEvent: { create: audit } } })
      .overrideProvider(PostgresSessionStore).useValue(new MemoryStore())
      .overrideProvider(IdentityService).useValue({ authenticate: async (username: string) => ({ status: 'success', account: accounts.find((account) => account.username === username) }) })
      .overrideProvider(ReviewsService).useValue(service).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false });
    configureHttp(app); await app.init();
  });
  afterAll(async () => app.close());
  async function login(index = 0) {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/auth/csrf');
    const response = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken).send({ username: `http${index}`, password: 'synthetic-password' }).expect(200);
    return { agent, token: response.body.csrfToken as string };
  }
  const reads = ['/api/review-pool', '/api/reviews/assignments', '/api/proposals/p', '/api/proposals/p/revisions', '/api/proposals/p/activity'];
  it('requires an enabled Reviewer session on every read and command', async () => {
    for (const url of reads) await request(app.getHttpServer()).get(url).expect(401);
    for (const index of [1, 2]) {
      const { agent, token } = await login(index);
      for (const url of reads) await agent.get(url).expect(403);
      for (const command of ['claim', 'drop']) await agent.post(`/api/proposals/p/${command}`).set('x-csrf-token', token).send({ expectedVersion: 0 }).expect(403);
    }
  });
  it('requires CSRF and rejects supplied reviewer identity, unexpected fields and malformed queries', async () => {
    const { agent, token } = await login();
    await agent.post('/api/proposals/p/claim').send({ expectedVersion: 0 }).expect(403);
    for (const body of [{ expectedVersion: 0, reviewerId: 'attacker' }, { expectedVersion: 2147483648 }, { expectedVersion: '1' }]) {
      await agent.post('/api/proposals/p/claim').set('x-csrf-token', token).send(body).expect(422);
    }
    await agent.post('/api/proposals/p/drop').set('x-csrf-token', token).send({ expectedVersion: 0 }).expect(422);
    for (const url of ['/api/review-pool?state=IN_REVIEW', '/api/review-pool?limit=1e2', '/api/review-pool?limit=1&limit=2',
      '/api/reviews/assignments?state=DRAFT', '/api/proposals/p?evidenceId=foreign', '/api/proposals/p/activity?limit=1', '/api/proposals/p/revisions?limit=101']) await agent.get(url).expect(422);
  });
  it('carries session account version into services and serves safe no-store errors', async () => {
    const { agent, token } = await login();
    const response = await agent.get('/api/review-pool').expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(service.queue).toHaveBeenLastCalledWith(expect.objectContaining({ accountId: accounts[0]!.id, accountVersion: 7 }), { limit: 20 });
    await agent.post('/api/proposals/p/claim').set('x-csrf-token', token).send({ expectedVersion: 1 }).expect(200);
    expect(service.claim).toHaveBeenLastCalledWith(expect.objectContaining({ accountVersion: 7 }), 'p', { expectedVersion: 1 });
    service.detail.mockRejectedValueOnce(new ForbiddenException('synthetic secret must stay hidden'));
    const rejected = await agent.get('/api/proposals/p').expect(403);
    expect(rejected.body).toEqual({ code: 'FORBIDDEN', message: 'Request could not be completed.', correlationId: expect.any(String) });
    expect(JSON.stringify(rejected.body)).not.toContain('synthetic secret');
  });
  it('F-004 audits each controller validation rejection once without raw input or service calls', async () => {
    const { agent, token } = await login();
    const secret = 'synthetic-private-input-must-never-be-audited';
    const invalidRequests = [
      () => agent.post('/api/proposals/p/claim').set('x-csrf-token', token).send({ expectedVersion: 0, reviewerId: secret }),
      () => agent.post('/api/proposals/p/drop').set('x-csrf-token', token).send({ revisionId: secret }),
      () => agent.get(`/api/review-pool?password=${secret}`),
      () => agent.get(`/api/reviews/assignments?state=${secret}`),
      () => agent.get(`/api/proposals/${secret.repeat(4)}`),
      () => agent.get(`/api/proposals/p?revisionId=${secret.repeat(4)}`),
      () => agent.get(`/api/proposals/p/revisions?cursor=${secret}&limit=0`),
      () => agent.get(`/api/proposals/p/activity?cursor=${secret}&unknown=${secret}`),
    ];
    for (const send of invalidRequests) {
      audit.mockClear(); Object.values(service).forEach((method) => method.mockClear());
      const response = await send().expect(422);
      expect(audit).toHaveBeenCalledTimes(1);
      expect(audit.mock.calls[0]![0]).toEqual({ data: { actorId: accounts[0]!.id,
        action: expect.stringMatching(/^REVIEW_(POOL|ASSIGNED|CLAIM|DROP|DETAIL|REVISIONS|ACTIVITY)_VALIDATION_REJECTED$/),
        target: expect.stringMatching(/^(review-pool|assigned-reviews|proposal-(claim|drop|detail|revisions|activity))$/),
        correlationId: response.body.correlationId, outcome: 'rejected' } });
      expect(JSON.stringify(audit.mock.calls)).not.toContain(secret);
      Object.values(service).forEach((method) => expect(method).not.toHaveBeenCalled());
    }
  });
  it('F-004 leaves guard rejections and valid/service-failing requests outside validation auditing', async () => {
    const { agent, token } = await login();
    audit.mockClear();
    await agent.post('/api/proposals/p/claim').send({ invalid: 'sensitive' }).expect(403);
    expect(audit).toHaveBeenCalledTimes(1);
    expect(audit.mock.calls[0]![0]).toMatchObject({ data: { action: 'CSRF_REJECTED' } });
    audit.mockClear();
    await agent.get('/api/review-pool').expect(200);
    await agent.get('/api/reviews/assignments').expect(200);
    await agent.get('/api/proposals/p').expect(200);
    await agent.get('/api/proposals/p/revisions').expect(200);
    await agent.get('/api/proposals/p/activity').expect(200);
    await agent.post('/api/proposals/p/claim').set('x-csrf-token', token).send({ expectedVersion: 0 }).expect(200);
    await agent.post('/api/proposals/p/drop').set('x-csrf-token', token).send({ expectedVersion: 0, revisionId: 'r', assignmentId: 'a', expectedAssignmentVersion: 0 }).expect(200);
    service.detail.mockRejectedValueOnce(new ForbiddenException());
    await agent.get('/api/proposals/p').expect(403);
    expect(audit).not.toHaveBeenCalled();
  });
});
