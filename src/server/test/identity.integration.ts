import 'reflect-metadata';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { readConfig } from '../src/config';
import { DatabaseService } from '../src/database/database.service';
import { configureHttp } from '../src/http';
import { hashPassword, IdentityService } from '../src/identity/identity.service';
import { IDLE_MS, PostgresSessionStore } from '../src/identity/session.store';
import type { SessionData } from 'express-session';

describe('PostgreSQL-backed identity', () => {
  let app: NestExpressApplication;
  let database: DatabaseService;
  let identity: IdentityService;
  const secret = 'isolated-auth-test-secret-more-than-32-characters';
  const prefix = `auth-test-${randomUUID()}`;
  const username = prefix;
  const password = 'synthetic-password-for-testing';
  const keys = new Set<string>();
  const sessions = new Set<string>();
  const throttleKey = (kind: string, value: string) => {
    const key = `${kind}:${createHmac('sha256', secret).update(value).digest('hex')}`;
    keys.add(key);
    return key;
  };
  const authenticate = (name: string, pass: string, ip: string) => {
    throttleKey('account', name); throttleKey('ip', ip);
    return identity.authenticate(name, pass, ip, prefix);
  };

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to a disposable migrated test database');
    const module = await Test.createTestingModule({ imports: [AppModule.register(readConfig({
      NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL, SESSION_SECRET: secret,
    }))] }).compile();
    app = module.createNestApplication<NestExpressApplication>({ logger: false });
    configureHttp(app);
    await app.init();
    database = app.get(DatabaseService);
    identity = app.get(IdentityService);
    await database.client.userAccount.create({ data: { username, passwordHash: await hashPassword(password), role: 'REVIEWER' } });
  });
  afterAll(async () => {
    if (database) {
      const account = await database.client.userAccount.findUnique({ where: { username } });
      await database.client.authSession.deleteMany({ where: { OR: [
        { id: { in: [...sessions] } }, ...(account ? [{ data: { contains: account.id } }] : []),
      ] } });
      await database.client.loginThrottle.deleteMany({ where: { key: { in: [...keys] } } });
      await database.client.securityEvent.deleteMany({ where: { OR: [{ correlationId: prefix }, ...(account ? [{ actorId: account.id }] : [])] } });
      await database.client.userAccount.deleteMany({ where: { username } });
    }
    await app?.close();
  });

  it('verifies Argon2id passwords, persists sessions, and rejects logged-out cookies', async () => {
    const account = await database.client.userAccount.findUniqueOrThrow({ where: { username } });
    expect(account.passwordHash).toMatch(/^\$argon2id\$/);
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/auth/csrf').expect(200);
    const login = await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken).send({ username, password }).expect(200);
    throttleKey('account', username); throttleKey('ip', '::ffff:127.0.0.1');
    expect(login.body.account.role).toBe('REVIEWER');
    const row = await database.client.authSession.findFirstOrThrow({ where: { data: { contains: account.id } } });
    expect(row.id).toMatch(/^[a-f0-9]{64}$/);
    expect(row.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(IDLE_MS);
    await agent.get('/api/auth/session').expect(200);
    await agent.post('/api/auth/logout').set('x-csrf-token', login.body.csrfToken).expect(204);
    expect(await database.client.authSession.findUnique({ where: { id: row.id } })).toBeNull();
    await request(app.getHttpServer()).get('/api/auth/session').set('Cookie', String(login.headers['set-cookie']?.[0])).expect(401);
  });
  it('throttles five failed attempts and releases the account after the block expires', async () => {
    const name = `${prefix}-missing`;
    const ip = `${prefix}-account-ip`;
    for (let attempt = 0; attempt < 5; attempt++) expect((await authenticate(name, 'wrong', ip)).status).toBe('invalid');
    expect((await authenticate(name, 'wrong', `${ip}-other`)).status).toBe('throttled');
    await database.client.loginThrottle.update({ where: { key: throttleKey('account', name) }, data: {
      failuresAt: [], blockedUntil: new Date(Date.now() - 1),
    } });
    expect((await authenticate(name, 'wrong', `${ip}-other`)).status).toBe('invalid');
  });
  it('limits an IP across distinct account names', async () => {
    const ip = `${prefix}-ip-limit`;
    for (let attempt = 0; attempt < 30; attempt++) expect((await authenticate(`${prefix}-${attempt}`, 'wrong', ip)).status).toBe('invalid');
    expect((await authenticate(username, password, ip)).status).toBe('throttled');
  }, 15000);
  it('counts failures across a rolling-window boundary', async () => {
    const name = `${prefix}-rolling`;
    const key = throttleKey('account', name);
    const now = Date.now();
    await database.client.loginThrottle.create({ data: { key, failuresAt: [
      new Date(now - 16 * 60000), // Falls outside the window and must be ignored.
      new Date(now - 14 * 60000), new Date(now - 13 * 60000),
      new Date(now - 2 * 60000), new Date(now - 60000),
    ] } });
    expect((await authenticate(name, 'wrong', `${prefix}-rolling-ip`)).status).toBe('invalid');
    expect((await authenticate(name, 'wrong', `${prefix}-rolling-ip`)).status).toBe('throttled');
  });
  it('serializes concurrent failures so the account threshold cannot be bypassed', async () => {
    const name = `${prefix}-concurrent`;
    const results = await Promise.all(Array.from({ length: 8 }, (_, index) => authenticate(name, 'wrong', `${prefix}-parallel-${index}`)));
    expect(results.filter((result) => result.status === 'invalid')).toHaveLength(5);
    expect(results.filter((result) => result.status === 'throttled')).toHaveLength(3);
  }, 15000);
  it('withholds access when an account is disabled after login', async () => {
    const agent = request.agent(app.getHttpServer());
    const csrf = await agent.get('/api/auth/csrf');
    await agent.post('/api/auth/login').set('x-csrf-token', csrf.body.csrfToken).send({ username, password }).expect(200);
    await database.client.userAccount.update({ where: { username }, data: { enabled: false, version: { increment: 1 } } });
    await agent.get('/api/auth/session').expect(401);
    expect((await authenticate(username, password, `${prefix}-disabled`)).status).toBe('invalid');
    await database.client.userAccount.update({ where: { username }, data: { enabled: true } });
  });
  it('expires idle sessions and cannot recreate a destroyed session through touch', async () => {
    const store = app.get(PostgresSessionStore);
    const id = randomUUID();
    const digest = createHash('sha256').update(id).digest('hex');
    sessions.add(digest);
    const data = { cookie: { originalMaxAge: IDLE_MS }, issuedAt: Date.now(), csrfToken: 'b'.repeat(64) } as SessionData;
    await new Promise<void>((resolve, reject) => store.set(id, data, (error) => error ? reject(error) : resolve()));
    await database.client.authSession.update({ where: { id: digest }, data: { expiresAt: new Date(Date.now() - 1) } });
    expect(await new Promise((resolve, reject) => store.get(id, (error, value) => error ? reject(error) : resolve(value)))).toBeNull();
    await new Promise<void>((resolve, reject) => store.touch(id, data, (error) => error ? reject(error) : resolve()));
    expect(await database.client.authSession.findUnique({ where: { id: digest } })).toBeNull();
  });
});
