import 'reflect-metadata';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { Pool } from 'pg';
import * as argon2 from 'argon2';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AiTransportRequest, AiTransport } from '../../../../src/server/src/ai/contracts';

// TEST ONLY. This executable is never imported by the production bootstrap. It
// overrides transport through Nest DI, with no mock endpoint or browser switch.
async function testServer() {
  // npm workspaces may install the server's testing package under its own root.
  const serverRequire = createRequire(resolve('src/server/package.json'));
  const { Test } = serverRequire('@nestjs/testing') as typeof import('../../../../src/server/node_modules/@nestjs/testing');
  // Load decorated server modules only in the ts-node executable, never in
  // Playwright's browser-test transform (which does not emit Nest metadata).
  const { AppModule } = serverRequire(resolve('src/server/src/app.module')) as typeof import('../../../../src/server/src/app.module');
  const { readConfig } = serverRequire(resolve('src/server/src/config')) as typeof import('../../../../src/server/src/config');
  const { configureHttp } = serverRequire(resolve('src/server/src/http')) as typeof import('../../../../src/server/src/http');
  const { AI_GATEWAY_OPTIONS, AI_TRANSPORT, VERIFIED_TOKEN_COUNTER } = serverRequire(resolve('src/server/src/ai/contracts')) as typeof import('../../../../src/server/src/ai/contracts');
  const { SafeAiError } = serverRequire(resolve('src/server/src/ai/gateway')) as typeof import('../../../../src/server/src/ai/gateway');
  if (!process.env.TEST_DATABASE_URL || !new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test'))
    throw new Error('Explicit disposable test database required');
  const transport: AiTransport = { async complete(request: AiTransportRequest) {
    const data = request.messages[1]!.content.match(/\n(.*)\n<\/submitted_context>/s)?.[1];
    const context = JSON.parse(data ?? '{}') as {selectedCriterionIds:string[];summary:string;scope:{proposalId:string}};
    if (context.summary.includes('[test-unavailable]')) throw new SafeAiError('PROVIDER_AUTH');
    if (context.summary.includes('[test-delayed]')) {
      const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL,statement_timeout:15000});
      const client=await pool.connect();
      try {
        await client.query('SELECT pg_advisory_lock(hashtext($1))',['ai-browser-'+context.scope.proposalId]);
        await client.query('SELECT pg_advisory_unlock(hashtext($1))',['ai-browser-'+context.scope.proposalId]);
      } finally {client.release();await pool.end();}
    }
    return {status:200,retryAfter:null,body:JSON.stringify({choices:[{finish_reason:'stop',message:{role:'assistant',content:JSON.stringify({
      coverage:context.selectedCriterionIds.map(criterionId=>({criterionId,status:'PARTIALLY_COVERED',rationale:'Synthetic missing boundary evidence.'})),
      risks:[{criterionIds:context.selectedCriterionIds.slice(0,1),severity:'LOW',description:'Synthetic advisory <script>window.aiInjected=true</script>'}],
      questions:['Which boundary is verified?'],suggestedTests:['Check the boundary.'],confidence:'LOW',
    })}}]})};
  } };
  const config=readConfig({...process.env,NODE_ENV:'production',DATABASE_URL:process.env.TEST_DATABASE_URL});
  const module=await Test.createTestingModule({imports:[AppModule.register(config)]})
    .overrideProvider(AI_GATEWAY_OPTIONS).useValue({mode:'test',model:'synthetic-reviewer-model',contextWindow:16384,tokenCounterVerificationId:'synthetic-counter-v1'})
    .overrideProvider(AI_TRANSPORT).useValue(transport)
    .overrideProvider(VERIFIED_TOKEN_COUNTER).useValue({model:'synthetic-reviewer-model',verificationId:'synthetic-counter-v1',countInput:()=>100}).compile();
  const app=module.createNestApplication<NestExpressApplication>({logger:false});
  configureHttp(app,resolve('src/client/dist'));app.enableShutdownHooks();await app.listen(3000,'127.0.0.1');
}
if (require.main===module) void testServer().catch(()=>{console.error('Synthetic browser server failed');process.exitCode=1;});

export async function createPatchRiskFixture(mode='normal') {
  if(!process.env.TEST_DATABASE_URL||!new URL(process.env.TEST_DATABASE_URL).pathname.endsWith('_test'))throw new Error('Disposable test DB required');
  const pool=new Pool({connectionString:process.env.TEST_DATABASE_URL});
  const prefix='ai-browser-'+randomUUID();const owner=randomUUID(),reviewer=randomUUID(),proposal=randomUUID(),revision=randomUUID();
  const criteria=[randomUUID(),randomUUID()];const password='synthetic-browser-password';
  const hash=await argon2.hash(password,{type:argon2.argon2id});
  await pool.query('INSERT INTO "UserAccount"(id,username,"passwordHash",role) VALUES ($1,$2,$3,\'CONTRIBUTOR\'),($4,$5,$3,\'REVIEWER\')',[owner,prefix+'-owner',hash,reviewer,prefix+'-reviewer']);
  await pool.query('INSERT INTO "ChangeProposal"(id,"ownerId",title,state,"firstSubmittedAt") VALUES ($1,$2,$3,\'SUBMITTED\',now())',[proposal,owner,prefix]);
  await pool.query('INSERT INTO "ProposalRevision"(id,"proposalId",number,summary,problem,constraints,"expectedBehavior","diffText") VALUES ($1,$2,1,$3,\'Synthetic problem\',\'\',\'Expected behavior\',$4)',[revision,proposal,mode==='unavailable'?'[test-unavailable]':mode==='delayed'?'[test-delayed]':'Synthetic summary','--- a/file\n+++ b/file\n@@ -1 +1 @@\n-old\n+new\n']);
  for(let i=0;i<criteria.length;i++)await pool.query('INSERT INTO "AcceptanceCriterion"(id,"revisionId","stableKey",statement,required) VALUES($1,$2,$3,\'Criterion\',true)',[criteria[i],revision,'AC-'+(i+1)]);
  await pool.query('UPDATE "ChangeProposal" SET "currentRevisionId"=$2 WHERE id=$1',[proposal,revision]);
  const gate=mode==='delayed'?await pool.connect():null;
  if(gate)await gate.query('SELECT pg_advisory_lock(hashtext($1))',['ai-browser-'+proposal]);
  let released=false;
  async function release(){if(gate&&!released){released=true;await gate.query('SELECT pg_advisory_unlock(hashtext($1))',['ai-browser-'+proposal]);gate.release();}}
  return {prefix,password,owner,reviewer,proposal,revision,criteria,pool,release,async dispose(){
    await release();
    await pool.query('TRUNCATE "ChangeProposal" CASCADE');
    await pool.query('DELETE FROM "AiRequest" WHERE "actorId"=$1',[reviewer]);
    await pool.query('DELETE FROM "AiQueueLease" WHERE "actorId"=$1',[reviewer]);
    await pool.query('DELETE FROM "AuthSession" WHERE data::jsonb->>\'userId\'=ANY($1::text[])',[[owner,reviewer]]);
    await pool.query('DELETE FROM "SecurityEvent" WHERE "actorId"=ANY($1::text[])',[[owner,reviewer]]);
    await pool.query('DELETE FROM "UserAccount" WHERE id=ANY($1::text[])',[[owner,reviewer]]);await pool.end();
  }};
}
