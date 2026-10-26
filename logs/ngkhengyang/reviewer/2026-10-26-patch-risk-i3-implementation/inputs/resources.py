"""Derived resource view; logical coordinator roles share one actual executor."""
import datetime as dt,json,pathlib
P=pathlib.Path('logs/ngkhengyang/reviewer/2026-10-26-patch-risk-i3-implementation')
s=json.loads((P/'state.json').read_text(encoding='utf-8'))
rows=list(s['records'].values());assert all(r['status']!='running' for r in rows)
def stamp(value):return dt.datetime.fromisoformat(value)
def merged(intervals):
 out=[]
 for a,b in sorted(intervals):
  if out and a<=out[-1][1]:out[-1]=(out[-1][0],max(b,out[-1][1]))
  else:out.append((a,b))
 return sum((b-a).total_seconds() for a,b in out)
def executor(row):
 if row['agent']=='main' or row['invocation'].startswith('coordinator'):return 'main'
 if row['invocation']=='gateway-2':return '/root/gateway_retry'
 if row['invocation']=='ui-2':return '/root/ui_retry'
 return '/root/'+row['agent'].replace('-','_')
intervals=[(stamp(r['start']),stamp(r['end']))for r in rows]
per={}
for r in rows:per.setdefault(executor(r),[]).append((stamp(r['start']),stamp(r['end'])))
span=(max(b for _,b in intervals)-min(a for a,_ in intervals)).total_seconds()
summed=sum(merged(v)for v in per.values());overlap=merged(intervals);raw=sum(r['elapsed_seconds']for r in rows)
lines=['# Pre-review resource report','',f'Calendar span: {span:.3f} seconds. Summed actual-agent elapsed (same-executor overlap deduplicated): {summed:.3f} seconds. Overlap-aware elapsed across agents: {overlap:.3f} seconds. Raw logical-interval sum (not actual-agent total): {raw:.3f} seconds.','',
'Boundaries are coordinator-observed and include scheduling, waiting and an unknown idle period across the user continuation/account limit. No precise inactive/model-computation duration is inferred. Initial read-only bootstrap and final report/response rendering are outside their respective finished intervals.','',
'| Stage / logical owner / invocation | Actual executor | Selected model / effort | Start UTC | End UTC | Seconds | Outcome |',
'| --- | --- | --- | --- | --- | --- | ---: | --- |']
for r in rows:lines.append(f"| {r['stage']} / {r['agent']} / {r['invocation']} | {executor(r)} | {r['selected_model']} / {r['selected_effort']} | {r['start']} | {r['end']} | {r['elapsed_seconds']:.3f} | {r['status']} |")
lines+=['','Exact record-aligned input/output/cache/tool/retry counters and observed model/effort are unavailable. Captured runtime deltas are sampled windows with lagging cutoffs; they are not imported into logical ownership records. Coordinator takeover rows run on the same actual main thread, so neither tokens nor elapsed time is duplicated as independent agents.','',
'Main and descendant sampled evidence is in the external MP4 sessions collector files. Cache is already included in input and reasoning in output. No billing, model-computation or workflow-savings claim is made. Product AI usage is separate from these development-agent measurements.','',
'Historical independent security design review is in the earlier preparation run; its elapsed/tokens are not added to this execution run. Independent implementation review is unstarted by user instruction.']
(P/'reports/resources.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
external=pathlib.Path('C:/Users/User/Documents/NUS/CS3227/MP4 sessions/local-resource-tracking')
sample=json.loads((external/'2026-10-26-patch-risk-execution-final-delta.json').read_text(encoding='utf-8'))
lines+=['','## Sampled development token window','',
'Cumulative baseline: 2026-10-26-patch-risk-resume-compile-start.json. Delta report: 2026-10-26-patch-risk-execution-final-delta.json. Distinct thread rows are included once; main plus descendant aggregate values are never also assigned to main. These are execution-window samples, not exact stage imports.','',
'| Thread / agent | Input | Cached subset | Output including reasoning | Cutoff UTC |','| --- | ---: | ---: | ---: | --- |']
for tid,row in sample['sessions'].items():
 u=row.get('usage',{});lines.append(f"| {row.get('agent')} / {tid} | {u.get('input_tokens','unavailable')} | {u.get('cached_input_tokens','unavailable')} | {u.get('output_tokens','unavailable')} | {row.get('cutoff','unavailable')} |")
lines+=['',f"Collector coverage: {sample.get('session_count')} distinct sessions; source is local event_msg/token_count telemetry. Skipped headers: {sample.get('skipped_session_headers')}. Sampled at {sample.get('sampled_at')}. Earlier security thread is present with zero new usage in this window. Missing/lagging events and the final response remain outside the sample."]
(external/'2026-10-26-patch-risk-execution-resources.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps({'calendar_seconds':span,'summed_actual_agent_seconds':summed,'overlap_aware_seconds':overlap,'raw_logical_interval_seconds':raw,'finished_records':len(rows)},indent=2))
