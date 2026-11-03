# Independent final UI publication verification

Fresh browser execution ran against the CURRENT final application/CSS after main confirmed113 client tests, lint, all workspace typechecks and production build. Original-root preview5189 used an ignored temporary cache and synthetic context-wide HTTP fixtures, including new tabs. User5173/API processes were untouched. No application source, historical evidence or existing browser assertion was edited by this verifier.

## Results

| Suite | Result | Fresh evidence |
| --- | --- | --- |
| Phase1/2 and enlarged recovery regressions |48/48 passed|`functional/acceptance-results.json`|
| Same Phase3 implemented-screen visual matrix |34/34 passed|`visual/visual-results.json`|
| Portable layout/state checks plus row focus |8/8 passed:7 layout/state+1 criterion/evidence focus|`extras/phase3-checks.json`|

Zero unexpected console/page errors and zero console warnings in all three suites. Every suite ran after the final CSS spacing correction; the48-case pass now has no prior-CSS qualification. Coverage retains dirty navigation/history/native unload, saved criteria, sticky recovery/pending duplicates/forced-session clearing, semantic breadcrumbs/rows/new tabs, independent section jumps,375/768/1440 and200% reflow, reduced motion, truthful counts/pagination, disabled hover, long patch focus and criterion/evidence add/validation/removal focus.

New permanent source: `workflow/tests/browser/visual-phase3-checks.mjs`. It combines the previously validated7-case supplemental body and existing focus check body with shared existing fixture code. No new framework or dependency; no product assertion was removed. It has no runtime import from ignored tmp and defaults its outputs to ignored `tmp/browser-checks/visual-phase3`; `UI_CHECK_OUTPUT` selects a fresh evidence directory. Its only retained image inputs are the three `logs/yooplo/resources/2026-10-31-visual-phase3/verification/baseline/empty-{375,768,1440}.png` files. `portable-test-provenance.json` records source/asset hashes and provenance.

The existing48/34 harnesses remain byte-identical. Temporary copies change exactly one output-directory literal each; reverse-substitution equivalence was checked before and after execution. `functional-harness-proof.json` and `visual-harness-proof.json` retain hashes. `validated-source-hashes.json` identifies the application state reviewed.

## Reproduce safely from a checkout

Run from repository root after documented installation/shared build. In one terminal start a separate preview:

```powershell
npm.cmd run dev -w @specsentry/client -- --port 5189
```

In another terminal prepare safe output-only copies (Python is already used by the resource tooling):

```python
from pathlib import Path
folder = Path('tmp/ui-validation')
folder.mkdir(parents=True, exist_ok=True)
pairs = [
    ('navigation-phase2.mjs', b'logs/yooplo/resources/2026-10-31-navigation-phase2/verification', b'tmp/ui-validation/results/functional'),
    ('visual-phase3.mjs', b'logs/yooplo/resources/2026-10-31-visual-phase3/verification/${mode}', b'tmp/ui-validation/results/visual'),
]
for name, old, new in pairs:
    data = (Path('workflow/tests/browser') / name).read_bytes()
    assert data.count(old) == 1
    copied = data.replace(old, new)
    assert copied.replace(new, old) == data
    (folder / name).write_bytes(copied)
```

Then run:

```powershell
$env:UI_BASE_URL='http://127.0.0.1:5189'
node tmp/ui-validation/navigation-phase2.mjs
node tmp/ui-validation/visual-phase3.mjs after
$env:UI_CHECK_OUTPUT='tmp/ui-validation/results/extras'
node workflow/tests/browser/visual-phase3-checks.mjs
```

The actual run used equivalent generated copies under `tmp/ui-spec-publication-browser-20261031`, with outputs under this publication evidence directory. Installed Chrome is required by the verified `channel: chrome` configuration. These commands require no ignored source or test input; the ignored copies/helpers are reproducible outputs derived from committed test source.

## Evidence retention and limits

Fresh JSON result screenshot filenames describe ORIGINAL LOCAL CAPTURES. Publication screenshots are redundant with the retained Phase3 before/final gallery and are intentionally kept local/excluded from commit without deletion. They are not required inputs and this report creates no link dependency on those fresh PNGs. Retained visual comparison: [Phase3 before/after gallery](../../2026-10-31-visual-phase3/verification/comparison.html).

No blocker found. Synthetic Chrome only: live backend/database/cross-role persistence, other engines, real mobile keyboards, complete manual WCAG/screen-reader compliance and deployment remain unverified. Main owns specification/link/inventory/staged-manifest checks and commit/push; this verifier did not stage or publish. Resource `f2728dbf97764d9a9c6649805c0ab791` covers preparation/build wait and all browser execution; selected/observed model/effort and attributable token/cache/tool/retry telemetry are unavailable. Final report/resource rendering is outside finished measurements.
