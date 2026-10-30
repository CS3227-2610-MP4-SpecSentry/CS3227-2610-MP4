// Synthetic UI acceptance only: start Vite on UI_BASE_URL before running this script.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseURL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5186';
const output = 'logs/yooplo/resources/2026-10-31-navigation-phase2/verification';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { scope: 'Synthetic API browser fixtures; no live backend/database authorization certification', checks: [], consoleErrors: [], expectedHttpErrors: [], warnings: [], screenshots: [] };
const csrfToken = 'a'.repeat(64);
const initial = {
  title: 'Specification ' + 'x'.repeat(180), problem: 'A private problem', constraints: '', expectedBehavior: 'A useful outcome',
  summary: 'Browser verification fixture', diffText: '+'.repeat(2000),
  criteria: [{ stableKey: 'criterion-1', statement: '<script>first criterion</script>\nSecond line retained', required: true }, { stableKey: 'criterion-2', statement: 'Second optional criterion', required: false }], evidence: [{ id: 'evidence-1', text: 'Evidence ' + 'e'.repeat(2000) }],
};

async function fixture({ signedIn = true, role = 'CONTRIBUTOR', populated = false, listStatus = 200, delay = 0, touch = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, hasTouch: touch });
  const page = await context.newPage();
  const state = { signedIn, role, populated, listStatus, content: structuredClone(initial), version: 1, deleted: false, requests: [], requestFailures: [], saveStatus: 200, readFailure: false, saveDelay: 0, accountId: 'synthetic-owner', currentCsrf: csrfToken, expiresAt: Date.now() + 1800000 };
  page.on('console', message => { if (message.type() === 'warning') results.warnings.push(message.text()); });
  page.on('requestfailed', request => state.requestFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
  page.on('pageerror', error => results.consoleErrors.push(error.message));
  page.on('console', message => {
    if (message.type() !== 'error') return;
    if (/status of (401|409|500)|net::ERR_FAILED/.test(message.text())) results.expectedHttpErrors.push(message.text());
    else results.consoleErrors.push(message.text());
  });
  await context.route('**/api/**', async route => {
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
          : destination === 'breadcrumb' ? f.page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).getByRole('link').first() : f.page.getByRole('button', { name: 'Back to draft detail' });
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
      await expect(f.page.locator('.save-actions').getByRole('status')).toContainText(/paused|verification incomplete/i); const historyBeforeRecovery = await f.page.evaluate(() => ({ url: location.href, index: history.state.idx, length: history.length }));
      const recoveryLink = f.page.getByRole('link', { name: 'Recovery details', exact: true }); await recoveryLink.focus(); await recoveryLink.press('Enter'); const recovery = f.page.getByRole('region', { name: 'Save recovery details', exact: true }); await expect(recovery).toBeFocused(); await expect(recovery.getByRole('alert')).toBeVisible();
      assert.deepEqual(await f.page.evaluate(() => ({ url: location.href, index: history.state.idx, length: history.length })), historyBeforeRecovery); const message = await recovery.getByRole('alert').textContent();
      if (mode === 500 || mode === 'network') assert.match(message, /uncertain|may have been saved/i);
      if (mode === 409) { assert.match(message, /changed/i); assert.match(message, /reload/i); }
      if (mode === 'reconcile') { assert.match(message, /saved/i); assert.match(message, /could not|not.*verif/i); }
      await expect(f.page.getByLabel('Problem (required)')).toHaveValue(`Kept after ${mode}`);
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
    await expect(f.page.locator('.save-actions').getByRole('status')).toContainText('Save needs attention.'); await expect(f.page.getByRole('link', { name: 'Recovery details', exact: true })).toBeVisible(); await expect(f.page.getByRole('region', { name: 'Save recovery details', exact: true }).getByRole('alert')).toContainText('Check the highlighted fields.');
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


for (const [path, title] of [['/contributor','Private drafts'], ['/contributor/new','Create a private draft'], ['/contributor/drafts/proposal-1','Private draft detail'], [editorPath,'Edit private draft']]) {
  await check(`AC-CON-UX-004 single task h1 and semantic breadcrumbs ${path}`, async () => {
    const f = await fixture({ populated: true });
    try {
      await f.page.goto(baseURL + path); await expect(f.page.getByRole('heading', { level: 1, name: title })).toBeVisible(); await expect(f.page.getByRole('heading', { level: 1 })).toHaveCount(1);
      const breadcrumbs = f.page.getByRole('navigation', { name: 'Breadcrumb', exact: true }); await expect(breadcrumbs.locator('ol')).toHaveCount(1); await expect(breadcrumbs.locator('[aria-current="page"]')).toHaveCount(1);
      const levels = await f.page.locator('main').getByRole('heading').evaluateAll(nodes => nodes.map(node => Number(node.tagName.slice(1))));
      assert.equal(levels[0], 1); for (let index = 1; index < levels.length; index++) assert.ok(levels[index] <= levels[index - 1] + 1, `Heading hierarchy ${levels}`);
      await expect(f.page.locator('.topbar-task')).toHaveText(path === '/contributor' ? 'Private drafts' : path.endsWith('/edit') ? 'Edit draft' : path.endsWith('/new') ? 'Create draft' : 'Draft details');
      if (path.includes('drafts/')) { await expect(breadcrumbs.locator('.draft-title-crumb > [title]')).toHaveAttribute('title', initial.title); assert.equal(f.state.requests.filter(item => item.path.endsWith('/draft') && item.method === 'GET').length - f.state.requestFailures.filter(item => item.path.endsWith('/draft') && item.error === 'net::ERR_ABORTED').length, 1); }
      await scan(f.page, `task orientation ${path}`); await capture(f.page, `orientation-${path.split('/').at(-1)}`);
    } finally { await f.close(); }
  });
}

await check('AC-CON-UX-004 loaded title breadcrumb uses dirty guard and keyboard stay/leave', async () => {
  const f = await fixture({ populated: true });
  try {
    await edit(f); await f.page.getByLabel('Problem (required)').fill('Context breadcrumb protected'); const title = f.page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).locator('.draft-title-crumb a');
    await expect(title).toHaveAttribute('href', '/contributor/drafts/proposal-1'); await title.focus(); await leaveAttempt(f, () => title.press('Enter'), false);
    await expect(f.page.getByLabel('Problem (required)')).toHaveValue('Context breadcrumb protected'); await leaveAttempt(f, () => title.press('Enter'), true); await expect(f.page.getByRole('heading', { level: 1, name: 'Private draft detail' })).toBeVisible();
  } finally { await f.close(); }
});

await check('AC-CON-UX-005 whole row real link covers primary region, keyboard and normal pointer', async () => {
  const f = await fixture({ populated: true });
  try {
    await f.page.goto(baseURL + '/contributor'); const row = f.page.locator('.draft-list li'); const link = row.locator('> a'); await expect(link).toHaveCount(1); await expect(link).toHaveAccessibleName(initial.title);
    assert.equal(await link.locator('a,button,input,select,textarea,[role="button"]').count(), 0); const rowBox = await row.boundingBox(); const box = await link.boundingBox(); assert.ok(box.width >= rowBox.width * .9 && box.height >= 44);
    const href = await link.getAttribute('href'); assert.equal(href, '/contributor/drafts/proposal-1'); await link.focus(); await expect(link).toBeFocused();
    assert.notEqual(await link.evaluate(node => getComputedStyle(node).outlineStyle), 'none'); await link.press('Enter'); await expect(f.page.getByRole('heading', { level: 1, name: 'Private draft detail' })).toBeVisible();
    await f.page.getByRole('link', { name: 'Back to your drafts' }).click(); const target = await f.page.locator('.draft-row-link').boundingBox(); await f.page.mouse.click(target.x + target.width - 25, target.y + target.height / 2);
    await expect(f.page.getByRole('heading', { level: 1, name: 'Private draft detail' })).toBeVisible();
  } finally { await f.close(); }
});

for (const method of ['Control', 'middle']) {
  await check(`AC-CON-UX-005 browser ${method} modified row opens detail in new tab`, async () => {
    const f = await fixture({ populated: true });
    try {
      await f.page.goto(baseURL + '/contributor'); const link = f.page.getByRole('link', { name: initial.title, exact: true }); await expect(link).toBeVisible();
      const opened = f.page.context().waitForEvent('page'); await link.click(method === 'middle' ? { button: 'middle' } : { modifiers: ['Control'] }); const tab = await opened;
      await expect(tab).toHaveURL(baseURL + '/contributor/drafts/proposal-1'); await expect(tab.getByRole('heading', { level: 1, name: 'Private draft detail' })).toBeVisible(); await expect(f.page).toHaveURL(baseURL + '/contributor'); await tab.close();
    } finally { await f.close(); }
  });
}
await check('AC-CON-UX-005 mobile touch row primary region navigates normally', async () => {
  const f = await fixture({ populated: true, touch: true });
  try {
    await f.page.setViewportSize({ width: 375, height: 812 }); await f.page.goto(baseURL + '/contributor'); const box = await f.page.locator('.draft-row-link').boundingBox();
    await f.page.touchscreen.tap(box.x + box.width - 24, box.y + box.height / 2); await expect(f.page.getByRole('heading', { level: 1, name: 'Private draft detail' })).toBeVisible();
  } finally { await f.close(); }
});

for (const width of [375, 768, 1440]) {
  await check(`AC-CON-UX-006 four editor jumps focus clear of save and preserve history ${width}px`, async () => {
    const f = await fixture({ populated: true });
    try {
      await f.page.setViewportSize({ width, height: 1000 }); await f.page.emulateMedia({ reducedMotion: 'reduce' }); await f.page.goto(baseURL + '/contributor/drafts/proposal-1'); await f.page.getByRole('link', { name: 'Edit private draft' }).click();
      await f.page.getByLabel('Problem (required)').fill('Jump retained dirty text'); const historyBefore = await f.page.evaluate(() => ({ url: location.href, length: history.length, index: history.state.idx })); const header = await f.page.locator('.topbar').boundingBox();
      const nav = f.page.getByRole('navigation', { name: 'Draft sections', exact: true }); await expect(nav.getByRole('link')).toHaveCount(4);
      for (const [name, id] of [['Overview','editor-overview'],['Acceptance criteria','editor-criteria'],['Patch','editor-patch'],['Evidence','editor-evidence']]) {
        const link = nav.getByRole('link', { name, exact: true }); await link.focus(); await link.press('Enter'); const section = f.page.locator('#' + id); await expect(section).toBeFocused();
        const target = await section.boundingBox(); const bar = await f.page.locator('.save-actions').boundingBox(); assert.ok(target.y >= bar.y + bar.height - 1, `${name} must clear measured toolbar: ${target.y} vs ${bar.y + bar.height}`); assert.ok(target.y < 1000);
        assert.deepEqual(await f.page.evaluate(() => ({ url: location.href, length: history.length, index: history.state.idx })), historyBefore); assert.equal(await f.page.evaluate(() => document.scrollingElement.scrollTop), 0); assert.deepEqual(await f.page.locator('.topbar').boundingBox(), header);
      }
      assert.equal(await f.page.locator('main').evaluate(node => [...node.querySelectorAll('section,form,fieldset,div')].filter(child => /auto|scroll/.test(getComputedStyle(child).overflowY) && child.scrollHeight > child.clientHeight).length), 0);
      await expect(f.page.getByLabel('Problem (required)')).toHaveValue('Jump retained dirty text'); assert.equal(await f.page.locator('main').evaluate(node => getComputedStyle(node).scrollBehavior), 'auto');
      await capture(f.page, `section-evidence-${width}`); await leaveAttempt(f, () => f.page.evaluate(() => history.back()), false); await expect(f.page).toHaveURL(baseURL + editorPath);
    } finally { await f.close(); }
  });
}

await check('AC-CON-UX-006 narrative width is bounded while patch stays wider on desktop', async () => {
  const f = await fixture({ populated: true });
  try {
    await f.page.setViewportSize({ width: 1920, height: 1080 }); await edit(f); const narrative = await f.page.getByLabel('Problem (required)').boundingBox(); const patch = await f.page.getByLabel('Unified diff (optional)').boundingBox();
    assert.ok(narrative.width < patch.width, `Narrative ${narrative.width}, patch ${patch.width}`); assert.ok(narrative.width <= 900);
  } finally { await f.close(); }
});

await check('AC-CON-UX-007 task hints, exact limits and error description associations', async () => {
  const f = await fixture({ populated: true });
  try {
    await edit(f);
    for (const [label, limit] of [['Title (required)','200'], ['Problem (required)','10,000'], ['Constraints (optional)','10,000'], ['Expected behavior (required)','10,000'], ['Contributor summary (optional)','500'], ['Unified diff (optional)','100,000']]) {
      const field = f.page.getByLabel(label); const hintIds = (await field.getAttribute('aria-describedby')).split(/\s+/); const hints = await Promise.all(hintIds.map(id => f.page.locator('[id="' + id + '"]').textContent()));
      const text = hints.join(' '); assert.ok(text.includes(limit), label + ' limit'); assert.ok(text.length > (`Maximum ${limit} characters.`).length, label + ' must include task guidance');
    }
    await f.page.getByLabel('Title (required)').fill('x'.repeat(201)); await f.page.getByRole('button', { name: 'Save private draft', exact: true }).click(); await expect(f.page.getByLabel('Title (required)')).toBeFocused(); await expect(f.page.getByLabel('Title (required)')).toHaveAttribute('aria-invalid', 'true');
    const descriptions = (await f.page.getByLabel('Title (required)').getAttribute('aria-describedby')).split(/\s+/); assert.ok(descriptions.includes('draft-title-error')); await expect(f.page.locator('#draft-title-error')).toBeVisible(); assert.equal(f.state.requests.filter(item => item.method === 'PATCH').length, 0);
  } finally { await f.close(); }
});

for (const width of [375, 768, 1440]) {
  await check(`AC-CON-UX-007 compact topbar long title, drawer and 200% text ${width}px`, async () => {
    const f = await fixture({ populated: true }); f.state.accountId = 'u'.repeat(80);
    try {
      await f.page.setViewportSize({ width, height: 1000 }); await edit(f); await fits(f.page); await expect(f.page.locator('.topbar-task')).toHaveText('Edit draft'); const topbar = await f.page.locator('.topbar').boundingBox(); assert.ok(topbar.height <= 100);
      await expect(f.page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).locator('.draft-title-crumb > [title]')).toHaveAttribute('title', initial.title);
      if (width === 375) {
        const open = f.page.getByRole('button', { name: 'Open navigation' }); await open.click(); const dialog = f.page.getByRole('dialog'); await expect(dialog).toBeVisible(); assert.ok(await dialog.evaluate(node => node.matches(':modal'))); await dialog.getByRole('button', { name: 'Close navigation' }).focus();
        await f.page.locator('main input').first().evaluate(node => node.focus()); assert.ok(await dialog.evaluate(node => node.contains(document.activeElement))); await f.page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(open).toBeFocused();
      }
      await f.page.evaluate(() => { document.documentElement.style.fontSize = '200%'; }); await fits(f.page); await expect(f.page.locator('.topbar-task')).toBeVisible();
      const evidence = f.page.getByRole('navigation', { name: 'Draft sections' }).getByRole('link', { name: 'Evidence', exact: true }); await evidence.focus(); await evidence.press('Enter'); await expect(f.page.locator('#editor-evidence')).toBeFocused();
      const target = await f.page.locator('#editor-evidence').boundingBox(); const save = await f.page.locator('.save-actions').boundingBox(); assert.ok(target.y >= save.y + save.height - 1); await capture(f.page, `reflow-${width}`);
    } finally { await f.close(); }
  });
}

await check('PROP-CON-001 remains inactive: successful creation still opens saved detail', async () => {
  const f = await fixture();
  try {
    await f.page.goto(baseURL + '/contributor/new'); await f.page.getByLabel('Title (required)').fill('Keep detail redirect'); await f.page.getByLabel('Problem (required)').fill('Issue'); await f.page.getByLabel('Expected behavior (required)').fill('Outcome');
    const d = dialogs(f.page, false); await f.page.getByRole('button', { name: 'Create private draft' }).click(); await expect(f.page).toHaveURL(baseURL + '/contributor/drafts/proposal-1'); await expect(f.page.getByRole('heading', { level: 1, name: 'Private draft detail' })).toBeVisible(); assert.equal(d.seen.length, 0); d.stop();
  } finally { await f.close(); }
});


await check('P2-A11Y-002 enlarged unfocused skip link leaves task unobscured and focus restores it', async () => {
  const f = await fixture({ populated: true });
  try {
    await f.page.setViewportSize({ width: 375, height: 1000 }); await edit(f); await f.page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    const skip = f.page.getByRole('link', { name: 'Skip to main content' }); await skip.focus(); const visible = await skip.boundingBox(); assert.ok(visible.y >= 0 && visible.y + visible.height <= 1000); await f.page.keyboard.press('Enter'); await expect(f.page.locator('main')).toBeFocused();
    assert.ok(await f.page.locator('.topbar-task').evaluate(node => { const rect = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)); }), 'Unfocused skip link must not overlay the current task');
    await capture(f.page, 'enlarged-skip-fixed');
  } finally { await f.close(); }
});


await check('P2-MOB-001 enlarged mobile uncertainty keeps Save, fields and section navigation usable', async () => {
  const f = await fixture({ populated: true }); f.state.saveStatus = 500;
  try {
    await f.page.setViewportSize({ width: 375, height: 1000 }); await edit(f); await f.page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await f.page.getByLabel('Problem (required)').fill('ENLARGED UNCERTAIN EDITS'); await f.page.getByRole('button', { name: 'Save private draft', exact: true }).click();
    const actions = f.page.getByRole('region', { name: 'Save draft and status' }); await expect(actions).toContainText(/uncertain|may have been saved/i); await expect(f.page.getByRole('button', { name: 'Save private draft', exact: true })).toBeDisabled(); await saveVisible(f.page);
    await expect(f.page.getByLabel('Problem (required)')).toHaveValue('ENLARGED UNCERTAIN EDITS'); await expect(f.page.getByLabel('Problem (required)')).toBeEnabled();
    const main = await f.page.locator('main').boundingBox(); const bar = await actions.boundingBox(); assert.ok(bar.height < main.height, 'Recovery toolbar must not consume whole scroll viewport');
    const beforeRecovery = await f.page.evaluate(() => ({ url: location.href, index: history.state.idx, length: history.length })); await f.page.getByRole('link', { name: 'Recovery details', exact: true }).click(); const recovery = f.page.getByRole('region', { name: 'Save recovery details', exact: true }); await expect(recovery).toBeFocused(); await expect(recovery.getByRole('alert')).toContainText(/uncertain|may have been saved/i);
    assert.deepEqual(await f.page.evaluate(() => ({ url: location.href, index: history.state.idx, length: history.length })), beforeRecovery);
    await f.page.getByLabel('Title (required)').focus(); await expect(f.page.getByLabel('Title (required)')).toBeFocused(); const field = await f.page.getByLabel('Title (required)').boundingBox(); const currentBar = await actions.boundingBox();
    assert.ok(field.y >= currentBar.y + currentBar.height && field.y + field.height <= main.y + main.height, 'Enlarged title remains fully operable below recovery');
    const jump = f.page.getByRole('navigation', { name: 'Draft sections' }).getByRole('link', { name: 'Overview', exact: true }); await jump.focus(); await jump.press('Enter'); await expect(f.page.locator('#editor-overview')).toBeFocused();
    const target = await f.page.locator('#editor-overview').boundingBox(); const jumpedBar = await actions.boundingBox(); assert.ok(target.y >= jumpedBar.y + jumpedBar.height - 1);
    assert.equal(await f.page.locator('main').evaluate(node => [...node.querySelectorAll('section,form,fieldset,div')].filter(child => /auto|scroll/.test(getComputedStyle(child).overflowY) && child.scrollHeight > child.clientHeight).length), 0);
    await fits(f.page); assert.equal(await f.page.evaluate(() => document.scrollingElement.scrollTop), 0); await capture(f.page, 'enlarged-mobile-recovery');
  } finally { await f.close(); }
});

await browser.close();
await writeFile(`${output}/acceptance-results.json`, JSON.stringify(results, null, 2) + '\n');
console.log(JSON.stringify({ passed: results.checks.filter(item => item.status === 'passed').length, failed: results.checks.filter(item => item.status === 'failed').length, consoleErrors: results.consoleErrors, warnings: results.warnings }, null, 2));
if (results.checks.some(item => item.status === 'failed') || results.consoleErrors.length || results.warnings.some(value => value.includes('not created by @remix-run/router'))) process.exitCode = 1;
