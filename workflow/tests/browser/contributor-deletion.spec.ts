import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const username = `delete-browser-${randomUUID()}`;
const password = 'synthetic-delete-browser-password';
let pool: Pool;
test.beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL) throw new Error('Explicit migrated disposable TEST_DATABASE_URL required');
  pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await pool.query('INSERT INTO "UserAccount" (id,username,"passwordHash",role) VALUES ($1,$2,$3,$4)',
    [randomUUID(), username, await argon2.hash(password, { type: argon2.argon2id }), 'CONTRIBUTOR']);
});
test.afterAll(async () => {
  if (!pool) return;
  await pool.query(`DELETE FROM "AuthSession" WHERE data::jsonb->>'userId' IN (SELECT id FROM "UserAccount" WHERE username=$1)`, [username]);
  await pool.end();
});

test('owner confirms deletion by keyboard with conflict/uncertainty recovery and minimal retained evidence', async ({ page }) => {
  test.setTimeout(60000);
  await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' });
  await page.goto('/contributor');
  await page.getByLabel('Username').fill(username); await page.getByLabel('Password').fill(password); await page.getByLabel('Password').press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Private drafts', exact: true })).toBeVisible();
  const auth = await (await page.request.get('/api/auth/session')).json();
  const initial = { title: '<script>Delete title</script>', problem: 'Delete problem', constraints: '', expectedBehavior: 'Delete expected',
    summary: 'Delete summary', diffText: 'Delete diff', criteria: [{ statement: 'Delete criterion', required: true }], evidence: [{ text: 'Delete evidence' }] };
  const createdResponse = await page.request.post('/api/proposals', { headers: { 'x-csrf-token': auth.csrfToken }, data: initial });
  expect(createdResponse.status()).toBe(201); const created = await createdResponse.json();
  const url = `/api/proposals/${created.proposalId}`;
  await page.goto(`/contributor/drafts/${created.proposalId}`);
  await page.getByRole('button', { name: 'Delete private draft', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Cancel deletion' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.getByRole('button', { name: 'Delete private draft', exact: true })).toBeFocused();
  expect((await page.request.get(`${url}/draft`)).status()).toBe(200);
  const latest = await (await page.request.get(`${url}/draft`)).json();
  expect((await page.request.patch(`${url}/draft`, { headers: { 'x-csrf-token': auth.csrfToken }, data: { expectedVersion: 0, content: latest.content } })).status()).toBe(200);
  await page.keyboard.press('Enter'); await page.getByRole('button', { name: 'Permanently delete draft' }).click();
  await expect(page.getByRole('alert')).toContainText('This draft changed');
  await expect(page.getByRole('button', { name: 'Delete private draft', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Check current draft' }).click();
  await expect(page.getByRole('button', { name: 'Delete private draft', exact: true })).toBeEnabled();
  await page.route(`**${url}`, route => route.request().method() === 'DELETE' ? route.abort('failed') : route.continue());
  await page.getByRole('button', { name: 'Delete private draft', exact: true }).click(); await page.getByRole('button', { name: 'Permanently delete draft' }).click();
  await expect(page.getByRole('alert')).toContainText('deletion result is uncertain');
  await expect(page.getByRole('button', { name: 'Delete private draft', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Check current draft' }).click();
  await expect(page.getByRole('button', { name: 'Delete private draft', exact: true })).toBeEnabled();
  await page.unroute(`**${url}`);
  await page.getByRole('button', { name: 'Delete private draft', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Cancel deletion' })).toBeFocused();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 640, height: 800 }); await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.getByText('Private draft deleted.', { exact: true })).toBeFocused();
  await expect(page.getByText('No drafts yet')).toBeVisible();
  expect((await page.request.get(`${url}/draft`)).status()).toBe(404);
  const tombstones = (await pool.query('SELECT * FROM "DraftTombstone" WHERE "proposalId"=$1', [created.proposalId])).rows;
  expect(tombstones).toHaveLength(1); expect(Object.keys(tombstones[0]).sort()).toEqual(['action', 'actorId', 'proposalId', 'timestamp']);
  expect(tombstones[0]).toMatchObject({ action: 'DRAFT_DELETED', actorId: auth.account.id });
  expect((await pool.query('SELECT 1 FROM "WorkingRevision" WHERE "proposalId"=$1', [created.proposalId])).rowCount).toBe(0);

  const lost = await (await page.request.post('/api/proposals', { headers: { 'x-csrf-token': auth.csrfToken }, data: { ...initial, title: 'Lost committed response' } })).json();
  await page.goto(`/contributor/drafts/${lost.proposalId}`);
  await page.route(`**/api/proposals/${lost.proposalId}`, async route => { expect((await route.fetch()).status()).toBe(204); await route.abort('failed'); });
  await page.getByRole('button', { name: 'Delete private draft', exact: true }).click(); await page.getByRole('button', { name: 'Permanently delete draft' }).click();
  await expect(page.getByRole('alert')).toContainText('deletion result is uncertain');
  await page.getByRole('button', { name: 'Check current draft' }).click();
  await expect(page.getByText('This draft is no longer available.')).toBeVisible();
  await expect(page.getByText('Private draft deleted.', { exact: true })).toHaveCount(0);
  expect((await pool.query('SELECT 1 FROM "DraftTombstone" WHERE "proposalId"=$1', [lost.proposalId])).rowCount).toBe(1);
});
