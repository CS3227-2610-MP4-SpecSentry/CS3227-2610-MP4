"""Prepare exact, agent-only local-counter deltas for existing resource records."""
import json
from pathlib import Path

RUN = Path(__file__).resolve().parent
EXTERNAL = Path('C:/Users/User/Documents/NUS/CS3227/MP4 sessions/local-resource-tracking')
SPECS = [
    ('main-integration-interrupted', 'rec-c1dee73208e444c8', 'main', 'i2-foundation-end-cumulative.json', 'i2-integration-recovery-cutoff.json'),
    ('main-integration-recovery', 'rec-917db1a6d6534fb6', 'main', 'i2-integration-recovery-cutoff.json', 'i2-ready-review.json'),
    ('main-review-coordination', 'rec-7d87282575ee45de', 'main', 'i2-ready-review.json', 'i2-review-findings-cutoff.json'),
    ('main-security-fix', 'rec-0009a0a9bc7e406a', 'main', 'i2-review-findings-cutoff.json', 'i2-fixes-complete.json'),
    ('lifecycle-races-fix', 'rec-8c029ecaa35a449a', '/root/lifecycle', 'i2-lifecycle-races-start.json', 'i2-lifecycle-races-end.json'),
    ('lifecycle-reopen-fix', 'rec-4a51441ad3544afc', '/root/lifecycle', 'i2-review-findings-cutoff.json', 'i2-fixes-complete.json'),
    ('independent-initial-review', 'rec-dabe716321514ad1', '/root/security_review', 'i2-ready-review.json', 'i2-review-initial-complete.json'),
]


def prepare(name, record, agent, start, end):
    before = next(row for row in json.loads((EXTERNAL / start).read_text())['sessions'].values() if row['agent'] == agent)
    after = next(row for row in json.loads((EXTERNAL / end).read_text())['sessions'].values() if row['agent'] == agent)
    values = {key: after['usage'][key] - before['usage'][key]
              for key in ('input_tokens', 'output_tokens', 'cached_input_tokens')}
    assert all(value >= 0 for value in values.values())
    result = {
        'record_id': record, 'import_id': name + '-usage', 'scope': 'record',
        'source': f'MP4 sessions/local-resource-tracking/{start} -> {end}; ONLY {agent}; cutoff {after.get("cutoff")}. '
                  'Sample excludes unflushed events, boundary bookkeeping and final rendering. Cache/reasoning subsets not added.',
        'input_tokens': values['input_tokens'], 'output_tokens': values['output_tokens'],
        'cache_read_tokens': values['cached_input_tokens'], 'tool_calls': None, 'retries': None,
        'observed_model': 'gpt-6.1-sol', 'observed_effort': 'medium' if agent == '/root/ui' else 'high',
        'unavailable_reasons': {'tool_calls': 'Attributable full aggregate unavailable', 'retries': 'Runtime retry aggregate unavailable'},
    }
    (RUN / (name + '-usage.json')).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')


if __name__ == '__main__':
    for spec in SPECS:
        prepare(*spec)
    print(f'Prepared {len(SPECS)} stage-only imports; existing runtime records unchanged.')
