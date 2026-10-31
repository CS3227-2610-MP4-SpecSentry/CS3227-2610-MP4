# Compact historical workflow evidence

Prompter: **ngkhengyang**, inferred from Git identity and this established session. Date: 27 October 2026, Asia/Singapore. Applied the repository change-session logging skill. Main runtime identifies the GPT-6 family; exact alias/effort and attributable usage counters are unavailable. No subagents were launched.

## Request and outcome

Following the PR #9 line-count analysis and the explanation of repeated machine state, the user explicitly requested: **"Go ahead and Replace bulky execution state with compact historical evidence summaries."** Scope: the eight completed Reviewer runs already identified in that analysis. This does not change the formats required for new workflow runs.

Replaced **113,218 lines / 5,202,461 bytes** of execution state with **2,409 lines / 1,278,891 bytes** of historical summaries: **110,809 fewer lines (97.9%)** and **3,923,570 fewer bytes (75.4%)**. These measurements cover the eight state files, excluding the small accompanying notices, manifest annotations, this log and resource record. This is substantive removal of embedded per-file manifests and repeated case/path data as well as compact per-record JSON formatting.

| Run | Before lines | Summary lines | Before bytes | Summary bytes |
| --- | ---: | ---: | ---: | ---: |
| [2026-10-25-manual-review](reviewer/2026-10-25-manual-review/state.json) | 1,657 | 128 | 67,877 | 44,719 |
| [2026-10-25-reviewer-intake](reviewer/2026-10-25-reviewer-intake/state.json) | 914 | 126 | 33,881 | 27,525 |
| [2026-10-26-patch-risk-i3](reviewer/2026-10-26-patch-risk-i3/state.json) | 3,767 | 209 | 150,897 | 88,560 |
| [2026-10-26-patch-risk-i3-implementation](reviewer/2026-10-26-patch-risk-i3-implementation/state.json) | 42,193 | 774 | 1,909,784 | 445,282 |
| [2026-10-26-reviewer-iteration2](reviewer/2026-10-26-reviewer-iteration2/state.json) | 5,480 | 154 | 259,420 | 77,741 |
| [2026-10-26-reviewer-iteration4](reviewer/2026-10-26-reviewer-iteration4/state.json) | 3,201 | 187 | 148,989 | 72,601 |
| [2026-10-27-reviewer-iteration4-implementation](reviewer/2026-10-27-reviewer-iteration4-implementation/state.json) | 40,734 | 524 | 1,913,604 | 314,347 |
| [2026-10-27-reviewer-iteration4-review-fixes](reviewer/2026-10-27-reviewer-iteration4-review-fixes/state.json) | 15,272 | 307 | 718,009 | 208,116 |

## What is retained and omitted

- Filenames remain `state.json` to preserve links, but the format explicitly identifies historical evidence and lacks the executable recorder schema. The existing workflow CLI rejects all eight; it was not modified to bypass validation.
- Requirements, ownership/assignments, findings with every reopen/closure and evidence reference, review cycles, expected attempts, commands and failure/supersession histories, completions, original resource records and unavailable telemetry retain their original decoded values.
- Snapshot IDs, timestamps, artifact hashes, source scopes, Git/base/diff fingerprints and file counts remain. Repeated per-file hash manifests are omitted. Intake's existing source-state/snapshot-history summaries and separate resource file are retained.
- Verification definitions retain their fields, with repeated path lists replaced by references to deduplicated `source_scopes`. Final acceptance cases remain once per run. Earlier matrices retain original metadata, case order and field deltas relative to those final cases; all earlier contents can be reconstructed exactly.
- Every summary identifies its original path, working-file and Git-content SHA-256, size/line count, authoritative report and original-source URL. The committed JSON at **62a807d7082410d10192f55196e718018ad08d8a** was checked against every original working payload. Full original manifests/runtime details are recoverable from that Git revision; they are no longer reconstructible solely from the current summaries.
- Historical gate verdicts reference the original reports. Iteration 3's five original invocation issues and Iteration 4's final 34 cross-run acceptance-evidence gaps remain; no fresh pass, deployment, human approval or live-provider acceptance is claimed.

## References and affected files

The [retention index](reviewer/RETAINED-EVIDENCE.md) now covers all eight runs, explains scope references/matrix deltas, Git recovery and the retired automated replay boundary. Seven existing consolidated/cleanup logs received only a dated policy notice; their original bodies were preserved exactly. Existing generated handoffs, reviews, briefs, test outputs and resource evidence were not rewritten.

The three earlier cleanup manifests received an additive `state_compaction_update` annotation. Their original removal entries and checkpoint claims are unchanged; current pointers now identify compact metadata rather than every original payload field. This explicitly supersedes earlier assertions that full original snapshot contents remain in current state.

Updated only reference terminology in [AI Integration](../../docs/AI-Integration.md) and [traceability](../../workflow/TRACEABILITY.md) to describe historical summaries and the replay boundary. No requirement, acceptance claim, product source, test, configuration or workflow implementation changed. Existing one-off historical scripts remain provenance, not supported resumption tools.

## Validation

| Check | Result |
| --- | --- |
| Exact assignments | 32 preserved |
| Exact findings and full closure/reopen histories | 19 preserved |
| Exact original run resource records | 110 preserved |
| Exact command outcomes and supersession | 279 preserved |
| Exact handoff registrations | 84 preserved |
| Verification definitions with scopes expanded | 216 preserved |
| Exact completions | 22 preserved |
| Snapshot revision/scope/hash fingerprints | 273 preserved |
| Historical acceptance matrices | 17 versions / 816 original case rows reconstructed exactly |
| Full original Git payload recovery | 8/8 decoded payloads verified |
| Existing cleanup JSON pointers | 424 resolve |
| Historical format rejected by unchanged CLI | 8/8 as intended |
| Protected source/test/tooling and retained evidence files | 732 byte-for-byte unchanged; only the two declared documentation-reference files differed |
| Report bodies / previous removal entries | Exact preservation after excluding the new notices/retention annotation |

Validation uses decoded original Git blobs as an independent baseline, expands deduplicated scopes and reconstructs original matrix contents. Local-link and final Git-scope/format checks are recorded at closure below. Application suites and historical completeness passes were not rerun: product/harness behavior is unchanged, and these files are deliberately retired from CLI operation.

Two setup checks were corrected before state mutation: a Git blob lookup initially used an absolute rather than repository-relative path; a replacement patch attempted delete/add on the same index path and was rejected. The subsequent read-only lookup and ordinary file update succeeded. Both are included within the measured main-stage interval, with no partial state edits from the failed commands.

## Resources

Shared interval [5b7613200c8b4686b39969de520648d6](resources/2026-10-27-state-summary/5b7613200c8b4686b39969de520648d6.json) started before the first repository edit. Timing includes evaluation, tool retries and validation; attributable input/output/cache/tool/retry counters are unavailable and not estimated. The original run resource totals remain separate from this cleanup. Final measured results are appended after closure; final reporting/response rendering is outside the finished boundary.

Closure checks: **426** local file links in changed/new Markdown were checked, with **zero new broken targets**. The **21** tracked changed files exactly match the declared state/retention/reference scope. Seven historical report bodies and all three original removal manifests match their committed originals after excluding only the new notices/additive annotations. `git diff --check` passed (routine Windows line-ending normalization warnings only). No source, tests, configuration or workflow implementation changed.

### Measured cleanup resources

Shared recorder `report`: **ok=true**, one finished interval, no issues.

| Agent / stage | Selected model / effort | Start / end (UTC) | Elapsed seconds | Input / output / cache / tools / retries | Outcome |
| --- | --- | --- | ---: | --- | --- |
| main / evaluate-compact-validate | GPT-6 / unavailable | 2026-10-27T11:53:55.693087+00:00 / 2026-10-27T12:07:23.415309+00:00 | 807.722222 | unavailable / unavailable / unavailable / unavailable / unavailable | succeeded |

Measured boundary span and summed agent elapsed are both **807.722222s** (one main interval, no parallel agents). This includes inspection, retries, edits and validation; it is not CPU/model-only time. Observed execution alias/effort and attributable usage telemetry were unavailable. Earlier iteration and cleanup resource totals are not combined with this session. Final measurement rendering, helper removal and response generation occur outside the finished boundary.
