import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const output='logs/yooplo/resources/2026-11-02-draft-action-spacing/verification';
await mkdir(output,{recursive:true});
const results={scope:'Synthetic API routing against actual local frontend; no real data reads or mutations',widths:[],errors:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
for(const width of [1440,768,375]) {
  const context=await browser.newContext({viewport:{width,height:1000},hasTouch:width===375});
  const page=await context.newPage(); const mutations=[];
  page.on('pageerror',e=>results.errors.push(e.message));
  await context.route('**/api/**',async route=>{
    const req=route.request(); const path=new URL(req.url()).pathname;
    const send=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
    if(req.method()!=='GET'){mutations.push({method:req.method(),path});return send({},500);}
    if(path==='/api/auth/session')return send({account:{id:'owner',username:'synthetic-owner',role:'CONTRIBUTOR'},csrfToken:'a'.repeat(64),expiresAt:Date.now()+1800000});
    if(path==='/api/proposals/proposal-1/draft')return send({proposalId:'proposal-1',workingRevisionId:'working-1',version:1,state:'DRAFT',content:{title:'Synthetic action spacing fixture',problem:'Verify clear draft action hierarchy.',constraints:'Preserve behavior.',expectedBehavior:'Actions remain readable and accessible.',summary:'',diffText:'',criteria:[{stableKey:'criterion-1',statement:'Controls have comfortable spacing.',required:true}],evidence:[]}});
    return send({},404);
  });
  await page.goto('http://127.0.0.1:5173/contributor/drafts/proposal-1');
  const submit=page.getByRole('button',{name:'Submit saved working copy',exact:true});
  const withdraw=page.getByRole('button',{name:'Withdraw proposal',exact:true});
  const del=page.getByRole('button',{name:'Delete private draft',exact:true});
  await expect(submit).toBeVisible();await del.scrollIntoViewIfNeeded();
  const boxes=await Promise.all([submit,withdraw,del].map(x=>x.boundingBox()));
  boxes.forEach(b=>assert.ok(b&&b.height>=44&&b.width>=44,'Minimum touch size'));
  const [s,w,d]=boxes;
  assert.ok(d.y>=Math.max(s.y+s.height,w.y+w.height)+23.5,'Separate delete row with >=24px separation');
  if(width===375){assert.ok(w.y>=s.y+s.height+15.5,'Stacked mobile actions >=16px gap');assert.ok(Math.abs(s.x-w.x)<1&&Math.abs(s.width-w.width)<1&&Math.abs(s.width-d.width)<1,'Full width mobile actions');}
  else {assert.ok(Math.abs(s.y-w.y)<1,'Desktop/tablet action row');assert.ok(w.x>=s.x+s.width+15.5,'Horizontal >=16px gap');}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No viewport overflow');
  const appearance=await Promise.all([submit,withdraw,del].map(x=>x.evaluate(e=>{const s=getComputedStyle(e);return {background:s.backgroundColor,color:s.color,border:s.borderColor}})));
  assert.notEqual(appearance[0].background,appearance[1].background,'Submit primary, withdraw secondary');assert.notEqual(appearance[1].color,appearance[2].color,'Destructive color distinct');
  await submit.focus();await page.keyboard.press('Tab');await expect(withdraw).toBeFocused();await page.keyboard.press('Tab');await expect(del).toBeFocused();
  await page.screenshot({path:`${output}/draft-actions-${width}.png`});
  await submit.focus();await page.keyboard.press('Enter');await expect(page.getByRole('form',{name:'Confirm submit'})).toBeVisible();await expect(page.getByRole('button',{name:'Cancel action',exact:true})).toBeFocused();await page.getByRole('button',{name:'Cancel action',exact:true}).click();
  await withdraw.click();await expect(page.getByRole('heading',{name:'Confirm withdrawal',exact:true})).toBeVisible();await expect(page.getByLabel('Withdrawal reason (required)',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel action',exact:true}).click();
  await del.click();await expect(page.getByRole('heading',{name:'Confirm permanent deletion',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Cancel deletion',exact:true})).toBeFocused();await page.getByRole('button',{name:'Cancel deletion',exact:true}).click();await expect(del).toBeFocused();
  assert.equal(mutations.length,0,'Opening/canceling confirmations must not mutate');
  results.widths.push({width,passed:true,boxes,appearance,keyboardOrder:true,confirmations:['submit','withdraw','delete'],businessMutations:mutations.length});await context.close();
}
assert.deepEqual(results.errors,[]);
}finally{await browser.close();await writeFile(`${output}/browser-results.json`,JSON.stringify(results,null,2));}
console.log(JSON.stringify({widths:results.widths.map(r=>r.width),passed:results.widths.length,errors:results.errors.length}));
