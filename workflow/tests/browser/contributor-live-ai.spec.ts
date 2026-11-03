import { expect, request, test, type Page } from '@playwright/test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import { contributorAiUsageResponseSchema, contributorDraftResponseSchema, draftResponseSchema } from '@specsentry/shared';

test.skip(process.env.RUN_LIVE_AI_ACCEPTANCE !== '1', 'Explicit opt-in required for real provider requests.');
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

const username = `live-ai-acceptance-${randomUUID()}`;
const password = 'synthetic-live-ai-acceptance-password';
let pool: Pool;

test.beforeAll(async () => {
  const url = process.env.TEST_DATABASE_URL ? new URL(process.env.TEST_DATABASE_URL) : null;
  assert(url && ['127.0.0.1', 'localhost'].includes(url.hostname) && url.pathname.endsWith('_test'),
    'Explicit disposable loopback test database required.');
  assert(process.env.PLAYWRIGHT_NO_COPY_PROMPT === '1', 'Use the metadata-only live acceptance config.');
  pool = new Pool({ connectionString: url.href });
  await pool.query('INSERT INTO "UserAccount"(id,username,"passwordHash",role) VALUES($1,$2,$3,\'CONTRIBUTOR\')',
    [randomUUID(), username, await argon2.hash(password, { type: argon2.argon2id })]);
});
test.afterAll(async () => { await pool?.end(); });

async function readDraft(page: Page, id: string) {
  const response = await page.request.get(`/api/proposals/${id}/draft`);
  assert(response.status() === 200, 'Owner draft read rejected.');
  const result = draftResponseSchema.safeParse(await response.json());
  assert(result.success, 'Owner draft response shape rejected.');
  return result.data;
}

async function openEditor(page: Page, problem = 'Users can add tasks and mark them completed. Persistence and deletion are unspecified.') {
  await page.setExtraHTTPHeaders({ 'X-Forwarded-Proto': 'https' });
  await page.goto('/contributor');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password').fill(password);
  await page.getByLabel('Password').press('Enter');
  await expect.poll(() => page.getByRole('heading', { name: 'Private drafts', exact: true }).isVisible()).toBe(true);
  const session = await (await page.request.get('/api/auth/session')).json();
  const response = await page.request.post('/api/proposals', { headers: { 'x-csrf-token': session.csrfToken }, data: {
    title: 'Synthetic live task list', summary: '',
    problem,
    constraints: 'No accounts or external integrations.', expectedBehavior: 'Original synthetic behavior',
    criteria: [{ statement: 'Original synthetic criterion', required: false }], diffText: '', evidence: [],
  } });
  assert(response.status() === 201, 'Synthetic proposal creation rejected.');
  const root = await response.json();
  await page.goto(`/contributor/drafts/${root.proposalId}/edit`);
  await expect.poll(async () => (await page.getByLabel('Expected behavior (required)').inputValue()) === 'Original synthetic behavior').toBe(true);
  return root.proposalId as string;
}

test('live suggestion needs explicit selection, application and save before owner content changes', async ({ page }) => {
  let stage = 'login/create';
  try {
    const id = await openEditor(page);
    const original = await readDraft(page, id);
    let saves = 0; let generations = 0;
    page.on('request', request => {
      if (request.method() === 'PATCH' && request.url().endsWith(`/api/proposals/${id}/draft`)) saves++;
      if (request.method() === 'POST' && request.url().endsWith(`/api/proposals/${id}/ai/draft`)) generations++;
    });
    stage = 'one real generation';
    const pending = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/api/proposals/${id}/ai/draft`));
    await page.getByRole('button', { name: 'Generate draft suggestions', exact: true }).click();
    const response = await pending;
    console.info(JSON.stringify({ check: 'live-generation-http', status: response.status() }));
    assert(response.status() === 200, 'Live generation rejected; no validation retry.');
    const suggestion = contributorDraftResponseSchema.safeParse(await response.json());
    assert(suggestion.success, 'Live suggestion shape invalid.');
    assert(suggestion.data.analyzedScope.proposalId === id && suggestion.data.analyzedScope.workingRevisionId === original.workingRevisionId
      && suggestion.data.analyzedScope.expectedVersion === original.version, 'Live suggestion scope mismatched.');
    await expect.poll(() => page.getByRole('heading', { name: 'Select suggestions to apply' }).isVisible()).toBe(true);
    assert(await page.getByRole('button', { name: 'Apply selected suggestions to editor' }).isDisabled(), 'Apply must require selection.');
    assert((await page.getByLabel('Expected behavior (required)').inputValue()) === original.content.expectedBehavior, 'Generation changed the editor.');
    assert(JSON.stringify((await readDraft(page, id)).content) === JSON.stringify(original.content) && saves === 0, 'Generation persisted content.');
    stage = 'explicit selection and local application';
    await page.getByRole('checkbox', { name: /^Add a new required criterion:/ }).first().check();
    await page.getByRole('button', { name: 'Apply selected suggestions to editor', exact: true }).click();
    await expect.poll(async () => (await page.getByLabel('Criterion 2 statement', { exact: true }).inputValue()) === suggestion.data.result.acceptanceCriteria[0]).toBe(true);
    assert(await page.getByLabel('Criterion 2 required', { exact: true }).isChecked(), 'Applied criterion must default required.');
    const beforeSave = await readDraft(page, id);
    assert(beforeSave.version === original.version && JSON.stringify(beforeSave.content) === JSON.stringify(original.content)
      && saves === 0, 'Applying suggestions persisted without Save.');
    stage = 'explicit save and reconciliation';
    await page.getByRole('button', { name: 'Save private draft', exact: true }).click();
    await expect.poll(() => page.getByText(`Draft saved. Version ${original.version + 1}.`, { exact: true }).isVisible()).toBe(true);
    const saved = await readDraft(page, id);
    assert(saved.version === original.version + 1 && saved.state === 'DRAFT' && saves === 1 && generations === 1, 'Save/lifecycle request count mismatch.');
    assert(saved.content.criteria.length === 2 && saved.content.criteria[0].stableKey === original.content.criteria[0].stableKey
      && saved.content.criteria[1].statement === suggestion.data.result.acceptanceCriteria[0]
      && saved.content.criteria[1].required && Boolean(saved.content.criteria[1].stableKey), 'Selected criterion was not persisted correctly.');
    assert(saved.content.expectedBehavior === original.content.expectedBehavior, 'Unselected objective was applied.');
    stage = 'usage accounting';
    const usageResponse = await page.request.get('/api/contributor/ai/usage');
    const usage = contributorAiUsageResponseSchema.safeParse(await usageResponse.json());
    assert(usageResponse.status() === 200 && usage.success, 'Own usage response rejected.');
    assert(usage.data.requests === 1 && usage.data.attempts >= 1 && usage.data.attempts <= 2
      && usage.data.completedAttempts === usage.data.attempts && usage.data.usageReportedAttempts === usage.data.attempts
      && usage.data.usage.promptTokens !== null && usage.data.usage.completionTokens !== null, 'Reported usage accounting missing.');
    const metadata = await pool.query('SELECT row_to_json(r) AS record FROM "AiRequest" r WHERE "proposalId"=$1', [id]);
    const attempts = await pool.query('SELECT row_to_json(a) AS record FROM "AiOutboundAttempt" a JOIN "AiRequest" r ON r.id=a."requestId" WHERE r."proposalId"=$1', [id]);
    assert(metadata.rows.length === 1 && attempts.rows.length === usage.data.attempts
      && metadata.rows[0].record.outcome === 'SUCCESS' && metadata.rows[0].record.templateVersion === 'contributor-draft-v3', 'Durable AI metadata mismatched usage.');
    const serializedMetadata = JSON.stringify([metadata.rows, attempts.rows]);
    assert(!serializedMetadata.includes(original.content.problem) && !serializedMetadata.includes(suggestion.data.result.objective)
      && !serializedMetadata.includes(suggestion.data.result.acceptanceCriteria[0]) && !/clsk_[A-Za-z0-9]+_[A-Za-z0-9_-]{16,}/.test(serializedMetadata),
    'AI metadata retained context, suggestions or credential-shaped data.');
    console.info(JSON.stringify({ check: 'authenticated-live-apply-save', passed: true, generations, saves,
      requests: usage.data.requests, attempts: usage.data.attempts, retries: usage.data.retries, usage: usage.data.usage }));
  } catch { throw new Error(`Authenticated live acceptance failed at ${stage}; raw page/model data intentionally omitted.`); }
});

test('real backend preflight and guard denials keep outbound attempts unchanged and allow manual recovery', async ({ page }) => {
  let stage = 'login/create large synthetic draft';
  try {
    const id = await openEditor(page, 'x'.repeat(3500));
    const original = await readDraft(page, id);
    const before = contributorAiUsageResponseSchema.safeParse(await (await page.request.get('/api/contributor/ai/usage')).json());
    assert(before.success, 'Usage baseline shape invalid.');
    stage = 'authentication and CSRF denials';
    const body = { expectedVersion: original.version, workingRevisionId: original.workingRevisionId };
    const anonymous = await request.newContext({ baseURL: 'http://127.0.0.1:3197' });
    try { assert((await anonymous.post(`/api/proposals/${id}/ai/draft`, { data: body })).status() === 401, 'Anonymous AI request not rejected.'); }
    finally { await anonymous.dispose(); }
    assert((await page.request.post(`/api/proposals/${id}/ai/draft`, { data: body })).status() === 403, 'Missing CSRF AI request not rejected.');
    stage = 'real backend input-limit rejection';
    const pending = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/api/proposals/${id}/ai/draft`));
    await page.getByRole('button', { name: 'Generate draft suggestions', exact: true }).click();
    assert((await pending).status() === 422, 'Oversized AI context was not rejected before dispatch.');
    await expect.poll(() => page.getByText(/cannot fit the assistant context/i).isVisible()).toBe(true);
    assert((await page.getByLabel('Expected behavior (required)').inputValue()) === original.content.expectedBehavior
      && (await readDraft(page, id)).version === original.version, 'Backend rejection changed editor or saved content.');
    const after = contributorAiUsageResponseSchema.safeParse(await (await page.request.get('/api/contributor/ai/usage')).json());
    assert(after.success && after.data.attempts === before.data.attempts && after.data.requests === before.data.requests + 1
      && after.data.preflightRejections === before.data.preflightRejections + 1, 'Preflight or guard denial consumed outbound budget.');
    stage = 'manual recovery after backend rejection';
    await page.getByLabel('Expected behavior (required)').fill('Manual synthetic recovery after backend rejection');
    await page.getByRole('button', { name: 'Save private draft', exact: true }).click();
    await expect.poll(() => page.getByText(`Draft saved. Version ${original.version + 1}.`, { exact: true }).isVisible()).toBe(true);
    assert((await readDraft(page, id)).content.expectedBehavior === 'Manual synthetic recovery after backend rejection', 'Backend rejection prevented manual save.');
    console.info(JSON.stringify({ check: 'real-backend-preflight-and-guard-recovery', passed: true, anonymousStatus: 401, csrfStatus: 403,
      preflightStatus: 422, outboundAttemptsAdded: 0 }));
  } catch { throw new Error(`Backend recovery acceptance failed at ${stage}; raw page/model data intentionally omitted.`); }
});

test('simulated browser HTTP failure preserves manual editor and explicit save', async ({ page }) => {
  let stage = 'login/create';
  try {
    const id = await openEditor(page);
    const original = await readDraft(page, id);
    let intercepted = 0;
    await page.route(`**/api/proposals/${id}/ai/draft`, async route => {
      intercepted++;
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic browser failure' }) });
    }, { times: 1 });
    stage = 'simulated failure';
    await page.getByRole('button', { name: 'Generate draft suggestions', exact: true }).click();
    await expect.poll(() => page.getByText(/assistant is unavailable/i).isVisible()).toBe(true);
    assert(intercepted === 1 && (await page.getByLabel('Expected behavior (required)').inputValue()) === original.content.expectedBehavior,
      'Simulated failure lost editor input.');
    assert((await readDraft(page, id)).version === original.version, 'Simulated failure changed saved version.');
    stage = 'manual recovery save';
    await page.getByLabel('Expected behavior (required)').fill('Manual synthetic recovery after browser failure');
    await page.getByRole('button', { name: 'Save private draft', exact: true }).click();
    await expect.poll(() => page.getByText(`Draft saved. Version ${original.version + 1}.`, { exact: true }).isVisible()).toBe(true);
    const saved = await readDraft(page, id);
    assert(saved.content.expectedBehavior === 'Manual synthetic recovery after browser failure' && saved.state === 'DRAFT', 'Manual recovery did not persist.');
    console.info(JSON.stringify({ check: 'simulated-browser-failure-manual-save', passed: true, providerCalls: 0 }));
  } catch { throw new Error(`Simulated recovery acceptance failed at ${stage}; raw page/model data intentionally omitted.`); }
});
