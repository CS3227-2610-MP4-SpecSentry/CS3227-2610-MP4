"""Create linked V3 execution contracts; retain preparation as historical evidence."""
import json
import subprocess
import sys
from pathlib import Path

root=Path(__file__).resolve().parents[4]
run=Path(__file__).resolve().parent
old=root/'logs/ngkhengyang/reviewer/2026-10-26-reviewer-iteration4'
source=json.loads((old/'state.json').read_text())
previous=json.loads((root/'logs/ngkhengyang/reviewer/2026-10-26-patch-risk-i3-implementation/state.json').read_text())
(run/'inputs').mkdir(exist_ok=True);(run/'reports').mkdir(exist_ok=True)
cli=[sys.executable,'-B',str(root/'workflow/reviewer/scripts/workflow.py'),'--run',str(run.relative_to(root))]
def ingest(kind,name,data):
 p=run/'inputs'/(name+'.json');p.write_text(json.dumps(data,indent=2)+'\n')
 subprocess.run(cli+[kind,'--input',str(p.relative_to(root))],cwd=root,check=True,capture_output=True,text=True)
for key,row in source['assignments'].items():
 data={k:row[k] for k in ('id','agent','role','paths','dependencies')}
 if key=='ui':data['paths'].append('playwright.config.ts')
 ingest('assignment','assignment-'+key,data)
checks=source['verification_checks']
for key in ('runtime','database-preflight','browser-runtime','baseline-fixture'):
 c=dict(checks[key])
 if key=='database-preflight':c=dict(previous['verification_checks'][key])
 if key=='baseline-fixture':
  c['argv']=[checks['runtime']['argv'][0],'node_modules/jest/bin/jest.js','--config','src/server/jest.integration.config.cjs','--runInBand','--runTestsByPath','src/server/test/demo-seed.integration.ts','src/server/test/reviewer-seed.integration.ts','--testNamePattern','creates two enabled accounts per role|creates atomic synthetic submitted graphs']
  c['paths']=['src/server/test/demo-seed.integration.ts','src/server/test/reviewer-seed.integration.ts','src/server/src/identity/seed-demo.ts','src/server/src/reviews/seed-reviewer.ts','src/server/prisma','src/server/package.json','package-lock.json']
 ingest('check-register','check-'+key,c)
for key,c0 in checks.items():
 if key in ('runtime','database-preflight','browser-runtime','baseline-fixture'):continue
 c=dict(c0)
 if key.startswith('foundation-'):
  c['paths']=source['assignments']['foundation']['paths']+['package.json','package-lock.json','src/server/package.json','src/shared/package.json','src/server/jest.config.cjs','src/server/jest.integration.config.cjs']
 ingest('check-register','check-'+key,c)
node=checks['runtime']['argv'][0]
for key,argv in [('foundation-generate',[node,'node_modules/prisma/build/index.js','generate','--config','src/server/prisma.config.ts']),('foundation-shared-build',[node,'.tools/package/bin/npm-cli.js','run','build','-w','@specsentry/shared'])]:
 c={'id':key,'kind':'build','argv':argv,'paths':source['assignments']['foundation']['paths']+['package.json','package-lock.json','src/server/prisma.config.ts','src/shared/package.json','src/shared/tsconfig.json'],'depends_on':['runtime'],'resources':['build'],'environment':[],'database':None,'timeout':180}
 ingest('check-register','check-'+key,c)
matrix={k:source['acceptance_matrices'][-1][k] for k in ('cases','not_applicable')}
ingest('matrix','matrix-final-design',matrix)
print('Registered4 assignments,49cases,14checks; existing baseline fixtures precede new foundation.')
