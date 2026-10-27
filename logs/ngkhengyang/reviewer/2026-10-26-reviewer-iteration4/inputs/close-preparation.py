"""Validate paused preparation, close its document interval, render evidence once."""
import hashlib
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[5]
RUN = Path(__file__).resolve().parents[1]
REPORTS = RUN / 'reports'
LOG = ROOT / 'logs/ngkhengyang/2026-10-26-reviewer-iteration4.md'
EXTERNAL = Path('C:/Users/User/Documents/NUS/CS3227/MP4 sessions/local-resource-tracking')
CLI = [sys.executable, '-B', str(ROOT / 'workflow/reviewer/scripts/workflow.py'), '--run', str(RUN.relative_to(ROOT))]

def call(args, expected=(0,)):
    p = subprocess.run(args, cwd=ROOT, capture_output=True, text=True)
    if p.returncode not in expected:
        raise RuntimeError(p.stderr or p.stdout)
    return p

def save(name, value):
    (REPORTS / name).write_text(json.dumps(value, indent=2) + '\n', encoding='utf-8')

state = json.loads((RUN / 'state.json').read_text())
assert len(state['assignments']) == 4
assert len(state['acceptance_matrices'][-1]['cases']) == 49
assert len(state['verification_checks']) == 12
assert not any(row['stage'] in ('implement', 'fix', 'integrate', 'review', 'revalidate') for row in state['records'].values())
assert [key for key, row in state['records'].items() if row['status']=='running'] == ['rec-aaec6cce8efa4e04']
manifest = json.loads((REPORTS/'preparation-manifest.json').read_text())
for path, digest in manifest['paths'].items():
    assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest() == digest, path
assert call(['git','rev-parse','HEAD']).stdout.strip() == manifest['baseline_head']
assert not call(['git','diff','--name-only']).stdout.strip()
assert not call(['git','diff','--cached','--name-only']).stdout.strip()
for path in call(['git','ls-files','--others','--exclude-standard']).stdout.splitlines():
    assert path == str(LOG.relative_to(ROOT)).replace('\\','/') or path.startswith(str(RUN.relative_to(ROOT)).replace('\\','/')+'/'), path
call(['git','diff','--check'])
for key in state['handoffs']:
    call(CLI+['handoff','validate','--id',key])
for check in ('runtime','database-preflight','browser-runtime','baseline-fixture'):
    entries = [key for key,row in state['verification_runs'].items() if row['check']==check]
    assert entries and state['commands'][entries[-1]]['passed']
validation = {'ok':True,'scope':'Preparation/source identity, disjoint declared ownership,49 planned cases, prerequisite results and six handoff formats; no product acceptance execution.',
 'head':manifest['baseline_head'],'product_changed_paths':[],'implementation_records':0,'cases':49,'checks':12,
 'handoffs':len(state['handoffs']),'manifest_paths':len(manifest['paths']),
 'fixture_check':'verify-d8bb57a1cb33401a','foundation_readiness':'passed before requested pause; refresh on resumption',
 'dependent_readiness':'blocked on current successful implementation dependencies',
 'security_gate':'independently passed final design hashes; no code/security certification'}
save('preparation-validation.json',validation)

# This is the actual close boundary after validation. Subsequent operations render
# reports/finished measurements and check their links; that tail is disclosed.
call(CLI+['finish','--id','rec-aaec6cce8efa4e04','--status','succeeded','--outcome',
 'Consolidated preparation, all agent attempts and independent design controls; validated source identity, plan and handoffs; paused before implementation',
 '--unavailable-reason','Exact aligned stage tokens/model/tool/retry counters unavailable; sampled external thread windows and cutoffs retained'])
end_name='iteration4-01a178d0-consolidation-end.json'
call([sys.executable,'-B',str(EXTERNAL/'codex_usage.py'),'--thread','01a178d0-4871-7153-adda-0edfbc659cd7',
 '--baseline',str(EXTERNAL/'iteration4-01a178d0-consolidation-start.json'),'--output',str(EXTERNAL/end_name)])
bundle_run=call(CLI+['report','--format','bundle'],(0,1))
bundle=json.loads(bundle_run.stdout)
save('pause-bundle.json',bundle)
(REPORTS/'pause-report.md').write_text(bundle['markdown'],encoding='utf-8')
state=json.loads((RUN/'state.json').read_text())
records=list(state['records'].values())
assert all(row['status']!='running' for row in records)

def stats(rows):
    spans=sorted((datetime.fromisoformat(r['start']),datetime.fromisoformat(r['end'])) for r in rows)
    merged=[]
    for a,b in spans:
        if merged and a<=merged[-1][1]:merged[-1]=(merged[-1][0],max(b,merged[-1][1]))
        else:merged.append((a,b))
    return {'calendar_seconds':(max(b for _,b in spans)-min(a for a,_ in spans)).total_seconds(),
     'summed_agent_elapsed_seconds':sum(r['elapsed_seconds'] for r in rows),
     'merged_interval_seconds':sum((b-a).total_seconds() for a,b in merged)}

prep=[row for row in records if row['stage']!='document']
summary={'preparation_excluding_consolidation':stats(prep),'all_recorded_including_consolidation':stats(records),
 'record_count':len(records),'actual_agents':3,'failed_attempts':1,'running_records':0,
 'exact_token_imports':0,'reason':'Collector cutoffs lag recorder boundaries; only sampled per-thread windows are available. No cumulative parent-plus-child attribution.'}
save('resource-totals.json',summary)
lines=['# Preparation and consolidation resource report','',
 'Canonical source: ../state.json. Elapsed includes coordination, tools and waits; active model computation is unavailable. All times below are UTC; Asia/Singapore is UTC+08:00.', '',
 '| Agent / stage / invocation | Selected model / effort | Start / end UTC | Elapsed seconds | Outcome |',
 '| --- | --- | --- | ---: | --- |']
for row in records:
    lines.append(f"| {row['agent']} / {row['stage']} / {row['invocation']} | {row['selected_model']} / {row['selected_effort']} | {row['start']} / {row['end']} | {row['elapsed_seconds']:.6f} | {row['status']} |")
lines+=['', 'Preparation excluding later consolidation: '+json.dumps(summary['preparation_excluding_consolidation'])+'.',
 'All recorded boundaries including separate consolidation: '+json.dumps(summary['all_recorded_including_consolidation'])+'.', '',
 'Three actual agents; retry and recheck are the same child chat. Main compilation overlaps read-only security, so summed elapsed differs from calendar/merged coverage. No same-agent overlapping logical ownership intervals were created. These are elapsed measurements, not causal time saved.', '',
 'Exact input/output/cache/tool/retry counters and observed model/effort remain unavailable per record. Selected child settings are declared; main settings are not exposed. External samples provide per-thread counters and explicit cutoffs without importing them into misaligned records. Cached input is within input; reasoning within output. No account percentages, monetary estimates or whole-thread totals are attributed to multiple stages.', '',
 'Initial instruction discovery/recorder bootstrap preceded the first measured interval. Final bundle/resource/log rendering, link checks on rendered outputs and final response lie outside the finished consolidation interval. No implementation timing exists.']
(REPORTS/'resources.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')

samples=['main-compile-end','security-attempt1-end','security-attempt2-end','security-recheck-end','consolidation-end']
usage_lines=['# Iteration 4 sampled runtime usage windows','',
 'Samples are not exact recorder-stage imports: event cutoffs may lag both endpoints. Windows overlap; do not sum rows across windows. New descendants use cumulative counters once in each window. Cache is included in input and reasoning in output. Only per-thread rows are shown; no parent-plus-child total is imported into main.', '',
 '| Window | Thread / agent | Input | Output | Cached input (included) | Baseline cutoff / end cutoff UTC |',
 '| --- | --- | ---: | ---: | ---: | --- |']
for sample in samples:
    file=EXTERNAL/('iteration4-01a178d0-'+sample+'.json')
    data=json.loads(file.read_text())
    for thread,row in data['sessions'].items():
        u=row.get('usage') or {}
        usage_lines.append(f"| {sample} | {thread} / {row.get('agent')} | {u.get('input_tokens','unavailable')} | {u.get('output_tokens','unavailable')} | {u.get('cached_input_tokens','unavailable')} | {row.get('baseline_cutoff','new descendant')} / {row.get('cutoff','unavailable')} |")
usage_lines+=['','Source cumulative baselines and deltas: fresh `iteration4-01a178d0-*.json` files in this directory. All new collector files are outside Git. Final report/response tokens after each cutoff are excluded; null/unavailable differs from zero observed delta. Exact active-compute/tool/retry metrics are unavailable.']
external_report=EXTERNAL/'iteration4-01a178d0-sampled-usage.md'
external_report.write_text('\n'.join(usage_lines)+'\n',encoding='utf-8')

resource_section='\n## Finished resource measurements\n\n'
resource_section+='[Canonical resource table](reviewer/2026-10-26-reviewer-iteration4/reports/resources.md), [numerical totals](reviewer/2026-10-26-reviewer-iteration4/reports/resource-totals.json), and [external sampled usage](<'+external_report.as_posix()+'>) provide all five measured stages/attempts with sources, coverage and cutoffs.\n\n'
for label,values in summary.items():
    if isinstance(values,dict):resource_section+=f"- {label}: calendar **{values['calendar_seconds']:.3f}s**; merged interval coverage **{values['merged_interval_seconds']:.3f}s**; summed agent elapsed **{values['summed_agent_elapsed_seconds']:.3f}s**.\n"
resource_section+='\nAll five intervals are finished: four succeeded and the original capacity-failed security attempt remains failed. Three actual agents participated. Exactly aligned per-stage token/cache counters remain null; sampled per-thread windows have distinct baseline/end cutoffs and are not summed or imported into overlapping stages. Tool/retry/computation and observed settings remain unavailable with reasons. Final bundle/resource/log rendering, rendered-output link validation and this response lie outside the finished consolidation boundary.\n'
LOG.write_text(LOG.read_text(encoding='utf-8')+resource_section,encoding='utf-8')

missing=[]
docs=[LOG,*RUN.rglob('*.md')]
for doc in docs:
    for match in re.finditer(r'\[[^\]]*\]\((?:<([^>]+)>|([^\s)]+))\)',doc.read_text(encoding='utf-8')):
        target=unquote((match[1] or match[2]).split('#')[0])
        if not target or target.startswith(('http:','https:','codex:','mailto:')):continue
        p=Path(target) if Path(target).is_absolute() else doc.parent/target
        if not p.exists():missing.append({'document':str(doc.relative_to(ROOT)),'target':target})
assert not missing,missing
validation['rendered_document_links']='passed for '+str(len(docs))+' Markdown files'
validation['final_report_exit_code']=bundle_run.returncode
validation['full_iteration_status']='intentionally incomplete; user pause and future work, not feature certification'
validation['running_records']=0
save('preparation-validation.json',validation)
call(['git','diff','--check'])
print(json.dumps({'ok':True,'paused_before_implementation':True,'records':len(records),'matrix_cases':49,
 'bundle_exit_code':bundle_run.returncode,'all_local_links_passed':True,'resource_totals':summary},indent=2))
