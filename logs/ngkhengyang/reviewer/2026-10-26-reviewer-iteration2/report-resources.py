"""Derived report of this run's recorded intervals; never edits original state."""
import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
state = json.loads((ROOT / 'state.json').read_text(encoding='utf-8'))
rows = list(state['records'].values())
parse = dt.datetime.fromisoformat


def merged(intervals):
    result = []
    for start, end in sorted(intervals):
        if result and start <= result[-1][1]:
            result[-1] = (result[-1][0], max(result[-1][1], end))
        else:
            result.append((start, end))
    return result


def seconds(intervals):
    return sum((end - start).total_seconds() for start, end in intervals)


finished = [r for r in rows if r.get('end')]
intervals = [(parse(r['start']), parse(r['end'])) for r in finished]
agents = sorted({r['agent'] for r in rows})
per_agent = {}
for agent in agents:
    own = [r for r in rows if r['agent'] == agent]
    own_intervals = [(parse(r['start']), parse(r['end'])) for r in own if r.get('end')]
    per_agent[agent] = {
        'records': len(own), 'raw_elapsed_seconds': sum(r.get('elapsed_seconds') or 0 for r in own),
        'deduplicated_elapsed_seconds': seconds(merged(own_intervals)),
        'input_tokens': sum(r['usage'].get('input_tokens') or 0 for r in own),
        'output_tokens': sum(r['usage'].get('output_tokens') or 0 for r in own),
        'cached_input_included': sum(r['usage'].get('cache_read_tokens') or 0 for r in own),
    }
totals = {metric: sum(r['usage'].get(metric) or 0 for r in rows)
          for metric in ('input_tokens', 'output_tokens', 'cache_read_tokens')}
coverage = {metric: sum(r['usage'].get(metric) is not None for r in rows) for metric in totals}
summary = {
    'records': len(rows), 'finished': len(finished), 'running': [r['id'] for r in rows if not r.get('end')],
    'calendar_span_seconds': (max(e for _, e in intervals) - min(s for s, _ in intervals)).total_seconds(),
    'merged_coverage_seconds': seconds(merged(intervals)),
    'raw_summed_agent_seconds': sum(r.get('elapsed_seconds') or 0 for r in rows),
    'deduplicated_summed_agent_seconds': sum(a['deduplicated_elapsed_seconds'] for a in per_agent.values()),
    'measured_tokens_only': totals, 'token_coverage_records': coverage, 'per_agent': per_agent,
    'limitations': [
        'Elapsed includes tools, waiting and unknown idle; active computation unavailable.',
        'The interrupted main-5 integration interval includes a prolonged runtime/tool delay; do not label it active work.',
        'Merge same-agent intervals to remove nested dispatch timing; its tokens are unavailable and already included in main foundation delta.',
        'Cache is within input; reasoning is within output. Missing counters are unavailable, never measured zero.',
        'Local sampled counters may lag flushes; exact sources/cutoffs remain in state and external MP4 sessions JSON.',
        'Final report/response rendering and separate consolidation are outside implementation-run timing.',
    ],
}
(ROOT / 'resource-analysis.json').write_text(json.dumps(summary, indent=2) + '\n', encoding='utf-8')
lines = ['# Recorded run resources', '',
         'Derived from state.json; original intervals and failed/interrupted attempts are retained. Times are UTC.', '',
         '| Agent / invocation / stage / attempt | Selected model / effort | Start → end UTC | Elapsed seconds | Input / output / cached input | Status |',
         '| --- | --- | --- | ---: | --- | --- |']
for row in rows:
    usage = ' / '.join(f'{row["usage"][key]:,}' if row['usage'].get(key) is not None else 'unavailable'
                       for key in ('input_tokens', 'output_tokens', 'cache_read_tokens'))
    lines.append(f'| {row["agent"]} / {row["invocation"]} / {row["stage"]} / {row["attempt"]} '
                 f'| {row["selected_model"]} / {row["selected_effort"]} | {row["start"]} → {row.get("end")} '
                 f'| {row.get("elapsed_seconds")} | {usage} | {row["status"]} |')
lines += ['', f'Finished: {len(finished)}/{len(rows)}. Calendar span: {summary["calendar_span_seconds"]:.6f}s; '
          f'merged coverage: {summary["merged_coverage_seconds"]:.6f}s. Raw summed elapsed: '
          f'{summary["raw_summed_agent_seconds"]:.6f}s; same-agent overlap deduplicated sum: '
          f'{summary["deduplicated_summed_agent_seconds"]:.6f}s.', '',
          f'Measured input {totals["input_tokens"]:,}, output {totals["output_tokens"]:,}; '
          f'cached input {totals["cache_read_tokens"]:,} is already included. Coverage: {coverage}.', '',
          'Tool/retry aggregate and active computation telemetry are unavailable. Selected/observed settings and '
          'counter cutoff/source details remain in state.json and the linked usage-import JSON files.', '']
lines += ['- ' + item for item in summary['limitations']]
(ROOT / 'resource-analysis.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in summary.items() if k not in ('per_agent', 'limitations')}))
