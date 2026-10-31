"""Read only the failed disposable migration ledger under the runner's DB lease."""
import json
import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
root=Path(__file__).resolve().parents[4]
run_path=Path(__file__).resolve().parent
sys.path.insert(0,str(root/'workflow/reviewer/scripts'))
import core
import verification
run=core.open_run(SimpleNamespace(repo=str(root),run=str(run_path.relative_to(root))))
row={'id':'migration-ledger-diagnostic','resources':['database'],'environment':['TEST_DATABASE_URL'],
 'database':{'environment':'TEST_DATABASE_URL','name':'specsentry_reviewer_intake_test'}}
verification.environment_ready(row)
script="""const {Client}=require('pg');(async()=>{const c=new Client({connectionString:process.env.TEST_DATABASE_URL,connectionTimeoutMillis:5000});try{await c.connect();const r=await c.query('SELECT migration_name,finished_at IS NOT NULL AS finished,rolled_back_at IS NOT NULL AS rolled_back,logs FROM _prisma_migrations WHERE migration_name=$1 ORDER BY started_at DESC',['20261026160000_approval_revocation']);console.log(JSON.stringify(r.rows.map(x=>({...x,logs:x.logs?.replace(/postgres(?:ql)?:\\/\\/[^\\s]+/g,'[redacted database URL]').slice(0,6000)})),null,2));}finally{await c.end()}})().catch(e=>{console.error('Migration diagnostic failed: '+(e.code||'unknown'));process.exit(1)});"""
with verification.leases(run,row):
 p=subprocess.run(['C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe','-e',script],cwd=root,capture_output=True,text=True,timeout=15)
 if p.returncode:raise RuntimeError(p.stderr)
 (run_path/'reports/migration-ledger-diagnostic.json').write_text(p.stdout,encoding='utf-8')
 print(p.stdout)
