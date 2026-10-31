// Synthetic UI acceptance only: start Vite on UI_BASE_URL before running this script.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseURL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5183';
const output = 'logs/yooplo/resources/2026-10-30-saas-ui-redesign/verification';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { scope: 'Synthetic API browser fixtures; no live backend/database authorization certification', checks: [], consoleErrors: [], expectedHttpErrors: [], screenshots: [] };
const csrfToken = 'a'.repeat(64);
const initial = {
  title: 'Specification ' + 'x'.repeat(180), problem: 'A private problem', constraints: '', expectedBehavior: 'A useful outcome',
  summary: 'Browser verification fixture', diffText: '+'.repeat(2000),
  criteria: [{ stableKey: 'criterion-1', statement: 'A required criterion', required: true }], evidence: [{ id: 'evidence-1', text: 'Evidence ' + 'e'.repeat(2000) }],
};

async function fixture({ signedIn = true, role = 'CONTRIBUTOR', populated = false, listStatus = 200, delay = 0 } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const state = { signedIn, role, populated, listStatus, content: structuredClone(initial), version: 1, deleted: false, requests: [] };
  page.on('pageerror', error => results.consoleErrors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (/status of (401|500)/.test(message.text())) results.expectedHttpErrors.push(message.text());
    else results.consoleErrors.push(message.text());
  });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    state.requests.push({ path: url.pathname, method: request.method(), csrf: request.headers()['x-csrf-token'] ?? null });
    const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: status === 204 ? undefined : JSON.stringify(body) });
    const session = { account: { id: 'synthetic-owner', username: 'browser.contributor', role: state.role }, csrfToken, expiresAt: Date.now() + 1800000 };
    if (url.pathname === '/api/auth/session') return send(state.signedIn ? session : {}, state.signedIn ? 200 : 401);
    if (url.pathname === '/api/auth/csrf') return send({ csrfToken });
    if (url.pathname === '/api/auth/login') { state.signedIn = true; return send(session); }
    if (url.pathname === '/api/auth/logout') { state.signedIn = false; return send({}, 204); }
    if (url.pathname === '/api/proposals' && request.method() === 'GET') {
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      if (state.listStatus !== 200) return send({}, state.listStatus);
      return send({ items: state.populated && !state.deleted && !url.searchParams.has('cursor') ? [{ proposalId: 'proposal-1', workingRevisionId: 'working-1', title: state.content.title, state: 'DRAFT', version: state.version, createdAt: '2026-10-30T10:00:00Z' }] : [], nextCursor: state.populated && !url.searchParams.has('cursor') ? 'page-2' : null });
    }
    if (url.pathname === '/api/proposals' && request.method() === 'POST') {
      state.content = request.postDataJSON(); state.populated = true;
      return send({ proposalId: 'proposal-1', revisionId: null, workingRevisionId: 'working-1', assignmentId: null, assignmentVersion: null, version: state.version, state: 'DRAFT' });
    }
    if (url.pathname === '/api/proposals/proposal-1/draft') {
      if (request.method() !== 'GET') {
        assert.equal(request.postDataJSON().expectedVersion, state.version);
        state.content = request.postDataJSON().content; state.version++;
        return send({ proposalId: 'proposal-1', revisionId: null, workingRevisionId: 'working-1', assignmentId: null, assignmentVersion: null, version: state.version, state: 'DRAFT' });
      }
      return send({ proposalId: 'proposal-1', workingRevisionId: 'working-1', version: state.version, state: 'DRAFT', content: state.content });
    }
    if (url.pathname === '/api/proposals/proposal-1' && request.method() === 'DELETE') { assert.equal(request.postDataJSON().confirmed, true); state.deleted = true; return send({}, 204); }
    return send({}, 404);
  });
  return { page, state, close: () => context.close() };
}

async function check(name, action) {
  try { await action(); results.checks.push({ name, status: 'passed' }); }
  catch (error) { results.checks.push({ name, status: 'failed', error: error.stack }); }
}
async function scan(page, name) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  assert.deepEqual(result.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => node.target) })), [], `${name} axe violations`);
}
async function capture(page, name) {
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true }); results.screenshots.push(`${name}.png`);
}
async function fits(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Document must fit viewport');
}

await check('login keyboard, CSRF, sign out and scan', async () => {
  const f = await fixture({ signedIn: false });
  try {
    await f.page.goto(baseURL);
    await expect(f.page.getByLabel('Username')).toBeVisible();
    await scan(f.page, 'login'); await capture(f.page, 'login-desktop');
    for (const width of [375, 768, 1024, 1440]) { await f.page.setViewportSize({ width, height: 1000 }); await fits(f.page); }
    await f.page.setViewportSize({ width: 375, height: 1000 }); await capture(f.page, 'login-mobile');
    await f.page.getByLabel('Username').fill('browser.contributor'); await f.page.getByLabel('Password').fill('synthetic-password');
    await f.page.getByLabel('Password').press('Enter');
    await expect(f.page.getByRole('heading', { name: 'No drafts yet' })).toBeVisible();
    assert.equal(f.state.requests.find(item => item.path === '/api/auth/login').csrf, csrfToken);
    const expand = f.page.getByRole('button', { name: 'Expand navigation' });
    if (await expand.count()) await expand.click();
    await f.page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(f.page.getByLabel('Username')).toBeVisible();
  } finally { await f.close(); }
});

for (const width of [375, 768, 1024, 1440]) {
  await check(`empty list responsive ${width}px and axe`, async () => {
    const f = await fixture();
    try {
      await f.page.setViewportSize({ width, height: 1000 }); await f.page.goto(`${baseURL}/contributor`);
      await expect(f.page.getByRole('heading', { name: 'No drafts yet' })).toBeVisible();
      await expect(f.page.getByTestId('draft-page-count')).toHaveText('0');
      await fits(f.page); await scan(f.page, `empty ${width}`); await capture(f.page, `empty-${width}`);
    } finally { await f.close(); }
  });
}

await check('populated page and empty cursor boundary', async () => {
  const f = await fixture({ populated: true });
  try {
    await f.page.goto(`${baseURL}/contributor`); await expect(f.page.getByTestId('draft-page-count')).toHaveText('1');
    await f.page.setViewportSize({ width: 375, height: 1000 }); await fits(f.page); await scan(f.page, 'populated list'); await capture(f.page, 'populated-mobile');
    await f.page.getByRole('button', { name: 'Next page' }).click();
    await expect(f.page.getByTestId('draft-page-count')).toHaveText('0');
    await expect(f.page.getByRole('heading', { name: 'No drafts yet' })).toHaveCount(0);
    await expect(f.page.getByRole('heading', { name: 'No drafts on this page' })).toBeVisible();
    await expect(f.page.getByRole('link', { name: 'Create your first draft' })).toHaveCount(0);
    await f.page.getByRole('button', { name: 'First page' }).click(); await expect(f.page.getByTestId('draft-page-count')).toHaveText('1');
  } finally { await f.close(); }
});

await check('create validation, draft detail and delete confirmation', async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${baseURL}/contributor/new`); await f.page.getByRole('button', { name: 'Create private draft', exact: true }).click();
    await expect(f.page.getByLabel('Title (required)')).toBeFocused();
    await f.page.getByLabel('Title (required)').fill('Keyboard specification'); await f.page.getByLabel('Problem (required)').fill('A problem');
    await f.page.getByLabel('Expected behavior (required)').fill('An expected result'); await scan(f.page, 'create validation');
    await f.page.getByRole('button', { name: 'Create private draft', exact: true }).click();
    await expect(f.page.getByRole('heading', { name: 'Private draft detail' })).toBeVisible(); await scan(f.page, 'detail');
    await f.page.getByRole('button', { name: 'Delete private draft', exact: true }).click();
    await expect(f.page.getByRole('button', { name: 'Cancel deletion' })).toBeFocused(); await scan(f.page, 'deletion confirmation');
    await capture(f.page, 'delete-confirmation'); await f.page.getByRole('button', { name: 'Cancel deletion' }).press('Enter');
    await expect(f.page.getByRole('button', { name: 'Delete private draft', exact: true })).toBeFocused();
    await f.page.getByRole('button', { name: 'Delete private draft', exact: true }).press('Enter');
    await f.page.getByRole('button', { name: 'Permanently delete draft', exact: true }).click();
    await expect(f.page.getByRole('heading', { name: 'No drafts yet' })).toBeVisible();
    assert.equal(f.state.requests.find(item => item.method === 'DELETE').csrf, csrfToken);
  } finally { await f.close(); }
});

await check('editor long text, navigation preserves input and responsive scan', async () => {
  const f = await fixture({ populated: true });
  try {
    await f.page.goto(`${baseURL}/contributor/drafts/proposal-1/edit`); await expect(f.page.getByLabel('Title (required)')).toHaveValue(initial.title);
    await f.page.getByLabel('Problem (required)').fill('Unsaved private text');
    for (const width of [375, 768, 1024, 1440]) {
      await f.page.setViewportSize({ width, height: 1000 }); await fits(f.page); await scan(f.page, `editor ${width}`); await capture(f.page, `editor-${width}`);
    }
    const toggle = f.page.getByRole('button', { name: /navigation/ });
    await toggle.focus(); await toggle.press('Enter'); await expect(toggle).toBeFocused(); await toggle.press('Enter');
    await expect(f.page.getByLabel('Problem (required)')).toHaveValue('Unsaved private text');
    await f.page.getByRole('button', { name: 'Save private draft', exact: true }).click();
    await expect(f.page.getByRole('status').filter({ hasText: 'Draft saved. Version 2.' })).toBeVisible();
    assert.equal(f.state.requests.find(item => item.method === 'PATCH').csrf, csrfToken);
    await f.page.setViewportSize({ width: 375, height: 1000 });
    await f.page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); await fits(f.page);
    await f.page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await f.page.getByRole('button', { name: 'Back to draft detail' }).click();
    await expect(f.page.getByRole('heading', { name: 'Private draft detail' })).toBeVisible();
    await fits(f.page); await scan(f.page, 'long detail mobile'); await capture(f.page, 'detail-mobile');
  } finally { await f.close(); }
});

await check('loading and retry error retain usable navigation', async () => {
  const f = await fixture({ listStatus: 500, delay: 1000 });
  try {
    await f.page.goto(`${baseURL}/contributor`); await expect(f.page.getByRole('status').filter({ hasText: /Loading drafts/ })).toBeVisible();
    await expect(f.page.getByRole('alert')).toBeVisible(); await expect(f.page.getByTestId('draft-page-count')).toHaveText('Unavailable');
    await scan(f.page, 'list error'); await capture(f.page, 'list-error');
    f.state.listStatus = 200; await f.page.getByRole('button', { name: 'Retry loading drafts' }).click();
    await expect(f.page.getByRole('heading', { name: 'No drafts yet' })).toBeVisible();
  } finally { await f.close(); }
});

for (const [role, path, label] of [['REVIEWER', '/reviewer', 'Reviewer'], ['RELEASE_MAINTAINER', '/releases', 'Release Maintainer']]) {
  await check(`${label} authorized landing only`, async () => {
    const f = await fixture({ role });
    try {
      await f.page.goto(`${baseURL}${path}`); await expect(f.page.getByRole('heading', { name: `${label} workspace` })).toBeVisible();
      assert.equal(await f.page.getByRole('navigation').getByRole('link').count(), 1); await scan(f.page, label);
      for (const width of [375, 768, 1024, 1440]) { await f.page.setViewportSize({ width, height: 1000 }); await fits(f.page); }
      await f.page.goto(`${baseURL}/contributor`); await expect(f.page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
    } finally { await f.close(); }
  });
}

await browser.close();
await writeFile(`${output}/acceptance-results.json`, JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ passed: results.checks.filter(item => item.status === 'passed').length, failed: results.checks.filter(item => item.status === 'failed').length, consoleErrors: results.consoleErrors, report: `${output}/acceptance-results.json` }, null, 2));
if (results.checks.some(item => item.status === 'failed') || results.consoleErrors.length) process.exitCode = 1;
