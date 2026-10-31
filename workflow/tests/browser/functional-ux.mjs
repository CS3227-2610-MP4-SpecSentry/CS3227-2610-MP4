// Synthetic UI acceptance only: start Vite on UI_BASE_URL before running this script.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseURL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5185';
const output = 'logs/yooplo/resources/2026-10-31-functional-ux/verification';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { scope: 'Synthetic API browser fixtures; no live backend/database authorization certification', checks: [], consoleErrors: [], expectedHttpErrors: [], warnings: [], screenshots: [] };
const csrfToken = 'a'.repeat(64);
const initial = {
  title: 'Specification ' + 'x'.repeat(180), problem: 'A private problem', constraints: '', expectedBehavior: 'A useful outcome',
  summary: 'Browser verification fixture', diffText: '+'.repeat(2000),
  criteria: [{ stableKey: 'criterion-1', statement: '<script>first criterion</script>\nSecond line retained', required: true }, { stableKey: 'criterion-2', statement: 'Second optional criterion', required: false }], evidence: [{ id: 'evidence-1', text: 'Evidence ' + 'e'.repeat(2000) }],
};

async function fixture({ signedIn = true, role = 'CONTRIBUTOR', populated = false, listStatus = 200, delay = 0 } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const state = { signedIn, role, populated, listStatus, content: structuredClone(initial), version: 1, deleted: false, requests: [], saveStatus: 200, readFailure: false, saveDelay: 0, accountId: 'synthetic-owner', currentCsrf: csrfToken, expiresAt: Date.now() + 1800000 };
  page.on('console', message => { if (message.type() === 'warning') results.warnings.push(message.text()); });
  page.on('pageerror', error => results.consoleErrors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (/status of (401|409|500)|net::ERR_FAILED/.test(message.text())) results.expectedHttpErrors.push(message.text());
    else results.consoleErrors.push(message.text());
  });
  await page.route('**/api/**', async route => {
    const request = route.request();
    const url = new URL(request.url());
    state.requests.push({ path: url.pathname, method: request.method(), csrf: request.headers()['x-csrf-token'] ?? null });
    const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: status === 204 ? undefined : JSON.stringify(body) });
    const session = { account: { id: state.accountId, username: state.accountId, role: state.role }, csrfToken: state.currentCsrf, expiresAt: state.expiresAt };
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
        if (state.saveDelay) await new Promise(resolve => setTimeout(resolve, state.saveDelay));
        if (state.saveStatus === 'network') return route.abort();
        if (state.saveStatus !== 200) return send({}, state.saveStatus);
        assert.equal(request.postDataJSON().expectedVersion, state.version);
        state.content = request.postDataJSON().content; state.version++;
        return send({ proposalId: 'proposal-1', revisionId: null, workingRevisionId: 'working-1', assignmentId: null, assignmentVersion: null, version: state.version, state: 'DRAFT' });
      }
      if (state.readFailure && state.version > 1) return send({}, 500);
      return send({ proposalId: 'proposal-1', workingRevisionId: 'working-1', version: state.version, state: 'DRAFT', content: state.content });
    }
    if (url.pathname === '/api/proposals/proposal-1' && request.method() === 'DELETE') { assert.equal(request.postDataJSON().confirmed, true); state.deleted = true; return send({}, 204); }
    return send({}, 404);
  });
  return { page, state, close: async () => { page.removeAllListeners('dialog'); page.on('dialog', dialog => dialog.accept()); await context.close(); } };
}

async function check(name, action) {
  try { await action(); results.checks.push({ name, status: 'passed' }); }
  catch (error) { results.checks.push({ name, status: 'failed', error: error.stack }); }
  console.log(name + ': ' + results.checks.at(-1).status);
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

const editorPath = '/contributor/drafts/proposal-1/edit';
async function edit(f) { await f.page.goto(baseURL + editorPath); await expect(f.page.getByLabel('Problem (required)')).toHaveValue(initial.problem); }
function dialogs(page, accept = false) {
  const seen = []; const listener = async dialog => { seen.push({ type: dialog.type(), message: dialog.message() }); await (accept ? dialog.accept() : dialog.dismiss()); };
  page.on('dialog', listener); return { seen, stop: () => page.off('dialog', listener) };
}
async function leaveAttempt(f, action, accept) {
  const d = dialogs(f.page, accept);
  try { await action(); await expect.poll(() => d.seen.length).toBe(1); assert.equal(d.seen[0].type, 'confirm'); }
  finally { d.stop(); }
}
async function saveVisible(page) {
  const save = page.getByRole('button', { name: 'Save private draft', exact: true });
  await expect(save).toHaveCount(1); await expect(save).toBeVisible();
  const box = await save.boundingBox(); const main = await page.locator('main').boundingBox();
  assert.ok(box.y >= main.y && box.y + box.height <= main.y + main.height + 1, 'Save must stay in workspace viewport');
}

for (const destination of ['sidebar', 'brand', 'breadcrumb', 'Back']) {
  await check(`AC-CON-UX-001 dirty ${destination} stay and leave exactly once`, async () => {
    const f = await fixture({ populated: true });
    try {
      await edit(f); await f.page.getByLabel('Problem (required)').fill('Unsaved guarded text');
      const target = destination === 'sidebar' ? f.page.locator('#workspace-navigation').getByRole('link', { name: 'Contributor workspace', exact: true })
        : destination === 'brand' ? f.page.locator('#workspace-navigation').getByRole('link', { name: 'SpecSentry workspace' })
          : destination === 'breadcrumb' ? f.page.locator('.breadcrumb').getByRole('link') : f.page.getByRole('button', { name: 'Back to draft detail' });
      await leaveAttempt(f, () => target.click(), false); await expect(f.page).toHaveURL(baseURL + editorPath);
      await expect(f.page.getByLabel('Problem (required)')).toHaveValue('Unsaved guarded text');
      await leaveAttempt(f, () => target.click(), true); await expect(f.page).not.toHaveURL(baseURL + editorPath);
    } finally { await f.close(); }
  });
}

await check('AC-CON-UX-001 browser POP stay preserves history and leave proceeds once', async () => {
  const f = await fixture({ populated: true });
  try {
    await f.page.goto(`${baseURL}/contributor`); await f.page.getByRole('link', { name: initial.title, exact: true }).click();
    await f.page.getByRole('link', { name: 'Edit private draft' }).click(); await f.page.getByLabel('Problem (required)').fill('POP private content');
    await leaveAttempt(f, () => f.page.evaluate(() => history.back()), false); await expect(f.page).toHaveURL(baseURL + editorPath);
    await expect(f.page.getByLabel('Problem (required)')).toHaveValue('POP private content');
    await leaveAttempt(f, () => f.page.evaluate(() => history.back()), true); await expect(f.page).toHaveURL(`${baseURL}/contributor/drafts/proposal-1`);
    const d = dialogs(f.page, false); await f.page.evaluate(() => history.forward()); await expect(f.page).toHaveURL(baseURL + editorPath);
    await expect(f.page.getByLabel('Problem (required)')).toHaveValue(initial.problem); assert.equal(d.seen.length, 0); d.stop();
  } finally { await f.close(); }
});

await check('AC-CON-UX-001 clean and reconciled saves navigate without prompt', async () => {
  const f = await fixture({ populated: true });
  try {
    await edit(f); let d = dialogs(f.page, false); await f.page.getByRole('button', { name: 'Back to draft detail' }).click();
    await expect(f.page.getByRole('heading', { name: 'Private draft detail' })).toBeVisible(); assert.equal(d.seen.length, 0); d.stop();
    await f.page.getByRole('link', { name: 'Edit private draft' }).click(); await f.page.getByLabel('Problem (required)').fill('Saved content');
    await f.page.getByRole('button', { name: 'Save private draft', exact: true }).click(); await expect(f.page.getByText('Draft saved. Version 2.', { exact: true })).toBeVisible();
    d = dialogs(f.page, false); await f.page.locator('#workspace-navigation').getByRole('link', { name: 'Contributor workspace' }).click();
    await expect(f.page.getByRole('heading', { name: 'Your private drafts' })).toBeVisible(); assert.equal(d.seen.length, 0); d.stop();
    assert.equal(await f.page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  } finally { await f.close(); }
});

await check('AC-CON-UX-001 criterion/evidence changes protect exit and exact reversion becomes clean', async () => {
  const f = await fixture({ populated: true });
  try {
    await edit(f); await f.page.getByLabel('Criterion 1 statement').fill('Edited criterion'); await f.page.getByLabel('Criterion 1 meaning').selectOption('same');
    await leaveAttempt(f, () => f.page.getByRole('button', { name: 'Back to draft detail' }).click(), false);
    await f.page.getByLabel('Criterion 1 statement').fill(initial.criteria[0].statement);
    await f.page.getByLabel('Criterion 2 required').check(); await leaveAttempt(f, () => f.page.getByRole('button', { name: 'Back to draft detail' }).click(), false);
    await f.page.getByLabel('Criterion 2 required').uncheck(); await f.page.getByLabel('Evidence 1 text').fill('Changed evidence');
    await leaveAttempt(f, () => f.page.getByRole('button', { name: 'Back to draft detail' }).click(), false); await f.page.getByLabel('Evidence 1 text').fill(initial.evidence[0].text);
    const d = dialogs(f.page, false); await f.page.getByRole('button', { name: 'Back to draft detail' }).click(); await expect(f.page.getByRole('heading', { name: 'Private draft detail' })).toBeVisible(); assert.equal(d.seen.length, 0); d.stop();
  } finally { await f.close(); }
});

await check('AC-CON-UX-001 reload latest cancel retains text and confirm reconciles clean', async () => {
  const f = await fixture({ populated: true });
  try {
    await edit(f); await f.page.getByLabel('Problem (required)').fill('Reload latest edits');
    const reload = f.page.getByRole('button', { name: 'Reload latest draft and discard changes' });
    await leaveAttempt(f, () => reload.click(), false); await expect(f.page.getByLabel('Problem (required)')).toHaveValue('Reload latest edits');
    await leaveAttempt(f, () => reload.click(), true); await expect(f.page.getByLabel('Problem (required)')).toHaveValue(initial.problem);
    const d = dialogs(f.page, false); await f.page.getByRole('button', { name: 'Back to draft detail' }).click(); await expect(f.page.getByRole('heading', { name: 'Private draft detail' })).toBeVisible(); assert.equal(d.seen.length, 0); d.stop();
  } finally { await f.close(); }
});

await check('AC-CON-UX-001 hash-only skip link preserves dirty editor without prompt', async () => {
  const f = await fixture({ populated: true });
  try {
    await edit(f); await f.page.getByLabel('Problem (required)').fill('Hash retained'); const d = dialogs(f.page, false);
    await f.page.getByRole('link', { name: 'Skip to main content' }).focus(); await f.page.keyboard.press('Enter');
    await expect(f.page.getByLabel('Problem (required)')).toHaveValue('Hash retained'); assert.equal(d.seen.length, 0); d.stop();
  } finally { await f.close(); }
});

await check('UX-NAV-003 skip focuses main without unindexed history; dirty Back stays or leaves once', async () => {
  const f = await fixture({ populated: true });
  try {
    await f.page.goto(`${baseURL}/contributor/drafts/proposal-1`); await expect(f.page.getByRole('heading', { name: 'Private draft detail' })).toBeVisible();
    const historyBefore = await f.page.evaluate(() => ({ url: location.href, length: history.length, index: history.state.idx }));
    await f.page.getByRole('link', { name: 'Skip to main content' }).focus(); await f.page.keyboard.press('Enter'); await expect(f.page.locator('main')).toBeFocused();
    assert.deepEqual(await f.page.evaluate(() => ({ url: location.href, length: history.length, index: history.state.idx })), historyBefore);
    await f.page.getByRole('link', { name: 'Edit private draft' }).click(); await f.page.getByLabel('Problem (required)').fill('HASH REGRESSION PRIVATE TEXT');
    await leaveAttempt(f, () => f.page.evaluate(() => history.back()), false); await expect(f.page).toHaveURL(baseURL + editorPath);
    await expect(f.page.getByLabel('Problem (required)')).toHaveValue('HASH REGRESSION PRIVATE TEXT');
    await leaveAttempt(f, () => f.page.evaluate(() => history.back()), true); await expect(f.page).toHaveURL(`${baseURL}/contributor/drafts/proposal-1`);
    await capture(f.page, 'skip-history-fixed');
  } finally { await f.close(); }
});

await check('AC-CON-UX-001 mobile drawer navigation cancel retains private text', async () => {
  const f = await fixture({ populated: true });
  try {
    await f.page.setViewportSize({ width: 375, height: 812 }); await edit(f); await f.page.getByLabel('Problem (required)').fill('Mobile protected');
    await f.page.getByRole('button', { name: 'Open navigation' }).click();
    await leaveAttempt(f, () => f.page.getByRole('dialog').getByRole('link', { name: 'Contributor workspace', exact: true }).click(), false);
    await expect(f.page).toHaveURL(baseURL + editorPath); await expect(f.page.getByLabel('Problem (required)')).toHaveValue('Mobile protected');
  } finally { await f.close(); }
});

await check('AC-CON-UX-001 create dirty guard and successful create clears it', async () => {
  const f = await fixture();
  try {
    await f.page.goto(`${baseURL}/contributor/new`); await f.page.getByLabel('Title (required)').fill('New protected draft');
    await leaveAttempt(f, () => f.page.getByRole('link', { name: 'Back to your drafts' }).click(), false);
    await expect(f.page.getByLabel('Title (required)')).toHaveValue('New protected draft');
    await f.page.getByLabel('Problem (required)').fill('Problem'); await f.page.getByLabel('Expected behavior (required)').fill('Outcome');
    const d = dialogs(f.page, false); await f.page.getByRole('button', { name: 'Create private draft' }).click();
    await expect(f.page.getByRole('heading', { name: 'Private draft detail' })).toBeVisible(); assert.equal(d.seen.length, 0); d.stop();
  } finally { await f.close(); }
});

await check('AC-CON-UX-001 native beforeunload reload cancel and confirm', async () => {
  const f = await fixture({ populated: true });
  try {
    await edit(f); await f.page.getByLabel('Problem (required)').fill('Reload protected text');
    assert.equal(await f.page.evaluate(() => window.dispatchEvent(new Event('beforeunload', { cancelable: true }))), false);
    let d = dialogs(f.page, false); await f.page.reload({ timeout: 1500 }).catch(() => {});
    assert.ok(d.seen.some(item => item.type === 'beforeunload'), 'Chrome native beforeunload must appear after user input'); d.stop();
    await expect(f.page.getByLabel('Problem (required)')).toHaveValue('Reload protected text');
    d = dialogs(f.page, true); await f.page.reload(); await expect(f.page.getByLabel('Problem (required)')).toHaveValue(initial.problem);
    assert.equal(d.seen.filter(item => item.type === 'beforeunload').length, 1); d.stop();
  } finally { await f.close(); }
});

await check('AC-CON-UX-002 saved ordered escaped criteria and classification', async () => {
  const f = await fixture({ populated: true });
  try {
    await f.page.goto(`${baseURL}/contributor/drafts/proposal-1`); const criteria = f.page.locator('section').filter({ has: f.page.locator('#saved-criteria-title') }).last();
    await expect(criteria.getByRole('heading', { name: /Acceptance criteria/i })).toBeVisible();
    const rows = criteria.locator('ol > li'); await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText('<script>first criterion</script>'); await expect(rows.nth(0)).toContainText('Required');
    assert.equal(await rows.nth(0).locator('p').textContent(), initial.criteria[0].statement); assert.equal(await rows.nth(0).locator('p').evaluate(node => getComputedStyle(node).whiteSpace), 'pre-wrap');
    await expect(rows.nth(1)).toContainText('Second optional criterion'); await expect(rows.nth(1)).toContainText('Optional');
    assert.equal(await f.page.locator('script').filter({ hasText: 'first criterion' }).count(), 0);
    await scan(f.page, 'saved criteria'); await capture(f.page, 'saved-criteria');
  } finally { await f.close(); }
});
await check('AC-CON-UX-002 empty saved criteria explains absence', async () => {
  const f = await fixture({ populated: true }); f.state.content.criteria = [];
  try { await f.page.goto(`${baseURL}/contributor/drafts/proposal-1`); await expect(f.page.getByText(/No acceptance criteria|No criteria/i)).toBeVisible(); }
  finally { await f.close(); }
});

for (const width of [1440, 375]) {
  await check(`AC-CON-UX-003 sticky save/status ${width}px scroll, focus, pending duplicates and success`, async () => {
    const f = await fixture({ populated: true }); f.state.saveDelay = 900;
    try {
      await f.page.setViewportSize({ width, height: 900 }); await f.page.emulateMedia({ reducedMotion: 'reduce' }); await edit(f);
      await saveVisible(f.page); await f.page.getByLabel('Evidence 1 text').fill('Evidence changed');
      await saveVisible(f.page); assert.ok(await f.page.locator('main').evaluate(node => node.scrollTop) > 0);
      await f.page.getByRole('button', { name: 'Save private draft', exact: true }).focus();
      const scroll = await f.page.locator('main').evaluate(node => node.scrollTop); await f.page.keyboard.press('Enter');
      await expect(f.page.locator('.save-actions').getByRole('status')).toContainText(/Saving/i);
      await expect(f.page.getByRole('button', { name: /Saving/ })).toBeDisabled();
      await f.page.getByRole('button', { name: /Saving/ }).evaluate(node => { node.click(); node.click(); });
      await expect(f.page.getByText('Draft saved. Version 2.', { exact: true })).toBeVisible();
      assert.equal(f.state.requests.filter(item => item.method === 'PATCH').length, 1); await saveVisible(f.page);
      assert.ok(Math.abs(await f.page.locator('main').evaluate(node => node.scrollTop) - scroll) < 110, 'Save feedback should preserve current scroll');
      await f.page.getByLabel('Evidence 1 text').focus(); const field = await f.page.getByLabel('Evidence 1 text').boundingBox(); const bar = await f.page.locator('.save-actions').boundingBox();
      assert.ok(field.y + field.height <= bar.y || field.y >= bar.y + bar.height, 'Focused evidence field must not overlap sticky action bar');
      await scan(f.page, `sticky save ${width}`); await fits(f.page); await capture(f.page, `sticky-save-${width}`);
    } finally { await f.close(); }
  });
}

await check('AC-CON-UX-003 mobile raw pointer save preserves deep editing position', async () => {
  const f = await fixture({ populated: true });
  try {
    await f.page.setViewportSize({ width: 375, height: 900 }); await edit(f); await f.page.getByLabel('Evidence 1 text').fill('Pointer edit'); await saveVisible(f.page);
    const scroll = await f.page.locator('main').evaluate(node => node.scrollTop); const box = await f.page.getByRole('button', { name: 'Save private draft', exact: true }).boundingBox();
    await f.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await expect(f.page.getByText('Draft saved. Version 2.', { exact: true })).toBeVisible();
    assert.ok(Math.abs(await f.page.locator('main').evaluate(node => node.scrollTop) - scroll) < 35); assert.equal(await f.page.evaluate(() => document.scrollingElement.scrollTop), 0);
    await capture(f.page, 'mobile-pointer-save');
  } finally { await f.close(); }
});

await check('AC-CON-UX-003 mobile enlarged text keeps validation focus clear of measured toolbar', async () => {
  const f = await fixture({ populated: true });
  try {
    await f.page.setViewportSize({ width: 375, height: 900 }); await edit(f); await f.page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await f.page.getByLabel('Title (required)').fill(''); await f.page.getByRole('button', { name: 'Save private draft', exact: true }).click();
    await expect(f.page.getByLabel('Title (required)')).toBeFocused(); await fits(f.page);
    const field = await f.page.getByLabel('Title (required)').boundingBox(); const bar = await f.page.locator('.save-actions').boundingBox();
    assert.ok(field.y >= bar.y + bar.height, 'Enlarged focused title must not be covered'); await capture(f.page, 'mobile-enlarged-validation');
  } finally { await f.close(); }
});

for (const mode of [409, 500, 'network', 'reconcile']) {
  await check(`AC-CON-UX-003 truthful ${mode} failure retains dirty text and adjacent recovery`, async () => {
    const f = await fixture({ populated: true }); if (mode === 'reconcile') f.state.readFailure = true; else f.state.saveStatus = mode;
    try {
      await edit(f); await f.page.getByLabel('Problem (required)').fill(`Kept after ${mode}`); await f.page.getByRole('button', { name: 'Save private draft', exact: true }).click();
      await expect(f.page.locator('.save-actions').getByRole('alert')).toBeVisible(); await expect(f.page.getByLabel('Problem (required)')).toHaveValue(`Kept after ${mode}`);
      await expect(f.page.getByRole('button', { name: 'Save private draft', exact: true })).toBeDisabled();
      await leaveAttempt(f, () => f.page.getByRole('button', { name: 'Back to draft detail' }).click(), false);
      await expect(f.page.getByLabel('Problem (required)')).toHaveValue(`Kept after ${mode}`); await capture(f.page, `failure-${mode}`);
    } finally { await f.close(); }
  });
}

await check('AC-CON-UX-003 validation focuses field and message remains adjacent', async () => {
  const f = await fixture({ populated: true });
  try {
    await edit(f); await f.page.getByLabel('Title (required)').fill(''); await f.page.getByLabel('Evidence 1 text').focus();
    await f.page.getByRole('button', { name: 'Save private draft', exact: true }).click(); await expect(f.page.getByLabel('Title (required)')).toBeFocused();
    await expect(f.page.locator('.save-actions').getByRole('alert')).toContainText('Check the highlighted fields.');
    const field = await f.page.getByLabel('Title (required)').boundingBox(); const bar = await f.page.locator('.save-actions').boundingBox();
    assert.ok(field.y >= bar.y + bar.height || field.y + field.height <= bar.y); assert.equal(f.state.requests.filter(item => item.method === 'PATCH').length, 0);
  } finally { await f.close(); }
});

await check('AC-CON-UX-001 pending navigation warns truthfully and late save does not redirect', async () => {
  const f = await fixture({ populated: true }); f.state.saveDelay = 1200;
  try {
    await edit(f); await f.page.getByLabel('Problem (required)').fill('Pending text'); await f.page.getByRole('button', { name: 'Save private draft', exact: true }).click();
    const d = dialogs(f.page, true); await f.page.locator('#workspace-navigation').getByRole('link', { name: 'Contributor workspace' }).click();
    await expect(f.page.getByRole('heading', { name: 'Your private drafts' })).toBeVisible(); await f.page.waitForTimeout(1400);
    assert.equal(d.seen.length, 1); assert.match(d.seen[0].message, /pending|progress|saving/i); assert.match(d.seen[0].message, /not cancel|continue|complete/i); d.stop();
    await expect(f.page).toHaveURL(`${baseURL}/contributor`); assert.equal(f.state.requests.filter(item => item.method === 'PATCH').length, 1);
  } finally { await f.close(); }
});

for (const transition of ['401', 'timer', 'replacement']) {
  await check(`AC-CON-UX-001 forced auth ${transition} bypasses guard and erases old private input`, async () => {
    const f = await fixture({ populated: true }); if (transition === 'timer') f.state.expiresAt = Date.now() + 2200;
    try {
      await edit(f); await f.page.getByLabel('Problem (required)').fill('OLD PRIVATE INPUT'); const d = dialogs(f.page, false);
      if (transition === '401') { f.state.saveStatus = 401; await f.page.getByRole('button', { name: 'Save private draft', exact: true }).click(); }
      if (transition === 'replacement') {
        f.state.accountId = 'replacement-owner'; f.state.currentCsrf = 'b'.repeat(64); f.state.content.problem = 'Replacement saved problem';
        await f.page.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect(f.page.getByLabel('Problem (required)')).toHaveValue('Replacement saved problem');
      } else await expect(f.page.getByLabel('Username')).toBeVisible();
      assert.equal(d.seen.length, 0); d.stop(); assert.equal(await f.page.locator('textarea').evaluateAll(nodes => nodes.some(node => node.value === 'OLD PRIVATE INPUT')), false);
      assert.equal(await f.page.evaluate(() => localStorage.length + sessionStorage.length), 0);
    } finally { await f.close(); }
  });
}

await browser.close();
await writeFile(`${output}/acceptance-results.json`, JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ passed: results.checks.filter(item => item.status === 'passed').length, failed: results.checks.filter(item => item.status === 'failed').length, consoleErrors: results.consoleErrors, warnings: results.warnings }, null, 2));
if (results.checks.some(item => item.status === 'failed') || results.consoleErrors.length || results.warnings.some(value => value.includes('not created by @remix-run/router'))) process.exitCode = 1;
