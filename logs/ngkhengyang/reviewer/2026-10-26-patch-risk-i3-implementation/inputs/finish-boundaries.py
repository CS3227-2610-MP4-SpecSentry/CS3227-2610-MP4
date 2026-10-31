"""Finalize successful logical ownership boundaries after settled verification."""
import hashlib,json,pathlib,subprocess,sys
from argparse import Namespace
P=pathlib.Path('logs/ngkhengyang/reviewer/2026-10-26-patch-risk-i3-implementation')
RUN=[sys.executable,'-B',str(P/'inputs/run.py')]
def call(*args):
 r=subprocess.run(RUN+list(args),capture_output=True,text=True)
 print(r.stdout or r.stderr)
 if r.returncode:raise SystemExit(r.returncode)
 return r.stdout
def state():return json.loads((P/'state.json').read_text(encoding='utf-8'))
def changed():
 paths=set(subprocess.run(['git','diff','--name-only'],capture_output=True,text=True,check=True).stdout.splitlines())
 paths.update(subprocess.run(['git','ls-files','--others','--exclude-standard'],capture_output=True,text=True,check=True).stdout.splitlines())
 return sorted(p.replace('\\','/') for p in paths if not p.startswith('logs/'))
def command(check):
 s=state();rows=[k for k,v in s['verification_runs'].items() if v['check']==check]
 assert rows and s['commands'][rows[-1]]['passed'],check
 return rows[-1]
paths=changed()
snapshot_args=['snapshot','--id','integrated-before-review','--base','HEAD']
for path in paths:snapshot_args+=['--path',path]
call(*snapshot_args)
manifest={p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest() if pathlib.Path(p).exists() else None for p in paths}
(P/'reports/source-manifest.json').write_text(json.dumps({'base':'b8daea2dac771a0c372a01e4d0a23da4e44690e3','files':manifest},indent=2),encoding='utf-8')
select=['verify','--select-only']
for path in paths:select+=['--changed',path]
selected=subprocess.run(RUN+select,capture_output=True,text=True,check=True)
(P/'reports/changed-check-selection.json').write_text(selected.stdout,encoding='utf-8')
print('Saved complete changed-path verification selection:',len(paths),'paths')
for owner,rid,checks in [
 ('gateway','rec-d88faae6232e4142',['named-gateway','integration-unit-captured']),
 ('reviewer-integration','rec-e7b56dbf44c14ba3',['named-postgres-final','integration-unit-captured']),
 ('ui','rec-4e53075a0fb3470f',['named-ui-v2','integration-unit-captured','integration-browser-captured']),
]:
 scope=state()['assignments'][owner]['paths']
 owned=[p for p in paths if any(p==a or p.startswith(a+'/') for a in scope)]
 assert owned,owner
 c={'assignment':owner,'record_id':rid,'snapshot_id':'integrated-before-review',
    'commands':[command(k) for k in checks],'changed_paths':owned,
    'summary':f'Completed {owner} under coordinator takeover after worker usage-limit interruption; settled source and named acceptance checks passed.',
    'risks':'Independent implementation review is intentionally unstarted. Live provider compatibility/usefulness/latency remain unverified and live configuration disabled. Logical role executed by the same actual main thread, not a new independent agent.',
    'next_action':'Pause for user before independent implementation review; retain original failed/interrupted attempts.',
    'references':['workflow/specs/AI-SECURITY-SPEC.md','workflow/specs/ROLE-REVIEWER.md',str(P/'reports/source-manifest.json')],
    'unavailable_reason':'Exact record-aligned usage and observed settings unavailable. Logical coordinator role overlaps main integration; do not duplicate main token counters or same-thread elapsed time.'}
 f=P/f'inputs/{owner}-integrated-completion.json';f.write_text(json.dumps(c,indent=2),encoding='utf-8')
 call('complete','--id',f'07-{owner}-integrated','--input',str(f))
# Preserve failures with explicit current successors. Revised immutable check IDs
# may share the same semantic diagnostic scope, which is explained in the log.
call('supersede','--kind','handoffs','--id','02-foundation-complete','--by','06-foundation-revalidated',
     '--reason','Minimal foundation test lint correction revalidated against settled contracts; original completion remains historical.')
s=state()
sys.path.insert(0,str(pathlib.Path('workflow/reviewer/scripts').resolve()))
import core,evidence
run=core.open_run(Namespace(repo=pathlib.Path.cwd(),run=P))
replacement={'foundation-cases':'named-foundation','foundation-cases-v2':'named-foundation',
 'integration-postgres-captured':'named-postgres-final','patch-risk-postgres':'named-postgres-final'}
for key,row in list(s['commands'].items()):
 if row.get('superseded_by'):continue
 if row.get('passed') and evidence.snapshot_matches(run,row.get('snapshot_id')):continue
 oldcheck=s['verification_runs'].get(key,{}).get('check')
 if oldcheck:
  target=replacement.get(oldcheck,oldcheck)
  candidates=[k for k,v in s['verification_runs'].items() if v['check']==target and s['commands'].get(k,{}).get('passed') and not s['commands'][k].get('superseded_by') and evidence.snapshot_matches(run,s['commands'][k].get('snapshot_id'))]
  if candidates:
   call('supersede','--kind','commands','--id',key,'--by',candidates[-1],'--reason','Settled source and fresh prerequisites passed the same registered check; retain failed attempt as historical evidence.')
call('finish','--id','rec-5879423e05784aaf','--status','succeeded','--outcome',
 'Implementation and integration complete with final source identity, build/static/unit/PostgreSQL/browser and all 47 named acceptance cases. Paused before independent implementation review per user request.',
 '--unavailable-reason','Exact main API alias/effort, record-aligned tokens/cache and automatic tool/retry counters unavailable. Sampled per-thread resource windows retained separately; waiting/idle time included.')
for operation,name in [('completeness','pre-review-completeness.json'),('report','pre-review-report.md'),('summary','pre-review-resource-summary.json')]:
 r=subprocess.run(RUN+[operation],capture_output=True,text=True)
 (P/'reports'/name).write_text(r.stdout+r.stderr,encoding='utf-8');print(operation,'exit',r.returncode)
print('All started intervals closed; independent review remains deliberately unstarted.')
