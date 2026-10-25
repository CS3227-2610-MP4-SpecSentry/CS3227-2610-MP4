"""Read-only structural checks for the user-requested preparation checkpoint."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys

root = Path.cwd().resolve()
folder = root / 'logs/ngkhengyang/reviewer/2026-10-25-reviewer-intake'
state = json.loads((folder / 'state.json').read_text(encoding='utf-8'))
manifest = json.loads((folder / 'source-manifest-v1.json').read_text(encoding='utf-8-sig'))
for entry in manifest['files']:
    assert hashlib.sha256((root / entry['path']).read_bytes()).hexdigest() == entry['sha256'], entry['path']
assert len(manifest['files']) == 18
assert all(row['stage'] not in {'implement', 'fix', 'integrate', 'review'} for row in state['records'].values())
assert all(row['status'] == 'closed' for row in state['findings'].values())
for row in state['records'].values():
    assert row['status'] == 'succeeded' or (row['agent'] == 'main' and row['stage'] == 'close' and row['status'] == 'running')
assert len(state['expected']) == len(state['records'])
for expected in state['expected'].values():
    assert expected['record_id'] in state['records']

sys.path.insert(0, str(root / 'workflow/reviewer/scripts'))
from core import Run
from evidence import handoff_is_valid, snapshot_matches
run = Run(root, folder)
assert snapshot_matches(run, 'preimplementation-source')
assert len(state['handoffs']) == 8
for hid in state['handoffs']:
    assert handoff_is_valid(run, hid), hid

for markdown in [root / 'logs/ngkhengyang/2026-10-25-reviewer-intake.md', *folder.glob('*.md'), *folder.glob('handoffs/*.md')]:
    for match in re.finditer(r'\[[^\]]+\]\(([^)]+)\)', markdown.read_text(encoding='utf-8')):
        target = match.group(1).strip('<>').split('#', 1)[0]
        if not target or '://' in target:
            continue
        assert (markdown.parent / target).resolve().exists(), (markdown.name, target)

changed = subprocess.check_output(['git', 'diff', '--name-only', 'HEAD'], text=True).splitlines()
assert all(path.startswith('logs/ngkhengyang/') for path in changed), changed
status = subprocess.check_output(['git', 'status', '--porcelain', '--untracked-files=all'], text=True).splitlines()
for line in status:
    path = line[3:]
    assert path == 'logs/ngkhengyang/2026-10-25-reviewer-intake.md' or path.startswith('logs/ngkhengyang/reviewer/2026-10-25-reviewer-intake/'), path
print('PASS: 18 source hashes; unchanged relevant source snapshot; eight pinned valid handoffs; local links; closed design findings; declared resource identities; preparation-only change scope; no implementation stages.')
