import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const username = `preparation-browser-${randomUUID()}`;
const password = 'synthetic-preparation-browser-password';
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

test('owner prepares summary, inert diff and plain-text evidence with identity preservation and keyboard recovery', async ({ page }) => {
  test.setTimeout(60000);
  await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' });
  await page.goto('/contributor'); await page.getByLabel('Username').fill(username); await page.getByLabel('Password').fill(password); await page.getByLabel('Password').press('Enter');
  await expect(page.getByRole('heading', { name: 'Contributor workspace' })).toBeVisible();
  const auth = await (await page.request.get('/api/auth/session')).json();
  const content = { title: 'Preparation draft', problem: 'Problem', constraints: '', expectedBehavior: 'Expected', summary: '', diffText: '',
    criteria: [{ statement: 'Preserve this optional criterion', required: false }], evidence: [{ text: 'Original evidence' }] };
  const created = await page.request.post('/api/proposals', { headers: { 'x-csrf-token': auth.csrfToken }, data: content }); expect(created.status()).toBe(201);
  const root = await created.json(); const url = `/api/proposals/${root.proposalId}/draft`;
  const original = await (await page.request.get(url)).json();
  await page.goto(`/contributor/drafts/${root.proposalId}/edit`);
  const summary = '<script>window.preparationExecuted=true</script>\nContributor-written summary';
  const diff = '--- a/example\n+++ b/example\n@@ incomplete patch\n+$(touch must-not-execute)\n+<img src="https://invalid.example/probe" onerror="window.preparationExecuted=true">';
  await page.getByLabel('Contributor summary (optional)').fill(summary); await page.getByLabel('Unified diff (optional)').fill(diff);
  await page.getByLabel('Evidence 1 text').fill('[plain link](https://invalid.example)\nCommand-like evidence: rm -rf fake');
  await page.getByRole('button', { name: 'Add evidence' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByLabel('Evidence 2 text')).toBeFocused(); await page.getByLabel('Evidence 2 text').fill('Second evidence item');
  await page.getByRole('button', { name: 'Save private draft' }).focus(); await page.keyboard.press('Enter'); await expect(page.getByText('Draft saved. Version 1.')).toBeVisible();
  let latest = await (await page.request.get(url)).json();
  expect(latest.content.summary).toBe(summary); expect(latest.content.diffText).toBe(diff); expect(latest.content.criteria).toEqual(original.content.criteria);
  expect(latest.content.evidence[0].id).toBe(original.content.evidence[0].id); const added = latest.content.evidence[1].id; expect(added).toBeTruthy();
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).preparationExecuted)).toBeUndefined();
  expect(await page.locator('img[src="https://invalid.example/probe"]').count()).toBe(0);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  // Another editor wins: the old version must not overwrite its summary.
  expect((await page.request.patch(url, { headers: { 'x-csrf-token': auth.csrfToken }, data: { expectedVersion: 1, content: { ...latest.content, summary: 'External edit' } } })).status()).toBe(200);
  await page.getByLabel('Contributor summary (optional)').fill('Retained conflicting summary'); await page.getByRole('button', { name: 'Save private draft' }).click();
  await expect(page.getByRole('alert')).toContainText('This draft changed'); await expect(page.getByLabel('Contributor summary (optional)')).toHaveValue('Retained conflicting summary');
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Reload latest draft and discard changes' }).click();
  await expect(page.getByRole('button', { name: 'Save private draft' })).toBeDisabled();
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Reload latest draft and discard changes' }).click();
  await expect(page.getByLabel('Contributor summary (optional)')).toHaveValue('External edit');
  let failRead = true;
  await page.route(`**${url}`, route => { if (route.request().method() === 'GET' && failRead) { failRead = false; return route.abort('failed'); } return route.continue(); });
  await page.getByLabel('Contributor summary (optional)').fill(summary); await page.getByRole('button', { name: 'Save private draft' }).click();
  await expect(page.getByRole('alert')).toContainText('Draft saved, but its current identities could not be reconciled');
  await expect(page.getByLabel('Unified diff (optional)')).toHaveValue(diff); await expect(page.getByRole('button', { name: 'Save private draft' })).toBeDisabled();
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Reload latest draft and discard changes' }).click();
  await expect(page.getByRole('button', { name: 'Save private draft' })).toBeEnabled(); await page.unroute(`**${url}`);
  latest = await (await page.request.get(url)).json(); expect(latest.content.evidence[1].id).toBe(added); expect(latest.content.criteria).toEqual(original.content.criteria);
  await page.getByRole('button', { name: 'Back to draft detail' }).click();
  await expect(page.getByText(summary, { exact: true })).toBeVisible(); await expect(page.getByText(diff, { exact: true })).toBeVisible();
  expect(await page.locator('script:not([src])').count()).toBe(0); expect(await page.locator('a[href="https://invalid.example"]').count()).toBe(0);
  await page.setViewportSize({ width: 640, height: 800 }); await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.getByRole('link', { name: 'Edit private draft' }).click();
  await page.getByRole('button', { name: 'Remove evidence 2' }).focus(); await page.keyboard.press('Enter'); await expect(page.getByLabel('Evidence 1 text')).toBeFocused();
  await page.getByRole('button', { name: 'Remove evidence 1' }).click(); await expect(page.getByRole('button', { name: 'Add evidence' })).toBeFocused();
  await page.getByLabel('Contributor summary (optional)').fill(''); await page.getByLabel('Unified diff (optional)').fill('');
  await page.getByRole('button', { name: 'Save private draft' }).click(); await expect(page.getByText('Draft saved. Version 4.')).toBeVisible();
  latest = await (await page.request.get(url)).json(); expect(latest.content).toMatchObject({ summary: '', diffText: '', evidence: [], criteria: original.content.criteria });
});
