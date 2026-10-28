import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const username = `criteria-browser-${randomUUID()}`;
const password = 'synthetic-criteria-browser-password';
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

test('owner manages criterion classification and explicit identity with authoritative reconciliation and keyboard recovery', async ({ page }) => {
  test.setTimeout(60000);
  await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' });
  await page.goto('/contributor'); await page.getByLabel('Username').fill(username); await page.getByLabel('Password').fill(password); await page.getByLabel('Password').press('Enter');
  await expect(page.getByRole('heading', { name: 'Contributor workspace' })).toBeVisible();
  const auth = await (await page.request.get('/api/auth/session')).json();
  const content = { title: 'Criterion draft', problem: 'Problem', constraints: '', expectedBehavior: 'Expected', summary: '', diffText: '', criteria: [], evidence: [] };
  const create = await page.request.post('/api/proposals', { headers: { 'x-csrf-token': auth.csrfToken }, data: content }); expect(create.status()).toBe(201);
  const root = await create.json(); const url = `/api/proposals/${root.proposalId}/draft`;
  await page.goto(`/contributor/drafts/${root.proposalId}/edit`);
  await page.getByRole('button', { name: 'Add criterion' }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByLabel('Criterion 1 statement')).toBeFocused(); await expect(page.getByLabel('Criterion 1 required')).toBeChecked();
  await page.keyboard.type('<script>Acceptance wording</script>'); await page.keyboard.press('Tab'); await expect(page.getByLabel('Criterion 1 required')).toBeFocused(); await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Save private draft' }).focus(); await page.keyboard.press('Enter'); await expect(page.getByText('Draft saved. Version 1.')).toBeVisible();
  let latest = await (await page.request.get(url)).json(); const initialKey = latest.content.criteria[0].stableKey;
  expect(latest.content.criteria[0]).toMatchObject({ required: false, statement: '<script>Acceptance wording</script>' });
  await page.getByLabel('Criterion 1 statement').fill('Corrected wording, same meaning');
  await page.getByRole('button', { name: 'Save private draft' }).click(); await expect(page.getByLabel('Criterion 1 meaning')).toBeFocused();
  await page.getByLabel('Criterion 1 meaning').selectOption('same'); await page.getByRole('button', { name: 'Save private draft' }).click(); await expect(page.getByText('Draft saved. Version 2.')).toBeVisible();
  latest = await (await page.request.get(url)).json(); expect(latest.content.criteria[0].stableKey).toBe(initialKey);
  await page.getByLabel('Criterion 1 statement').fill('A materially different requirement'); await page.getByLabel('Criterion 1 meaning').selectOption('replace');
  await page.getByRole('button', { name: 'Save private draft' }).click(); await expect(page.getByText('Draft saved. Version 3.')).toBeVisible();
  latest = await (await page.request.get(url)).json(); expect(latest.content.criteria[0].stableKey).not.toBe(initialKey); const replacement = latest.content.criteria[0].stableKey;
  await page.getByRole('button', { name: 'Remove criterion 1' }).focus(); await page.keyboard.press('Enter'); await expect(page.getByRole('button', { name: 'Add criterion' })).toBeFocused();
  await page.getByRole('button', { name: 'Save private draft' }).click(); await expect(page.getByText('Draft saved. Version 4.')).toBeVisible();
  expect((await (await page.request.get(url)).json()).content.criteria).toEqual([]);
  await page.getByRole('button', { name: 'Add criterion' }).click(); await page.getByLabel('Criterion 1 statement').fill('A new criterion after removal');
  let failRead = true;
  await page.route(`**${url}`, route => { if (route.request().method() === 'GET' && failRead) { failRead = false; return route.abort('failed'); } return route.continue(); });
  await page.getByRole('button', { name: 'Save private draft' }).click(); await expect(page.getByRole('alert')).toContainText('Draft saved, but its current identities could not be reconciled');
  await expect(page.getByLabel('Criterion 1 statement')).toHaveValue('A new criterion after removal'); await expect(page.getByRole('button', { name: 'Save private draft' })).toBeDisabled();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('button', { name: 'Reload latest draft and discard changes' }).click(); await expect(page.getByRole('button', { name: 'Save private draft' })).toBeDisabled();
  page.once('dialog', dialog => dialog.accept()); await page.getByRole('button', { name: 'Reload latest draft and discard changes' }).click(); await expect(page.getByRole('button', { name: 'Save private draft' })).toBeEnabled();
  latest = await (await page.request.get(url)).json(); expect(latest.version).toBe(5); expect(latest.content.criteria[0].stableKey).not.toBe(replacement); const finalKey = latest.content.criteria[0].stableKey;
  await page.getByRole('button', { name: 'Save private draft' }).click(); await expect(page.getByText('Draft saved. Version 6.')).toBeVisible();
  expect((await (await page.request.get(url)).json()).content.criteria[0].stableKey).toBe(finalKey);
  await page.setViewportSize({ width: 640, height: 800 }); await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
});
