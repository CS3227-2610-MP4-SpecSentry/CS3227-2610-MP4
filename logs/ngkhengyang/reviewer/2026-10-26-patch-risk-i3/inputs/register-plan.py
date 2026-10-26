"""Run-local planning input generator; does not implement or execute product behavior."""
import json
import os
from pathlib import Path
import subprocess
import sys

RUN = Path('logs/ngkhengyang/reviewer/2026-10-26-patch-risk-i3')
CLI = [sys.executable, '-B', 'workflow/reviewer/scripts/workflow.py', '--run', RUN.as_posix()]
NODE = 'C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'

def call(*args):
    # Resume only already-persisted identical registrations after an interrupted
    # bookkeeping subprocess; never overwrite canonical history or passing evidence.
    state=json.loads((RUN/'state.json').read_text(encoding='utf-8'))
    if args[0] in ('check-register','assignment'):
        data=json.loads(Path(args[2]).read_text(encoding='utf-8'))
        table='verification_checks' if args[0]=='check-register' else 'assignments'
        if data['id'] in state.get(table, {}):
            return
    if args[0]=='expect':
        key=f'{args[2]}|{args[4]}|{args[6]}|1'
        if key in state['expected']: return
    if args[0]=='snapshot' and args[2] in state.get('snapshots',{}): return
    if args[0]=='command' and args[2] in state.get('commands',{}): return
    if args[0]=='verify' and any(v['check']==args[2] for v in state.get('verification_runs',{}).values()): return
    result = subprocess.run(CLI + list(args), capture_output=True, text=True)
    print(result.stdout.strip() or result.stderr.strip())
    if result.returncode:
        raise SystemExit(result.returncode)

def save(name, data):
    path = RUN / 'inputs' / (name + '.json')
    path.write_text(json.dumps(data, indent=2) + '\n', encoding='utf-8')
    return path.as_posix()

runtime = {'id':'runtime','kind':'preflight','argv':[NODE,'-e',
    'const f=require("node:fs"); if(Number(process.versions.node.split(".")[0])!==24)process.exit(1); for(const p of ["node_modules/jest/bin/jest.js","node_modules/prisma/build/index.js","src/shared/dist/index.js","src/server/src/generated/prisma/client.ts"])if(!f.existsSync(p))process.exit(1); console.log("Node 24, installed test tools and generated sources present");'],
    'paths':['package.json','package-lock.json','src/server/package.json','src/shared/package.json','src/shared/src'],
    'depends_on':[],'resources':[],'environment':[],'database':None,'timeout':30}
call('check-register','--input',save('runtime',runtime))
call('verify','--check','runtime')
call('snapshot','--id','baseline-source','--base','HEAD',
     '--path','package.json','--path','package-lock.json','--path','src/shared/src',
     '--path','src/server/src/ai','--path','src/server/src/reviews','--path','src/server/src/proposals',
     '--path','src/server/src/identity','--path','src/server/src/activity','--path','src/server/src/config.ts',
     '--path','src/server/src/http.ts','--path','src/server/prisma/schema.prisma','--path','src/server/prisma/migrations',
     '--path','src/server/test','--path','src/client/src/features/reviewer','--path','workflow/tests/browser')
# Existing tests only. This establishes a bounded baseline, not AI acceptance.
call('command','--id','baseline-server-unit','--snapshot','baseline-source','--timeout','120','--',
     NODE,'node_modules/jest/bin/jest.js','--runInBand','--config','src/server/jest.config.cjs',
     '--runTestsByPath','src/server/test/manual-review-contracts.spec.ts',
     'src/server/test/proposal-lifecycle-contracts.spec.ts','src/server/test/reviewer-contracts.spec.ts',
     'src/server/test/notifications-contracts.spec.ts')

existing_integration = sorted(str(p).replace('\\','/') for p in Path('src/server/test').glob('*.integration.ts'))
assignments = [
 {'id':'foundation','agent':'foundation','role':'implementer','dependencies':[], 'paths':[
  'src/shared/src/contracts/ai.ts','src/shared/src/index.ts','src/server/prisma/schema.prisma',
  'src/server/prisma/migrations/20261026090000_reviewer_ai','src/server/src/generated/prisma',
  'src/server/src/config.ts','.env.example','src/server/src/ai/ai.module.ts',
  'src/server/src/ai/contracts.ts','src/server/test/business-fixtures.ts',
  'src/server/test/ai-fixtures.ts','src/server/test/ai-foundation.spec.ts',
  'package.json','package-lock.json','src/server/package.json','src/shared/package.json','src/client/package.json',
  'workflow/tests/browser/fixtures/reviewer-intake.ts','workflow/tests/browser/fixtures/reviewer-revision-cycle.ts'] + existing_integration},
 {'id':'gateway','agent':'gateway','role':'implementer','dependencies':['foundation'], 'paths':[
  'src/server/src/ai/gateway','src/server/test/ai-gateway.spec.ts','workflow/tests/ai/reviewer']},
 {'id':'reviewer-integration','agent':'reviewer-integration','role':'implementer','dependencies':['foundation'], 'paths':[
  'src/server/src/reviews/patch-risk.service.ts','src/server/src/reviews/patch-risk.controller.ts',
  'src/server/src/reviews/reviews.module.ts','src/server/src/reviews/manual-review.ts',
  'src/server/src/reviews/reviews.service.ts','src/server/src/proposals/proposals.service.ts',
  'src/server/src/proposals/proposal-lifecycle.service.ts','src/server/src/identity/business-context.ts',
  'src/server/src/http.ts','src/server/test/patch-risk.integration.ts','src/server/test/patch-risk-http.spec.ts']},
 {'id':'ui','agent':'ui','role':'implementer','dependencies':['foundation'], 'paths':[
  'src/client/src/features/reviewer/PatchRiskAssistant.tsx','src/client/src/features/reviewer/PatchRiskAssistant.test.tsx',
  'src/client/src/features/reviewer/ReviewerWorkspace.tsx','src/client/src/features/reviewer/ManualReview.tsx',
  'src/client/src/features/reviewer/ManualReview.test.tsx','src/client/src/features/reviewer/ReviewerWorkspace.test.tsx',
  'workflow/tests/browser/reviewer-patch-risk.spec.ts','workflow/tests/browser/fixtures/reviewer-patch-risk.ts',
  'playwright.config.ts']},
 {'id':'main-records','agent':'main','role':'coordinator','dependencies':[], 'paths':[
  RUN.as_posix(),'logs/ngkhengyang/2026-10-26-reviewer-iteration3.md',
  'docs/Reviewer-Guide.md','docs/AI-Integration.md','workflow/TRACEABILITY.md']},
]
for a in assignments:
    call('assignment','--input',save('assignment-'+a['id'],a))

planned = [('main','main-1','dispatch'),('foundation','foundation-1','implement'),
           ('gateway','gateway-1','implement'),('reviewer-integration','reviewer-integration-1','implement'),
           ('ui','ui-1','implement'),('main','main-1','integrate'),('independent-review','review-1','review'),
           ('main','main-1','document'),('main','main-1','close')]
for agent, invocation, stage in planned:
    call('expect','--agent',agent,'--invocation',invocation,'--stage',stage)

def check(cid,kind,argv,paths,deps=(),db=False,environment=(),resources=(),timeout=120):
    row={'id':cid,'kind':kind,'argv':argv,'paths':paths,'depends_on':list(deps),
         'resources':list(resources),'environment':list(environment),
         'database':{'environment':'TEST_DATABASE_URL','name':'specsentry_test'} if db else None,'timeout':timeout}
    call('check-register','--input',save('check-'+cid,row))

dbjs = '''const {Client}=require('pg'),{spawnSync}=require('node:child_process');
(async()=>{const url=process.env.TEST_DATABASE_URL;if(!url||new URL(url).pathname!='/specsentry_test')throw Error('Explicit disposable specsentry_test required');
const c=new Client({connectionString:url,connectionTimeoutMillis:5000});try{await c.connect();const r=await c.query('SELECT current_database() AS name');if(r.rows[0].name!=='specsentry_test')throw Error('Database mismatch');}finally{await c.end();}
const r=spawnSync(process.execPath,['../../node_modules/prisma/build/index.js','migrate','deploy'],{cwd:'src/server',env:{...process.env,DIRECT_DATABASE_URL:url,DATABASE_URL:url},stdio:'pipe',timeout:30000});
if(r.status!==0)throw Error('Disposable database migration preflight failed');console.log('Disposable connection and migration preflight passed');})().catch(()=>{console.error('Disposable database preflight failed');process.exit(1);});'''
check('database-preflight','preflight',[NODE,'-e',dbjs],
      ['src/server/prisma/schema.prisma','src/server/prisma/migrations','src/server/prisma.config.ts','package-lock.json'],
      ['runtime'],db=True,environment=['TEST_DATABASE_URL'],timeout=60)
check('browser-runtime','preflight',[NODE,'-e',
      'const f=require("node:fs");if(!f.existsSync(require("playwright").chromium.executablePath())){console.error("Configured Chromium executable unavailable");process.exit(1);}'],
      ['playwright.config.ts','package-lock.json'],['runtime'])
check('ai-fixture','fixture',[NODE,'node_modules/jest/bin/jest.js','--config','src/server/jest.integration.config.cjs',
      '--runInBand','--runTestsByPath','src/server/test/patch-risk.integration.ts','--testNamePattern','^.*ai-fixture-normalized-roles-cleanup$'],
      ['src/server/test/ai-fixtures.ts','src/server/test/business-fixtures.ts','src/server/test/patch-risk.integration.ts',
       'src/server/prisma/schema.prisma','src/server/prisma/migrations','src/server/package.json','package-lock.json'],
      ['database-preflight'],db=True,environment=['TEST_DATABASE_URL'])

cases=[]
def case(cid,req,kind,owner,scenario,pre,expected,events=()):
    if owner=='gateway':
        file='src/server/test/ai-gateway.spec.ts'; config='src/server/jest.config.cjs'; ck='unit'; db=False
    elif owner=='foundation':
        file='src/server/test/ai-foundation.spec.ts'; config='src/server/jest.config.cjs'; ck='unit'; db=False
    elif owner=='ui':
        file='workflow/tests/browser/reviewer-patch-risk.spec.ts'; config=None; ck='browser'; db=True
    else:
        file='src/server/test/patch-risk.integration.ts'; config='src/server/jest.integration.config.cjs'; ck='integration'; db=True
    argv=([NODE,'node_modules/@playwright/test/cli.js','test',file,'--grep',cid,'--workers=1'] if owner=='ui' else
          [NODE,'node_modules/jest/bin/jest.js','--config',config,'--runInBand','--runTestsByPath',file,'--testNamePattern',cid])
    paths=[file,'package.json','package-lock.json','src/server/package.json','src/shared/package.json',
           'src/shared/src/contracts/ai.ts','src/shared/src/contracts/reviewer.ts','src/shared/src/contracts/revision-cycle.ts']
    if owner=='gateway': paths+=['src/server/src/ai','src/server/src/config.ts','src/server/prisma/schema.prisma','workflow/tests/ai/reviewer']
    elif owner=='foundation': paths+=['src/server/src/ai/contracts.ts','src/server/src/config.ts','src/server/prisma/schema.prisma']
    elif owner=='ui': paths+=['src/client/src/features/reviewer','src/client/src/shared/authorization.ts','playwright.config.ts',
        'workflow/tests/browser/fixtures/reviewer-patch-risk.ts','src/server/src/ai','src/server/src/reviews','src/server/src/identity',
        'src/server/src/proposals','src/server/src/http.ts','src/server/prisma/schema.prisma']
    else: paths+=['src/server/src/reviews','src/server/src/ai','src/server/src/identity','src/server/src/proposals',
        'src/server/src/activity','src/server/src/http.ts','src/server/prisma/schema.prisma','src/server/prisma/migrations',
        'src/server/test/ai-fixtures.ts','src/server/test/business-fixtures.ts','src/server/jest.integration.config.cjs']
    check(cid,ck,argv,paths,['ai-fixture'] if db else ['runtime'],db=db,
          environment=['TEST_DATABASE_URL'] if db else [],resources=['browser-server'] if owner=='ui' else [])
    cases.append({'id':cid,'requirement':'REQ-REV-'+req,'kind':kind,'owner':owner,'check':cid,
                  'scenario':scenario,'preconditions':pre,'expected':expected,'events':list(events)})

current='Enabled assigned Reviewer with valid persisted session/CSRF; latest immutable revision, active assignment generation, IN_REVIEW; controllable synthetic transport'
unchanged='No proposal/version, manual coverage, finding, decision, approval, release, business activity or notification changes; only safe AI audit/accounting permitted'
case('ai-selected-batch','003','normal','reviewer-integration','Analyze selected 1-5 criteria using complete context',current,
     'CURRENT identifies analyzed scope, exactly selected coverage, sorted risks and no manual coverage writes; '+unchanged)
case('ai-access-recheck','012','normal','reviewer-integration','Freshly authorize at provider completion',current,'Recheck persisted session/account/role/root/assignment/lifecycle before returning any result')
case('ai-human-save','013','normal','ui','Edit prefilled risk, cancel then explicitly save',current,'Opening/cancel writes nothing; explicit edited human Save creates one finding with original scope and atomic human activity')
case('ai-size-fallback','014','normal','reviewer-integration','Otherwise valid submission exceeds AI capacity',current,'Before outbound attempt explain fallback without truncation; manual review works; '+unchanged)
case('ai-private-metadata','015','normal','reviewer-integration','Own separate AI audit versus shared human history',current,'Own permitted safe metadata visible; previous reviewer metadata and raw data absent from all projections')
for suffix,scenario,expected in [
 ('batch','0/6, duplicate, historical and unknown criteria','Accept 1 and 5 unique current IDs; reject each invalid selection before provider'),
 ('scope','Client injects prompt/actor/model/endpoint/unknown fields','Strict schema rejects all client context/config overrides and preserves exact grounding IDs')]:
    case('ai-boundary-'+suffix,'003','boundary','foundation',scenario,current,expected)
case('ai-context-isolation','015','authorization','reviewer-integration','Draft, other proposals and cross-revision evidence exist',current,
     'Captured transport context includes all same-revision spec/diff/evidence and required IDs, never private drafts/unrelated records/history; batching never slices context')
case('ai-http-access','012','authorization','reviewer-integration','Missing/expired/logged-out session, wrong role, invalid CSRF and unassigned IDOR',current,
     '401/403/404 without protected retrieval/provider dispatch/result leakage; security audit safe; '+unchanged)
case('ai-lifecycle','012','lifecycle','reviewer-integration','Request historical revision or APPROVED/IN_RELEASE/RELEASED/WITHDRAWN/DRAFT',current,
     'Only latest IN_REVIEW/CHANGES_REQUESTED analysis accepted; no obsolete save; '+unchanged)
case('ai-output-rejection','003','boundary','gateway','Normal/adversarial JSON and transport envelopes',current,
     'Reject duplicate keys, prose, unknown fields, wrong enums/types, invalid ID grounding, missing/duplicate coverage, codepoint overflow/nesting, refusals, non-stop, multiple choices, tool calls, bad usage and >64KiB; no repair/retry')
case('ai-secret-injection','015','authorization','gateway','Versioned direct/indirect/Unicode/delimiter-breaking injection and secret fixtures',current,
     'Reject high-confidence secrets; lower-confidence redaction precedes hashing/token count; delimited full context, no tools or forbidden effects, raw text absent in errors/logs')
case('ai-budget-retry','014','boundary','gateway','Fake clock and controlled transport test all limits and Retry-After',current,
     '10/10min, 60/SGT day, 30/minute, queue10; 20s includes waiting/retry; max one allowed transient retry, attempts counted, unknown usage null, SGT versus UTC distinct')
case('ai-transient-page','013','normal','ui','Reload/navigate/back-forward/pagehide/logout then return',current,
     'No raw result recoverable via storage/URL/cache/BFCache; abort/discard late result; hostile text escaped; rerun variability and not-analyzed criteria displayed')
case('ai-failed-call-isolation','013','rollback','reviewer-integration','Disabled/timeout/429/5xx/refusal/invalid output/oversized/provider cancellation',current,
     unchanged+'; snapshot complete business records and preserve unsaved manual form text')
case('ai-save-rollback','013','rollback','reviewer-integration','Inject finding/activity/version write failures after explicit human Save',current,
     'Transaction rolls back finding/version/activity and notifications together; original human data unchanged; safe rejection audit only')
case('ai-ui-fallback','014','normal','ui','AI disabled, unavailable, slow, invalid or rate-limited while manual form has content',current,
     'Safe correlation/fallback visible; manual form remains usable and text intact during/after pending AI request')
case('ai-ui-selection-stale','012','normal','ui','Selected criteria and revision change during delayed response',current,
     'Display selected batch and analyzed revision; stale cannot Create finding; no late response replaces newer page state')
case('ai-live-disabled','014','boundary','gateway','Missing catalog/tokenizer/parameter/quota/retention verification or unsupported endpoint',current,
     'Live configuration disabled; no redirected authorization or provider call; deterministic injected transport remains testable')
case('ai-changes-requested','003','normal','reviewer-integration','Analyze latest assigned revision during CHANGES_REQUESTED',
     current.replace('IN_REVIEW','CHANGES_REQUESTED'),'Valid exact selected output; analysis grants no new decision or human mutation; '+unchanged)
case('ai-generation-lineage','012','authorization','reviewer-integration','Multiple retained revisions versus drop/reclaim/resubmit with same reviewer',current,
     'accessGenerationId preserved across retained revisions permits STALE; any later fresh claim permanently prevents old output disclosure, even after subsequent retained revisions')
case('ai-whole-deadline','014','boundary','reviewer-integration','Contended initial/final account/root and quota locks plus queue/provider delay',current,
     'One monotonic 20s deadline bounds entire authenticated handler including transaction acquisition/execution/parsing/disclosure; no late output and expired queue leases cleaned')
case('ai-session-final-wait','012','authorization','reviewer-integration','Logout, idle expiry or absolute expiry while waiting for final authorization locks',current,
     'Fresh persisted session and expiry rechecked after lock acquisition and immediately before disclosure; no output after expiry or logout')

for event in ['drop','withdrawal','disablement','new-revision','drop-reclaim','approval','logout']:
    for ordering in ['event-first','completion-first']:
        outcome=('Continuous same-reviewer REVISION_REPLACED lineage permits only STALE/NEW_REVISION; Create finding disabled' if event=='new-revision' else
                 'Event committed first discards provider output or returns safe lifecycle conflict without suggestions')
        case('ai-response-'+event+'-'+ordering,'012','concurrency','reviewer-integration',
             'Provider completion competes with '+event+'; '+ordering,current,
             outcome+'; completion-first returns only while authorized, subsequent human save rechecks original scope; no old assignment revival. Compare final business state to an event-only control: lifecycle event effects are expected; zero additional AI-caused business delta.',
             ['Delayed provider completion with explicit barrier','Real lifecycle/session operation: '+event+'; force '+ordering])
for event in ['new-revision','approval','drop-reclaim']:
    for ordering in ['event-first','save-first']:
        case('ai-save-'+event+'-'+ordering,'012','concurrency','reviewer-integration',
             'Explicit suggestion Save competes with '+event+'; '+ordering,current+('; seed complete covered criteria and LOW risk so finding does not itself block approval' if event=='approval' else ''),
             'Event-first rejects obsolete save without finding/activity; save-first atomically commits one finding+activity before event, later lifecycle remains consistent; never rebind analyzed coordinates',
             ['Explicit human finding Save under original analyzed versions','Real '+event+' transaction; barrier forces '+ordering])
for slot in ['user-window','user-day','global-window','queue']:
    case('ai-final-slot-'+slot,'014','concurrency','reviewer-integration','Two processes compete for last '+slot+' slot',current,
         'Exactly one reservation succeeds; no overspend; denied request/retry does not dispatch; cancellation/expiry cleans queue lease; '+unchanged,
         ['Request A reserves final available '+slot+' slot','Concurrent request B reserves same slot; database barriers control ordering'])
call('matrix','--input',save('matrix',{'cases':cases,'not_applicable':{}}))
print('Registered',len(cases),'planned acceptance cases; implementations/tests intentionally absent at requested pause.')
