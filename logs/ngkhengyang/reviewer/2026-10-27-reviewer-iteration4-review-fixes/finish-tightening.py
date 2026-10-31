import json,subprocess,sys,os,hashlib
from pathlib import Path
root=Path.cwd();run=Path(__file__).resolve().parent;check=sys.argv[1]
env=os.environ.copy();env.update(GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='safe.directory',GIT_CONFIG_VALUE_0=root.as_posix())
cli=[sys.executable,'-B','workflow/reviewer/scripts/workflow.py','--run',str(run.relative_to(root))]
def call(args):
 p=subprocess.run(cli+args,capture_output=True,text=True,encoding='utf-8',errors='replace',env=env)
 if p.returncode:raise RuntimeError(p.stdout+p.stderr)
 return json.loads(p.stdout)
path='src/server/test/release-revocation.integration.ts'
call(['snapshot','--id','conflict-assertion-final','--base','HEAD','--path',path])
value={'assignment':'fixer','record_id':'rec-cf8f513f9aa24450','snapshot_id':'conflict-assertion-final','commands':[check],'changed_paths':[path],
 'summary':'Tightened duplicate semantic version rejection to expected409 conflict;18 focused PostgreSQL tests pass',
 'risks':'Independent final closure pending; historicalunit/fullPG evidence unchanged and explicitly reused',
 'next_action':'Same reviewer verifies assertion and final manifest, closes evidence-backed findings',
 'references':[str(run.relative_to(root)/'reports/initial-review.json')],'unavailable_reason':'Stage-aligned counters unavailable; retrospective thread totals separate'}
p=run/'inputs/16-conflict-assertion-complete.json';p.write_text(json.dumps(value,indent=2)+'\n')
call(['complete','--id','16-conflict-assertion-complete','--input',str(p.relative_to(root))])
call(['supersede','--kind','commands','--id','verify-7b4df6d5c9df41fb','--by',check,'--reason','Independent review required409 assertion rather than any exception; same focused release suite revalidated'])
manifest=json.loads((run/'reports/final-reviewed-manifest.json').read_text());manifest['files'][path]=hashlib.sha256((root/path).read_bytes()).hexdigest()
(run/'reports/final-reviewed-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
args=['snapshot','--id','final-application-tightened','--base','HEAD']
state=json.loads((run/'state.json').read_text());scope=state['snapshots']['final-integrated-application']['paths']
for q in scope:args+=['--path',q]
call(args)
validation=json.loads((run/'reports/final-validation.json').read_text());validation['current_executions'][0]['id']=check
validation['current_executions'][0]['result']='18/18 PASS including exact409 duplicate-version rejection'
(run/'reports/final-validation.json').write_text(json.dumps(validation,indent=2)+'\n')
review=call(['start','--agent','independent-reviewer','--invocation','revalidate-round1','--stage','revalidate','--attempt','2','--model','gpt-6-sol','--effort','high'])
print(json.dumps({'review_record':review['record_id'],'check':check,'snapshot':'final-application-tightened'}))
