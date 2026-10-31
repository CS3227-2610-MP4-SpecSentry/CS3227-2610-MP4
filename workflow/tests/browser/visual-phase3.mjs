// Synthetic UI acceptance only: start Vite on UI_BASE_URL before running this script.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseURL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5188';
const mode = process.argv[2] ?? 'baseline';
assert.ok(['baseline', 'after'].includes(mode));
const output = `logs/yooplo/resources/2026-10-31-visual-phase3/verification/${mode}`;
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = { scope: 'Synthetic API browser fixtures; no live backend/database authorization certification', checks: [], consoleErrors: [], expectedHttpErrors: [], warnings: [], screenshots: [] };
const csrfToken = 'a'.repeat(64);
const initial = {
  title: 'Improve specification traceability', problem: 'Requirements and review evidence are spread across several tools. Contributors need a clear private draft before submitting a change.', constraints: 'Preserve ownership, immutable submitted revisions and manual review.', expectedBehavior: 'Contributors can prepare a complete specification with explicit acceptance criteria and supporting evidence.',
  summary: 'Browser verification fixture', diffText: '+'.repeat(2000),
  criteria: [{ stableKey: 'criterion-1', statement: 'Saving a private draft preserves the existing submitted revision.', required: true }, { stableKey: 'criterion-2', statement: 'Keyboard focus remains clear while editing long content.', required: false }], evidence: [{ id: 'evidence-1', text: 'Synthetic verification notes: owner-only access, validation and keyboard navigation are checked before review.' }],
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


const scenarios = [
  ['empty','/contributor',{}], ['populated','/contributor',{populated:true}],
  ['login','/login',{signedIn:false}], ['create','/contributor/new',{}],
  ['detail','/contributor/drafts/proposal-1',{populated:true}], ['editor','/contributor/drafts/proposal-1/edit',{populated:true}],
  ['reviewer','/reviewer',{role:'REVIEWER'}], ['release','/releases',{role:'RELEASE_MAINTAINER'}],
  ['error','/contributor',{listStatus:500}], ['not-found','/missing-page',{}], ['loading','/contributor',{delay:1800}],
];
for (const [name,path,options] of scenarios) for (const width of [375,768,1440]) {
  await check(`${name} ${width}px`, async()=>{
    const f=await fixture(options);
    try {
      await f.page.setViewportSize({width,height:1000}); await f.page.goto(baseURL+path);
      if(name==='login') await expect(f.page.getByLabel('Username')).toBeVisible();
      else if(name==='loading') await expect(f.page.getByRole('status').filter({hasText:/Loading drafts/})).toBeVisible();
      else if(name==='error') await expect(f.page.getByRole('alert')).toBeVisible();
      else if(name==='empty') await expect(f.page.getByRole('heading',{name:'No drafts yet'})).toBeVisible();
      else if(name==='populated') await expect(f.page.getByRole('link',{name:initial.title,exact:true})).toBeVisible();
      else await expect(f.page.locator('main h1')).toBeVisible();
      await fits(f.page);await capture(f.page,`${name}-${width}`);
      if(width===1440 && name!=='loading') await scan(f.page,name);
      if(name==='editor') {
        await f.page.getByRole('navigation',{name:'Draft sections'}).getByRole('link',{name:'Patch',exact:true}).click();await expect(f.page.locator('#editor-patch')).toBeFocused();await capture(f.page,`patch-${width}`);
      }
      if(name==='login') {await f.page.getByLabel('Username').focus();await capture(f.page,`login-focus-${width}`);}
      if(name==='loading') await expect(f.page.getByRole('heading',{name:'No drafts yet'})).toBeVisible();
    }finally{await f.close();}
  });
}
await check('mobile drawer, button states, 200% text and reduced motion',async()=>{
  const f=await fixture({populated:true});try{
    await f.page.setViewportSize({width:375,height:1000});await f.page.goto(baseURL+'/contributor');await expect(f.page.getByRole('link',{name:initial.title,exact:true})).toBeVisible();
    const action=f.page.getByRole('link',{name:'Create New Draft',exact:true});await action.hover();await capture(f.page,'primary-hover-375');await action.focus();await capture(f.page,'primary-focus-375');
    const box=await action.boundingBox();await f.page.mouse.move(box.x+box.width/2,box.y+box.height/2);await f.page.mouse.down();await capture(f.page,'primary-pressed-375');await f.page.mouse.move(0,0);await f.page.mouse.up();
    const opener=f.page.getByRole('button',{name:'Open navigation'});await opener.click();await expect(f.page.getByRole('dialog')).toBeVisible();await capture(f.page,'drawer-375');await scan(f.page,'drawer');await f.page.keyboard.press('Escape');await expect(opener).toBeFocused();
    await f.page.evaluate(()=>document.documentElement.style.fontSize='200%');await fits(f.page);await capture(f.page,'enlarged-375');
    await f.page.emulateMedia({reducedMotion:'reduce'});assert.ok((await f.page.locator('.app-shell').evaluate(n=>getComputedStyle(n).transitionDuration)).split(',').every(value=>parseFloat(value)===0));
  }finally{await f.close();}
});
await browser.close();await writeFile(`${output}/visual-results.json`,JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify({mode,passed:results.checks.filter(c=>c.status==='passed').length,failed:results.checks.filter(c=>c.status==='failed').length,screenshots:results.screenshots.length,errors:results.consoleErrors,warnings:results.warnings},null,2));
if(results.checks.some(c=>c.status==='failed')||results.consoleErrors.length)process.exitCode=1;
