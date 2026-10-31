import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { expect, type APIRequestContext } from '@playwright/test';

/** Seeds identities only. Proposals, approvals and candidates use production HTTP commands. */
export async function createRevocationFixture() {
  if (!process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test'))
    throw new Error('An explicit disposable TEST_DATABASE_URL is required');
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const prefix = `revoke-browser-${randomUUID()}`;
  const password = 'synthetic-revocation-browser-password';
  const users = { owner: randomUUID(), reviewer: randomUUID(), maintainer: randomUUID() };
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  try {
    for (const [name, id] of Object.entries(users)) await pool.query(
      'INSERT INTO "UserAccount" (id,username,"passwordHash",role) VALUES ($1,$2,$3,$4)',
      [id, `${prefix}-${name}`, hash, name === 'owner' ? 'CONTRIBUTOR' : name === 'reviewer' ? 'REVIEWER' : 'RELEASE_MAINTAINER']);
  } catch (cause) { await pool.end(); throw cause; }
  return { prefix, password, users, async dispose() {
    await pool.query('TRUNCATE "ChangeProposal", "ReleaseCandidate" CASCADE');
    await pool.query('DELETE FROM "AuthSession" WHERE data::jsonb->>\'userId\' = ANY($1::text[])', [Object.values(users)]);
    await pool.query('DELETE FROM "SecurityEvent" WHERE "actorId" = ANY($1::text[])', [Object.values(users)]);
    await pool.query('DELETE FROM "UserAccount" WHERE id = ANY($1::text[])', [Object.values(users)]);
    await pool.end();
  } };
}

export async function apiActor(request: APIRequestContext, username: string, password: string) {
  const csrf = await request.get('/api/auth/csrf'); expect(csrf.ok()).toBe(true);
  const token = (await csrf.json()).csrfToken as string;
  const login = await request.post('/api/auth/login', { headers: { 'x-csrf-token': token }, data: { username, password } });
  expect(login.ok()).toBe(true);
  const session = await login.json() as { csrfToken: string };
  return { token: session.csrfToken, async post(path: string, data: unknown) {
    const response = await request.post(path, { headers: { 'x-csrf-token': session.csrfToken, 'Idempotency-Key': randomUUID() }, data });
    expect(response.ok(), `${path} returned ${response.status()}`).toBe(true);
    return response.json();
  } };
}
