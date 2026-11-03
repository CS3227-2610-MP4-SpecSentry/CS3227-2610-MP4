import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const password = 'synthetic-browser-test-password';
const prefix = `browser-${randomUUID()}`;
let pool: Pool;

test.beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL must point to a disposable migrated test database');
  pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  for (const role of ['CONTRIBUTOR', 'REVIEWER', 'RELEASE_MAINTAINER']) {
    await pool.query('INSERT INTO "UserAccount" (id, username, "passwordHash", role) VALUES ($1,$2,$3,$4)', [randomUUID(), `${prefix}-${role.toLowerCase()}`, hash, role]);
  }
});
test.afterAll(async () => {
  if (!pool) return;
  await pool.query(`DELETE FROM "AuthSession" WHERE data::jsonb->>'userId' IN (SELECT id FROM "UserAccount" WHERE username LIKE $1)`, [`${prefix}%`]);
  await pool.query('DELETE FROM "SecurityEvent" WHERE "actorId" IN (SELECT id FROM "UserAccount" WHERE username LIKE $1)', [`${prefix}%`]);
  await pool.query('DELETE FROM "UserAccount" WHERE username LIKE $1', [`${prefix}%`]);
  await pool.end();
});

test('login page withholds workspace content and passes automated accessibility checks', async ({ page }) => {
  await page.goto('/reviewer');
  await expect(page.getByRole('heading', { name: 'SpecSentry', exact: true })).toBeVisible();
  await expect(page.getByLabel('Username')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reviewer workspace' })).toHaveCount(0);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(results.violations).toEqual([]);
});

for (const [role, label] of [['CONTRIBUTOR', 'Contributor'], ['REVIEWER', 'Reviewer'], ['RELEASE_MAINTAINER', 'Release Maintainer']]) {
  test(`${label} can sign in, restore the session, and sign out`, async ({ page }) => {
    const workspaceHeading = role === 'CONTRIBUTOR' ? 'Private drafts' : role === 'REVIEWER' ? label : `${label} workspace`;
    // Simulate the controlled TLS-terminating proxy used by the production server.
    await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' });
    await page.goto('/');
    await page.getByLabel('Username').fill(`${prefix}-${role!.toLowerCase()}`);
    await page.getByLabel('Password').fill(password);
    await page.getByLabel('Password').press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: workspaceHeading, exact: true })).toBeVisible();
    if (role === 'REVIEWER') await expect(page.getByRole('heading', { level: 2, name: 'Reviewer workspace', exact: true })).toBeVisible();
    const cookies = await page.context().cookies();
    expect(cookies.find((cookie) => cookie.name === 'specsentry.sid')).toMatchObject({ secure: true, httpOnly: true, sameSite: 'Lax' });
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: workspaceHeading, exact: true })).toBeVisible();
    if (role === 'REVIEWER') await expect(page.getByRole('heading', { level: 2, name: 'Reviewer workspace', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: workspaceHeading, exact: true })).toHaveCount(0);
    if (role === 'REVIEWER') await expect(page.getByRole('heading', { level: 2, name: 'Reviewer workspace', exact: true })).toHaveCount(0);
  });
}
