"""Metadata-only retry of failed DDL after an empty-new-table forward-repair check."""
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
row={'id':'failed-test-migration-recovery','resources':['database'],'environment':['TEST_DATABASE_URL'],
 'database':{'environment':'TEST_DATABASE_URL','name':'specsentry_reviewer_intake_test'}}
verification.environment_ready(row)
node='C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
script="""const {Client}=require('pg');(async()=>{const u=new URL(process.env.TEST_DATABASE_URL);if(!['localhost','127.0.0.1'].includes(u.hostname))throw Error('Target');const c=new Client({connectionString:u.href});try{await c.connect();const names=['ReleaseCandidate','ReleaseCandidateMember','ReleaseSmokeTest','ReleasePublicationSnapshot'];const counts={};for(const name of names){const r=await c.query('SELECT count(*)::int AS n FROM "'+name+'"');counts[name]=r.rows[0].n;if(r.rows[0].n!==0)throw Error('New release data exists; forward recovery refused');}const r=await c.query('SELECT count(*)::int AS n FROM _prisma_migrations WHERE migration_name=$1 AND finished_at IS NULL AND rolled_back_at IS NULL',['20261026160000_approval_revocation']);if(r.rows[0].n!==1)throw Error('Failed migration identity mismatch');console.log(JSON.stringify({newReleaseTableCounts:counts,failedMigrationCount:1}));}finally{await c.end()}})().catch(e=>{console.error('Forward recovery precondition failed: '+(e.code||'failed'));process.exit(1)});"""
with verification.leases(run,row):
 p=subprocess.run([node,'-e',script],cwd=root,capture_output=True,text=True,timeout=15)
 if p.returncode:raise RuntimeError(p.stderr)
 env={**os.environ,'DIRECT_DATABASE_URL':os.environ['TEST_DATABASE_URL'],'DATABASE_URL':os.environ['TEST_DATABASE_URL']}
 result=subprocess.run([node,str(root/'node_modules/prisma/build/index.js'),'migrate','resolve','--rolled-back','20261026160000_approval_revocation'],cwd=root/'src/server',env=env,capture_output=True,text=True,timeout=30)
 if result.returncode:raise RuntimeError('Prisma failed migration recovery failed; no success claimed')
 print(p.stdout.strip())
 print('Marked only failed migration retryable after empty-new-table checks; forward SQL repair still must deploy; no database reset')
 (run_path/'reports/failed-migration-recovery.json').write_text(json.dumps({'migration':'20261026160000_approval_revocation','target':'specsentry_reviewer_intake_test','preconditions':json.loads(p.stdout),'strategy':'metadata-only resolve followed by guarded forward repair; partial DDL preserved','database_reset':False,'resolve_exit_code':result.returncode},indent=2)+'\n',encoding='utf-8')
