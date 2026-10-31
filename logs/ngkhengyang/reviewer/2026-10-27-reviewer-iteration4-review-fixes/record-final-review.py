import json,subprocess,sys,os
from pathlib import Path
root=Path.cwd();run=Path(__file__).resolve().parent
env=os.environ.copy();env.update(GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='safe.directory',GIT_CONFIG_VALUE_0=root.as_posix())
cli=[sys.executable,'-B','workflow/reviewer/scripts/workflow.py','--run',str(run.relative_to(root))]
def call(args):
 p=subprocess.run(cli+args,capture_output=True,text=True,encoding='utf-8',errors='replace',env=env)
 if p.returncode:raise RuntimeError(p.stdout+p.stderr)
 return json.loads(p.stdout)
review={'reviewer':'/root/review_i4_final','record_id':'rec-5bbcfe79f3b84438','snapshot_id':'final-application-tightened','manifest':'reports/final-reviewed-manifest.json',
 'summary':'Independent implementation revalidation supports closing F-001 through F-004. All43 manifest file hashes match. Current releasePG18/18, focusedbrowser3/3 and defaultbrowser14/14 pass; unchanged-source priorunit/fullPG evidence adequately reused. No unresolved implementation blocker within reviewed scope.',
 'findings':{
 'F-001':'CLOSE: form-scoped Decision combobox locator works in real browser; focused3/default14 passed.',
 'F-002':'CLOSE: noncreator add, isolated COVERAGE/REVISION/HIGH/CRITICAL blockers, empty/no smoke, real contentVersion stale smoke, duplicate version exact409 all asserted. Empty rollback plan rejected by DB CHECK; invalid persisted row is unreachable, so constraint assertion appropriate. Current release18 pass.',
 'F-003':'CLOSE: second-member RELEASE_PUBLISHED activity failure after first member writes/snapshot attempt causes complete publicationState equality across candidate, both members/proposals, snapshots, activities, decisions, invalidations and notices. Trigger/function finally cleanup inspected.',
 'F-004':'CLOSE: real attached hostile-text browser, unattached keyboard/focus/history and logout401 protected reason clearing; existing component uncertain-retry original key/body and conflict retention. Focused3/default14 pass.'},
 'coverage':{'contract_unit_cases':3,'postgres_cases':43,'ui_cases':3,'total':49,'assessment':'All named cases accounted by substantive checked assertions; not a guarantee of every possible application behavior.'},
 'reuse':'Production/shared/schema/config hashes byte-identical to initial integrated source. Earlier155unit/171fullPG/build/type/lint not reexecuted; current release18 and defaultbrowser14 execute changed tests. No broader rerun needed solely to green cross-run stale metadata. No concrete new lint/style defect identified.',
 'docs':'Three small Architecture/UserGuide/TRACEABILITY deltas actually reviewed; DeveloperGuide unchanged since initial review. Status links appropriate after closure.',
 'limitations':['CLI cannot import oldrun executions as fresh follow-on matrix evidence; structural gap must be disclosed separately.','Deployment/liveAI/production probing and human teammate approval excluded.']}
security={'reviewer':'/root/review_i4_final','record_id':'rec-f293a9a375cc468d','manifest':'reports/final-reviewed-manifest.json','assessment':'No confirmed security bypass or new material exposure within scoped unchanged production source.',
 'controls':['Role/assignment/candidate deterministic authorization before reads/replay','Persisted enabled account/session and CSRF checks','Sorted account/session/candidate/proposal locking and under-lock version revalidation','Own-member Reviewer candidate projection','Immutable approval/submission/publication evidence','Atomic invalidation/activity/notice and publication/snapshot/member writes'],
 'basis':'Final production/controller/contracts/schema hashes match initial independently traced code; assertion-only fixes strengthen evidence and do not change trust boundaries.',
 'limits':'Not blanket certification; no deployment/liveAI/production probes or human teammate approval.'}
for name,value in [('revalidation',review),('security-final',security)]: (run/'reports'/(name+'.json')).write_text(json.dumps(value,indent=2)+'\n')
for rid,outcome in [('rec-5bbcfe79f3b84438','Independent final revalidation completed: all4 findings support closure,49 cases accounted, final43file hashes match; scoped evidence reuse accepted.'),('rec-f293a9a375cc468d','Independent final code security refresh completed; unchanged production controls checked by hashes/previous actual trace, no new security concern in scope.')]:
 call(['finish','--id',rid,'--status','succeeded','--outcome',outcome,'--unavailable-reason','Stage-aligned counters unavailable; cumulative reviewer thread sample retained separately'])
closures={'reviewer':'independent-reviewer','record_id':'rec-5bbcfe79f3b84438','snapshot_id':'final-application-tightened',
 'findings':[{'id':fid,'evidence':[str(run.relative_to(root)/'reports/revalidation.json'),str(run.relative_to(root)/'reports/security-final.json')],'reason':reason} for fid,reason in review['findings'].items()]}
p=run/'inputs/final-closures.json';p.write_text(json.dumps(closures,indent=2)+'\n')
call(['finding','close-batch','--input',str(p.relative_to(root))])
call(['cycle','--reviewer','independent-reviewer','--outcome','passed','--evidence',str(run.relative_to(root)/'reports/revalidation.json')])
packet=json.loads((run/'inputs/15-fixer-to-reviewer.json').read_text());packet.update(
 identity='Independent reviewer to main: final review/fix completion, all four findings closed with independent evidence.',
 state=review['summary'],verification='Current verification IDs/results and historical reuse basis in final-validation.json; revalidation.json and security-final.json record actual independent assessment. All43 current hashes match final-reviewed-manifest. Earlier failed/interrupted attempts retained, no production changes after initial assessment.',
 risks='Agent review/fix complete in bounded scope. CLI historical/cross-run stale evidence remains a structural limitation, not a new product failure or freshexecution claim. Deployment, liveAI and human approval separate.',
 snapshot_id='final-application-tightened',resource_record='rec-5bbcfe79f3b84438')
packet['references']+=[str(run.relative_to(root)/'reports/revalidation.json'),str(run.relative_to(root)/'reports/security-final.json')]
p=run/'inputs/17-review-completion.json';p.write_text(json.dumps(packet,indent=2)+'\n')
call(['handoff','create','--id','17-review-completion','--input',str(p.relative_to(root))])
for hid in ['11-main-to-reviewer','12-main-to-fixer','13-locator-fix-complete','14-assertions-complete','15-fixer-to-reviewer']:
 call(['supersede','--kind','handoffs','--id',hid,'--by','17-review-completion','--reason','Final reviewed implementation and closures supersede historical boundary views; all source inputs/attempts retained'])
print(json.dumps({'closed':list(review['findings']),'reviewed_files':43,'final_handoff':'17-review-completion'}))
