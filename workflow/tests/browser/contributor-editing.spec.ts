import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const username = `edit-browser-${randomUUID()}`;
const password = 'synthetic-edit-browser-password';
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
  // Synthetic append-only proposal evidence stays in the disposable database until it is dropped.
  await pool.end();
});

test('owner edits via keyboard with version conflicts, confirmed reload, uncertain-save recovery and accessible forms', async ({ page }) => {
  test.setTimeout(60000);
  await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' });
  await page.goto('/contributor');
  await page.getByLabel('Username').fill(username); await page.getByLabel('Password').fill(password);
  await page.getByLabel('Password').press('Enter');
  await expect(page.getByRole('heading', { name: 'Contributor workspace' })).toBeVisible();
  const auth = await (await page.request.get('/api/auth/session')).json();
  const initial = { title: 'Initial title', problem: 'Problem', constraints: '', expectedBehavior: 'Expected',
    summary: 'Hidden summary', diffText: 'Hidden diff', criteria: [{ statement: 'Hidden criterion', required: true }], evidence: [{ text: 'Hidden evidence' }] };
  const createdResponse = await page.request.post('/api/proposals', { headers: { 'x-csrf-token': auth.csrfToken }, data: initial });
  expect(createdResponse.status()).toBe(201); const created = await createdResponse.json();
  await page.goto(`/contributor/drafts/${created.proposalId}`);
  await page.getByRole('link', { name: 'Edit private draft' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByLabel('Title (required)')).toHaveValue('Initial title');
  await page.getByLabel('Title (required)').focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('<script>Edited title</script>');
  await page.keyboard.press('Tab'); await expect(page.getByLabel('Problem (required)')).toBeFocused();
  await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('Edited problem');
  await page.keyboard.press('Tab'); await page.keyboard.type('Edited constraints');
  await page.keyboard.press('Tab'); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.type('Edited behavior');
  await page.getByRole('button', { name: 'Save private draft' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByText('Draft saved. Version 1.')).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Back to draft detail' }).click();
  await expect(page.getByText('<script>Edited title</script>', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Edit private draft' }).click();
  await expect(page.getByLabel('Title (required)')).toHaveValue('<script>Edited title</script>');
  const latest = await (await page.request.get(`/api/proposals/${created.proposalId}/draft`)).json();
  const external = await page.request.patch(`/api/proposals/${created.proposalId}/draft`, { headers: { 'x-csrf-token': auth.csrfToken },
    data: { expectedVersion: 1, content: { ...latest.content, title: 'External saved title' } } });
  expect(external.status()).toBe(200);
  await page.getByLabel('Title (required)').fill('My conflicting edits');
  await page.getByRole('button', { name: 'Save private draft' }).click();
  await expect(page.getByRole('alert')).toContainText('This draft changed');
  await expect(page.getByLabel('Title (required)')).toHaveValue('My conflicting edits');
  await expect(page.getByRole('button', { name: 'Save private draft' })).toBeDisabled();
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('button', { name: 'Reload latest draft and discard changes' }).click();
  await expect(page.getByLabel('Title (required)')).toHaveValue('My conflicting edits');
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Reload latest draft and discard changes' }).click();
  await expect(page.getByLabel('Title (required)')).toHaveValue('External saved title');
  await page.getByLabel('Title (required)').fill('My reconciled edit');
  await page.getByRole('button', { name: 'Save private draft' }).click();
  await expect(page.getByText('Draft saved. Version 3.')).toBeVisible();
  await page.route('**/api/proposals/*/draft', route => route.request().method() === 'PATCH' ? route.abort('failed') : route.continue());
  await page.getByLabel('Title (required)').fill('Uncertain local text');
  await page.getByRole('button', { name: 'Save private draft' }).click();
  await expect(page.getByRole('alert')).toContainText('save result is uncertain');
  await expect(page.getByLabel('Title (required)')).toHaveValue('Uncertain local text');
  await expect(page.getByRole('button', { name: 'Save private draft' })).toBeDisabled();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  page.once('dialog', dialog => dialog.accept());
  await page.getByRole('button', { name: 'Reload latest draft and discard changes' }).click();
  await expect(page.getByLabel('Title (required)')).toHaveValue('My reconciled edit');
  await expect(page.getByRole('button', { name: 'Save private draft' })).toBeEnabled();
  await page.setViewportSize({ width: 640, height: 800 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const final = await (await page.request.get(`/api/proposals/${created.proposalId}/draft`)).json();
  expect(final.content).toMatchObject({ summary: initial.summary, diffText: initial.diffText, criteria: [{ statement: 'Hidden criterion', required: true }], evidence: [{ text: 'Hidden evidence' }] });
});
