"""Read-only checks of this run's final evidence and declared change ownership."""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from urllib.parse import unquote

root = Path.cwd().resolve()
folder = root / 'logs/ngkhengyang/reviewer/2026-10-25-reviewer-intake'
os.environ.update(GIT_CONFIG_COUNT='1', GIT_CONFIG_KEY_0='safe.directory',
                  GIT_CONFIG_VALUE_0=root.as_posix())
sys.path.insert(0, str(root / 'workflow/reviewer/scripts'))
from core import Run
from evidence import handoff_is_valid, snapshot_matches

run = Run(root, folder)
state = run.state()
assert snapshot_matches(run, 'final-source-1'), 'Final tested source changed'
assert snapshot_matches(run, 'final-review-state'), 'Final reviewed state changed'
assert all(finding['status'] == 'closed' for finding in state['findings'].values())
assert len(state['records']) == len(state['expected'])
for expected in state['expected'].values():
    assert expected['record_id'] in state['records']
for record in state['records'].values():
    assert record['status'] in {'succeeded', 'failed', 'interrupted'} or (
        record['agent'] == 'main' and record['stage'] == 'close'
        and record['status'] == 'running'
    ), record['id']
for identifier, handoff in state['handoffs'].items():
    if not handoff.get('superseded_by'):
        assert handoff_is_valid(run, identifier), identifier

owned = [path.casefold() for assignment in state['assignments'].values()
         for path in assignment['paths']]
tracked = subprocess.check_output(['git', 'diff', '--name-only', 'HEAD'], text=True).splitlines()
untracked = subprocess.check_output(
    ['git', 'ls-files', '--others', '--exclude-standard'], text=True).splitlines()
changed = sorted(set(tracked + untracked))
for path in changed:
    if path.startswith('logs/ngkhengyang/resources/2026-10-25-local-token-tracking/'):
        continue  # Pre-existing unrelated evidence, explicitly preserved.
    lower = path.casefold()
    assert any(lower == prefix or lower.startswith(prefix + '/') for prefix in owned), path

for markdown in [root / 'logs/ngkhengyang/2026-10-25-reviewer-intake.md',
                 *folder.glob('*.md'), *folder.glob('handoffs/*.md')]:
    for match in re.finditer(r'\[[^\]]+\]\(([^)]+)\)', markdown.read_text(encoding='utf-8')):
        target = unquote(match.group(1).strip('<>').split('#', 1)[0])
        if not target or '://' in target:
            continue
        assert (markdown.parent / target).resolve().exists(), (markdown.name, target)

subprocess.run(['git', 'diff', '--check'], check=True)
print(json.dumps({
    'result': 'PASS', 'changed_paths': len(changed),
    'findings_closed': len(state['findings']),
    'checks': ['tested/reviewed state current', 'all findings closed',
               'resource registry matches invocations', 'current handoffs valid',
               'changes within declared ownership', 'local log links resolve',
               'diff whitespace clean'],
    'limitation': 'Structural evidence check; behavioral evidence comes from tests and independent review.'
}, indent=2))
