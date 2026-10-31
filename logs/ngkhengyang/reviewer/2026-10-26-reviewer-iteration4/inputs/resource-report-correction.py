"""Preserve initial rendering and correct elapsed aggregation; never edit raw records."""
import ast
import json
import subprocess
import sys
from datetime import datetime
from pathlib import Path

root=Path(__file__).resolve().parents[5]
run=Path(__file__).resolve().parents[1]
reports=run/'reports'
cli=[sys.executable,'-B',str(root/'workflow/reviewer/scripts/workflow.py'),'--run',str(run.relative_to(root))]
external=Path('C:/Users/User/Documents/NUS/CS3227/MP4 sessions/local-resource-tracking')

def call(argv,allowed=(0,)):
    p=subprocess.run(argv,cwd=root,capture_output=True,text=True)
    if p.returncode not in allowed:raise RuntimeError(p.stderr or p.stdout)
    return p

# Extract only the pure aggregation function: do not replay the one-shot closer.
tree=ast.parse((run/'inputs/close-preparation.py').read_text())
function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='stats')
namespace={'datetime':datetime}
exec(compile(ast.Module(body=[function],type_ignores=[]),'<stats>','exec'),namespace)
stats=namespace['stats']
state=json.loads((run/'state.json').read_text())
prep=[r for r in state['records'].values() if r['stage']!='document']
numbers=stats(prep)
assert numbers['calendar_seconds']==1112.735164
assert numbers['merged_interval_seconds']<=numbers['calendar_seconds']
assert not call(['git','diff','--name-only']).stdout.strip()
assert not call(['git','diff','--cached','--name-only']).stdout.strip()
call(['git','diff','--check'])
for name in ('resource-totals.json','resources.md','pause-bundle.json','pause-report.md'):
    (reports/('initial-render-'+name)).write_bytes((reports/name).read_bytes())
call(cli+['finish','--id','rec-9803ce6873874ca1','--status','succeeded','--outcome',
 'Corrected report-only min/max calendar aggregation, validated nested-interval arithmetic and preserved initial render/raw records; no product changes',
 '--unavailable-reason','Exact aligned model/token/cache/tool/retry telemetry unavailable; separate sampled window retained'])
call([sys.executable,'-B',str(external/'codex_usage.py'),'--thread','01a178d0-4871-7153-adda-0edfbc659cd7',
 '--baseline',str(external/'iteration4-01a178d0-render-correction-start.json'),
 '--output',str(external/'iteration4-01a178d0-render-correction-end.json')])
state=json.loads((run/'state.json').read_text()); rows=list(state['records'].values())
assert all(r['status']!='running' for r in rows)
totals={'preparation_excluding_later_documentation':stats(prep),
 'all_recorded_including_consolidation_and_correction':stats(rows),
 'record_count':len(rows),'actual_agents':3,'failed_attempts':1,'running_records':0,
 'exact_token_imports':0,'correction':'Initial renderer used last-started interval end; corrected calendar to latest end minus earliest start. Initial renders and raw intervals retained.'}
for value in totals.values():
    if isinstance(value,dict):assert value['merged_interval_seconds']<=value['calendar_seconds']+1e-6
(reports/'resource-totals.json').write_text(json.dumps(totals,indent=2)+'\n')
lines=['# Preparation and separate documentation resource report','',
 'Canonical source: ../state.json; six actual stage/attempt records, three agents. Times are UTC (Asia/Singapore UTC+08:00). Elapsed includes coordination/tools/waits; active computation unavailable.', '',
 '| Agent / stage / invocation | Selected model / effort | Start / end UTC | Elapsed seconds | Outcome |',
 '| --- | --- | --- | ---: | --- |']
for r in rows:
    lines.append(f"| {r['agent']} / {r['stage']} / {r['invocation']} | {r['selected_model']} / {r['selected_effort']} | {r['start']} / {r['end']} | {r['elapsed_seconds']:.6f} | {r['status']} |")
for label,values in totals.items():
    if isinstance(values,dict):lines+=['',label+': '+json.dumps(values)+'.']
lines+=['',totals['correction'],
 'Original preparation totals remain in initial-render-resource-totals.json; initial-render-resources.md and initial-render-pause-bundle.json preserve their historical association. No raw timestamps were changed.', '',
 'Retry/recheck share one actual child. Main compilation overlaps security; summed durations are not wall time or model computation. No causal savings claim is made. Observed model/effort, exact aligned tokens/cache/tools/retries remain unavailable per record. Collector samples lag boundaries and are retained as separate per-thread windows outside Git; no parent-plus-children total is imported into main. Cache is included in input and reasoning in output.', '',
 'See external iteration4-01a178d0-sampled-usage.md for original five sampled windows and iteration4-01a178d0-render-correction-end.json for this correction window. Do not sum overlapping windows. Final generated-report/measurement rendering, local rendered-link checks and the final response occur outside the finished intervals.']
(reports/'resources.md').write_text('\n'.join(lines)+'\n')
p=call(cli+['report','--format','bundle'],(0,1));bundle=json.loads(p.stdout)
(reports/'pause-bundle.json').write_text(json.dumps(bundle,indent=2)+'\n');(reports/'pause-report.md').write_text(bundle['markdown'])
log=root/'logs/ngkhengyang/2026-10-26-reviewer-iteration4.md'
text=log.read_text();text=text.split('\n## Finished resource measurements')[0]
text+='\n## Finished resource measurements\n\n[Canonical resource table](reviewer/2026-10-26-reviewer-iteration4/reports/resources.md), [corrected numerical totals](reviewer/2026-10-26-reviewer-iteration4/reports/resource-totals.json), [preserved initial totals](reviewer/2026-10-26-reviewer-iteration4/reports/initial-render-resource-totals.json), and [external sampled usage](<'+(external/'iteration4-01a178d0-sampled-usage.md').as_posix()+'>) supply boundaries and measurement caveats. The separate correction sample is [retained here](<'+(external/'iteration4-01a178d0-render-correction-end.json').as_posix()+'>).\n\n'
for label,values in totals.items():
    if isinstance(values,dict):text+=f"- {label}: calendar **{values['calendar_seconds']:.3f}s**; merged interval coverage **{values['merged_interval_seconds']:.3f}s**; summed agent elapsed **{values['summed_agent_elapsed_seconds']:.3f}s**.\n"
text+='\nAll six intervals are finished: five succeeded; the capacity-failed security attempt remains failed. Preparation excludes both later main documentation intervals. Exact stage token/cache imports remain null because sample cutoffs lag recorder boundaries; sampled per-thread windows are not summed or duplicated. Tool/retry/active-computation and observed model/effort are unavailable. Initial instruction discovery/recorder bootstrap preceded measurement; final report/resource/measurement rendering, rendered-link checks and this response occur outside finished boundaries.\n'
log.write_text(text,encoding='utf-8')
v=json.loads((reports/'preparation-validation.json').read_text());v['resource_arithmetic']='passed latest-end/earliest-start and merged<=calendar; initial render preserved';v['finished_resource_records']=6
(reports/'preparation-validation.json').write_text(json.dumps(v,indent=2)+'\n')
print(json.dumps(totals,indent=2))
