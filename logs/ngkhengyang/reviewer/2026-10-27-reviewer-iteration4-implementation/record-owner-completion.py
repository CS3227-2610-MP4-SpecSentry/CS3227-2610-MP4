"""Complete one settled implementation owner with current scoped evidence."""
import json
import os
import subprocess
import sys
from pathlib import Path
root=Path(__file__).resolve().parents[4]
run=Path(__file__).resolve().parent
owner,record,snapshot,completion,*commands=sys.argv[1:]
state=json.loads((run/'state.json').read_text())
assignment=state['assignments'][owner]
cli=[sys.executable,'-B',str(root/'workflow/reviewer/scripts/workflow.py'),'--run',str(run.relative_to(root))]
def call(args):
 p=subprocess.run(args,cwd=root,capture_output=True,text=True)
 if p.returncode:raise RuntimeError(p.stderr or p.stdout)
 return p.stdout
changed=call(['git','diff','--name-only']).splitlines()+call(['git','ls-files','--others','--exclude-standard']).splitlines()
paths=sorted({p for p in changed if any(p==q or p.startswith(q+'/') for q in assignment['paths'])})
argv=cli+['snapshot','--id',snapshot,'--base','HEAD']
for path in assignment['paths']:argv+=['--path',path]
call(argv)
value={'assignment':owner,'record_id':record,'snapshot_id':snapshot,'commands':commands,'changed_paths':paths,
 'summary':f'Implemented {owner} owned scope with passing scoped checks; integration deliberately not started',
 'risks':'Root release registration and administrative CLI constructor wiring, assembled browser/regression/type checks and independent code/security review remain pending; named evidence does not certify full product completion',
 'next_action':'Preserve settled owned source and report pre-integration dependencies; no integration without further user-directed resumption',
 'references':['logs/ngkhengyang/reviewer/2026-10-26-reviewer-iteration4/brief.md',str(run.relative_to(root)/'reports/integration-plan.md')],
 'unavailable_reason':'Exact record-aligned runtime tokens/cache/settings/tool/retry counters unavailable; coordinator-observed elapsed and sampled thread windows retained separately'}
p=run/'inputs'/(completion+'.json');p.write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
print(call(cli+['complete','--id',completion,'--input',str(p.relative_to(root))]))
print(json.dumps({'owner':owner,'changed_paths':paths},indent=2))
