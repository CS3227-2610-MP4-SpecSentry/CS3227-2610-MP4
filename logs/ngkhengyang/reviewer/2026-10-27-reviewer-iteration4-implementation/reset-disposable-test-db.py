"""Rebuild only the explicitly authorized disposable DB after partial failed DDL."""
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlparse
root=Path(__file__).resolve().parents[4]
run_path=Path(__file__).resolve().parent
sys.path.insert(0,str(root/'workflow/reviewer/scripts'))
import core
import verification
run=core.open_run(SimpleNamespace(repo=str(root),run=str(run_path.relative_to(root))))
row={'id':'rebuild-disposable-schema','resources':['database'],'environment':['TEST_DATABASE_URL'],
 'database':{'environment':'TEST_DATABASE_URL','name':'specsentry_reviewer_intake_test'}}
verification.environment_ready(row)
url=os.environ['TEST_DATABASE_URL']
if urlparse(url).hostname not in ('127.0.0.1','localhost'):raise RuntimeError('Loopback disposable target required')
env={**os.environ,'DIRECT_DATABASE_URL':url,'DATABASE_URL':url}
with verification.leases(run,row):
 result=subprocess.run(['C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe',
 str(root/'node_modules/prisma/build/index.js'),'migrate','reset','--force'],cwd=root/'src/server',env=env,capture_output=True,text=True,timeout=90)
 error=re.sub(r'postgres(?:ql)?://[^\s]+','[redacted database URL]',result.stderr.replace(url,'[redacted database URL]'))[:8000]
 safe={'target':'specsentry_reviewer_intake_test','loopback':True,'purpose':'Failed new migration left partial DDL; prior safe rollback precondition refused ledger-only recovery',
 'reset_exit_code':result.returncode,'successful':result.returncode==0,'runtime_database_touched':False,'safe_error':error}
 (run_path/'reports/disposable-schema-recovery.json').write_text(json.dumps(safe,indent=2)+'\n',encoding='utf-8')
 if result.returncode:raise RuntimeError('Disposable schema rebuild failed: '+error)
 print('Rebuilt only authorized loopback disposable test schema using current migrations; synthetic fixtures must be revalidated')
