# F-001 independent latency revalidation

F-001 is fixed within the focused C3 reporting scope; independent reviewer `verifier`, invocation `verifier-f001-resume3`, resource record `rec-59390f005e08461b`. No new findings. Prompter ngkhengyang from the assigned packet. Applied specification conformance review and session logging skills; main owns the conversation log. This successor reviewer authored no product or test changes.

Owner completion `evaluation-f001-resume3-complete` / `rec-410a44abf6014abb` was terminal before review stage/snapshot. Reviewed HEAD/base `8707d19b94f1bf00e26564b67c84a0e76eee42f8`, snapshot `verifier-f001-resume3-final`, selected diff SHA-256 `7f5c67d811d7d1a67c68c04d8e8da466a0e647ced263263d249a6f71bc06e5eb`. Helper/test are untracked additions relative to HEAD, so ordinary git diff is empty; inspected their actual full content rather than claiming a tracked diff. Snapshot helper SHA-256 `bac523cf11c94e211bb3fc6259ae22f4e5cce5da47ffb93e899329db5baa0e05`; test `7b9bf7e9a73552e4e6c54270cb2cbbf5d351b1c6598d9f19786ce7ed52ebeb53`. Selected docs are DeveloperGuide and TRACEABILITY; the snapshot records their exact hashes. Packet/procedure and initial source retrieval precede measured baseline and are excluded from stage usage; timing was not reconstructed.

Scope: original [F-001 evidence](verifier-evaluation-latency.md), C3, REQ-REV-003 and [AI evaluation gates](../../../../../workflow/specs/AI-SECURITY-SPEC.md#ai-evaluation-gates). Reused broader [initial review](independent-final.md) and [security review](security-final.md); this change introduces no new trust boundary. Inspected actual helper, existing test assertions, caller CLI, and narrow latency documentation. Source records failure durations in `finally`, filters only null durations, sorts numeric values, averages the middle pair for even counts and uses one-based nearest rank `ceil(.95*n)`. Expected count includes admitted skipped/dry-run cases so missing measurements cannot masquerade as complete coverage. No-sample statistics are null. Strict comparisons implement median <8000ms and p95 <18000ms. Live overall pass requires protocol and latency pass; dry-run retains protocol success and explicitly unavailable latency. CLI already maps overall `passed` to exit status. Docs match this behavior.

Independent compiled-helper probe `verifier-f001-resume3-probe` passed, exit0, using [assert-based CLI input](../inputs/verifier-f001-resume3-probe.cjs); bounded stdout/stderr artifacts are in `commands/`, with canonical results in state. All transport responses were injected locally, zero provider calls. Results:

| Case | Sample / expected | Median ms | p95 ms | Latency | Protocol / overall |
| --- | --- | ---: | ---: | --- | --- |
| Original nine 19s | 9/9 | 19000 | 19000 | FAIL | true / false |
| Fast unsorted samples | 9/9 | 500 | 900 | PASS | true / true |
| Exact median threshold | 9/9 | 8000 | 8000 | FAIL | true / false |
| Exact p95 threshold | 9/9 | 1000 | 18000 | FAIL | true / false |
| Eight samples, eighth HTTP401, ninth skipped | 8/9 | 4500 | 8000 | UNAVAILABLE | false / false |
| Dry run | 0/9 | null | null | UNAVAILABLE | true / true |
| Live, no admitted samples | 0/0 | null | null | UNAVAILABLE | false / false |

Partial sampling independently proves failed attempt inclusion, even median arithmetic and exclusion of skipped/rejected zero placeholders. Re-ran registered `verify --check evaluation-unit --force` with the authorized isolated `specsentry_test` database URL and V3 leases: evaluation `verify-e513c5061552460f`, 15/15 tests, one suite passed. Runner-required offline/PostgreSQL/fixture/shared-build prerequisites also passed (`verify-087a6200413e4756`, `verify-3055e1ffc7894f4e`, `verify-9d2d3875f4e241aa`, `verify-296d4fffd62143d4`). No browser or broad gateway suite rerun. Owner’s current build/lint/typecheck/compiled dry-run evidence is linked by its handoff and not claimed as independently executed here.

Closure uses the successful independent resource record and current selected snapshot through finding close-batch; canonical transition is authoritative. F-001 closure does not close the ordinary full gateway timing/local integration acceptance blocker. Instrumented 51pass and narrow passing checks remain distinct. Genuine BFCache, live SoC compatibility/latency, human usefulness ratings, scheduler/deployed retention, deployment/performance and human teammate/summary verification gates remain unresolved. No full acceptance or provider-performance claim.

Resource selection gpt-6.1-sol/medium: bounded statistical/report-only revalidation with deterministic existing checks. Actual thread `01a1a82d-f58a-7e20-b574-6a6d2c80c694`; outside-Git collector baseline/end `MP4 sessions/local-resource-tracking/verifier-f001-resume3-start.json` and `verifier-f001-resume3-end.json`; aligned import [usage input](../inputs/verifier-f001-resume3-usage.json). Delta: input 515722, cached input 496640 (included), output 3085 (reasoning included), sample cutoff UTC `2026-11-04T20:12:00.876Z`. Initial retrieval, unflushed tail and subsequent evidence/closure/final rendering excluded; tool/retry counters and observed runtime settings unavailable. Record timestamps/elapsed are canonical state fields. Main must not double-count this own-thread delta as parent/descendant totals.

Canonical closure succeeded (`closed: [F-001]`), after record finish and usage import. Generated resource `summary --markdown` after closure; it covers the run's declared records, not new acceptance. This interval's measured elapsed is 194.780489 seconds. This final measurement annotation is outside the measured boundary.

| Agent / stage | Record | Measured elapsed seconds | Input | Cached input (included) | Output |
| --- | --- | ---: | ---: | ---: | ---: |
| verifier / revalidate / verifier-f001-resume3 | rec-59390f005e08461b | 194.780489 | 515722 | 496640 | 3085 |
