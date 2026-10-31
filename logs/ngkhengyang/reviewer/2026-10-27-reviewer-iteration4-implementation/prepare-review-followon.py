"""Explicit replacement ownership plan; retain original assignment history untouched."""
import json, os, subprocess, sys
from pathlib import Path
root=Path.cwd()
old=root/'logs/ngkhengyang/reviewer/2026-10-27-reviewer-iteration4-implementation'
new=root/'logs/ngkhengyang/reviewer/2026-10-27-reviewer-iteration4-review-fixes'
cli=[sys.executable,'-B','workflow/reviewer/scripts/workflow.py']
env=os.environ.copy();env.update(GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='safe.directory',GIT_CONFIG_VALUE_0=root.as_posix())
def call(args):
 p=subprocess.run(cli+args,cwd=root,env=env,capture_output=True,text=True,encoding='utf-8',errors='replace')
 if p.returncode:raise RuntimeError(p.stdout+p.stderr)
 return json.loads(p.stdout)
if new.exists():raise SystemExit('Follow-on run already exists; do not duplicate setup')
req=['REQ-REV-016','REQ-REV-004','REQ-REV-005','REQ-REV-006']
args=['init','--scope','reviewer','--prompter','ngkhengyang','--run-id',new.name]
for r in req:args+=['--requirement',r]
call(args)
prefix=['--run',str(new.relative_to(root))]
def command(args):return call(prefix+args)
record=command(['start','--agent','main','--invocation','followon-plan','--stage','compile','--model','unavailable','--effort','unavailable'])
for folder in ('inputs','reports'): (new/folder).mkdir(exist_ok=True)
def ingest(kind,name,data):
 p=new/'inputs'/(name+'.json');p.write_text(json.dumps(data,indent=2)+'\n',encoding='utf-8')
 return command([kind,'--input',str(p.relative_to(root))])
state=json.loads((old/'state.json').read_text())
paths=sorted(set(p for a in state['assignments'].values() for p in a['paths'])|{'src/server/src/app.module.ts','src/server/src/identity/manage-account.ts','playwright.config.ts','src/server/test/iteration4-review-regression.integration.ts'})
ingest('assignment','assignment-fixer',{'id':'fixer','agent':'fixer','role':'implementer','paths':paths,'dependencies':[]})
# Preserve executable contracts; their old results remain evidence in the original run.
# Only targeted changed checks are executed here. No imported result is claimed as a new test.
for cid,check in state['verification_checks'].items():
 ingest('check-register','check-'+cid,check)
matrix={k:state['acceptance_matrices'][-1][k] for k in ('cases','not_applicable')}
for case in matrix['cases']:case['owner']='fixer'
ingest('matrix','matrix-inherited-49',matrix)
helper=(old/'invoke-workflow.ps1').read_text().replace(str(old.relative_to(root)).replace('\\','/'),str(new.relative_to(root)).replace('\\','/'))
(new/'invoke-workflow.ps1').write_text(helper,encoding='utf-8')
plan={'authorization':'User explicitly requested a NEW fixer to modify reviewed implementation and interact with the independent reviewer until complete.',
 'supersedes_write_ownership_only':str(old.relative_to(root)),
 'original_assignments_preserved':True,'replacement_agent':'fixer','paths':paths,
 'coordinator_owned':['logs','docs','workflow/TRACEABILITY.md'],
 'scope':'Only confirmed review findings within iteration4; contracts/security changes require coordination. All original implementers freeze before fixer writes.',
 'evidence':'Original scoped/full backend results retained; rerun affected checks only. CLI hash scope limitations remain explicit, never disguised as new passing executions.'}
(new/'reports/replacement-ownership-plan.json').write_text(json.dumps(plan,indent=2)+'\n')
log=root/'logs/ngkhengyang/2026-10-26-reviewer-iteration4.md'
with log.open('a',encoding='utf-8') as out:
 out.write('\n## Integration resumption and expanded review/fix authorization\n\nUser interrupted to question excessive checks, requested authorship/necessity and token breakdowns, then explicitly authorized the same integrator to finish, a current-workflow implementation handoff, an independent reviewer and a NEW fixer interacting until done, followed by consolidation. This supersedes the earlier stop after first review. No permission for deployment, commits, live AI or unrelated workflow refactoring was added.\n\nCoordinator acknowledged unnecessary broad-scope verification/record refresh overhead. Original UI owner corrected the exact Decision locator; same integrator resumed remaining browsers. An external disposable PostgreSQL stop was recovered without reset. Original owner and integration intervals retained interruption gaps as elapsed, not compute. The explicit replacement ownership plan is in reviewer/2026-10-27-reviewer-iteration4-review-fixes/reports/replacement-ownership-plan.json; the follow-on run preserves old assignments rather than overwriting their provenance. All agents must freeze product writes before independent initial review and before each revalidation.\n')
print(json.dumps({'run':str(new.relative_to(root)),'compile_record':record,'assignment_paths':len(paths),'cases':len(matrix['cases'])}))
