import json,subprocess,sys
from pathlib import Path
root=Path.cwd();run=Path(__file__).resolve().parent
cli=[sys.executable,'-B','workflow/reviewer/scripts/workflow.py','--run',str(run.relative_to(root))]
def call(args):
 p=subprocess.run(cli+args,capture_output=True,text=True,encoding='utf-8',errors='replace')
 if p.returncode:raise RuntimeError(p.stdout+p.stderr)
 return json.loads(p.stdout)
finding={'requirement':'REQ-REV-016','severity':'MEDIUM','blocks':True,'owner':'fixer','reviewer':'independent-reviewer',
 'description':'API-backed approval-revocation browser acceptance cannot advance through the Review decision select: strict label matching failed, exact-label retry times out30s. Expected full real browser approval/revoke/candidate-blocker/history flow. Inspect trace and use a robust accessible selector or correct the actual defect; do not increase timeout to hide it.',
 'evidence':['logs/ngkhengyang/reviewer/2026-10-27-reviewer-iteration4-implementation/reports/integrator-result.json']}
p=run/'inputs/finding-browser-blocker.json';p.write_text(json.dumps(finding,indent=2)+'\n')
fid=call(['finding','add','--input',str(p.relative_to(root))])
record=call(['start','--agent','fixer','--invocation','fix-round1','--stage','fix','--assignment','fixer','--model','gpt-6-sol','--effort','medium'])
packet=json.loads((run/'inputs/11-main-to-reviewer.json').read_text())
packet.update(identity='Main to NEW fixer, iteration4 replacement implementation assignment. User explicitly authorized reviewer/fixer interaction until corrected and revalidated. Begin read-only diagnosis; do not edit until independent initial review finishes its frozen state and root releases the write gate.',
 permissions='You are the sole product/test writer in the explicit follow-on assignment fixer. Original foundation/reviewer/release/UI/integrator agents frozen. You are NOT alone: preserve their changes and root docs/logs. Work only confirmed findings; coordinate contract/security changes with root/reviewer. Do not edit workflow/specs/AGENTS, logs or docs. Runtime test outputs allowed. No commits/reset/deployment/liveAI. Reviewer is read-only and owns independent closure. Communicate directly with review_i4_final and root; user authorized interaction. Return structured fix completion (changed_paths, commands, snapshot suggestions, risks), root persists canonical state.',
 verification='Known F-001 browser blocker in original integrator result. Real PG171 and units155 passed before browser-only edits. First read trace/test and await frozen-state initial review batch. Apply minimal robust fix, then targeted leased browser check and outstanding default browser suite. Do not repeat build/types/unit/PG for selector-only changes. New follow-on check contracts review-build/types/lint/units/postgres/browser-default exclude browser edits from backend scope. Run only relevant checks through invoke-workflow.ps1 and request root for new focused check registration if needed. Fresh new-run contracts may require initial executions for their own evidence; do not mislabel old results as new. Reviewer assesses necessity/coverage.',
 risks='No source edits until root confirms initial review batch finished; initial diagnosis may proceed now. Inspect defects rather than changing timeouts or weakening assertions. Return urgent security/contract changes for coordination. Batch routine fixes, then freeze and send actual diff/results to reviewer. Two failed review/fix cycles require root reassessment. No unrequested refactor.',
 resources='Selected gpt-6-sol/medium for bounded fixes on established contracts; initial known issue is a browser locator. Escalate subtle concurrency/security difficulty to root rather than guessing. Coordinator-observed record '+record['record_id']+'; exact stage tokens unavailable; retrospective thread counters separately collected.',
 resource_record=record['record_id'])
p=run/'inputs/12-main-to-fixer.json';p.write_text(json.dumps(packet,indent=2)+'\n')
call(['handoff','create','--id','12-main-to-fixer','--input',str(p.relative_to(root))])
print(json.dumps({'finding':fid,'fix_record':record['record_id'],'handoff':str(run.relative_to(root)/'handoffs/12-main-to-fixer.md')}))
