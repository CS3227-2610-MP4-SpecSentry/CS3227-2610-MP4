# Independent Phase 3 acceptance and visual comparison

Verification used the original workspace, isolated preview5188 and synthetic Chrome fixtures. The same immutable visual harness produced44 baseline and44 final matching screenshots across375/768/1440x1000. Its byte hash still equals the recorded baseline hash. All baseline files, including44 PNGs, are byte-identical after verification; see `baseline-preservation.json`. Historical Phase1/2 evidence and imported harness were not rewritten.

## Results and comparison

- Baseline34/34 and final34/34 visual checks pass, including login, populated/empty Contributor, create/detail/editor/Patch, Reviewer/Maintainer landing, loading/error/notfound, hover/focus/pressed, drawer and200% text. Zero unexpected browser errors or warnings.
- The unmodified48-case Phase1+Phase2 matrix passes through an output-only temporary copy, including guard/history/native unload, version/uncertain recovery, forced session clearance, criteria detail, semantic rows/new tabs, task headers and section navigation. `functional-harness-proof.json` records byte equivalence. This full pass preceded the final CSS-only sibling-field margin; after that declaration all34 visual cases,7 targeted layout/state checks and the focus supplement were rerun. No business/guard source changed after the48 pass.
- Seven additional visual checks pass: truthful pending/error/page counts and cursor navigation, removed duplicate summary cards, primary action visibility, density improvement at three widths, representative token categories, hover/pressed/focus/reduced-motion states, disabled Save hover and enlarged long-patch focus/native scrolling. Count remains page-scoped, including0 for an empty cursor page, loading... and Unavailable on failure.
- Criterion and evidence add/blank-validation/removal focus supplement passes, with default required classification and no request on invalid blank input. No arbitrary focus delays or assertion removals were added.
- Tagged axe WCAG2 A/AA,2.1 AA and2.2 AA checks pass on the stable desktop screens, drawer and enlarged long-patch case. This is partial automated evidence, not full manual WCAG or screen-reader certification.

[Open the44-pair local gallery](comparison.html). Each pair uses identical synthetic data/routes/viewport state; click an image for full size. [Final visual results](after/visual-results.json), [regressions](functional/acceptance-results.json), [postchecks](after/phase3-checks.json), [focus supplement](focus/criterion-focus-results.json).

| Width | Baseline list-panel top | Final list-panel top | Moved upward |
| --- | --- | --- | --- |
|375px|529px|270.06px|258.94px|
|768px|435px|230.06px|204.94px|
|1440px|415px|238.06px|176.94px|

Baseline positions were measured from the saved PNG card border using the frozen12px radius and known content edge; allow about1px raster rounding. Final positions are live DOM bounds. `after/density-metrics.json` retains runs/method and values. These are layout measurements, not invented product statistics or performance savings.

## Attempts, investigation and limitations

Baseline resource2a4121073eb547bea67158d05dc80660 finished before source edits; main independently accepted the gate. Prepare-after resourcead71a3a94bc846f9bbe1f512ca0c5bcd recorded actual preparation/wait and finished before after browsers.

After attempt1 resource038faaa3f42144ab9fe434555657fa43 passed34 checks/44 captures but was interrupted by the final label-first count copy and environment repair; preserved under `attempts/after-1`. Dependency disappearance was investigated by main, and the user confirmed an overlapping npm operation. Verifier performed no dependency cleanup/removal/install. Only the owned5188 process was stopped on request so main could restore identical-lock dependencies; it restarted after main confirmed build success.

After attempt2 resourcefb6855511dc14754bfbb7c871944a5be passed34 visuals,48 regressions and focus, but one of7 additional checks required the entire enlarged textarea to fit a1000px viewport exactly. Diagnostics showed top506.64/bottom1001.39 and Save.bottom357.75: a149px clear gap with only1.39px fractional edge clipping, active field/native textarea scrolling and document scroll0. This was an overstrict geometry assertion, not sticky obscuring. Original failure and JSON/PNG remain under `attempts/after-2`; final check explicitly permits2px edge rounding while requiring focus, sticky clearance and a usable native control. No product fix was requested for that assertion.

Main's P3-SPACE-001 review found a real inter-field spacing omission; implementer added one scoped sibling-field margin. Final resourcebe356589dcf542b99373d7c159637f7f revalidated affected complete visuals/postchecks/focus after main reran113 client tests, lint, all workspace types and build. Main owns those command outcomes and full preservation/index/HEAD evidence.

The focus investigation's controlled Profiler tests reproduced a matching commit-boundary race before the layout-effect correction and passed after it, as recorded by implementer/main. The browser supplement verifies resulting user-visible focus behavior; it does not establish the precise scheduling cause of the historical intermittent test failure. No production instrumentation, arbitrary waits or weakened unit assertions were introduced.

No unresolved blocker in the authorized Phase3 scope. Remaining gaps: live backend/database/cross-role behavior, other browser engines, actual mobile keyboards, complete manual accessibility/screen-reader checks and deployment. Exact model/effort and attributable token/cache/tool/retry telemetry are unavailable; interval JSON supplies measured elapsed time. Final reporting/measurement rendering is outside completed intervals. No commit, push, merge or deployment was performed.
