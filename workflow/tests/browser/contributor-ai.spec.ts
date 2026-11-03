import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const username = `contributor-ai-browser-${randomUUID()}`;
const password = 'synthetic-contributor-ai-browser-password';
let pool: Pool;
test.beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test')) throw new Error('Explicit migrated disposable test database required');
  pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  await pool.query('INSERT INTO "UserAccount"(id,username,"passwordHash",role) VALUES($1,$2,$3,\'CONTRIBUTOR\')',
    [randomUUID(), username, await argon2.hash(password, { type: argon2.argon2id })]);
});
test.afterAll(async () => { await pool?.end(); });
async function openEditor(page: Page, problem = 'A bounded issue') {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' }); await page.goto('/contributor');
  await page.getByLabel('Username').fill(username); await page.getByLabel('Password').fill(password); await page.getByLabel('Password').press('Enter');
  await expect(page.getByRole('heading', { name: 'Private drafts', exact: true })).toBeVisible();
  const session = await (await page.request.get('/api/auth/session')).json();
  const created = await page.request.post('/api/proposals', { headers: { 'x-csrf-token': session.csrfToken }, data: {
    title: 'Contributor assistant', summary: '', problem, constraints: 'Original constraint', expectedBehavior: 'Original behavior',
    criteria: [{ statement: 'Original criterion', required: false }], diffText: '', evidence: [],
  } }); expect(created.status()).toBe(201); const root = await created.json();
  await page.goto(`/contributor/drafts/${root.proposalId}/edit`); await expect(page.getByLabel('Expected behavior (required)')).toHaveValue('Original behavior');
  return root.proposalId as string;
}

test('typed advisory generation changes nothing until selected local application, then a manual save persists it', async ({ page }) => {
  const id = await openEditor(page);
  const original = await (await page.request.get(`/api/proposals/${id}/draft`)).json();
  let saveCalls = 0; page.on('request', request => { if (request.method() === 'PATCH' && request.url().includes(`/api/proposals/${id}/draft`)) saveCalls++; });
  await page.getByRole('button', { name: 'Generate draft suggestions', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Select suggestions to apply' })).toBeVisible();
  await expect(page.getByLabel('Expected behavior (required)')).toHaveValue('Original behavior');
  await expect(page.getByRole('button', { name: 'Apply selected suggestions to editor' })).toBeDisabled();
  expect((await (await page.request.get(`/api/proposals/${id}/draft`)).json()).content).toEqual(original.content); expect(saveCalls).toBe(0);
  await page.getByLabel('Replace expected behavior: <script>Suggested objective remains text</script>', { exact: true }).check();
  await page.getByLabel('Add a new required criterion: Suggested required behavior', { exact: true }).check();
  await page.getByLabel('Append to constraints (Test idea): Exercise the boundary', { exact: true }).check();
  expect(await page.locator('script:not([src])').count()).toBe(0);
  await page.getByRole('button', { name: 'Apply selected suggestions to editor', exact: true }).click();
  await expect(page.getByLabel('Expected behavior (required)')).toHaveValue('<script>Suggested objective remains text</script>');
  await expect(page.getByLabel('Criterion 1 required')).not.toBeChecked(); await expect(page.getByLabel('Criterion 2 required')).toBeChecked();
  await expect(page.getByLabel('Constraints (optional)')).toHaveValue('Original constraint\nTest idea: Exercise the boundary');
  expect(saveCalls).toBe(0); expect((await (await page.request.get(`/api/proposals/${id}/draft`)).json()).content).toEqual(original.content);
  page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('link', { name: 'SpecSentry Specification workspace', exact: true }).click();
  await expect(page.getByLabel('Expected behavior (required)')).toHaveValue('<script>Suggested objective remains text</script>');
  await page.getByRole('button', { name: 'Save private draft', exact: true }).click(); await expect(page.getByText('Draft saved. Version 1.', { exact: true })).toBeVisible();
  const saved = await (await page.request.get(`/api/proposals/${id}/draft`)).json(); expect(saveCalls).toBe(1);
  expect(saved.content.criteria[0].stableKey).toBe(original.content.criteria[0].stableKey); expect(saved.content.criteria[1].stableKey).toBeTruthy();
  expect(saved.state).toBe('DRAFT'); expect(saved.content.expectedBehavior).toBe('<script>Suggested objective remains text</script>');
  await page.getByRole('button', { name: 'Refresh my AI resource use' }).click(); await expect(page.getByText('1 / 1 / 0', { exact: true })).toBeVisible();
  await expect(page.getByText('1 of 1 outbound attempts', { exact: true })).toBeVisible();
  await expect(page.getByText(/Singapore midnight \(SGT\).*UTC/)).toBeVisible();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  expect((await new AxeBuilder({ page }).withRules(['label-content-name-mismatch']).analyze()).violations).toEqual([]);
});

test('provider and malformed-output failures preserve the editor and permit a manual save', async ({ page }) => {
  const id = await openEditor(page, '[test-ai-unavailable]');
  await page.getByRole('button', { name: 'Generate draft suggestions' }).click(); await expect(page.getByText(/assistant is unavailable/i)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Spec Draft Assistant', exact: true }).getByRole('status')).toContainText(/Reference: [a-f0-9-]{36}/i);
  await expect(page.getByLabel('Expected behavior (required)')).toHaveValue('Original behavior');
  await page.getByLabel('Problem (required)').fill('[test-ai-invalid]'); await page.getByRole('button', { name: 'Save private draft' }).click(); await expect(page.getByText('Draft saved. Version 1.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Generate draft suggestions' }).click(); await expect(page.getByText(/assistant is unavailable/i)).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Replace expected behavior/ })).toHaveCount(0);
  await page.getByLabel('Expected behavior (required)').fill('Manually recovered behavior'); await page.getByRole('button', { name: 'Save private draft' }).click(); await expect(page.getByText('Draft saved. Version 2.', { exact: true })).toBeVisible();
  expect((await (await page.request.get(`/api/proposals/${id}/draft`)).json()).content.expectedBehavior).toBe('Manually recovered behavior');
});

test('manual edits invalidate a generation held behind a real database barrier without discarding input', async ({ page }) => {
  const problem = `[test-ai-delayed] ${randomUUID()}`; const gate = await pool.connect();
  await gate.query('SELECT pg_advisory_lock(hashtext($1))', ['contributor-ai-browser-' + problem]);
  const gatePid = (await gate.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
  let released = false;
  try {
    await openEditor(page, problem); await page.getByRole('button', { name: 'Generate draft suggestions' }).click();
    await expect(page.getByRole('button', { name: 'Generating suggestions...' })).toBeVisible();
    await expect.poll(async () => (await pool.query<{ blocked: boolean }>('SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))) AS blocked', [gatePid])).rows[0]!.blocked).toBe(true);
    await page.getByLabel('Problem (required)').fill('Unsaved manual input wins');
    await expect(page.getByRole('button', { name: 'Generate draft suggestions' })).toBeDisabled();
    await gate.query('SELECT pg_advisory_unlock(hashtext($1))', ['contributor-ai-browser-' + problem]); released = true;
    await expect(page.getByLabel('Problem (required)')).toHaveValue('Unsaved manual input wins');
    await expect(page.getByRole('heading', { name: 'Select suggestions to apply' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Save private draft' }).click(); await expect(page.getByText('Draft saved. Version 1.', { exact: true })).toBeVisible();
  } finally { if (!released) await gate.query('SELECT pg_advisory_unlock(hashtext($1))', ['contributor-ai-browser-' + problem]); gate.release(); }
});
