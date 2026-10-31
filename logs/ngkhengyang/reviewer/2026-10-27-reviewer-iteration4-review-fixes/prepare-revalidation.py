import json,subprocess,sys,os,hashlib
from pathlib import Path
root=Path.cwd();run=Path(__file__).resolve().parent
env=os.environ.copy();env.update(GIT_CONFIG_COUNT='1',GIT_CONFIG_KEY_0='safe.directory',GIT_CONFIG_VALUE_0=root.as_posix())
cli=[sys.executable,'-B','workflow/reviewer/scripts/workflow.py','--run',str(run.relative_to(root))]
def call(args):
 p=subprocess.run(cli+args,capture_output=True,text=True,encoding='utf-8',errors='replace',env=env)
 if p.returncode:raise RuntimeError(p.stdout+p.stderr)
 return json.loads(p.stdout)
paths=['src/server/test/release-revocation.integration.ts','workflow/tests/browser/reviewer-revocation.spec.ts']
args=['snapshot','--id','assertions-fixed','--base','HEAD']
for p in paths:args+=['--path',p]
call(args)
completion={'assignment':'fixer','record_id':'rec-f4712eb3ccb34485','snapshot_id':'assertions-fixed',
 'commands':['verify-7b4df6d5c9df41fb','verify-07f79964a86b4447'], 'changed_paths':paths,
 'summary':'Implemented missing requirement assertions: expanded release gates/creator add/publication rollback, unattached keyboard revocation and access-loss browser checks;18focusedPG and14defaultbrowser pass. No production changes.',
 'risks':'Independent actual-code revalidation pending; old155unit/171PG results reused only for unchanged production/other test sources, not claimed as new executions.',
 'next_action':'Freeze both files and independently revalidate F001-004 plus final docs delta',
 'references':[str(run.relative_to(root)/'reports/initial-review.json')],
 'unavailable_reason':'Exact record-aligned token/cache/tool/retry counters unavailable; retrospective thread counters separately sampled'}
p=run/'inputs/14-assertions-complete.json';p.write_text(json.dumps(completion,indent=2)+'\n')
call(['complete','--id','14-assertions-complete','--input',str(p.relative_to(root))])
for old,new in [('verify-749131c206c746bd','verify-7b4df6d5c9df41fb'),('verify-4aa1bce837f14278','verify-7b4df6d5c9df41fb'),('verify-9f5597b8b3404907','verify-946dc718a15f4798'),('verify-325a563918484a75','verify-946dc718a15f4798')]:
 call(['supersede','--kind','commands','--id',old,'--by',new,'--reason','Expanded tests/valid fixture setup verified; historical failures/results preserved, no product validation weakened'])
integration=call(['start','--agent','main','--invocation','integrate-test-fixes','--stage','integrate','--model','unavailable','--effort','unavailable'])
state=json.loads((run/'state.json').read_text())
scope=state['snapshots']['integrated-application-review1'].get('paths')
if not scope:scope=state['verification_checks']['integration-browser-default']['paths']
for sid,selected in [('final-integrated-application',scope),('final-integrated-docs',['docs/UserGuide.md','docs/DeveloperGuide.md','docs/Architecture.md','workflow/TRACEABILITY.md'])]:
 args=['snapshot','--id',sid,'--base','HEAD']
 for q in selected:args+=['--path',q]
 call(args)
initial=json.loads((run/'reports/initial-reviewed-manifest.json').read_text())
files={p:hashlib.sha256((root/p).read_bytes()).hexdigest() if (root/p).is_file() else None for p in initial['files']}
changed=[p for p in files if files[p]!=initial['files'][p]]
production=[p for p in changed if p not in paths and not p.startswith(('docs/','workflow/'))]
if production:raise SystemExit('Unexpected production change: '+str(production))
manifest={'base':initial['base'],'files':files,'changed_since_initial_review':changed,'production_changed_since_initial_review':production}
(run/'reports/final-reviewed-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
checks=[{'id':'verify-7b4df6d5c9df41fb','scope':'Expanded release PG file','result':'18/18 PASS'},
 {'id':'verify-946dc718a15f4798','scope':'Focused real revocation browser spec','result':'3/3 PASS'},
 {'id':'verify-07f79964a86b4447','scope':'Unfiltered default browser all specs','result':'14/14 PASS'}]
validation={'current_executions':checks,'reused_historical':[{'scope':'Unit/components','result':'155 PASS','command':'verify-38da33136cdd4c87'},
 {'scope':'Full PostgreSQL','result':'171 PASS before expanded release tests','command':'verify-7b05839ce8eb4e49'},
 {'scope':'Build/types/lint','result':'PASS in integration before final test-only changes','commands':['verify-b0e002a9bfa2414d','verify-7c32aa0e3d014be6','verify-0fff06cce4b043f7']}],
 'reuse_basis':'Production/shared/schema/config sources byteidentical to initial integrated state; unchanged test files retained. Two expanded test files executed currently. Independent reviewer decides adequacy; counts overlap and are not summed.',
 'no_new_full_unit_or_postgres_execution_claimed':True,'source_manifest':'reports/final-reviewed-manifest.json'}
(run/'reports/final-validation.json').write_text(json.dumps(validation,indent=2)+'\n')
call(['finish','--id',integration['record_id'],'--status','succeeded','--outcome','Integrated test-only corrections in shared workspace; current PG18/browser14 evidence and full source identity captured. Original39product/test/config baseline maintained; no production/interface edits. Documentation separate.','--unavailable-reason','Stage-aligned counters/settings unavailable'])
review=call(['start','--agent','independent-reviewer','--invocation','revalidate-round1','--stage','revalidate','--model','gpt-6-sol','--effort','high'])
packet=json.loads((run/'inputs/11-main-to-reviewer.json').read_text())
packet.update(identity='Fixer completion to same independent reviewer: final revalidation of F001-004. Root persisted actual fixer completion14; source writers frozen.',
 state='Final application/docs snapshots and final-reviewed-manifest identify settled43 changedfiles (or actual count inmanifest). Since initial review ONLY two test files plus three coordinator documentation edits changed. No production/shared/schema/config changes. Both test files were originally untracked: ordinary git diff against HEAD omits their iteration delta; compare initial/final hashes and your initially inspected content, then read actual final assertions.',
 verification='Current expanded release file18/18 verify-7b4df6d5c9df41fb, focused browser3/3 verify-946dc718a15f4798, unfiltered default browser14/14 verify-07f79964a86b4447. Inspect real assertions, isolated gates, DBguard applicability, multi-member publication failure/cleanup, keyboard/accessloss, source identity and final-validation reuse rationale. Prior155unit/171PG remain historical; no reexecution claimed. Do not close on owner summary. Inspect three docs deltas too.',
 risks='Confirm meaningful F002 gate coverage including whether DBconstraint guard is adequate rollback-note evidence; F003 failure truly occurs during publish after durable fragments attempted, full rollback comparisons; F004 actualrealbrowser behavior. Request smallest missing discriminator only. If unchanged fullPG/unit evidence is insufficient, explain specific risk before broader run. Return perF001-004 closed/open recommendation and49case status, exact reviewed manifest and remaining gaps. DefaultCLI cross-run evidence gaps remain separate; no waivers solely for greenmetadata.',
 resources='Same independent gpt-6-sol/high reviewer; final transaction/assertion evidence assessment. Record '+review['record_id']+'. Per-stage telemetry unavailable; cumulative thread at closure.',
 snapshot_id='final-integrated-application',resource_record=review['record_id'])
packet['references']+= [str(run.relative_to(root)/p) for p in ['handoffs/14-assertions-complete.md','reports/final-reviewed-manifest.json','reports/final-validation.json']]
p=run/'inputs/15-fixer-to-reviewer.json';p.write_text(json.dumps(packet,indent=2)+'\n')
call(['handoff','create','--id','15-fixer-to-reviewer','--input',str(p.relative_to(root))])
print(json.dumps({'revalidation_record':review['record_id'],'delta':changed,'production_delta':production,'handoff':str(run.relative_to(root)/'handoffs/15-fixer-to-reviewer.md')}))
