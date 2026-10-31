import json,subprocess,sys,os
from pathlib import Path
root=Path.cwd();run=Path(__file__).resolve().parent
cli=[sys.executable,'-B','workflow/reviewer/scripts/workflow.py','--run',str(run.relative_to(root))]
env=os.environ.copy();env.update(GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='safe.directory',GIT_CONFIG_VALUE_0=root.as_posix())
def call(args):
 p=subprocess.run(cli+args,capture_output=True,text=True,encoding='utf-8',errors='replace',env=env)
 if p.returncode:raise RuntimeError(p.stdout+p.stderr)
 return json.loads(p.stdout)
report={'reviewer':'/root/review_i4_final','resource_record':'rec-ee9bb341034541e9','manifest':'reports/initial-reviewed-manifest.json','base':'9556b72b5cce9da8df0b40887c8ba816cccdaaf8',
 'scope':'Initial independent source/spec/security/test-adequacy and changed-doc review; no suites rerun. Initial manifest is historical after scoped F001 locator fix.',
 'coverage':{'contract':{'cases':3,'status':'direct unit assertions'},'postgres':{'cases':43,'status':'substantive auth/session/replay/stale/revocation-rollback and18 genuinePG races; release ownership/gates/publication-rollback assertion gaps'},'ui':{'cases':3,'status':'component evidence partial; attached browser blocked at locator; unattached/access-loss/keyboard/focus evidence missing'}},
 'security':'No confirmed direct bypass observed after tracing controller, businessTransaction, account/session checks before reads/replay, assignment/candidate scopes, creator gates, sorted locks, atomic invalidation/activity/notice and publication/snapshot/member writes, own-blocker projection and migration immutability. No liveAI or production probing. Evidence gaps prevent blanket certification.',
 'docs':'Four changed guides/traceability reviewed as provisional; no separate conformance defect. Claims must match eventual checked final state.',
 'findings':[
 {'id':'F-001','requirement':'REQ-REV-016','severity':'MEDIUM','blocks':True,'description':'Real browser approval/revocation flow blocked by Decision label locator timeout. Accessible combobox selector required; actual end-to-end flow must pass.'},
 {'requirement':'REQ-REL-001/002/004','severity':'HIGH','blocks':True,'description':'Release verification overstated at src/server/test/release-revocation.integration.ts:162-192: ownership omits noncreator add; gates omit missing rollback, uncovered required criterion, HIGH/CRITICAL finding, stale revision, duplicate version, and actual content-change stale smoke. Existing code has controls; this is an evidence gap. Add focused realPG cases varying one gate at a time; assert expected blocker and no publication/member fragments.'},
 {'requirement':'REQ-REL-004/008','severity':'HIGH','blocks':True,'description':'Publication rollback is unverified at release-revocation.integration.ts:193-203: release-rollback invokes revoke, not publish. Inject a few discriminating publication failures including after snapshot and after first member write in multi-member candidate; compare candidate/member/proposal/snapshot/activity/idempotency before/after. Do not mirror every implementation line.'},
 {'requirement':'REQ-REV-016','severity':'MEDIUM','blocks':True,'description':'UI acceptance browser covers attached happy path only; component network/conflict mocks and label/limit assertions do not establish unattached real browser flow, keyboard/focus or access-loss clearing. Add focused browser evidence without duplicating every mock. Preserve hostile-text safe rendering assertion.'}]}
p=run/'reports/initial-review.json';p.write_text(json.dumps(report,indent=2)+'\n')
ids=['F-001']
for i,f in enumerate(report['findings'][1:],2):
 f=dict(f,owner='fixer',reviewer='independent-reviewer',evidence=[str(p.relative_to(root))]);q=run/'inputs'/f'finding-review-{i}.json';q.write_text(json.dumps(f,indent=2)+'\n')
 ids.append(call(['finding','add','--input',str(q.relative_to(root))])['finding'])
call(['finish','--id','rec-ee9bb341034541e9','--status','succeeded','--outcome','Initial independent assessment completed; four blocking verification findings, no confirmed direct product authorization/transaction defect. Frozen initial state plus scoped F001 release recorded.','--unavailable-reason','Per-stage counters unavailable; reviewer thread cumulative sampled separately'])
call(['cycle','--reviewer','independent-reviewer','--outcome','failed','--evidence',str(p.relative_to(root))])
print(json.dumps({'findings':ids,'initial_review':'completed with blockers'}))
