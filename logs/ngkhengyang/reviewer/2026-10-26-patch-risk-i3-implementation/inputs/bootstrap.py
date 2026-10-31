import json, os, pathlib, subprocess, sys
ROOT=pathlib.Path.cwd()
RUN=pathlib.Path('logs/ngkhengyang/reviewer/2026-10-26-patch-risk-i3-implementation')
OLD=pathlib.Path('logs/ngkhengyang/reviewer/2026-10-26-patch-risk-i3')
PY=sys.executable
NODE=str(pathlib.Path(os.environ['LOCALAPPDATA']).parent/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe')
# LOCALAPPDATA's parent is not the user directory on every host; use the discovered runtime.
NODE='C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
CLI=[PY,'-B','workflow/reviewer/scripts/workflow.py','--run',RUN.as_posix()]
os.environ.update(GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='safe.directory',GIT_CONFIG_VALUE_0=ROOT.as_posix())
os.environ['PATH']=str(ROOT/'.tools/bin')+';'+str(pathlib.Path(NODE).parent)+';'+os.environ['PATH']
os.environ['PLAYWRIGHT_BROWSERS_PATH']=str(ROOT/'.tools/playwright-browsers')
for line in (ROOT/'.tools/reviewer-test-db.env').read_text().splitlines():
    if '=' in line and not line.startswith('#'):
        k,v=line.split('=',1);os.environ[k]=v.strip().strip('"')

def call(*args,fail=True):
    r=subprocess.run(CLI+list(args),capture_output=True,text=True)
    print(r.stdout.strip() or r.stderr.strip(),flush=True)
    if fail and r.returncode:raise SystemExit(r.returncode)
    return r
def save(name,d):
    p=RUN/'inputs'/f'{name}.json';p.parent.mkdir(exist_ok=True,parents=True);p.write_text(json.dumps(d,indent=2),encoding='utf-8');return p.as_posix()

old=json.loads((OLD/'state.json').read_text())
foundation=dict(old['assignments']['foundation']);foundation={k:foundation[k] for k in ['id','agent','role','paths','dependencies']}
foundation['paths'].remove('src/server/src/ai/ai.module.ts')
integration=dict(old['assignments']['reviewer-integration']);integration={k:integration[k] for k in ['id','agent','role','paths','dependencies']}
integration['paths']+=old['assignments']['reviewer-contract-wiring']['paths']
ui={k:old['assignments']['ui'][k] for k in ['id','agent','role','paths','dependencies']}
gateway={k:old['assignments']['gateway'][k] for k in ['id','agent','role','paths','dependencies']}
main={'id':'main-integration','agent':'main','role':'coordinator','paths':[
    'src/server/src/ai/ai.module.ts','src/server/src/app.module.ts','src/server/test/ai-wiring.spec.ts',
    'docs/Reviewer-Guide.md','docs/AI-Integration.md','workflow/TRACEABILITY.md',RUN.as_posix(),
    'logs/ngkhengyang/2026-10-26-reviewer-iteration3.md'],'dependencies':[]}
for a in [foundation,gateway,integration,ui,main]:call('assignment','--input',save('assignment-'+a['id'],a))
for a,i,s in [('foundation','foundation-1','implement'),('gateway','gateway-1','implement'),('reviewer-integration','integration-1','implement'),('ui','ui-1','implement'),('main','main-resume','dispatch'),('main','main-resume','integrate'),('independent-review','review-1','review')]:call('expect','--agent',a,'--invocation',i,'--stage',s)

# Prerequisites select existing tests, not tests the gated assignment must create.
runtime=dict(old['verification_checks']['runtime'])
runtime['argv'][0]=NODE
call('check-register','--input',save('runtime',runtime))
db=dict(old['verification_checks']['database-preflight'])
db['database']['name']='specsentry_reviewer_intake_test'
db['argv'][0]=NODE;db['argv'][2]=db['argv'][2].replace('specsentry_test','specsentry_reviewer_intake_test')
call('check-register','--input',save('database-preflight',db))
browser=dict(old['verification_checks']['browser-runtime']);browser['argv'][0]=NODE
browser['environment']=['PLAYWRIGHT_BROWSERS_PATH']
call('check-register','--input',save('browser-runtime',browser))
fixture={'id':'baseline-fixture','kind':'fixture','argv':[NODE,'node_modules/jest/bin/jest.js',
    '--config','src/server/jest.integration.config.cjs','--runInBand','--runTestsByPath',
    'src/server/test/demo-seed.integration.ts','src/server/test/manual-review.integration.ts',
    '--testNamePattern','creates two enabled accounts per role|rolls back assessment/finding/transition/amendment/decision'],
    'paths':['src/server/test/demo-seed.integration.ts','src/server/test/manual-review.integration.ts',
     'src/server/test/business-fixtures.ts','src/server/src/identity/seed-demo.ts','src/server/prisma/schema.prisma',
     'src/server/prisma/migrations','src/server/package.json','package-lock.json'],
    'depends_on':['database-preflight'],'resources':['database'],'environment':['TEST_DATABASE_URL'],
    'database':{'environment':'TEST_DATABASE_URL','name':'specsentry_reviewer_intake_test'},'timeout':120}
call('check-register','--input',save('baseline-fixture',fixture))
for cid,c in old['verification_checks'].items():
    if cid in ['runtime','database-preflight','browser-runtime','ai-fixture']:continue
    c['argv'][0]=NODE
    c['depends_on']=['baseline-fixture' if d=='ai-fixture' else d for d in c['depends_on']]
    if c['database']:c['database']['name']='specsentry_reviewer_intake_test'
    call('check-register','--input',save('check-'+cid,c))
call('matrix','--input',save('matrix',{k:old['acceptance_matrices'][-1][k] for k in ['cases','not_applicable']}))
call('verify','--check','baseline-fixture','--force')
call('readiness','--assignment','foundation')
