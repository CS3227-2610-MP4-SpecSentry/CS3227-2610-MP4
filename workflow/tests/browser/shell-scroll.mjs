// Synthetic UI acceptance only: start Vite on UI_BASE_URL before running this script.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseURL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5184';
const output = 'logs/yooplo/resources/2026-10-31-shell-scroll-refinement/verification';
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

async function rect(page, selector) { return page.locator(selector).boundingBox(); }
async function scrollState(page) {
  return page.evaluate(() => ({ document: document.scrollingElement.scrollTop, main: document.querySelector('main').scrollTop,
    bodyHeight: document.documentElement.scrollHeight, viewport: innerHeight, mainHeight: document.querySelector('main').clientHeight,
    mainContent: document.querySelector('main').scrollHeight }));
}
async function wheelMain(page) {
  const box = await rect(page, 'main'); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, 650); await expect.poll(async () => (await scrollState(page)).main).toBeGreaterThan(100);
}
async function settle(page) { await page.waitForTimeout(250); }

for (const viewport of [{ width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 1024, height: 900 }, { width: 768, height: 900 }, { width: 375, height: 812 }]) {
  await check(`bounded independent shell ${viewport.width}x${viewport.height}`, async () => {
    const f = await fixture({ populated: true });
    try {
      await f.page.setViewportSize(viewport); await f.page.goto(`${baseURL}/contributor/drafts/proposal-1/edit`);
      await expect(f.page.getByLabel('Title (required)')).toBeVisible(); await fits(f.page);
      const header = await rect(f.page, '.topbar'); const aside = await rect(f.page, '#workspace-navigation');
      const before = await scrollState(f.page); assert.ok(before.mainContent > before.mainHeight); assert.ok(before.bodyHeight <= before.viewport + 1);
      await wheelMain(f.page); const after = await scrollState(f.page); assert.equal(after.document, 0);
      await f.page.locator('main').focus(); await f.page.keyboard.press('PageDown'); await settle(f.page);
      assert.ok((await scrollState(f.page)).main > after.main, 'Keyboard must scroll main'); assert.equal((await scrollState(f.page)).document, 0);
      assert.deepEqual(await rect(f.page, '.topbar'), header);
      if (viewport.width >= 768) assert.deepEqual(await rect(f.page, '#workspace-navigation'), aside);
      await scan(f.page, `shell ${viewport.width}`); await capture(f.page, `shell-${viewport.width}`);
    } finally { await f.close(); }
  });
}

await check('sidebar navigation overflow is independent and footer stays accessible', async () => {
  const f = await fixture({ populated: true });
  try {
    await f.page.goto(`${baseURL}/contributor/drafts/proposal-1/edit`); await expect(f.page.getByLabel('Title (required)')).toBeVisible();
    assert.ok(await f.page.locator('#workspace-navigation .sidebar-scroll').evaluate(node => node.scrollHeight <= node.clientHeight), 'Fitting navigation must not overflow');
    await f.page.locator('#workspace-navigation nav').evaluate(nav => {
      for (let index = 0; index < 60; index++) { const row = document.createElement('p'); row.textContent = `Synthetic overflow row ${index}`; row.style.cssText = 'padding:12px;color:white'; nav.append(row); }
    });
    const nav = f.page.locator('#workspace-navigation .sidebar-scroll');
    assert.ok(await nav.evaluate(node => node.scrollHeight > node.clientHeight), 'Navigation must scroll independently when overflowed');
    const header = await rect(f.page, '#workspace-navigation .brand'); const footer = await rect(f.page, '#workspace-navigation .signout-button');
    const mainBefore = (await scrollState(f.page)).main;
    await nav.hover(); await f.page.mouse.wheel(0, 1000); await expect.poll(() => nav.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
    await nav.evaluate(node => { node.scrollTop = node.scrollHeight; }); await f.page.mouse.wheel(0, 1000); await settle(f.page);
    assert.equal((await scrollState(f.page)).main, mainBefore); assert.deepEqual(await rect(f.page, '#workspace-navigation .brand'), header); assert.deepEqual(await rect(f.page, '#workspace-navigation .signout-button'), footer);
    assert.ok(footer.y + footer.height <= 1000); await expect(f.page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await capture(f.page, 'sidebar-overflow');
  } finally { await f.close(); }
});

await check('desktop rail accessible names, stable gutter and preserved editor state', async () => {
  const f = await fixture({ populated: true });
  try {
    await f.page.goto(`${baseURL}/contributor/drafts/proposal-1/edit`); await expect(f.page.getByLabel('Problem (required)')).toBeVisible();
    await f.page.getByLabel('Problem (required)').fill('Unsaved scroll refinement text');
    const expanded = (await rect(f.page, '#workspace-navigation')).width;
    await f.page.getByRole('button', { name: 'Collapse navigation' }).click(); await settle(f.page);
    const collapsed = (await rect(f.page, '#workspace-navigation')).width; assert.ok(collapsed > 40 && collapsed < expanded / 2);
    await expect(f.page.getByRole('navigation').getByRole('link', { name: 'Contributor workspace' })).toBeVisible();
    await expect(f.page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await expect(f.page.getByLabel('Problem (required)')).toHaveValue('Unsaved scroll refinement text');
    await scan(f.page, 'collapsed rail'); await capture(f.page, 'rail-desktop');
    // Same route navigation must not expand the rail or clear the mounted editor.
    await f.page.getByRole('button', { name: 'Expand navigation' }).click(); await settle(f.page);
    await f.page.getByRole('button', { name: 'Collapse navigation' }).click(); await settle(f.page);
    await expect(f.page.getByLabel('Problem (required)')).toHaveValue('Unsaved scroll refinement text');
    await f.page.getByLabel('Problem (required)').fill(initial.problem);
    await f.page.getByRole('button', { name: 'Back to draft detail' }).click();
    await expect(f.page.getByRole('heading', { name: 'Private draft detail' })).toBeVisible(); await settle(f.page);
    assert.equal((await rect(f.page, '#workspace-navigation')).width, collapsed);
    const mainWidth = await f.page.locator('main').evaluate(node => node.clientWidth);
    const style = await f.page.locator('main').evaluate(node => getComputedStyle(node).scrollbarGutter); assert.match(style, /stable/);
    await f.page.getByRole('link', { name: 'Contributor workspace', exact: true }).click();
    await expect(f.page.getByRole('heading', { name: 'Your private drafts' })).toBeVisible();
    assert.equal(await f.page.locator('main').evaluate(node => node.clientWidth), mainWidth);
  } finally { await f.close(); }
});

await check('compact content-driven empty state and reduced motion', async () => {
  const f = await fixture();
  try {
    await f.page.emulateMedia({ reducedMotion: 'reduce' }); await f.page.goto(`${baseURL}/contributor`);
    await expect(f.page.getByRole('heading', { name: 'No drafts yet' })).toBeVisible();
    const height = (await rect(f.page, '.empty-state')).height; assert.ok(height < 340, `Empty state height ${height} should be compact`);
    const transitions = await f.page.locator('.app-shell').evaluate(node => getComputedStyle(node).transitionDuration); assert.ok(transitions.split(',').every(value => parseFloat(value) === 0));
    const sidebarTransitions = await f.page.locator('#workspace-navigation').evaluate(node => getComputedStyle(node).transitionDuration); assert.ok(sidebarTransitions.split(',').every(value => parseFloat(value) === 0));
    assert.equal(await f.page.locator('main').evaluate(node => getComputedStyle(node).scrollBehavior), 'auto');
    await capture(f.page, 'empty-compact'); await scan(f.page, 'empty compact reduced motion');
  } finally { await f.close(); }
});

await check('mobile drawer Escape, focus trap, scroll blocking and resize', async () => {
  const f = await fixture({ populated: true });
  try {
    await f.page.setViewportSize({ width: 375, height: 812 }); await f.page.goto(`${baseURL}/contributor/drafts/proposal-1/edit`);
    await expect(f.page.getByLabel('Problem (required)')).toBeVisible(); await f.page.getByLabel('Problem (required)').fill('Mobile unsaved content');
    const opener = f.page.getByRole('button', { name: /Open navigation|Expand navigation/ });
    await opener.focus(); await opener.press('Enter');
    const dialog = f.page.getByRole('dialog'); await expect(dialog).toBeVisible();
    assert.ok(await dialog.evaluate(node => node.matches(':modal')), 'Native dialog must be opened modally');
    assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)));
    // Native Chrome dialogs allow browser-chrome focus; page focus must remain modal.
    for (let index = 0; index < 8; index++) { await f.page.keyboard.press('Tab'); assert.ok(await dialog.evaluate(node => !document.hasFocus() || node.contains(document.activeElement))); }
    for (let index = 0; index < 8; index++) { await f.page.keyboard.press('Shift+Tab'); assert.ok(await dialog.evaluate(node => !document.hasFocus() || node.contains(document.activeElement))); }
    await dialog.getByRole('button', { name: 'Close navigation' }).focus();
    const before = await scrollState(f.page); await f.page.mouse.move(350, 700); await f.page.mouse.wheel(0, 800); await settle(f.page);
    assert.equal((await scrollState(f.page)).main, before.main); assert.equal((await scrollState(f.page)).document, 0);
    await f.page.locator('main input').first().evaluate(node => node.focus());
    assert.ok(await dialog.evaluate(node => node.contains(document.activeElement)), 'Native modal must block background focus');
    await scan(f.page, 'mobile dialog'); await capture(f.page, 'mobile-drawer');
    await f.page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(opener).toBeFocused();
    await expect(f.page.getByLabel('Problem (required)')).toHaveValue('Mobile unsaved content');
    await opener.click(); await expect(dialog).toBeVisible(); await f.page.setViewportSize({ width: 1024, height: 900 }); await settle(f.page);
    await expect(f.page.getByRole('dialog')).toHaveCount(0); await expect(f.page.getByRole('button', { name: 'Collapse navigation' })).toBeFocused();
    await f.page.getByLabel('Problem (required)').focus(); await expect(f.page.getByLabel('Problem (required)')).toBeFocused();
    await fits(f.page); await expect(f.page.getByLabel('Problem (required)')).toHaveValue('Mobile unsaved content');
    await f.page.setViewportSize({ width: 375, height: 812 }); await settle(f.page); await expect(f.page.getByRole('dialog')).toHaveCount(0); await wheelMain(f.page);
    await f.page.setViewportSize({ width: 375, height: 420 }); await opener.click(); await expect(dialog).toBeVisible();
    const footer = await dialog.getByRole('button', { name: 'Sign out', exact: true }).boundingBox(); assert.ok(footer.y + footer.height <= 420);
    await capture(f.page, 'mobile-drawer-short'); await dialog.getByRole('button', { name: 'Close navigation' }).click(); await expect(opener).toBeFocused();
  } finally { await f.close(); }
});

await check('existing create/save/delete and sign-out workflow', async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${baseURL}/contributor/new`); await expect(f.page.getByLabel('Title (required)')).toBeVisible();
    await f.page.getByLabel('Title (required)').fill('Scroll refinement draft'); await f.page.getByLabel('Problem (required)').fill('A problem'); await f.page.getByLabel('Expected behavior (required)').fill('An outcome');
    await f.page.getByRole('button', { name: 'Create private draft', exact: true }).click(); await expect(f.page.getByRole('heading', { name: 'Private draft detail' })).toBeVisible();
    await f.page.getByRole('link', { name: 'Edit private draft' }).click(); await f.page.getByLabel('Problem (required)').fill('Updated problem');
    await f.page.getByRole('button', { name: 'Save private draft', exact: true }).click(); await expect(f.page.getByRole('status').filter({ hasText: 'Draft saved. Version 2.' })).toBeVisible();
    await f.page.getByRole('button', { name: 'Back to draft detail' }).click(); await f.page.getByRole('button', { name: 'Delete private draft', exact: true }).click();
    await expect(f.page.getByRole('button', { name: 'Cancel deletion' })).toBeFocused(); await f.page.getByRole('button', { name: 'Permanently delete draft', exact: true }).click();
    await expect(f.page.getByRole('heading', { name: 'No drafts yet' })).toBeVisible(); await f.page.getByRole('button', { name: 'Sign out', exact: true }).click(); await expect(f.page.getByLabel('Username')).toBeVisible();
    for (const method of ['POST', 'PATCH', 'DELETE']) assert.equal(f.state.requests.find(item => item.method === method && item.path.includes('proposals')).csrf, csrfToken);
  } finally { await f.close(); }
});

await browser.close();
await writeFile(`${output}/acceptance-results.json`, JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify(results, null, 2));
if (results.checks.some(item => item.status === 'failed') || results.consoleErrors.length) process.exitCode = 1;
