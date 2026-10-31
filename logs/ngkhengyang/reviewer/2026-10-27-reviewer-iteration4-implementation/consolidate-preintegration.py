"""Consolidate actual implementation evidence and close at the requested pause."""
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote

root=Path(__file__).resolve().parents[4]
run=Path(__file__).resolve().parent
prep=root/'logs/ngkhengyang/reviewer/2026-10-26-reviewer-iteration4'
reports=run/'reports'
log=root/'logs/ngkhengyang/2026-10-26-reviewer-iteration4.md'
external=Path('C:/Users/User/Documents/NUS/CS3227/MP4 sessions/local-resource-tracking')
cli=[sys.executable,'-B',str(root/'workflow/reviewer/scripts/workflow.py'),'--run',str(run.relative_to(root))]
def call(argv,allowed=(0,)):
 p=subprocess.run(argv,cwd=root,capture_output=True,text=True,encoding='utf-8',errors='replace')
 if p.returncode not in allowed:raise RuntimeError(p.stderr or p.stdout)
 return p
def save(name,value):
 (reports/name).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
def check_links(paths):
 missing=[]
 for doc in paths:
  for m in re.finditer(r'\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))\)',doc.read_text(encoding='utf-8')):
   target=unquote((m[1] or m[2]).split('#')[0])
   if not target or target.startswith(('http:','https:','codex:','mailto:')):continue
   dest=Path(target) if Path(target).is_absolute() else doc.parent/target
   if not dest.exists():missing.append((str(doc),target))
 if missing:raise RuntimeError(str(missing))

state=json.loads((run/'state.json').read_text())
assert not any(r['stage']=='integrate' for r in state['records'].values())
assert [rid for rid,r in state['records'].items() if r['status']=='running']==['rec-74b3e338a2324d17']
for key in ('02-foundation-complete','04-reviewer-complete','04-release-complete','06-ui-complete'):
 assert key in state['completions']
 call(cli+['handoff','validate','--id',key])
head=call(['git','rev-parse','HEAD']).stdout.strip()
assert head=='9556b72b5cce9da8df0b40887c8ba816cccdaaf8'
integration_paths=['src/server/src/app.module.ts','src/server/src/identity/manage-account.ts','playwright.config.ts']
for p in integration_paths:
 baseline=subprocess.run(['git','show','HEAD:'+p],cwd=root,capture_output=True,check=True).stdout.replace(b'\r\n',b'\n')
 assert (root/p).read_bytes().replace(b'\r\n',b'\n')==baseline,p
changed=call(['git','diff','--name-only']).stdout.splitlines()+call(['git','ls-files','--others','--exclude-standard']).stdout.splitlines()
product=sorted({p for p in changed if not p.startswith('logs/')})
assert all(any(p==q or p.startswith(q+'/') for a in state['assignments'].values() for q in a['paths']) for p in product)
assert not call(['git','diff','--cached','--name-only']).stdout.strip()
call(['git','diff','--check'])
manifest={'baseline_head':head,'scope':'Implemented source before integration; not independently code reviewed',
 'files':{p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in product},
 'deferred_wiring_unchanged':integration_paths,'untracked_sources_included':True}
save('preintegration-source-manifest.json',manifest)

summary='''# Reviewer iteration 4 - paused immediately before integration

All four implementation assignments have canonical completions. No integrator or integration interval has started. Source identity is [the SHA-256 manifest](preintegration-source-manifest.json), baseline `9556b72b5cce9da8df0b40887c8ba816cccdaaf8`. The implementations remain uncommitted.

| Owner | Implemented result | Scoped evidence |
| --- | --- | --- |
| Foundation | Strict schemas, real candidate/member/smoke/snapshot persistence, scoped provenance, migration, lock helpers and cleanup | 7 contract / 2 PostgreSQL tests; generation and shared build passed; 02-foundation-complete |
| Reviewer | Explicit revoke route/transaction, current approval/candidate context, preserved decisions and activity, authorization/idempotency/rollback | 11 PostgreSQL tests passed; 04-reviewer-complete |
| Release | Real creator-scoped operations/gates/removal/publication, immutable evidence and durable recipient-scoped notices | 10 normal / 18 overlapping PostgreSQL race tests passed; 04-release-complete |
| UI | Eligible revoke form, reason/impact, conflict/retry handling, original approval/revocation display and API-backed browser source | 55 Reviewer component tests, client types and nonexecuting browser syntax passed; 06-ui-complete |

Counts are scoped suite results, not 103 newly introduced tests or full product certification. The 49-case plan has passing check evidence for the 46 backend/foundation obligations; the three real browser obligations remain unexecuted. Named-case semantics and code still require independent review. UI component evidence does not replace real browser acceptance.

Three integration wiring tasks remain:

1. Connect `ReleasesModule.register(config)` in `src/server/src/app.module.ts`.
2. Supply the new revocation dependency in the direct ReviewsService construction in `src/server/src/identity/manage-account.ts`. Full-server TypeScript currently fails TS2554 at line30 for this deliberate integration gap; no integrated build is claimed.
3. Select the new production-API revocation fixture in `playwright.config.ts`, then run its three named browser cases against the wired application.

Then perform the bounded assembled interface/transaction inspection and affected build/type/lint/regression verification. Reuse scoped evidence only while its source/contracts/external state remain valid. Freeze the resulting source for independent implementation/security review. Substantive defects return to original owners. [Detailed integration plan](integration-plan.md).

Root/CLI/Playwright wiring files are verified unchanged from HEAD. Broader regression suites, integrated build, real browser acceptance, independent code/security review, human teammate approval and deployment remain pending. Live AI stays disabled under OPEN-002. Passing implementation checks and design review are distinct from independent approval of code.
'''
(reports/'pre-integration-summary.md').write_text(summary,encoding='utf-8')
(reports/'implementation-status.md').write_text(summary,encoding='utf-8')
validation={'ok':True,'baseline_head':head,'changed_product_files':len(product),'owner_completions':4,
 'integration_started':False,'deferred_wiring_unchanged':integration_paths,'running_product_checks':0,
 'source_manifest_hashes':len(product),'full_server_typecheck':'fails only deferred CLI constructor TS2554; initial race-mock type issue corrected',
 'browser_acceptance':'not executed; source syntax and component evidence only','independent_code_review':'not started'}
assert not any(c.get('status')=='running' for c in state['commands'].values())
check_links([log,reports/'pre-integration-summary.md',reports/'integration-plan.md'])
save('preintegration-boundary-validation.json',validation)

latest='''
## Consolidated implementation boundary - paused before integration

The user lifted the immediate agent pause while retaining the pause immediately before integration. All four source assignments are now complete with scoped evidence; no integration or independent implementation review has started. The [pre-integration report](reviewer/2026-10-27-reviewer-iteration4-implementation/reports/pre-integration-summary.md) is the current status and exact integration handoff boundary, superseding earlier in-progress status only. [Canonical execution](reviewer/2026-10-27-reviewer-iteration4-implementation/state.json), [source identity](reviewer/2026-10-27-reviewer-iteration4-implementation/reports/preintegration-source-manifest.json), and [boundary validation](reviewer/2026-10-27-reviewer-iteration4-implementation/reports/preintegration-boundary-validation.json) retain source/check correspondence.

Actual implementation participants were main, foundation, Reviewer, release and UI. Reviewer/release were interrupted by the user's immediate pause and reused on resumption. Foundation selected gpt-6-sol/high; Reviewer/release gpt-6-sol/high; UI gpt-6-sol/medium. Main selected settings and all observed settings are unavailable. Preparation's two independent security agents and their failed/full/recheck attempts remain in its separate historical state, not counted as new implementation workers. There was no integrator or independent code-review agent.

| Participant / attempts | Delivered work and verification | Resource/completion evidence |
| --- | --- | --- |
| Main: bootstrap, compile, original dispatch, resumed dispatch, consolidation | Requirements/contracts/ownership, prerequisite recovery, source-scoped check execution, returned defects to owners, current report | Bootstrap recorded in preparation; execution records and separate consolidation interval are canonical |
| Foundation: foundation-implement-1 | 18 owned files; migration/contracts/locks/fixture compatibility; generation/shared build, 7 contract and 2 DB tests passed | rec-e68edb5dfbec4794; 02-foundation-complete |
| Reviewer: reviewer-implement-1 interrupted; reviewer-implement-resume completed | 6 owned files; revoke/history/context and 11 PostgreSQL cases passed | rec-b49b9dd78e4c4719 interrupted; rec-d6a3224531e44b31 and04-reviewer-complete succeeded |
| Release: release-implement-1 interrupted; release-implement-resume completed | 7 owned files; real candidate lifecycle/gates/notice/publish; 10 normal and18 genuine PostgreSQL races passed | rec-7167a31828de45f6 interrupted; rec-7df874d0e6a24905 and04-release-complete succeeded |
| UI: ui-implement-1 | 5 owned files; explicit revoke/history/recovery, component and real-API browser source; 55 Reviewer component tests, client typecheck, browser-source syntax passed | rec-dd9d79ed13584a5a;06-ui-complete |

Implementation review and security assessment of final code remain pending. Earlier independent design findings SEC-I4-001/002/003 are design controls, not independent code closures. All 49 matrix cases remain; 46 foundation/backend obligations have current check evidence, while the three browser cases remain unexecuted at this boundary. The five-file 55-test Reviewer component result includes existing regressions and is not55 newly added cases. No combined cumulative test count is presented as useful-work productivity.

Significant implementation corrections preserved: failed partial migration42P17 and bounded forward recovery without reset; release schema drift corrected to normative payload/semver/smoke defaults; normalized-account, immediate FK and deferred assignment-pointer fixture errors; case-sensitive test-role mapping; async race mock typing; lazy contender promise dispatch. Original owners corrected these, and successful current tests supersede their failed checks where applicable. The true PostgreSQL waiter oracle was retained. Publication no longer treats a disabled Reviewer's completed approval as revoked, and latest-content smoke plus immutable snapshot evidence are included. These are implementation self-check outcomes, not independently closed findings.

The full-server typecheck initially found a race mock error and the CLI dependency gap. The latest captured result (`verify-a125ef12630d49cc`) contains only `manage-account.ts(30,9) TS2554`; the mock was fixed. This remaining failure is deliberately deferred integration wiring and prevents an integrated-build claim. Original failed evidence is retained, not hidden by the successful client typecheck.

Integration must connect root release registration, administrative CLI dependency construction and new Playwright fixture selection, then run affected assembled/regression checks and prepare independent implementation/security review. The [integration plan](reviewer/2026-10-27-reviewer-iteration4-implementation/reports/integration-plan.md) names the files, contracts, evidence reuse rules and stop conditions. All three wiring files were verified unchanged from HEAD; no integration mutation or acceptance sweep occurred. No commit/PR/deployment/live-provider call was requested or performed; OPEN-002 remains disabled and teammate approval remains separate.

Resource scope: interrupted main/Reviewer/release intervals were closed at the actual resumption checkpoint, so their elapsed includes an unknown user-pause gap. Preserve this measurement limitation rather than call it computation. The separate consolidation interval records report authoring/validation. Collector cumulative baselines and sampled deltas are outside Git; event cutoffs lag exact boundaries, so no misaligned stage tokens or combined parent/children values were imported. Cache is included in input and reasoning in output. Tool/retry counters, active computation and observed execution settings remain unavailable. No savings, causal compression or billing claim is made.

Retention: all preparation/execution canonical states, source hashes, matrices, generated handoffs, interrupted attempts, failed checks and successor links remain intact. No evidence was deleted/compacted, and this linked active execution can resume after the user lifts the integration pause. The earlier preparation report remains historical; no old result certifies current assembled code.
'''
text=log.read_text(encoding='utf-8')
log.write_text(text+latest,encoding='utf-8')
check_links([log,reports/'pre-integration-summary.md',reports/'integration-plan.md'])

# Actual separate consolidation end, after authoring and pre-render validation.
call(cli+['finish','--id','rec-74b3e338a2324d17','--status','succeeded','--outcome',
 'Consolidated all implementation owners, interrupted attempts, scoped checks and explicit integration gaps; source/links validated and user pause retained',
 '--unavailable-reason','Exact aligned token/cache/model/tool/retry telemetry unavailable; separate external sampled windows/cutoffs retained'])
call([sys.executable,'-B',str(external/'codex_usage.py'),'--thread','01a178d0-4871-7153-adda-0edfbc659cd7',
 '--baseline',str(external/'iteration4-01a178d0-preintegration-consolidation-start.json'),
 '--output',str(external/'iteration4-01a178d0-preintegration-consolidation-end.json')])
bundle_result=call(cli+['report','--format','bundle'],(0,1))
bundle=json.loads(bundle_result.stdout);save('preintegration-bundle.json',bundle)
(reports/'preintegration-harness-report.md').write_text(bundle['markdown'],encoding='utf-8')
state=json.loads((run/'state.json').read_text())
assert all(r['status']!='running' for r in state['records'].values())
def stats(rows):
 spans=sorted((datetime.fromisoformat(r['start']),datetime.fromisoformat(r['end'])) for r in rows)
 merged=[]
 for a,b in spans:
  if merged and a<=merged[-1][1]:merged[-1]=(merged[-1][0],max(b,merged[-1][1]))
  else:merged.append((a,b))
 result={'calendar_seconds':(max(b for a,b in spans)-min(a for a,b in spans)).total_seconds(),
  'summed_agent_elapsed_seconds':sum(r['elapsed_seconds'] for r in rows),
  'merged_interval_seconds':sum((b-a).total_seconds() for a,b in merged)}
 assert result['merged_interval_seconds']<=result['calendar_seconds']+1e-6
 return result
rows=list(state['records'].values())
totals={'execution_excluding_later_consolidation':stats([r for r in rows if r['stage']!='document']),
 'execution_including_consolidation':stats(rows),'records':len(rows),'actual_execution_agents':5,
 'unresolved_pause_gap':'included in three interrupted intervals; precise stop checkpoint unavailable',
 'record_aligned_usage':'unavailable; no misaligned imports'}
save('implementation-resource-totals.json',totals)
res=['# Implementation and separate consolidation resources','',
 'Source: execution state.json. UTC times; Asia/Singapore is UTC+08:00. Elapsed includes tools, scheduling, coordinator waits and an unknown pause gap in interrupted intervals. These are not active computation measurements. Preparation/resource reports remain separate.', '',
 '| Agent / invocation / stage | Selected model / effort | Start / end UTC | Elapsed seconds | Status |',
 '| --- | --- | --- | ---: | --- |']
for r in rows:res.append(f"| {r['agent']} / {r['invocation']} / {r['stage']} | {r['selected_model']} / {r['selected_effort']} | {r['start']} / {r['end']} | {r['elapsed_seconds']:.6f} | {r['status']} |")
res+=['',json.dumps(totals,indent=2),'',
 'Five actual execution agents: main/foundation/Reviewer/release/UI. Reused interrupted workers are not extra agents. Main intervals do not overlap one another; agent durations overlap across different agents, so sum differs from wall/merged coverage. No causal time-saved claim. Observed model/effort, exact aligned input/output/cache/tool/retry metrics remain unavailable per record. Cached input/reasoning subsets are not added twice. Final bundle/resource/finished-measurement rendering, rendered link checks and final response lie outside the finished consolidation boundary.']
(reports/'implementation-resources.md').write_text('\n'.join(res)+'\n',encoding='utf-8')

windows=['execution-compile','foundation','resume2','reviewer-resume','release-resume','ui','preintegration-consolidation']
usage=['# Iteration 4 implementation sampled usage','',
 'Per-thread sampled windows, not exactly aligned record imports. Windows overlap; do not sum them. New descendants appear with cumulative counters only in their own row. Existing prior security agents may have zero observed deltas; zero is different from unavailable.', '',
 '| Window | Actual thread / agent | Input | Output | Cached input included | Baseline / end cutoff UTC |',
 '| --- | --- | ---: | ---: | ---: | --- |']
thread_map={}
for window in windows:
 p=external/('iteration4-01a178d0-'+window+'-end.json')
 data=json.loads(p.read_text())
 for tid,row in data['sessions'].items():
  thread_map[tid]=row.get('agent')
  u=row.get('usage') or {}
  usage.append(f"| {window} | {tid} / {row.get('agent')} | {u.get('input_tokens','unavailable')} | {u.get('output_tokens','unavailable')} | {u.get('cached_input_tokens','unavailable')} | {row.get('baseline_cutoff','new descendant')} / {row.get('cutoff','unavailable')} |")
usage+=['','Sources: corresponding fresh cumulative baseline and end JSON files alongside this report, outside Git. Cutoffs can lag record start/end; no counter estimate or account percentage is substituted. No combined parent-plus-child total is imported into main. Input includes cached tokens; output includes reasoning. Final response after sampling is outside coverage.']
external_report=external/'iteration4-01a178d0-implementation-sampled-resources.md'
external_report.write_text('\n'.join(usage)+'\n',encoding='utf-8')
save('actual-thread-map.json',thread_map)
append='\n### Finished implementation resource and report references\n\n'
append+='[Per-attempt resources](reviewer/2026-10-27-reviewer-iteration4-implementation/reports/implementation-resources.md), [numerical totals](reviewer/2026-10-27-reviewer-iteration4-implementation/reports/implementation-resource-totals.json), [actual thread map](reviewer/2026-10-27-reviewer-iteration4-implementation/reports/actual-thread-map.json), [external sampled windows](<'+external_report.as_posix()+'>), and [final bundled harness view](reviewer/2026-10-27-reviewer-iteration4-implementation/reports/preintegration-bundle.json) retain full scope and limitations.\n\n'
for key,value in totals.items():
 if isinstance(value,dict):append+=f"- {key}: calendar {value['calendar_seconds']:.3f}s; merged interval coverage {value['merged_interval_seconds']:.3f}s; summed agent elapsed {value['summed_agent_elapsed_seconds']:.3f}s.\n"
append+='\nAll execution intervals are finished; no agent or verification command remains running. The bundle is intentionally incomplete for the full workflow: integration/review/close, real browser acceptance, deferred CLI wiring and truthful interrupted historical attempts remain gaps. This is not a fully green consistency or product completion claim. Final resource/report rendering and response lie outside finished timing.\n'
log.write_text(log.read_text(encoding='utf-8')+append,encoding='utf-8')
docs=[log,*run.rglob('*.md')]
check_links(docs)
validation.update(finished_records=len(rows),running_records=0,markdown_links_checked=len(docs),bundle_exit_code=bundle_result.returncode)
save('preintegration-boundary-validation.json',validation)
call(['git','diff','--check'])
print(json.dumps({'paused_before_integration':True,'source_files':len(product),'completions':4,
 'records_finished':len(rows),'bundle_exit_code':bundle_result.returncode,'local_links':'passed','resource_totals':totals},indent=2))
