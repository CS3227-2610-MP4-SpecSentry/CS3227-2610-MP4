# Reviewer workflow efficiency changes

## Context and requests

- Prompter: `ngkhengyang`, inferred from repository Git `user.name`; 26 October 2026, Asia/Singapore.
- Request: “Now implement the workflow changes.” This refers to the three preceding recommendations: focused integration context/responsibility, operation-local validation reuse and shared report generation, and scoped evidence with atomic finalization.
- Scope: standalone developer workflow/harness changes, separate from the completed Patch Risk Assistant iteration. Product behavior and historical run records are unchanged. No subagents were dispatched for this localized harness change.
- Starting revision: `003cc6fb206bf652299831eb5bbfe291bbcad6e8`; the working tree was clean before resource recording. Earlier analysis/recommendation and commit-message prompts caused no edits in this change interval.

## Changes and evidence

1. **Focused integration:** updated `workflow/reviewer/IMPLEMENTATION.md`, `README.md` and `agents/MAIN.md`; added `agents/INTEGRATOR.md`. Substantial assembled work uses one focused executor with contracts, completions, permitted wiring paths, checks/environment, escalation and stop conditions. The main agent remains accountable and handles decisions rather than duplicating execution. Local work may integrate directly. Original owners or explicitly assigned replacements handle substantive implementation. Verification batches shared prerequisites; forced reruns have an external-state reason. Combined main/integrator consumption and time remain the evaluation target.
2. **Validation reuse:** added `scripts/validation.py`, used by snapshot/handoff validation, readiness, completeness and report generation. State, distinct selected scopes and check outcomes are reused inside one operation. A full second content/Git/path/artifact/state check at the return boundary rejects concurrent changes; there is no cross-command cache or stat-only freshness shortcut. `report --format bundle` emits JSON consistency and Markdown from one validated view; its resource summary uses that same state.
3. **Scoped finalization:** `completion-refresh` appends linked completion/handoff evidence for identical current selected content, retaining the original implementation record. Changed content, missing check coverage and newer implementation/fix attempts are rejected. `finding close-batch` validates every transition before one atomic state update and handles exact retries without duplicate history. Individual finding transitions remain available. Guidance separates application, requirement/contract and documentation scopes without exempting changed requirements or documentation from impact/conformance review.
4. **Review independence:** `start --stage integrate --changes-code` records wiring authorship. Such integrators count as code authors for independence and owner-change closure timing; inspection-only integration remains distinct. The new integration guidance requires this marker for intervals permitting edits. Authorship/ownership are declared local evidence, not runtime authentication or filesystem enforcement.

Affected scripts: `checks.py`, `completion.py`, `evidence.py`, `planning.py`, `recording.py`, new `validation.py`. Tests added to `test_checks.py`, `test_evidence.py`, `test_recording.py`, `test_v3.py`. CLI examples and limits are documented in `scripts/V3.md` and `scripts/README.md`. No product sources, contracts, migration files or acceptance tests changed.

## Validation

- First regression pass: `python -B -m unittest discover -s workflow/reviewer/tests -v`: **82 tests, OK, 3 skipped**, 213.607 seconds. This preceded the additional integration-authorship guard.
- Final regression pass: `python -B -m unittest discover -s workflow/reviewer/tests -v`: **85 tests, OK, 3 skipped**, 215.987 seconds. All added authorship, refresh, bundle, batch and cache regressions passed.
- Initial and final `git diff --check`: passed. CLI help smoke checks for `finding close-batch` and `completion-refresh`: passed. Existing Git LF/CRLF conversion warnings do not indicate whitespace errors.
- Regression coverage includes operation-local scope reuse; same-size edits with restored mtime; added/untracked/deleted files; HEAD/index changes; artifact/run-state changes; batch rollback, idempotency and reopening; refreshed command coverage and newer-attempt rejection; bundle result consistency and deduplicated acceptance checks. Symlink tests are skipped where Windows denies symlink creation; existing containment guards remain active.
- This is an implementation self-check, not an independent review claim. Product database/browser suites are outside the changed harness scope. Historical failures, findings, resources and run state remain intact.

### Frozen-run validation probe

Read-only comparison using the canonical historical run at `logs/ngkhengyang/reviewer/2026-10-26-patch-risk-i3-implementation`, current HEAD `003cc6fb206bf652299831eb5bbfe291bbcad6e8`. In one Python process, wrap `evidence._snapshot` to count calls; time `checks.check_run(run)` (cached, including return-boundary rechecks), then `checks._check_run(run)` on the ordinary uncached `Run`. Assert exact result equality and unchanged `state.json` bytes. No product checks or record mutations were performed.

| Validator | Elapsed seconds | Snapshot builds | Result |
| --- | ---: | ---: | --- |
| Operation-local view | 21.771058 | 28 | Incomplete, 173 errors |
| Uncached validation body | 87.889747 | 163 | Exactly the same result |

The historical evidence is stale against the current commit; this comparison establishes equal diagnostics, not current product certification. Observed validation time fell approximately 75.2% (4.04 times faster); snapshot builds fell 82.8%. The return guard intentionally rebuilds each distinct scope a second time to detect concurrent changes. One ordered probe, filesystem warmth and concurrent disposable harness tests limit timing generalization. This does not measure future integration-agent tokens, end-to-end time, monetary cost or quota savings.

### Self-check against the requested behavior

| Criterion | Implementation / evidence |
| --- | --- |
| Focused integration and bounded responsibility | Dedicated integrator guidance and one-executor rule; no mirrored main-agent execution; explicit original-owner/replacement decisions |
| Reduce repeated validation without stale approval | Operation-local view, full return-boundary content/artifact/state check; scope/check-count and mutation regression tests |
| Shared final report | Bundle consistency equals standalone validation; Markdown and resource summary use the same read view |
| Administrative evidence does not look like a code fix | Identical-content completion refresh retains original interval; newer attempts and changed content are rejected |
| Atomic, repeatable closure | Batch rollback and exact-retry tests; existing reopening, timing, freshness and independence guards retained |
| Wiring retains independent review | Explicit integration authorship marker, self-review rejection and later-owner-wiring invalidation tests |

Local links checked in all seven changed/new guide/log documents: no missing targets. This self-check found the integration-authorship omission during implementation; it was corrected before the final regression pass. There were no failed test attempts in this change session.

## Resource record

The shared recorder started before the first repository edit. Records are under [resources/2026-10-26-workflow-efficiency](resources/2026-10-26-workflow-efficiency). The implementation interval includes the first regression pass; the expanded final suite spans the implementation/validation boundary. Validation includes the comparison, result collection and closure checks. These are elapsed boundaries, including tool/wait time, not active model-computation measurements.

| Stage / agent / invocation | Selected model / effort | Start / end (UTC, 2026-10-26) | Elapsed seconds | Usage / outcome |
| --- | --- | --- | ---: | --- |
| design / main / main-1 | unavailable / unavailable | 14:57:21.603250 / 14:59:25.098746 | 123.495496 | unavailable; succeeded |
| implement / main / main-1 | unavailable / unavailable | 14:59:25.298598 / 15:11:30.402045 | 725.103447 | unavailable; succeeded |
| validate / main / main-1 | unavailable / unavailable | 15:11:30.617204 / 15:14:53.487915 | 202.870711 | unavailable; succeeded |

Reports: `resource-session.py --name ngkhengyang --session 2026-10-26-workflow-efficiency report` and `report --markdown`. All three intervals finished successfully. Recorded span: **1,051.884665 seconds (17m31.9s)**; summed agent elapsed: **1,051.469654 seconds**. No concurrent agent intervals. Preliminary instruction/tool discovery before recording and final measurement rendering/response are outside this boundary.

Record references: [design](resources/2026-10-26-workflow-efficiency/dab32b94fbe142d6b8ee6acf25d61e60.json), [implementation](resources/2026-10-26-workflow-efficiency/70c5001016de46fc9774e63aec189754.json), [validation](resources/2026-10-26-workflow-efficiency/56b116be46ab4ce9992d4cb89c4eec32.json).

Selected/observed model and effort, attributable input/output/cache counters and tool/retry counters are unavailable through the per-stage runtime interface and remain null with reasons. No prior-window totals, account percentages or hypothetical estimates are imported. The returned resource table is reproduced above; final measurement rendering and the response lie outside finished intervals.
