import { expect, test, type APIRequestContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as argon2 from 'argon2';

const prefix = `contributor-cycle-${randomUUID()}`;
const password = 'synthetic-contributor-cycle-password';
const content = { title: 'Contributor lifecycle', problem: 'Original problem', constraints: '', expectedBehavior: 'Initial expected behavior',
  summary: 'Initial summary', criteria: [{ statement: 'Required behavior', required: true }], evidence: [],
  diffText: '--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n' };
let pool: Pool;
test.beforeAll(async () => {
  if (!process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test')) throw new Error('Explicit migrated disposable test database required');
  pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  for (const [name, role] of [['owner', 'CONTRIBUTOR'], ['reviewer', 'REVIEWER'], ['other', 'CONTRIBUTOR']]) {
    await pool.query('INSERT INTO "UserAccount" (id,username,"passwordHash",role) VALUES ($1,$2,$3,$4)', [randomUUID(), `${prefix}-${name}`, hash, role]);
  }
});
test.afterAll(async () => { await pool?.end(); });

async function login(context: APIRequestContext, name: string) {
  const bootstrap = await (await context.get('/api/auth/csrf')).json();
  const response = await context.post('/api/auth/login', { headers: { 'x-csrf-token': bootstrap.csrfToken }, data: { username: `${prefix}-${name}`, password } });
  expect(response.status()).toBe(200); return (await response.json()).csrfToken as string;
}
const scope = (root: { version: number; revision: { id: string }; assignment: { id: string; version: number } }) => ({
  expectedVersion: root.version, revisionId: root.revision.id, assignmentId: root.assignment.id, expectedAssignmentVersion: root.assignment.version,
});

test('Contributor submission, pooled replacement, Reviewer changes, owner resubmission and withdrawal preserve history', async ({ page, playwright }) => {
  test.setTimeout(90000);
  const reviewer = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3000', extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });
  const other = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3000', extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });
  try {
    const reviewerToken = await login(reviewer, 'reviewer'); await login(other, 'other');
    await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' });
    await page.goto('/contributor'); await page.getByLabel('Username').fill(`${prefix}-owner`); await page.getByLabel('Password').fill(password); await page.getByLabel('Password').press('Enter');
    await expect(page.getByRole('heading', { level: 1, name: 'Private drafts', exact: true })).toBeVisible();
    const auth = await (await page.request.get('/api/auth/session')).json();
    const created = await page.request.post('/api/proposals', { headers: { 'x-csrf-token': auth.csrfToken }, data: { ...content, title: 'LongTitle'.repeat(22) } });
    expect(created.status()).toBe(201); const draft = await created.json(); const id = draft.proposalId;
    await page.goto(`/contributor/drafts/${id}`);
    await page.getByRole('button', { name: 'Submit saved working copy' }).click();
    await expect(page.getByRole('button', { name: 'Cancel action' })).toBeFocused(); await page.getByRole('button', { name: 'Confirm submit' }).click();
    await expect(page.getByText('Viewing immutable submitted revision 1. Latest submitted revision: 1.')).toBeVisible();
    const first = await (await page.request.get(`/api/proposals/${id}`)).json();
    await page.getByRole('link', { name: 'All your proposals', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Your proposals', exact: true })).toBeVisible();
    expect((await new AxeBuilder({ page }).withRules(['label-content-name-mismatch']).analyze()).violations).toEqual([]);
    await page.getByRole('link', { name: `${'LongTitle'.repeat(22)} Latest submitted revision 1 SUBMITTED`, exact: true }).click();
    await expect(page.getByText('Viewing immutable submitted revision 1. Latest submitted revision: 1.')).toBeVisible();
    expect((await other.get(`/api/proposals/${id}`)).status()).toBe(403);
    expect((await other.get(`/api/proposals/${id}/draft`)).status()).toBe(403);
    await page.getByRole('link', { name: 'Open private working copy' }).click(); await page.getByRole('link', { name: 'Edit private draft' }).click();
    await page.getByLabel('Expected behavior (required)').fill('Pooled replacement behavior');
    await page.getByRole('button', { name: 'Save private draft' }).click(); await expect(page.getByText('Draft saved. Version 2.')).toBeVisible();
    await page.getByRole('button', { name: 'Back to draft detail' }).click(); await page.getByRole('button', { name: 'Submit saved working copy' }).click(); await page.getByRole('button', { name: 'Confirm submit' }).click();
    await expect(page.getByText('Viewing immutable submitted revision 2. Latest submitted revision: 2.')).toBeVisible();
    const second = await (await page.request.get(`/api/proposals/${id}`)).json(); expect(second.state).toBe('SUBMITTED');
    const claimed = await reviewer.post(`/api/proposals/${id}/claim`, { headers: { 'x-csrf-token': reviewerToken }, data: { expectedVersion: second.version } }); expect(claimed.status()).toBe(200);
    let root = await (await reviewer.get(`/api/proposals/${id}`)).json(); const reviewerId = root.assignment.reviewer.id;
    const finding = await reviewer.post(`/api/proposals/${id}/findings`, { headers: { 'x-csrf-token': reviewerToken }, data: { ...scope(root), severity: 'HIGH', description: '<script>Finding remains open</script>' } }); expect(finding.status()).toBe(201); const findingId = (await finding.json()).finding.id;
    root = await (await reviewer.get(`/api/proposals/${id}`)).json();
    expect((await reviewer.post(`/api/findings/${findingId}/amendments`, { headers: { 'x-csrf-token': reviewerToken }, data: { ...scope(root), description: 'Amended concern', reason: 'Clarification' } })).status()).toBe(200);
    root = await (await reviewer.get(`/api/proposals/${id}`)).json();
    expect((await reviewer.post(`/api/proposals/${id}/decision`, { headers: { 'x-csrf-token': reviewerToken, 'Idempotency-Key': randomUUID() }, data: { ...scope(root), decision: 'REQUEST_CHANGES', note: 'Please revise the behavior' } })).status()).toBe(200);
    await page.getByRole('button', { name: 'Refresh submitted proposal' }).click();
    await expect(page.getByText(/Current state: CHANGES_REQUESTED/)).toBeVisible(); await expect(page.getByText('Revision 2 · REQUEST_CHANGES', { exact: false })).toBeVisible();
    await expect(page.getByText('<script>Finding remains open</script>', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Show finding amendments and history' }).click(); await expect(page.getByText('Amended concern', { exact: true })).toBeVisible();
    expect(await page.locator('script:not([src])').count()).toBe(0);
    await page.getByRole('button', { name: `Respond to finding ${findingId}`, exact: true }).click();
    await page.getByLabel('Response text (required)').fill('<b>Owner response stays plain text</b>');
    page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('link', { name: 'All your proposals', exact: true }).click();
    await expect(page.getByLabel('Response text (required)')).toHaveValue('<b>Owner response stays plain text</b>');
    await expect(page.getByRole('button', { name: 'Refresh submitted proposal' })).toBeDisabled();
    await page.getByRole('button', { name: 'Add finding response' }).click();
    await expect(page.getByRole('region', { name: 'Finding responses', exact: true }).getByText('<b>Owner response stays plain text</b>', { exact: true })).toBeVisible();
    expect((await (await reviewer.get(`/api/proposals/${id}/responses`)).json()).items[0]).toMatchObject({ findingId, text: '<b>Owner response stays plain text</b>' });
    expect((await (await page.request.get(`/api/proposals/${id}/findings`)).json()).items[0].status).toBe('OPEN');
    await page.getByLabel('Submitted revision', { exact: true }).selectOption(first.revision.id);
    await expect(page.getByText('Viewing immutable submitted revision 1. Latest submitted revision: 2.')).toBeVisible();
    await page.getByRole('button', { name: 'Clone latest submitted content' }).click();
    await expect(page.getByText(/Existing private changes will be overwritten/)).toBeVisible();
    await page.getByRole('button', { name: 'Confirm clone-latest' }).click();
    await expect(page.getByLabel('Expected behavior (required)')).toHaveValue('Pooled replacement behavior');
    await page.getByLabel('Expected behavior (required)').fill('Revised behavior after changes requested'); await page.getByRole('button', { name: 'Save private draft' }).click();
    await expect(page.getByText('Draft saved. Version 10.')).toBeVisible(); await page.getByRole('button', { name: 'Back to draft detail' }).click();
    await page.getByRole('button', { name: 'Submit saved working copy' }).click(); await page.getByRole('button', { name: 'Confirm submit' }).click();
    await expect(page.getByText('Viewing immutable submitted revision 3. Latest submitted revision: 3.')).toBeVisible();
    root = await (await page.request.get(`/api/proposals/${id}`)).json(); expect(root.state).toBe('IN_REVIEW'); expect(root.assignment.reviewer.id).toBe(reviewerId);
    expect(root.revision.criteria[0].stableKey).toBe(first.revision.criteria[0].stableKey);
    expect((await (await page.request.get(`/api/proposals/${id}?revisionId=${first.revision.id}`)).json()).revision).toEqual(first.revision);
    await page.getByLabel('Submitted revision', { exact: true }).selectOption(second.revision.id); await expect(page.getByText('Viewing immutable submitted revision 2. Latest submitted revision: 3.')).toBeVisible();
    await expect(page.getByText('Pooled replacement behavior', { exact: true })).toBeVisible();
    expect((await (await page.request.get(`/api/proposals/${id}/findings`)).json()).items[0].status).toBe('OPEN');
    await page.setViewportSize({ width: 640, height: 900 }); await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()).violations).toEqual([]);
    await page.getByRole('button', { name: 'Withdraw proposal' }).click(); await page.getByLabel('Withdrawal reason (required)').fill('Owner withdraws after preserving history'); await page.getByRole('button', { name: 'Confirm withdraw' }).click();
    await expect(page.getByText(/Current state: WITHDRAWN/)).toBeVisible();
    expect((await reviewer.get(`/api/proposals/${id}`)).status()).toBe(403);
    const notices = await (await reviewer.get('/api/notifications')).json(); expect(notices.items.some((notice: { kind: string; proposalId: string }) => notice.kind === 'WITHDRAWN' && notice.proposalId === id)).toBe(true);
    const entries = await (await page.request.get(`/api/proposals/${id}/activity`)).json();
    expect(entries.items.find((entry: { action: string }) => entry.action === 'WITHDRAWN').reason).toBe('Owner withdraws after preserving history');
  } finally { await reviewer.dispose(); await other.dispose(); }
});

test('owner explicitly reopens an eligible approval without rewriting its decision', async ({ page, playwright }) => {
  const reviewer = await playwright.request.newContext({ baseURL: 'http://127.0.0.1:3000', extraHTTPHeaders: { 'X-Forwarded-Proto': 'https' } });
  try {
    const token = await login(reviewer, 'reviewer'); await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' });
    await page.goto('/contributor'); await page.getByLabel('Username').fill(`${prefix}-owner`); await page.getByLabel('Password').fill(password); await page.getByLabel('Password').press('Enter');
    await expect(page.getByRole('heading', { name: 'Private drafts', exact: true })).toBeVisible();
    const auth = await (await page.request.get('/api/auth/session')).json();
    const created = await (await page.request.post('/api/proposals', { headers: { 'x-csrf-token': auth.csrfToken }, data: content })).json();
    const submitted = await (await page.request.post(`/api/proposals/${created.proposalId}/submit`, { headers: { 'x-csrf-token': auth.csrfToken, 'Idempotency-Key': randomUUID() }, data: { expectedVersion: 0, workingRevisionId: created.workingRevisionId } })).json();
    const id = created.proposalId;
    expect((await reviewer.post(`/api/proposals/${id}/claim`, { headers: { 'x-csrf-token': token }, data: { expectedVersion: submitted.version } })).status()).toBe(200);
    let root = await (await reviewer.get(`/api/proposals/${id}`)).json();
    expect((await reviewer.put(`/api/proposals/${id}/coverage/${root.revision.criteria[0].id}`, { headers: { 'x-csrf-token': token }, data: { ...scope(root), operation: 'ASSESS', status: 'COVERED' } })).status()).toBe(200);
    root = await (await reviewer.get(`/api/proposals/${id}`)).json();
    expect((await reviewer.post(`/api/proposals/${id}/decision`, { headers: { 'x-csrf-token': token, 'Idempotency-Key': randomUUID() }, data: { ...scope(root), decision: 'APPROVE' } })).status()).toBe(200);
    const decisions = await (await page.request.get(`/api/proposals/${id}/decisions`)).json();
    await page.goto(`/contributor/proposals/${id}`); await page.getByRole('button', { name: 'Reopen approval for revision' }).click();
    await expect(page.getByText(/Reopening invalidates this approval/)).toBeVisible(); await page.getByRole('button', { name: 'Confirm reopen' }).click();
    await expect(page.getByText(/Current state: CHANGES_REQUESTED/)).toBeVisible();
    expect((await (await page.request.get(`/api/proposals/${id}/decisions`)).json()).items).toEqual(decisions.items);
    expect((await (await page.request.get(`/api/proposals/${id}`)).json()).effectiveApproval).toBe(false);
    await expect(page.getByRole('link', { name: 'Open private working copy' })).toBeVisible();
  } finally { await reviewer.dispose(); }
});
