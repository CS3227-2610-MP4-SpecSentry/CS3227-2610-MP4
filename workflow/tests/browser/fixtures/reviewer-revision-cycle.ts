import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { expect, type APIRequestContext } from '@playwright/test';

/** Identity-only seed: all proposal revisions are created through owner HTTP commands. */
export async function createReviewerRevisionCycleFixture() {
  if (!process.env.TEST_DATABASE_URL) throw new Error('A disposable migrated TEST_DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const prefix = `revision-${randomUUID()}`; const password = 'synthetic-revision-browser-password';
  const users = { owner: randomUUID(), reviewer: randomUUID() };
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  for (const [name, id] of Object.entries(users)) await pool.query('INSERT INTO "UserAccount" (id,username,"passwordHash",role) VALUES ($1,$2,$3,$4)', [id, `${prefix}-${name}`, hash, name === 'owner' ? 'CONTRIBUTOR' : 'REVIEWER']);
  return { prefix, password, users, title: `${prefix} real owner submission`, async dispose() {
    // Like the existing suites, cleanup requires exclusive use of the disposable DB.
    await pool.query('TRUNCATE "ChangeProposal" CASCADE');
    await pool.query('DELETE FROM "AuthSession" WHERE data::jsonb->>\'userId\' = ANY($1::text[])', [Object.values(users)]);
    await pool.query('DELETE FROM "SecurityEvent" WHERE "actorId" = ANY($1::text[])', [Object.values(users)]);
    await pool.query('DELETE FROM "UserAccount" WHERE id = ANY($1::text[])', [Object.values(users)]);
    await pool.end();
  } };
}

export async function ownerSession(request: APIRequestContext, username: string, password: string) {
  const bootstrap = await request.get('/api/auth/csrf'); expect(bootstrap.ok()).toBe(true);
  const csrf = await bootstrap.json();
  const login = await request.post('/api/auth/login', { headers: { 'x-csrf-token': csrf.csrfToken }, data: { username, password } });
  expect(login.ok()).toBe(true); const session = await login.json();
  return async (path: string, data: unknown, method: 'POST' | 'PATCH' = 'POST') => {
    const response = await request.fetch(path, { method, headers: { 'x-csrf-token': session.csrfToken, 'Idempotency-Key': randomUUID() }, data });
    expect(response.ok(), `Owner ${method} ${path} status ${response.status()}`).toBe(true);
    return response.json();
  };
}
