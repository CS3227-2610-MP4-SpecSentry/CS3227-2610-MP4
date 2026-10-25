import 'reflect-metadata';
import { Controller, Get, Module, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MemoryStore, type SessionData } from 'express-session';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { readConfig } from '../src/config';
import { configureHttp } from '../src/http';
import { DatabaseService } from '../src/database/database.service';
import { Roles } from '../src/identity/access';
import { IdentityService } from '../src/identity/identity.service';
import { ABSOLUTE_MS, PostgresSessionStore } from '../src/identity/session.store';

@Controller('protected')
class ProtectedController {
  @Get() read() { return { protected: true }; }
  @Roles('CONTRIBUTOR') @Get('contributor') contributor() { return { allowed: true }; }
  @Roles('REVIEWER') @Get('reviewer') reviewer() { return { allowed: true }; }
  @Roles('RELEASE_MAINTAINER') @Get('maintainer') maintainer() { return { allowed: true }; }
  @Post() write() { return { changed: true }; }
}
@Module({ controllers: [ProtectedController] })
class ProtectedModule {}

describe('identity HTTP boundary', () => {
  let app: NestExpressApplication;
  const store = new MemoryStore(); // Test-only: production always uses PostgreSQL.
  const accounts = ['CONTRIBUTOR', 'REVIEWER', 'RELEASE_MAINTAINER'].map((role, index) => ({
    id: `user-${index}`, username: `user${index}`, role, enabled: true, version: 1, passwordHash: 'private-hash',
  }));
  const event = jest.fn().mockResolvedValue({});
  const authenticate = jest.fn(async (username: string, password: string) => {
    const account = accounts.find((item) => item.username === username);
    return account && password === 'correct-password' ? { status: 'success', account } : { status: 'invalid' };
  });

  beforeAll(async () => {
    const config = readConfig({ NODE_ENV: 'test', DATABASE_URL: 'postgresql://test:test@localhost/test', SESSION_SECRET: 'synthetic-session-secret-longer-than-32-chars' });
    const module = await Test.createTestingModule({ imports: [AppModule.register(config), ProtectedModule] })
      .overrideProvider(DatabaseService).useValue({ client: {
        userAccount: { findUnique: async ({ where }: { where: { id: string } }) => accounts.find((account) => account.id === where.id) },
        securityEvent: { create: event },
      }, checkConnection: jest.fn() })
      .overrideProvider(PostgresSessionStore).useValue(store)
      .overrideProvider(IdentityService).useValue({ authenticate }).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false });
    configureHttp(app);
    await app.init();
  });
  afterAll(async () => { await app.close(); });
  beforeEach(() => {
    store.clear();
    for (const account of accounts) { account.enabled = true; account.version = 1; }
  });

  async function signIn(index = 0) {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/auth/csrf').expect(200);
    const response = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken)
      .send({ username: `USER${index}`, password: 'correct-password' }).expect(200);
    return { agent, response, csrf };
  }

  it('protects routes by default while health stays public', async () => {
    await request(app.getHttpServer()).get('/api/protected').expect(401);
    await request(app.getHttpServer()).get('/api/auth/session').expect(401);
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });
  it('requires a synchronizer CSRF token before login', async () => {
    await request(app.getHttpServer()).post('/api/auth/login').send({ username: 'user0', password: 'correct-password' }).expect(403);
    expect(authenticate).not.toHaveBeenCalled();
  });
  it('rotates the session and CSRF token; returns only safe account fields', async () => {
    const { agent, response, csrf } = await signIn();
    expect(String(response.headers['set-cookie']?.[0])).not.toEqual(String(csrf.headers['set-cookie']?.[0]));
    expect(response.body.csrfToken).not.toBe(csrf.body.csrfToken);
    expect(String(response.headers['set-cookie']?.[0])).toMatch(/HttpOnly/);
    expect(String(response.headers['set-cookie']?.[0])).toMatch(/SameSite=Lax/);
    expect(response.body.account).toEqual({ id: 'user-0', username: 'user0', role: 'CONTRIBUTOR' });
    expect(response.text).not.toMatch(/passwordHash|private-hash|correct-password/);
    await agent.get('/api/auth/session').expect(200);
    await request(app.getHttpServer()).get('/api/auth/session').set('Cookie', String(csrf.headers['set-cookie']?.[0])).expect(401);
  });
  it.each([0, 1, 2])('enforces role %s through direct API requests', async (index) => {
    const { agent } = await signIn(index);
    for (const [roleIndex, path] of ['contributor', 'reviewer', 'maintainer'].entries()) {
      await agent.get(`/api/protected/${path}`).expect(roleIndex === index ? 200 : 403);
    }
  });
  it('rejects client-supplied role fields', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/auth/csrf');
    await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken)
      .send({ username: 'user0', password: 'correct-password', role: 'REVIEWER' }).expect(422);
    expect(authenticate).not.toHaveBeenCalled();
  });
  it('invalid credentials return a generic safe error', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/auth/csrf');
    const response = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken)
      .send({ username: 'missing', password: 'wrong' }).expect(401);
    expect(response.body).toMatchObject({ code: 'UNAUTHENTICATED', message: 'Request could not be completed.' });
  });
  it('returns a safe rate-limit error with retry information', async () => {
    authenticate.mockResolvedValueOnce({ status: 'throttled' });
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/auth/csrf');
    const response = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken)
      .send({ username: 'user0', password: 'wrong' }).expect(429);
    expect(response.headers['retry-after']).toBe('900');
    expect(response.body.code).toBe('RATE_LIMITED');
  });
  it('rejects missing, incorrect and non-ASCII CSRF tokens on protected writes', async () => {
    const { agent, response } = await signIn();
    await agent.post('/api/protected').expect(403);
    await agent.post('/api/protected').set('x-csrf-token', '0'.repeat(64)).expect(403);
    await agent.post('/api/protected').set('x-csrf-token', 'é'.repeat(64)).expect(403);
    await agent.post('/api/protected').set('x-csrf-token', response.body.csrfToken).expect(201);
  });
  it('logout destroys server state and prevents cookie replay', async () => {
    const { agent, response } = await signIn();
    await agent.post('/api/auth/logout').set('x-csrf-token', response.body.csrfToken).expect(204);
    await agent.get('/api/auth/session').expect(401);
    await request(app.getHttpServer()).get('/api/auth/session').set('Cookie', String(response.headers['set-cookie']?.[0])).expect(401);
  });
  it.each(['enabled', 'version'])('rejects an existing session after account %s changes', async (field) => {
    const { agent } = await signIn();
    if (field === 'enabled') accounts[0]!.enabled = false;
    else accounts[0]!.version++;
    await agent.get('/api/auth/session').expect(401);
  });
  it('enforces absolute expiry despite renewed idle time', async () => {
    const { agent } = await signIn();
    const sessions = await new Promise<Record<string, SessionData>>((resolve, reject) => store.all((error, values) => error ? reject(error) : resolve(values as Record<string, SessionData>)));
    for (const [id, data] of Object.entries(sessions)) {
      data.issuedAt = Date.now() - ABSOLUTE_MS;
      await new Promise<void>((resolve, reject) => store.set(id, data, (error) => error ? reject(error) : resolve()));
    }
    await agent.get('/api/auth/session').expect(401);
  });
});
