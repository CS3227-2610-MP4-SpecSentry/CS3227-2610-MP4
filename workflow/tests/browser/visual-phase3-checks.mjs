// Start a preview first; run from repository root with UI_BASE_URL and optional UI_CHECK_OUTPUT.
// Seven layout/state checks plus criterion/evidence focus; retained baseline PNGs are explicit inputs.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseURL = process.env.UI_BASE_URL ?? 'http://127.0.0.1:5188';
const output = process.env.UI_CHECK_OUTPUT ?? 'tmp/browser-checks/visual-phase3';
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



const density = [];
async function baselinePanelTop(page,width) {
  const png = await readFile(`logs/yooplo/resources/2026-10-31-visual-phase3/verification/baseline/empty-${width}.png`);
  return page.evaluate(async({url,width})=>{
    const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
    const x=width===375?16:width===768?244:288;const runs=[];let start=null;
    for(let y=150;y<canvas.height;y++){const i=(y*canvas.width+x)*4;const border=Math.abs(pixels[i]-226)<=2&&Math.abs(pixels[i+1]-232)<=2&&Math.abs(pixels[i+2]-240)<=2;
      if(border&&start===null)start=y;if(!border&&start!==null){if(y-start>30)runs.push({start,end:y,length:y-start});start=null;}}
    if(start!==null)runs.push({start,end:canvas.height,length:canvas.height-start});const longest=runs.sort((a,b)=>b.length-a.length)[0];if(!longest||longest.length<150)throw new Error('Baseline panel border could not be measured');
    return {top:longest.start-12,method:'Baseline PNG longest left card border at known content x, minus frozen12px corner radius',x,runs};
  },{url:'data:image/png;base64,'+png.toString('base64'),width});
}
for(const width of [375,768,1440]) await check(`dashboard density/count/pagination ${width}px`,async()=>{
 const f=await fixture({populated:true});try{await f.page.setViewportSize({width,height:1000});await f.page.goto(baseURL+'/contributor');await expect(f.page.getByTestId('draft-page-count')).toHaveText('1');assert.equal(await f.page.locator('.summary-card').count(),0);assert.equal(await f.page.locator('.privacy-note').count(),1);assert.equal(await f.page.getByTestId('draft-page-count').count(),1);
 const before=await baselinePanelTop(f.page,width);const after=(await f.page.locator('.draft-panel').boundingBox()).y;assert.ok(after<before.top-1,`Panel must move up: ${before.top} -> ${after}`);density.push({width,before,after,movedUp:before.top-after});const primary=await f.page.getByRole('link',{name:'Create New Draft',exact:true}).boundingBox();assert.ok(primary.y>=0&&primary.y+primary.height<=1000);
 await f.page.getByRole('button',{name:'Next page',exact:true}).click();await expect(f.page.getByTestId('draft-page-count')).toHaveText('0');await expect(f.page.getByRole('heading',{name:'No drafts on this page'})).toBeVisible();await f.page.getByRole('button',{name:'First page',exact:true}).click();await expect(f.page.getByTestId('draft-page-count')).toHaveText('1');await fits(f.page);
 }finally{await f.close();}});
await check('dashboard pending/unavailable counts remain truthful',async()=>{
 const loading=await fixture({delay:900});try{await loading.page.goto(baseURL+'/contributor');await expect(loading.page.getByRole('status').filter({hasText:/Loading drafts/})).toBeVisible();await expect(loading.page.getByTestId('draft-page-count')).toHaveText('...');await expect(loading.page.getByRole('heading',{name:'No drafts yet'})).toBeVisible();await expect(loading.page.getByTestId('draft-page-count')).toHaveText('0');}finally{await loading.close();}
 const failure=await fixture({listStatus:500});try{await failure.page.goto(baseURL+'/contributor');await expect(failure.page.getByRole('alert')).toBeVisible();await expect(failure.page.getByTestId('draft-page-count')).toHaveText('Unavailable');}finally{await failure.close();}
});
await check('tokenized hover/pressed/focus and reduced-motion states',async()=>{
 const f=await fixture({populated:true});try{await f.page.emulateMedia({reducedMotion:'reduce'});await f.page.goto(baseURL+'/contributor');const action=f.page.getByRole('link',{name:'Create New Draft',exact:true});await expect(action).toBeVisible();
 const tokens=await f.page.evaluate(()=>Object.fromEntries(['--font-sans','--text-sm','--space-4','--radius-control','--shadow','--motion-fast','--motion-base','--focus-ring'].map(name=>[name,getComputedStyle(document.documentElement).getPropertyValue(name).trim()])));assert.ok(Object.values(tokens).every(Boolean));
 await f.page.mouse.move(0,0);const normal=await action.evaluate(n=>({background:getComputedStyle(n).backgroundColor,shadow:getComputedStyle(n).boxShadow}));await action.hover();const hover=await action.evaluate(n=>({background:getComputedStyle(n).backgroundColor,shadow:getComputedStyle(n).boxShadow}));assert.notEqual(hover.background,normal.background);const box=await action.boundingBox();await f.page.mouse.down();const pressed=await action.evaluate(n=>getComputedStyle(n).boxShadow);assert.notEqual(pressed,hover.shadow);await f.page.mouse.move(0,0);await f.page.mouse.up();
 await action.focus();await f.page.keyboard.press('Tab');await f.page.keyboard.press('Shift+Tab');await expect(action).toBeFocused();assert.equal(await action.evaluate(n=>getComputedStyle(n).outlineStyle),'solid');assert.ok((await action.evaluate(n=>getComputedStyle(n).transitionDuration)).split(',').every(v=>parseFloat(v)===0));
 results.tokens=tokens;
 }finally{await f.close();}
});
await check('disabled Save hover remains disabled presentation',async()=>{
 const f=await fixture({populated:true});f.state.saveDelay=1800;try{await f.page.emulateMedia({reducedMotion:'reduce'});await f.page.goto(baseURL+'/contributor/drafts/proposal-1/edit');await f.page.getByLabel('Problem (required)').fill('Pending hover check');await f.page.getByRole('button',{name:'Save private draft',exact:true}).click();const button=f.page.getByRole('button',{name:'Saving...',exact:true});await expect(button).toBeDisabled();await f.page.mouse.move(0,0);const normal=await button.evaluate(n=>getComputedStyle(n).backgroundColor);await button.hover();assert.equal(await button.evaluate(n=>getComputedStyle(n).backgroundColor),normal);await expect(f.page.getByText('Draft saved. Version 2.',{exact:true})).toBeVisible();}finally{await f.close();}
});
await check('long patch at200% remains usable under sticky Save',async()=>{
 const f=await fixture({populated:true});try{await f.page.setViewportSize({width:375,height:1000});await f.page.goto(baseURL+'/contributor/drafts/proposal-1/edit');await expect(f.page.getByLabel('Problem (required)')).toBeVisible();await f.page.evaluate(()=>document.documentElement.style.fontSize='200%');const patch=f.page.getByLabel('Unified diff (optional)');const value=('+ '+ 'x'.repeat(180)+'\n').repeat(100);await patch.fill(value);await expect(patch).toHaveValue(value);await patch.focus();const field=await patch.boundingBox(),bar=await f.page.locator('.save-actions').boundingBox();assert.ok(field.y>=bar.y+bar.height&&field.y+field.height<=1002,'Focused patch clears Save; allow2px fractional edge rounding');await expect(patch).toBeFocused();assert.ok(await patch.evaluate(n=>n.clientHeight>0&&n.scrollHeight>=n.clientHeight));await fits(f.page);assert.equal(await f.page.evaluate(()=>document.scrollingElement.scrollTop),0);await scan(f.page,'enlarged long patch');await capture(f.page,'long-patch-200');}finally{await f.close();}
});
await check('Supplement: criterion and evidence add/validation/removal focus',async()=>{
const f=await fixture({populated:true});f.state.content.criteria=[initial.criteria[0]];try{await f.page.goto(`${baseURL}/contributor/drafts/proposal-1/edit`);await expect(f.page.getByLabel('Problem (required)')).toBeVisible();
await f.page.getByRole('button',{name:'Add criterion',exact:true}).click();await expect(f.page.getByLabel('Criterion 2 statement')).toBeFocused();await expect(f.page.getByLabel('Criterion 2 required')).toBeChecked();
await f.page.getByRole('button',{name:'Save private draft',exact:true}).click();await expect(f.page.getByLabel('Criterion 2 statement')).toBeFocused();await expect(f.page.getByLabel('Criterion 2 statement')).toHaveAttribute('aria-invalid','true');assert.equal(f.state.requests.filter(item=>item.method==='PATCH').length,0);
await f.page.getByLabel('Criterion 2 statement').fill('Temporary second criterion');await f.page.getByRole('button',{name:'Remove criterion 2',exact:true}).click();await expect(f.page.getByLabel('Criterion 1 statement')).toBeFocused();
await f.page.getByRole('button',{name:'Add criterion',exact:true}).click();await f.page.getByLabel('Criterion 2 statement').fill('Temporary second');await f.page.getByRole('button',{name:'Add criterion',exact:true}).click();await f.page.getByLabel('Criterion 3 statement').fill('Third retains focus');
await f.page.getByRole('button',{name:'Remove criterion 2',exact:true}).click();await expect(f.page.getByLabel('Criterion 2 statement')).toBeFocused();await expect(f.page.getByLabel('Criterion 2 statement')).toHaveValue('Third retains focus');
await f.page.getByRole('button',{name:'Add evidence',exact:true}).click();await expect(f.page.getByLabel('Evidence 2 text')).toBeFocused();await f.page.getByRole('button',{name:'Save private draft',exact:true}).click();await expect(f.page.getByLabel('Evidence 2 text')).toBeFocused();await expect(f.page.getByLabel('Evidence 2 text')).toHaveAttribute('aria-invalid','true');await f.page.getByRole('button',{name:'Remove evidence 2',exact:true}).click();await expect(f.page.getByLabel('Evidence 1 text')).toBeFocused();await f.page.getByRole('button',{name:'Remove evidence 1',exact:true}).click();await expect(f.page.getByRole('button',{name:'Add evidence',exact:true})).toBeFocused();await capture(f.page,'criterion-evidence-focus-supplement');}finally{await f.close();}});
await browser.close();await writeFile(`${output}/phase3-checks.json`,JSON.stringify(results,null,2)+'\n');await writeFile(`${output}/density-metrics.json`,JSON.stringify(density,null,2)+'\n');console.log(JSON.stringify({passed:results.checks.filter(c=>c.status==='passed').length,failed:results.checks.filter(c=>c.status==='failed').length,errors:results.consoleErrors,density},null,2));if(results.checks.some(c=>c.status==='failed')||results.consoleErrors.length)process.exitCode=1;
