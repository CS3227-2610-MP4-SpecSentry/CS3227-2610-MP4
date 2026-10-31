"""Render one evidence-backed continuation in the canonical conversation log."""
import json,sys,hashlib
from pathlib import Path
from datetime import datetime
root=Path.cwd();run=Path(__file__).resolve().parent
usage_path=Path(sys.argv[1]);usage=json.loads(usage_path.read_text())
dirs=[root/'logs/ngkhengyang/reviewer'/n for n in ('2026-10-26-reviewer-iteration4','2026-10-27-reviewer-iteration4-implementation','2026-10-27-reviewer-iteration4-review-fixes')]
states=[json.loads((d/'state.json').read_text()) for d in dirs]
records=[dict(row,run=str(d.relative_to(root))) for d,s in zip(dirs,states) for row in s['records'].values()]
finished=[r for r in records if r['end']]
def epoch(x):return datetime.fromisoformat(x.replace('Z','+00:00')).timestamp()
def merged(intervals):
 result=[]
 for a,b in sorted(intervals):
  if result and a<=result[-1][1]:result[-1][1]=max(result[-1][1],b)
  else:result.append([a,b])
 return sum(b-a for a,b in result)
all_intervals=[(epoch(r['start']),epoch(r['end'])) for r in finished]
by_agent={}
for r in finished:by_agent.setdefault(r['agent'],[]).append((epoch(r['start']),epoch(r['end'])))
resources={'record_count':len(records),'finished_count':len(finished),'running':[r['id'] for r in records if not r['end']],
 'calendar_span_seconds':max(b for a,b in all_intervals)-min(a for a,b in all_intervals),
 'merged_interval_coverage_seconds':merged(all_intervals),'raw_summed_interval_seconds':sum(b-a for a,b in all_intervals),
 'summed_per_declared_agent_merged_seconds':sum(merged(v) for v in by_agent.values()),
 'limitations':['Intervals include observed waits, pauses and unknown interruption gaps; active compute unavailable.','Same logical-agent overlaps merged to avoid duplicate attribution; alias identity is recorder identity, not measured OS concurrency.','Main consolidation may still be running at draft render; final resource supplement follows its actual finish.'],
 'records':records,'retrospective_thread_usage_source':str(usage_path),'thread_usage':usage}
(run/'reports/final-resources.json').write_text(json.dumps(resources,indent=2)+'\n')
review=json.loads((run/'reports/revalidation.json').read_text())
manifest=json.loads((run/'reports/final-reviewed-manifest.json').read_text())
files=manifest['files']
for p,h in files.items():
 actual=hashlib.sha256((root/p).read_bytes()).hexdigest() if (root/p).is_file() else None
 if actual!=h:raise SystemExit('Reviewed manifest differs: '+p)
participants=[
 ('Main','Brief/security contracts, ownership, coordination,3 guide/traceability follow-up changes and canonical reporting','Selected main setting unavailable'),
 ('security_design','First independent design attempt; capacity failure retained','gpt-6.1-sol/high'),
 ('security_retry','Completed independent design review and exact final-brief recheck;3 design controls incorporated','gpt-6-sol/high'),
 ('foundation_i4','Contracts, provenance-preserving migration, release persistence/locks, fixture cleanup and stable ordering correction','gpt-6-sol/high'),
 ('reviewer_i4','Revocation route/transaction, versions/replay authorization, immutable approval/history and11 scopedPG cases','gpt-6-sol/high'),
 ('release_i4','Candidate lifecycle/publication, durable notices,10 normal/18 race cases and bounded lint correction','gpt-6-sol/high'),
 ('ui_i4','Reason/impact/history/retry form, component evidence, API browser fixture and initial fixture/locator corrections','gpt-6-sol/medium'),
 ('integrator_i4','Same resumed subagent wired3 files, assembled checks, restored existing testPG and returned39-file manifest/browser blocker','gpt-6-sol/high'),
 ('review_i4_final','Independent49-case/source/docs/security assessment; F001-004, actual fix revalidation and finalsecurity assessment','gpt-6-sol/high'),
 ('fixer_i4_final','Explicit replacement assignment: browser locator fix and targeted missing gate/rollback/browser assertions','gpt-6-sol/medium')]
lines=['\n## Consolidated implementation, integration and review/fix outcome\n',
 'This continuation supersedes earlier pause-only status summaries. Prompter **ngkhengyang** was inferred from Git identity and matching Reviewer ownership. The user successively authorized implementation, integration, first review and finally the same integrator plus an independent reviewer/new fixer interacting until corrected, then consolidation. The final authorization superseded the first-review stopping boundary. Questions about excessive checks, test authorship/necessity and per-agent tokens were answered from local evidence. No deployment, commit/push, live AI, broad Maintainer UI or human teammate approval was performed.\n',
 '**Source boundary:** baseline `9556b72b5cce9da8df0b40887c8ba816cccdaaf8`; uncommitted implementation including relevant new files. [Final reviewed hashes](reviewer/2026-10-27-reviewer-iteration4-review-fixes/reports/final-reviewed-manifest.json) identify '+str(len(files))+' changed product/test/config/document files; logs/generated outputs/dependencies/credentials are excluded. Source hashes were checked again when this report rendered.\n',
 '**Final independent assessment:** '+review['summary']+' See [revalidation](reviewer/2026-10-27-reviewer-iteration4-review-fixes/reports/revalidation.json) and [final security assessment](reviewer/2026-10-27-reviewer-iteration4-review-fixes/reports/security-final.json). Semantic review, actual test outcomes and CLI structural consistency are separate below.\n',
 '### Execution and ownership\n',
 'Foundation settled before Reviewer/release/UI work. The user pauses and interruptions remain in measured history. The same integrator authored only application release registration, administrative CLI dependency wiring and browser fixture configuration. Integration exposed deterministic fixture ordering, invalid fixture diff, unused bindings and browser locator defects. Original owners made bounded corrections. When a browser locator timeout remained, the integrator returned a partial result rather than claiming verification. The main agent created a **separate explicit replacement assignment plan**, retaining original assignments untouched, and generated seven-section implementation handoffs under the current workflow. The independent reviewer inspected frozen source; the fixer corrected only authorized findings. Reviewer/fixer direct interaction was expressly authorized by the user. Scoped locator work was released while unchanged backend review continued; final closure used settled post-fix source.\n',
 '| Agent | Concrete work and outcome | Selected settings |','| --- | --- | --- |']
for name,work,settings in participants:lines.append(f'| {name} | {work} | {settings} |')
lines+=['\n[Integrator result](reviewer/2026-10-27-reviewer-iteration4-implementation/reports/integrator-result.json); [implementation-to-review handoff](reviewer/2026-10-27-reviewer-iteration4-review-fixes/handoffs/11-main-to-reviewer.md); [new-fixer handoff](reviewer/2026-10-27-reviewer-iteration4-review-fixes/handoffs/12-main-to-fixer.md); [replacement ownership plan](reviewer/2026-10-27-reviewer-iteration4-review-fixes/reports/replacement-ownership-plan.json).\n',
 '### Independent findings, fixes and assurance\n',
 '| Finding | Observed gap | Final disposition |','| --- | --- | --- |']
for fid,f in states[-1]['findings'].items():lines.append(f"| {fid} | {f['description'].replace('|','/')} | {f['status']}; independent evidence in revalidation |")
lines+=['\nThe first independent assessment found **no confirmed direct server authorization/transaction bypass**, but it did find overstated verification: a release-gates test omitted several controls and its stale-smoke claim did not change content; the test called release-rollback actually invoked revocation; real browser recovery/accessibility evidence was partial. These were evidence gaps, not proven application failures. Existing tests were written by each implementation owner against the coordinator acceptance plan; the independent review challenged their assertions instead of equating names/counts with coverage. [Initial review](reviewer/2026-10-27-reviewer-iteration4-review-fixes/reports/initial-review.json).\n',
 '### Delivered behavior and final validation\n',
 'Assigned Reviewers can explicitly revoke an effective approval with a bounded reason and current version/assignment/candidate context. Original approval and revision evidence remain immutable. Unattached proposals enter CHANGES_REQUESTED; attached proposals stay frozen, block publication and notify the responsible Maintainer until explicit removal. Real release APIs enforce creator responsibility, membership/version/smoke/publication gates and immutable snapshots. Reads/retries retain scope/session/CSRF checks; business state/audit/notices commit together. Manual UI remains usable without product AI. Broader Maintainer UI and live AI remain excluded.\n',
 'Exact current checks, scope applicability and counts are in [final validation](reviewer/2026-10-27-reviewer-iteration4-review-fixes/reports/final-validation.json). Earlier assembled evidence passed155 unit/component and171 PostgreSQL tests before the final browser-only edits. Those are historical suite totals, not counts of newly authored tests. New tests and current results are distinguished in the final validation record. Full browser regressions/default execution are claimed only where an actual passing command exists.\n',
 '### Workflow problems and corrections\n',
 '| Observed problem | Impact and actual response |','| --- | --- |',
 '| Overly broad verification source scopes/dependencies and completion refreshes | Repeated builds/types/check bookkeeping after test-only edits. Coordinator acknowledged avoidable overhead. Follow-on contracts separate production/backend/browser/document scopes; focused browser checks run source server without unnecessary build dependency. No causal speedup claim is made. |',
 '| Capture wrapper Unicode encoding | Successful build output caused false failures; stdout/stderr UTF-8 replacement fixed the wrapper. Original failures retained. |',
 '| Disposable PostgreSQL stopped | Same existing loopback cluster restored without reset or deleting data; actual connectivity preflight and affected browser retry recorded. |',
 '| Browser worker stalled in default sandbox | Owned process tree canceled after diagnosis; two crash-left leases removed only after their exact PID/children were verified absent. Same focused source check passed escalated native browser execution in14.4s. Interrupted command remains explicitly superseded. |',
 '| Test names/matrix overstated assertions | Independent reviewer found F002-004 and required discriminating gate/publication rollback/browser tests. Fixer/reviewer interaction and actual revalidation replace self-certification. |',
 '| Unknown pauses/gaps and overlapping coordinator intervals | Historical elapsed includes a long gap between commands; not attributed to compute. Resource aggregation includes per-agent merged intervals, avoiding duplicate overlapping same-agent attribution. |',
 '| Earlier partial migration failure / security capacity failure | Forward repair of partially applied guarded migration preserved history; no forbidden reset. Failed security attempt and Sol retry retained. |',
 '\nNo workflow source refactoring or deletion/compaction was performed. New ownership/check contracts are run metadata; scope-selection benefits remain limited to observed reuse, not a controlled cross-run efficiency result.\n',
 '### Resources and retention\n',
 'Local runtime counters are cumulative per distinct thread, including retries and cached context; stage-aligned tokens/tool counts/retry counts are unavailable and not inferred. Input includes cached input; output includes reasoning. These are not a billing statement. [Raw closure-cutoff usage](<'+usage_path.as_posix()+'>) and [all interval/resource data](reviewer/2026-10-27-reviewer-iteration4-review-fixes/reports/final-resources.json) retain cutoffs and coverage. Final response/unflushed counters lie outside the sample.\n',
 '| Agent | Input | Cached input (included) | Output | Total |','| --- | ---: | ---: | ---: | ---: |']
for row in usage['sessions'].values():
 u=row.get('usage') or {};lines.append('| '+str(row.get('agent'))+' | '+' | '.join(str(u.get(k,'unavailable')) for k in ('input_tokens','cached_input_tokens','output_tokens','total_tokens'))+' |')
lines+=['\nMeasured token total: **'+format(usage['measured_totals_only']['total_tokens'],',')+'**, coverage '+str(usage['coverage']['total_tokens'])+'/'+str(usage['session_count'])+' threads; sample '+usage['sampled_at']+'. These thread totals span preparation through closure cutoff; no attempt was made to distribute them among stages.\n',
 'All historical preparation/implementation runs, failed/interrupted commands, interval records, scoped completions, matrix revisions and handoffs remain in their active CLI formats. [Preparation](reviewer/2026-10-26-reviewer-iteration4/state.json), [implementation](reviewer/2026-10-27-reviewer-iteration4-implementation/state.json) and [review/fixes](reviewer/2026-10-27-reviewer-iteration4-review-fixes/state.json) are linked rather than merged by editing historical state. Separate final CLI bundles preserve structural gaps without hiding recovered semantic results. No replay/resume evidence was removed. The original consolidation interval rec-a356c02c76f04a98 was interrupted by the user pause; resumed consolidation uses rec-455349fd5afe4e8e with checkpoint documentation rec-9de47f6bfa8341f8. Final measured timing supplement is appended after actual closure.\n']
log=root/'logs/ngkhengyang/2026-10-26-reviewer-iteration4.md'
marker='## Consolidated implementation, integration and review/fix outcome'
oldtext=log.read_text(encoding='utf-8')
if marker in oldtext:raise SystemExit('Final consolidation already appended; update deliberately rather than duplicate')
with log.open('a',encoding='utf-8') as out:out.write('\n'.join(lines)+'\n')
print(json.dumps({'canonical_log':str(log.relative_to(root)),'source_files':len(files),'tokens':usage['measured_totals_only']['total_tokens'],'records':len(records)}))
