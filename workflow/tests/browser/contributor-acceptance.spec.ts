import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const prefix = `con-response-acceptance-${randomUUID()}`;
const password = 'synthetic-independent-response-password';
let pool: Pool;
test.beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.endsWith('_test')) throw new Error('Explicit disposable test database required');
  pool = new Pool({ connectionString: url });
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  for (const [name, role] of [['owner', 'CONTRIBUTOR'], ['reviewer', 'REVIEWER']]) {
    await pool.query('INSERT INTO "UserAccount"(id,username,"passwordHash",role) VALUES($1,$2,$3,$4)',
      [randomUUID(), `${prefix}-${name}`, hash, role]);
  }
});
test.afterAll(async () => { await pool?.end(); });

test('Control and middle-click draft links open authorized detail with a real shared session', async ({ page }) => {
  await page.context().setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' });
  await page.goto('/contributor'); await page.getByLabel('Username').fill(`${prefix}-owner`);
  await page.getByLabel('Password').fill(password); await page.getByLabel('Password').press('Enter');
  await expect(page.getByRole('heading', { name: 'Private drafts', exact: true })).toBeVisible();
  const auth = await (await page.request.get('/api/auth/session')).json();
  const created = await page.request.post('/api/proposals', { headers: { 'x-csrf-token': auth.csrfToken }, data: {
    title: 'Real session modified navigation', summary: '', problem: 'Private problem', constraints: '',
    expectedBehavior: 'Private expected behavior', criteria: [], evidence: [], diffText: '',
  } });
  expect(created.status()).toBe(201); const id = (await created.json()).proposalId;
  await page.reload();
  const link = page.getByRole('link', { name: 'Real session modified navigation', exact: true });
  for (const method of ['Control', 'middle']) {
    const opened = page.context().waitForEvent('page');
    await link.click(method === 'middle' ? { button: 'middle' } : { modifiers: ['Control'] });
    const tab = await opened;
    try {
      await expect(tab).toHaveURL(`http://127.0.0.1:3000/contributor/drafts/${id}`);
      await expect(tab.getByRole('heading', { name: 'Private draft detail', level: 1 })).toBeVisible();
      await expect(tab.getByText('Private problem', { exact: true })).toBeVisible();
      await expect(page).toHaveURL('http://127.0.0.1:3000/contributor');
    } finally { await tab.close(); }
  }
});

test('a committed finding response with a lost reply reconciles without duplicating or resolving the finding', async ({ page, playwright }) => {
  const reviewer = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3000', extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });
  try {
    const bootstrap = await (await reviewer.get('/api/auth/csrf')).json();
    const loggedIn = await reviewer.post('/api/auth/login', { headers: { 'x-csrf-token': bootstrap.csrfToken },
      data: { username: `${prefix}-reviewer`, password } });
    expect(loggedIn.status()).toBe(200); const reviewerToken = (await loggedIn.json()).csrfToken;
    await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' }); await page.goto('/contributor');
    await page.getByLabel('Username').fill(`${prefix}-owner`); await page.getByLabel('Password').fill(password);
    await page.getByLabel('Password').press('Enter'); await expect(page.getByRole('heading', { name: 'Private drafts', exact: true })).toBeVisible();
    const auth = await (await page.request.get('/api/auth/session')).json();
    const created = await page.request.post('/api/proposals', { headers: { 'x-csrf-token': auth.csrfToken }, data: {
      title: 'Independent lost response', summary: 'Summary', problem: 'Problem', constraints: '', expectedBehavior: 'Expected',
      criteria: [{ statement: 'Required result', required: true }], evidence: [],
      diffText: '--- a/f\n+++ b/f\n@@ -1 +1 @@\n-old\n+new\n',
    } });
    expect(created.status()).toBe(201); const draft = await created.json(); const id = draft.proposalId;
    const submitted = await page.request.post(`/api/proposals/${id}/submit`, { headers: { 'x-csrf-token': auth.csrfToken, 'Idempotency-Key': randomUUID() },
      data: { expectedVersion: draft.version, workingRevisionId: draft.workingRevisionId } });
    expect(submitted.status()).toBe(200); const submission = await submitted.json();
    const claim = await reviewer.post(`/api/proposals/${id}/claim`, { headers: { 'x-csrf-token': reviewerToken }, data: { expectedVersion: submission.version } });
    expect(claim.status()).toBe(200); const claimed = await claim.json();
    const found = await reviewer.post(`/api/proposals/${id}/findings`, { headers: { 'x-csrf-token': reviewerToken }, data: {
      expectedVersion: claimed.version, revisionId: claimed.revisionId, assignmentId: claimed.assignmentId,
      expectedAssignmentVersion: claimed.assignmentVersion, severity: 'HIGH', description: 'Keep this finding open',
    } });
    expect(found.status()).toBe(201); const finding = await found.json(); const findingId = finding.finding.id;
    await page.goto(`/contributor/proposals/${id}`);
    await page.getByRole('button', { name: `Respond to finding ${findingId}`, exact: true }).click();
    const text = '<img src=x onerror="window.contributorResponseExecuted=true">\nPlain response survives an uncertain reply';
    await expect(page.getByLabel('Response text (required)')).toBeFocused();
    await page.getByLabel('Response text (required)').fill(text);
    let attempts = 0;
    await page.route(`**/api/findings/${findingId}/responses`, async route => {
      attempts += 1;
      const committed = await route.fetch(); expect(committed.status()).toBe(201);
      await route.abort('failed');
    });
    await page.getByRole('button', { name: 'Add finding response', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('uncertain');
    await expect(page.getByLabel('Response text (required)')).toHaveValue(text);
    await expect(page.getByRole('button', { name: 'Add finding response', exact: true })).toBeDisabled();
    expect(attempts).toBe(1);
    await page.getByRole('button', { name: 'Check current response state', exact: true }).click();
    await expect(page.getByRole('alert')).toContainText('This form will not be retried automatically');
    await page.getByRole('button', { name: 'Discard response form and refresh proposal', exact: true }).click();
    const history = page.getByRole('region', { name: 'Finding responses', exact: true });
    await expect(history.getByText(text, { exact: true })).toBeVisible();
    expect(attempts).toBe(1);
    expect(await page.locator('img[src="x"]').count()).toBe(0);
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).contributorResponseExecuted)).toBeUndefined();
    const replies = await (await page.request.get(`/api/proposals/${id}/responses`)).json();
    expect(replies.items).toHaveLength(1); expect(replies.items[0]).toMatchObject({ text, actor: { id: auth.account.id } });
    const current = await (await page.request.get(`/api/proposals/${id}`)).json(); expect(current.version).toBe(finding.version + 1);
    const findings = await (await page.request.get(`/api/proposals/${id}/findings`)).json(); expect(findings.items[0].status).toBe('OPEN');
    const activity = await (await page.request.get(`/api/proposals/${id}/activity`)).json();
    expect(activity.items.filter((item: { action: string }) => item.action === 'FINDING_RESPONDED')).toHaveLength(1);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
  } finally { await reviewer.dispose(); }
});
