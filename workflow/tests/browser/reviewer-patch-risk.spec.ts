import {test,expect,request as requestFactory,type Page} from '@playwright/test';
import {randomUUID} from 'node:crypto';
import {createPatchRiskFixture} from './fixtures/reviewer-patch-risk';
type Fixture=Awaited<ReturnType<typeof createPatchRiskFixture>>;
async function open(page:Page,f:Fixture){
  await page.setExtraHTTPHeaders({'X-Forwarded-Proto':'https'});await page.goto('/reviewer');
  await page.getByLabel('Username').fill(f.prefix+'-reviewer');await page.getByLabel('Password').fill(f.password);await page.getByLabel('Password').press('Enter');
  await page.getByRole('button',{name:'Claim '+f.prefix,exact:true}).click();
  await expect(page.getByRole('button',{name:'Analyze selected criteria'})).toBeVisible();
}
async function analyze(page:Page){
  const panel=page.getByRole('region',{name:'Patch Risk assistant'});
  await panel.getByRole('checkbox').first().check();await panel.getByRole('button',{name:'Analyze selected criteria'}).click();
  return panel;
}
test('ai-human-save',async({page})=>{
  const f=await createPatchRiskFixture();try{
    await open(page,f);const panel=await analyze(page);
    await expect(panel.getByRole('region',{name:'Patch Risk result'})).toBeVisible();
    await expect(panel.getByText(/Not analyzed in this batch:/)).not.toContainText('None.');
    expect(await page.evaluate(()=>Object.hasOwn(window,'aiInjected'))).toBe(false);
    await panel.getByRole('button',{name:'Create finding from risk 1'}).click();await panel.getByRole('button',{name:'Cancel',exact:true}).click();
    expect((await f.pool.query('SELECT count(*)::int n FROM "ReviewFinding" WHERE "proposalId"=$1',[f.proposal])).rows[0].n).toBe(0);
    await panel.getByRole('button',{name:'Create finding from risk 1'}).click();
    await panel.getByRole('textbox',{name:'Description',exact:true}).fill('Verified human finding');await panel.getByRole('button',{name:'Save finding',exact:true}).click();
    await expect(page.getByText('Finding created.',{exact:true})).toBeVisible();
    const rows=await f.pool.query('SELECT description FROM "ReviewFinding" WHERE "proposalId"=$1',[f.proposal]);expect(rows.rows).toEqual([{description:'Verified human finding'}]);
    expect((await f.pool.query('SELECT count(*)::int n FROM "CoverageAssessment" WHERE "proposalId"=$1',[f.proposal])).rows[0].n).toBe(0);
  }finally{await f.dispose();}
});
test('ai-transient-page',async({page})=>{
  const f=await createPatchRiskFixture();try{
    await open(page,f);let panel=await analyze(page);await panel.getByRole('button',{name:'Create finding from risk 1'}).click();
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
    await expect(panel.getByRole('form')).toHaveCount(0);await expect(panel.getByRole('region',{name:'Patch Risk result'})).toHaveCount(0);
    await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
    expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain('Synthetic advisory');
    await page.reload();await page.getByRole('button',{name:'My assignments',exact:true}).click();
    await page.getByRole('button',{name:'Open '+f.prefix,exact:true}).click();panel=page.getByRole('region',{name:'Patch Risk assistant'});
    await expect(panel.getByRole('region',{name:'Patch Risk result'})).toHaveCount(0);await expect(panel.getByRole('form')).toHaveCount(0);
  }finally{await f.dispose();}
});
test('ai-ui-fallback',async({page})=>{
  const f=await createPatchRiskFixture('unavailable');try{
    await open(page,f);const manual=page.getByRole('form',{name:'Create finding',exact:true});
    await manual.getByLabel('Description',{exact:true}).fill('Unsaved manual finding');const panel=await analyze(page);
    await expect(panel.getByRole('status')).toContainText('unavailable');
    await expect(manual.getByLabel('Description',{exact:true})).toHaveValue('Unsaved manual finding');
    await expect(manual.getByRole('button',{name:'Create finding',exact:true})).toBeEnabled();
  }finally{await f.dispose();}
});
test('ai-ui-selection-stale',async({page})=>{
  const f=await createPatchRiskFixture('delayed');try{
    await open(page,f);const pending=page.waitForRequest(r=>r.url().endsWith('/ai/patch-risk'));
    const panel=await analyze(page);await pending;
    // The synthetic provider waits at an explicit advisory test barrier. A real
    // owner HTTP save/submit replaces the revision before provider completion.
    await expect.poll(async()=>Number((await f.pool.query('SELECT count(*) n FROM "AiOutboundAttempt" WHERE "actorId"=$1',[f.reviewer])).rows[0].n)).toBe(1);
    const api=await requestFactory.newContext({baseURL:'http://127.0.0.1:3000',extraHTTPHeaders:{'X-Forwarded-Proto':'https'}});
    try{
      const csrf=await(await api.get('/api/auth/csrf')).json();
      const session=await(await api.post('/api/auth/login',{headers:{'x-csrf-token':csrf.csrfToken},data:{username:f.prefix+'-owner',password:f.password}})).json();
      const root=(await f.pool.query('SELECT version FROM "ChangeProposal" WHERE id=$1',[f.proposal])).rows[0];
      // Seeded submitted snapshots intentionally have no working draft. An
      // explicit owner save creates one; GET does not manufacture private state.
      const content={title:f.prefix,summary:'Replacement summary',problem:'Synthetic problem',constraints:'',expectedBehavior:'Expected behavior',
        diffText:'--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new revision\n',criteria:[{statement:'New required criterion',required:true}],evidence:[]};
      const saved=await api.patch(`/api/proposals/${f.proposal}/draft`,{headers:{'x-csrf-token':session.csrfToken},data:{expectedVersion:root.version,content}});
      expect(saved.ok()).toBe(true);const savedBody=await saved.json();
      const submitted=await api.post(`/api/proposals/${f.proposal}/submit`,{headers:{'x-csrf-token':session.csrfToken,'Idempotency-Key':randomUUID()},data:{expectedVersion:savedBody.version,workingRevisionId:savedBody.workingRevisionId}});
      expect(submitted.ok()).toBe(true);
    }finally{await api.dispose();await f.release();}
    await expect(panel.getByText(/Stale analysis;/)).toBeVisible();await expect(panel.getByRole('button',{name:'Create finding from risk 1'})).toBeDisabled();
  }finally{await f.dispose();}
});
