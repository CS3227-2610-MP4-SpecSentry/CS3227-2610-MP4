import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const output='logs/yooplo/resources/2026-11-02-breadcrumb-refinement/verification';
await mkdir(output,{recursive:true});
const title='<b>Long draft title</b> '+ 'accessible title '.repeat(10);
const detailPath='/contributor/drafts/proposal-1';
const editPath=detailPath+'/edit';
const results={scope:'Isolated synthetic API browser responses against actual frontend; no real database reads or mutations',screens:[],navigation:[],errors:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
async function fixture(width){
 const context=await browser.newContext({viewport:{width,height:1000}});const page=await context.newPage();const mutations=[];
 page.on('pageerror',e=>results.errors.push(e.message));
 await context.route('**/api/**',async route=>{
  const r=route.request(),path=new URL(r.url()).pathname;const send=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(r.method()!=='GET'){mutations.push({method:r.method(),path});return send({},500);}
  if(path==='/api/auth/session')return send({account:{id:'owner',username:'synthetic-owner',role:'CONTRIBUTOR'},csrfToken:'a'.repeat(64),expiresAt:Date.now()+1800000});
  if(path==='/api/proposals')return send({items:[{proposalId:'proposal-1',workingRevisionId:'working-1',title,state:'DRAFT',version:1,createdAt:'2026-10-30T10:00:00Z'}],nextCursor:null});
  if(path==='/api/proposals/proposal-1/draft')return send({proposalId:'proposal-1',workingRevisionId:'working-1',version:1,state:'DRAFT',content:{title,problem:'Problem',constraints:'',expectedBehavior:'Expected',summary:'',diffText:'',criteria:[],evidence:[]}});
  return send({},404);
 });
 return {context,page,mutations};
}
try{
for(const width of [1440,768,375]){
 const {context,page,mutations}=await fixture(width);
 for(const [path,labels,hrefs] of [
  ['/contributor',['My Drafts'],[]],
  [detailPath,['My Drafts',title],['/contributor']],
  [editPath,['My Drafts',title,'Edit'],['/contributor',detailPath]],
  ['/contributor/new',['My Drafts','Create Draft'],['/contributor']],
 ]){
  await page.goto('http://127.0.0.1:5173'+path);const nav=page.getByRole('navigation',{name:'Breadcrumb',exact:true});
  await expect(nav.locator('[aria-current="page"]')).toHaveText(labels.at(-1));
  const actual=await nav.locator('li').allTextContents();assert.deepEqual(actual,labels);
  assert.deepEqual(await nav.getByRole('link').evaluateAll(es=>es.map(e=>e.getAttribute('href'))),hrefs);
  assert.equal(new Set(hrefs).size,hrefs.length);await expect(nav.locator('a[aria-current="page"]')).toHaveCount(0);await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow');
  assert.equal(await nav.locator('b').count(),0,'User title rendered as text');
  if(path.includes('/drafts/'))await expect(nav.locator('.draft-title-crumb > [title]')).toHaveAttribute('title',title);
  await page.screenshot({path:`${output}/breadcrumbs-${width}-${path===editPath?'edit':path===detailPath?'detail':path.endsWith('new')?'create':'list'}.png`});
  results.screens.push({width,path,labels,hrefs,passed:true});
 }
 for(const target of ['My Drafts',title]){
  await page.goto('http://127.0.0.1:5173'+editPath);await page.getByLabel('Problem (required)',{exact:true}).fill('Unsaved edits');
  let confirms=0;page.once('dialog',async dialog=>{confirms++;await dialog.dismiss()});
  const link=page.getByRole('navigation',{name:'Breadcrumb',exact:true}).getByRole('link',{name:target,exact:true});
  await link.focus();await page.keyboard.press('Enter');await expect.poll(()=>confirms).toBe(1);await expect(page.getByLabel('Problem (required)',{exact:true})).toHaveValue('Unsaved edits');assert.equal(new URL(page.url()).pathname,editPath);assert.equal(confirms,1);
  page.once('dialog',async dialog=>{confirms++;await dialog.accept()});await link.press('Enter');await expect(page).toHaveURL(new RegExp((target==='My Drafts'?'/contributor':detailPath)+'$'));assert.equal(confirms,2);
  results.navigation.push({width,target:target===title?'Draft title':target,stayAndLeave:true});
 }
 await page.goto('http://127.0.0.1:5173'+detailPath);await page.getByRole('link',{name:'Edit private draft',exact:true}).click();
 await page.getByLabel('Problem (required)',{exact:true}).fill('Browser Back protected');let backPrompts=0;
 page.once('dialog',async d=>{backPrompts++;await d.dismiss()});await page.evaluate(()=>history.back());await expect.poll(()=>backPrompts).toBe(1);await expect(page.getByLabel('Problem (required)',{exact:true})).toHaveValue('Browser Back protected');assert.equal(new URL(page.url()).pathname,editPath);assert.equal(backPrompts,1);
 page.once('dialog',async d=>{backPrompts++;await d.accept()});await page.evaluate(()=>history.back());await expect(page).toHaveURL(new RegExp(detailPath+'$'));assert.equal(backPrompts,2);
 const historySize=await page.evaluate(()=>history.length);await page.goForward();await expect(page).toHaveURL(new RegExp(editPath+'$'));await expect(page.getByLabel('Problem (required)',{exact:true})).toHaveValue('Problem');await page.goBack();await expect(page).toHaveURL(new RegExp(detailPath+'$'));assert.equal(await page.evaluate(()=>history.length),historySize);
 await page.getByRole('link',{name:'Edit private draft',exact:true}).click();await expect(page.getByLabel('Problem (required)',{exact:true})).toHaveValue('Problem');let cleanPrompts=0;
 const cleanDialog=async d=>{cleanPrompts++;await d.dismiss()};page.on('dialog',cleanDialog);
 await page.getByRole('navigation',{name:'Breadcrumb',exact:true}).getByRole('link',{name:'My Drafts',exact:true}).click();await expect(page).toHaveURL(/\/contributor$/);assert.equal(cleanPrompts,0);page.off('dialog',cleanDialog);
 assert.equal(mutations.length,0);results.navigation.push({width,browserBackStayLeave:true,cleanNoPrompt:true,businessMutations:0});await context.close();
}
assert.deepEqual(results.errors,[]);
}finally{await browser.close();await writeFile(`${output}/browser-results.json`,JSON.stringify(results,null,2));}
console.log(JSON.stringify({screens:results.screens.length,navigation:results.navigation.length,errors:results.errors.length}));
