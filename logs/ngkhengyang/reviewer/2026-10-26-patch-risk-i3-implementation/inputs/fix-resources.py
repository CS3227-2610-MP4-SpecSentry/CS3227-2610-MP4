"""Derived fix-stage elapsed and sampled counters; does not mutate canonical records."""
import datetime as dt,json,pathlib
r=pathlib.Path('logs/ngkhengyang/reviewer/2026-10-26-patch-risk-i3-implementation')
s=json.loads((r/'state.json').read_text());start=s['records']['rec-052524ce4e724718']['start']
rows=[v for v in s['records'].values() if v['start']>=start]
assert all(v['status']!='running' for v in rows)
def stamp(x):return dt.datetime.fromisoformat(x)
def merged(xs):
 out=[]
 for a,b in sorted(xs):
  if out and a<=out[-1][1]:out[-1]=(out[-1][0],max(b,out[-1][1]))
  else:out.append((a,b))
 return sum((b-a).total_seconds() for a,b in out)
def executor(v):
 if v['agent']=='main' or v['invocation']=='documentation-evidence-refresh':return 'main'
 if v['agent']=='independent-review':return '/root/independent_reviewer'
 if v['agent']=='code-security':return '/root/code_security'
 return {'gateway':'/root/gateway_fixes','ui':'/root/ui_fix','reviewer-integration':'/root/contention_fix'}[v['agent']]
intervals=[(stamp(v['start']),stamp(v['end'])) for v in rows];per={}
for v in rows:per.setdefault(executor(v),[]).append((stamp(v['start']),stamp(v['end'])))
span=(max(b for a,b in intervals)-min(a for a,b in intervals)).total_seconds();raw=sum(v['elapsed_seconds'] for v in rows)
lines=['# Fix and revalidation resources','',f'Calendar span {span:.3f}s; raw logical interval sum {raw:.3f}s; actual-executor summed elapsed {sum(merged(x) for x in per.values()):.3f}s (same-main overlaps deduplicated); overlap-aware elapsed {merged(intervals):.3f}s.','',
'Intervals include coordination, subprocess checking and waiting, not measured active computation. Worker fix intervals extend through coordinator validation. Documentation evidence-refresh ownership rows share main execution; they are not extra workers. Final rendering/reply is outside finished intervals.','',
'| Owner / invocation / stage | Actual executor | Selected model / effort | UTC start | UTC end | Seconds | Status |','| --- | --- | --- | --- | --- | ---: | --- |']
for v in rows:lines.append(f"| {v['agent']} / {v['invocation']} / {v['stage']} | {executor(v)} | {v['selected_model']} / {v['selected_effort']} | {v['start']} | {v['end']} | {v['elapsed_seconds']:.3f} | {v['status']} |")
lines+=['','Exact stage-aligned tokens/cache/tool/retry counts and observed model/effort remain unavailable. Canonical records retain explicit reasons. No aggregate parent-plus-children counters are imported into main.','',
'Earlier implementation attempts including capacity/usage failures are preserved in [pre-review resources](resources.md), [review resources](independent-review-resources.md) and [canonical records](../state.json). They are not reclassified as successful by subsequent completion.','',
'## Sampled current-workflow window','',
'External collector baseline: 2026-10-26-patch-risk-fix1-main-start.json. End delta: 2026-10-26-patch-risk-fix1-final-window.json. Per-stage baselines/end samples are retained alongside it in MP4 sessions/local-resource-tracking; overlapping samples must not be summed. The table below uses one window and each thread once.','',
'| Thread / agent | Input | Cached subset | Output incl reasoning | Cutoff UTC |','| --- | ---: | ---: | ---: | --- |']
e=pathlib.Path('C:/Users/User/Documents/NUS/CS3227/MP4 sessions/local-resource-tracking');sample=json.loads((e/'2026-10-26-patch-risk-fix1-final-window.json').read_text())
for tid,v in sample['sessions'].items():
 u=v.get('usage',{});lines.append(f"| {v.get('agent')} / {tid} | {u.get('input_tokens','unavailable')} | {u.get('cached_input_tokens','unavailable')} | {u.get('output_tokens','unavailable')} | {v.get('cutoff','unavailable')} |")
lines+=['',f"Sampled at {sample.get('sampled_at')}; distinct sessions {sample.get('session_count')}; skipped headers {sample.get('skipped_session_headers')}. Counters can lag; final replies and work after each cutoff are not included. Cache is already a subset of input; reasoning is included in output. These are developer-agent samples, not product provider usage or a billing statement.",'',
'No exact model-computation/idle duration, dollar cost or causal workflow savings are inferred. No explicit token budget was supplied.']
(r/'reports/fix1-resources.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
(e/'2026-10-26-patch-risk-fix1-resources.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps({'intervals':len(rows),'executors':len(per),'calendar_seconds':span,'raw_logical_seconds':raw,'actual_executor_seconds':sum(merged(x) for x in per.values()),'overlap_seconds':merged(intervals)}))
