"""Narrow new contracts by actual application/test boundaries; retain old evidence."""
import json,subprocess,sys,os
from pathlib import Path
root=Path.cwd();run=Path(__file__).resolve().parent
state=json.loads((run/'state.json').read_text());checks=state['verification_checks']
cli=[sys.executable,'-B','workflow/reviewer/scripts/workflow.py','--run',str(run.relative_to(root))]
env=os.environ.copy();env.update(GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='safe.directory',GIT_CONFIG_VALUE_0=root.as_posix())
def call(args):
 p=subprocess.run(cli+args,capture_output=True,text=True,env=env,encoding='utf-8',errors='replace')
 if p.returncode:raise RuntimeError(p.stdout+p.stderr)
 return p.stdout
def browser(p):return p.startswith('workflow/tests/browser/') or p=='playwright.config.ts'
def test(p):return '/test/' in p or '.test.' in p or '.spec.' in p or browser(p)
mapping={}
for suffix in ('build','types','lint','units','postgres','browser-default'):
 old='integration-'+suffix;c=dict(checks[old]);c['id']='review-'+suffix
 if suffix=='build':c['paths']=[p for p in c['paths'] if not test(p)]
 elif suffix in ('types','units'):c['paths']=[p for p in c['paths'] if not browser(p)]
 elif suffix=='postgres':c['paths']=[p for p in c['paths'] if not browser(p) and not p.startswith('src/client/')]
 elif suffix=='browser-default':c['paths']=[p for p in c['paths'] if not test(p) or browser(p)]
 c['depends_on']=['review-build' if x=='integration-build' else x for x in c['depends_on']]
 p=run/'inputs'/('check-'+c['id']+'.json');p.write_text(json.dumps(c,indent=2)+'\n')
 call(['check-register','--input',str(p.relative_to(root))]);mapping[old]=c['id']
matrix={k:state['acceptance_matrices'][-1][k] for k in ('cases','not_applicable')}
for case in matrix['cases']:
 if case['kind']=='browser' or case['check'] in ('revocation-browser','integration-revocation-browser') or case['id'].startswith('revoke-ui'):
  case['check']='review-browser-default'
 elif case['check'].startswith('foundation-contract'):case['check']='review-units'
 else:case['check']='review-postgres'
p=run/'inputs/matrix-targeted-checks.json';p.write_text(json.dumps(matrix,indent=2)+'\n')
call(['matrix','--input',str(p.relative_to(root)),'--reason','New replacement run: map all49 inherited scenarios to assembled suites; exclude browser test/prose edits from backend contracts. Semantic coverage requires independent review.'])
print(json.dumps({'contracts':list(mapping.values()),'cases':len(matrix['cases'])}))
