import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { DatabaseService } from '../src/database/database.service';
import { readConfig } from '../src/config';
import { businessTransaction } from '../src/identity/business-context';
import { ABSOLUTE_MS, IDLE_MS, PostgresSessionStore } from '../src/identity/session.store';
import { persistedTestActor } from './business-fixtures';

describe('Persisted business session authorization (SEC-I2-001)', () => {
  let db: DatabaseService;
  const id = `business-session-${randomUUID()}`;
  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit disposable TEST_DATABASE_URL required');
    db = new DatabaseService(readConfig({ NODE_ENV: 'test', DATABASE_URL: process.env.TEST_DATABASE_URL,
      SESSION_SECRET: 'synthetic-business-session-test-secret-32-characters' }));
    await db.client.userAccount.create({ data: { id, username: id, role: 'REVIEWER', passwordHash: 'synthetic-unused-hash' } });
  });
  afterAll(async () => {
    await db.client.authSession.deleteMany({ where: { data: { contains: id } } });
    await db.client.securityEvent.deleteMany({ where: { actorId: id } });
    await db.client.userAccount.delete({ where: { id } }); await db.onModuleDestroy();
  });
  it('rejects missing, expired, malformed and mismatched persisted sessions before protected work', async () => {
    const actor = await persistedTestActor(db, id); const work = jest.fn().mockResolvedValue('protected');
    const run = () => businessTransaction(db, actor, 'REVIEWER', id, 'TEST', work);
    await expect(businessTransaction(db, { ...actor, session: undefined }, 'REVIEWER', id, 'TEST', work)).rejects.toMatchObject({ status: 401 });
    const original = await db.client.authSession.findUniqueOrThrow({ where: { id: actor.session!.digest } });
    for (const data of ['{', JSON.stringify({ userId: id, accountVersion: 2, issuedAt: actor.session!.issuedAt, csrfToken: actor.session!.csrfToken }),
      JSON.stringify({ userId: 'another', accountVersion: 1, issuedAt: actor.session!.issuedAt, csrfToken: actor.session!.csrfToken })]) {
      await db.client.authSession.update({ where: { id: actor.session!.digest }, data: { data } });
      await expect(run()).rejects.toMatchObject({ status: 401 });
    }
    await db.client.authSession.update({ where: { id: actor.session!.digest }, data: { data: original.data, expiresAt: new Date(0) } });
    await expect(run()).rejects.toMatchObject({ status: 401 });
    await db.client.authSession.delete({ where: { id: actor.session!.digest } });
    await expect(run()).rejects.toMatchObject({ status: 401 }); expect(work).not.toHaveBeenCalled();
  });
  it('logout committed before authorization denies, while an authorized transaction serializes logout', async () => {
    const actor = await persistedTestActor(db, id);
    let entered!: () => void; const inside = new Promise<void>(resolve => { entered = resolve; });
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    const operation = businessTransaction(db, actor, 'REVIEWER', id, 'TEST', async tx => {
      entered(); await gate;
      await tx.securityEvent.create({ data: { actorId: id, action: 'TEST_COMMITTED', target: id, outcome: 'success' } });
    });
    await inside;
    let deleted = false;
    const logout = db.client.authSession.deleteMany({ where: { id: actor.session!.digest } }).then(() => { deleted = true; });
    await new Promise<void>(resolve => setImmediate(resolve)); expect(deleted).toBe(false);
    release(); await operation; await logout;
    const work = jest.fn();
    await expect(businessTransaction(db, actor, 'REVIEWER', id, 'TEST', work)).rejects.toMatchObject({ status: 401 });
    expect(work).not.toHaveBeenCalled();
  });
  it('expiry while waiting for the account lock and expiry at final checkpoint roll back', async () => {
    const actor = await persistedTestActor(db, id);
    let locked!: () => void; const inside = new Promise<void>(resolve => { locked = resolve; });
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    const blocker = db.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "UserAccount" WHERE "id"=${id} FOR UPDATE`;
      locked(); await gate;
    });
    await inside;
    const work = jest.fn().mockResolvedValue(undefined);
    const pending = businessTransaction(db, actor, 'REVIEWER', id, 'TEST', work).catch(e => e);
    await db.client.authSession.update({ where: { id: actor.session!.digest }, data: { expiresAt: new Date(0) } });
    release(); await blocker; expect(await pending).toMatchObject({ status: 401 }); expect(work).not.toHaveBeenCalled();
    await db.client.authSession.update({ where: { id: actor.session!.digest }, data: { expiresAt: new Date(Date.now() + 300) } });
    await expect(businessTransaction(db, actor, 'REVIEWER', id, 'TEST', async tx => {
      await tx.securityEvent.create({ data: { actorId: id, action: 'MUST_ROLL_BACK', target: id, outcome: 'success' } });
      await tx.$executeRaw`SELECT pg_sleep(0.4)`;
    })).rejects.toMatchObject({ status: 401 });
    expect(await db.client.securityEvent.count({ where: { actorId: id, action: 'MUST_ROLL_BACK' } })).toBe(0);
  });
  it('rolling touch cannot renew expired or deleted sessions', async () => {
    const store = new PostgresSessionStore(db); const raw = randomUUID();
    const data = { cookie: { originalMaxAge: IDLE_MS }, userId: id, issuedAt: Date.now() };
    const set = () => new Promise<void>((resolve, reject) => store.set(raw, data as never, error => error ? reject(error) : resolve()));
    const touch = () => new Promise<void>((resolve, reject) => store.touch(raw, data as never, error => error ? reject(error) : resolve()));
    await set();
    await db.client.authSession.updateMany({ where: { data: { contains: id } }, data: { expiresAt: new Date(0) } });
    await touch();
    expect((await db.client.authSession.findMany({ where: { data: { contains: id } } })).every(row => row.expiresAt.getTime() === 0)).toBe(true);
    await new Promise<void>((resolve, reject) => store.destroy(raw, error => error ? reject(error) : resolve()));
    await touch(); expect(await new Promise<unknown>((resolve, reject) => store.get(raw, (error, row) => error ? reject(error) : resolve(row)))).toBeNull();
  });
  it('renews a live session while respecting its absolute lifetime', async () => {
    const store = new PostgresSessionStore(db); const raw = randomUUID();
    const digest = createHash('sha256').update(raw).digest('hex');
    const issuedAt = Date.now() - ABSOLUTE_MS + 60000;
    const data = { cookie: { originalMaxAge: IDLE_MS }, userId: id, issuedAt };
    await new Promise<void>((resolve, reject) => store.set(raw, data as never, error => error ? reject(error) : resolve()));
    await db.client.authSession.update({ where: { id: digest }, data: { expiresAt: new Date(Date.now() + 10000) } });
    await new Promise<void>((resolve, reject) => store.touch(raw, data as never, error => error ? reject(error) : resolve()));
    const row = await db.client.authSession.findUniqueOrThrow({ where: { id: digest } });
    expect(row.expiresAt.getTime()).toBe(issuedAt + ABSOLUTE_MS);
  });
  it.each(['idle', 'absolute'] as const)('touch waiting on a real row lock rechecks %s expiry after acquiring it', async kind => {
    const store = new PostgresSessionStore(db); const raw = randomUUID();
    const digest = createHash('sha256').update(raw).digest('hex'); const csrfToken = randomBytes(32).toString('hex');
    const deadline = Date.now() + 1500;
    const issuedAt = kind === 'absolute' ? deadline - ABSOLUTE_MS : Date.now();
    const data = { cookie: { originalMaxAge: IDLE_MS }, userId: id, accountVersion: 1, issuedAt, csrfToken };
    await new Promise<void>((resolve, reject) => store.set(raw, data as never, error => error ? reject(error) : resolve()));
    const expiresAt = new Date(kind === 'idle' ? deadline : Date.now() + IDLE_MS);
    await db.client.authSession.update({ where: { id: digest }, data: { expiresAt } });
    let entered!: () => void; const locked = new Promise<void>(resolve => { entered = resolve; });
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    const holder = db.client.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "AuthSession" WHERE "id"=${digest} FOR UPDATE`;
      entered(); await gate;
    });
    await locked; expect(Date.now()).toBeLessThan(deadline);
    const touch = new Promise<void>((resolve, reject) => store.touch(raw, data as never, error => error ? reject(error) : resolve()));
    try {
      let blocked = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        const rows = await db.client.$queryRaw<{ count: number }[]>`SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%AuthSession%FOR UPDATE%'`;
        if (rows[0]!.count > 0) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(blocked).toBe(true);
      await new Promise(resolve => setTimeout(resolve, Math.max(1, deadline - Date.now() + 50)));
    } finally { release(); await holder; await touch; }
    expect((await db.client.authSession.findUniqueOrThrow({ where: { id: digest } })).expiresAt).toEqual(expiresAt);
    const work = jest.fn();
    await expect(businessTransaction(db, { accountId: id, accountVersion: 1, session: { digest, issuedAt, csrfToken } },
      'REVIEWER', id, 'TEST', work)).rejects.toMatchObject({ status: 401 });
    expect(work).not.toHaveBeenCalled();
  });
});
