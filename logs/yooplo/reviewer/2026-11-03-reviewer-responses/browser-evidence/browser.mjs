import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const output = 'logs/yooplo/reviewer/2026-11-03-reviewer-responses/browser-evidence';
await mkdir(output, { recursive: true });
const timestamp = '2026-10-01T00:00:00.000Z';
const author = { id: 'a', username: 'Synthetic contributor' };
const item = { id: 'p', version: 1, title: 'Synthetic response review', author, summary: 'Summary', firstSubmittedAt: timestamp, latestSubmittedAt: timestamp, awaitingRevision: false, state: 'IN_REVIEW', assignmentId: 'assignment', revisionId: 'revision', assignmentVersion: 1 };
const detail = { id: 'p', version: 1, title: item.title, author, firstSubmittedAt: timestamp, latestSubmittedAt: timestamp, state: 'IN_REVIEW', assignment: { id: 'assignment', revisionId: 'revision', version: 1, reviewer: { id: 'r', username: 'Synthetic reviewer' } }, revision: { id: 'revision', number: 2, summary: 'Summary', problem: 'Problem', constraints: '', expectedBehavior: 'Expected', diffText: '', submittedAt: timestamp, criteria: [{ id: 'c', stableKey: 'AC1', statement: 'Required behavior', required: true }], evidence: [], criterionEvidenceLinks: [] } };
const response = { id: 'response', proposalId: 'p', findingId: 'historical-finding', revisionId: 'older-revision', actor: author, text: '<img src=x onerror=window.responseInjected=true>\nSecond response line', mutationVersion: 1, createdAt: timestamp };
const empty = { items: [], nextCursor: null };
const results = { scope: 'Synthetic API routes only; actual local frontend 5173', widths: [], errors: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const width of [1440, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const page = await context.newPage(); const mutations = []; const unexpected = [];
    page.on('pageerror', error => results.errors.push(error.message));
    await context.route('**/api/**', async route => {
      const req = route.request(); const url = new URL(req.url()); const path = url.pathname;
      const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (req.method() !== 'GET') { mutations.push(path); return send({}, 500); }
      if (path === '/api/auth/session') return send({ account: { id: 'r', username: 'Synthetic reviewer', role: 'REVIEWER' }, csrfToken: 'a'.repeat(64), expiresAt: Date.now() + 1800000 });
      if (path === '/api/notifications' || path === '/api/review-pool') return send(empty);
      if (path === '/api/reviews/assignments') return send({ items: [item], nextCursor: null });
      if (path === '/api/proposals/p') return send(detail);
      if (path === '/api/proposals/p/responses') return send(url.searchParams.has('cursor') ? { items: [{ ...response, id: 'response2', text: 'Earlier historical response', revisionId: 'earliest-revision' }], nextCursor: null } : { items: [response], nextCursor: 'next/+=' });
      if (path === '/api/proposals/p/review') return send({ proposalId: 'p', revisionId: 'revision', version: 1, assignmentId: 'assignment', assignmentVersion: 1, editable: true, coverage: [], approvalBlockers: [{ code: 'MISSING_ASSESSMENT', criterionId: 'c' }] });
      if (['revisions', 'activity', 'findings', 'coverage-history', 'decisions'].some(suffix => path === `/api/proposals/p/${suffix}`)) return send(empty);
      unexpected.push(path); return send({}, 404);
    });
    await page.goto('http://127.0.0.1:5173/reviewer');
    await page.getByRole('button', { name: 'My assignments', exact: true }).click();
    await page.getByRole('button', { name: `Open ${item.title}`, exact: true }).click();
    const history = page.getByRole('region', { name: 'Finding responses', exact: true });
    await expect(history.getByText(response.text, { exact: true })).toBeVisible();
    await expect(history).toContainText('Synthetic contributor (a)');
    await expect(history).toContainText('Finding: historical-finding');
    await expect(history).toContainText('Revision: older-revision');
    assert.equal(await history.locator('img').count(), 0);
    assert.equal(await page.evaluate(() => window.responseInjected), undefined);
    await expect(page.getByRole('button', { name: 'Save AC1 assessment', exact: true })).toBeEnabled();
    await history.getByRole('button', { name: 'Load more responses' }).click();
    await expect(history.getByText('Earlier historical response')).toBeVisible();
    await expect(history.getByText(response.text, { exact: true })).toBeVisible();
    await expect(history.getByRole('listitem')).toHaveCount(2);
    assert.equal(await history.getByRole('button', { name: 'Load more responses' }).count(), 0);
    await history.scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No viewport overflow');
    await page.screenshot({ path: `${output}/responses-${width}.png` });
    assert.deepEqual(mutations, [], 'Response viewing must not mutate or auto-resolve');
    assert.deepEqual(unexpected, [], 'All API routes must be synthetic and expected');
    results.widths.push({ width, escaped: true, paginated: true, manualEnabled: true, noOverflow: true, businessMutations: 0 });
    await context.close();
  }
  assert.deepEqual(results.errors, []);
} finally {
  await browser.close();
  await writeFile(`${output}/results.json`, JSON.stringify(results, null, 2));
}
console.log(JSON.stringify(results));
