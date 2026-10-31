# Reviewer workflow comparison and retrospective token evidence

Recorded 26 October 2026 for ngkhengyang. Requested: record token usage in logs and compare manual-review run with the first Reviewer intake run. Analysis/resource logging skills applied. No product source, workflow tooling, original measured intervals or immutable archived evidence changed.

## Evidence and method

- [Machine-readable counter evidence](token-comparison-2026-10-26.json) includes per-thread lineage, creation time, source path, selected event cutoff, counters, event counts and reset/validity checks. Source collector: `C:/Users/User/Documents/NUS/CS3227/MP4 sessions/local-resource-tracking/codex_usage.py`.
- Original [intake log](../../2026-10-25-reviewer-intake.md) and [manual-review log](../../2026-10-25-manual-review.md) establish scope, timing, defects and outcomes.
- Intake scope: distinct root thread01a171c7-c8a5-7eb0-8751-1fe14043748a and descendants from inception through latest counter no later than original closure2026-10-25T12:28:18.095895Z (20:28:18 SGT).
- Manual scope: distinct root thread01a173a5-a846-7b83-a7eb-e3cc0b4ac71d and descendants from inception through latest counter no later than reconciled closure2026-10-25T16:37:18.182729Z (26October00:37:18 SGT).
- For each thread, counted its latest valid cumulative token_count exactly once before closure. Checked nonnegative accounting, total=input+output, cached/reasoning subset bounds and monotonic counters. Coverage6/6 and5/5 threads; zero skipped headers, resets or invalid counters in selected windows.
- These are retrospective closure-cutoff thread totals, not per-stage deltas. Latest main counters precede closure by approximately32seconds and24seconds respectively, so trailing work after those counters is omitted. Inception includes preparation before formal recorder start. Later retrospectives and this token audit are excluded. Do not import these whole-thread totals into several stage records. No exact billable cost or active-compute claim.

## Comparison

| Measure | First: intake | Second: manual review | Observed difference |
| --- | ---: | ---: | --- |
| Input tokens | 57,305,287 | 33,525,321 | 41.5% lower |
| Cached input, already included | 55,771,136 | 32,452,608 | 41.8% lower |
| Uncached input | 1,534,151 | 1,072,713 | 30.1% lower |
| Output tokens, includes reasoning | 221,059 | 106,961 | 51.6% lower |
| Input plus output | 57,526,346 | 33,632,282 | 41.5% lower |
| Reasoning output, already included | 54,143 | 16,429 | 69.7% lower; model mixes differ |
| Cached share of input | 97.32% | 96.80% | 0.52percentage points lower; no cache-rate improvement |
| Merged recorded elapsed windows | 80.85min | 55.94min | 30.8% lower; includes waits/unknown idle |
| Calendar recorded span | 5h46m35s | 1h15m42s | Dominated by different pause/idle patterns; not a speedup estimate |
| Summed structured agent elapsed | 162.80min | 167.68min | 3.0% higher; duplicate recovery attribution and idle remain |
| Declared resource records | 30 | 19 | 36.7% fewer;19 includes4 continuation records |
| Generated handoff boundaries | 28 historically retained/deleted in archive | 6 | 78.6% fewer; format/retention differs |
| Agent threads | 6 | 5 | One fewer; second combines independent security/implementation review in same non-implementing reviewer |
| Model selection | Sol main/workers; Astra security and implementation reviewers | Sol across all roles | No Astra exception needed in second run; not proof of equal model capability |
| Final server/client/PostgreSQL/Chromium tests | 32 /38 /31 /5 | 35 /58 /48 /6 | More tests passed against expanded cumulative product scope |

Main-thread totals fell from43,033,001 to17,733,143 (58.8%). Other threads together rose from14,493,345 to15,899,139 (9.7%). Therefore the token reduction is concentrated in coordination/main-thread processing, not a uniform reduction in worker consumption. This is consistent with fewer handoffs and a shorter coordinator conversation, but the comparison does not isolate causes.

## Improvements observed

1. Lower recorded token processing, especially coordinator input/output, with fewer agent threads, resource rows and handoff boundaries.
2. Existing account/root locks, activity transaction APIs, migrations, local npm wrapper, isolated PostgreSQL cluster and Chromium were reused. The second slice implemented coverage, findings/provenance, approval gates and idempotency on the intake foundation. Warm environment and foundation reuse are major confounders.
3. The later Astra-by-exception policy was followed: Sol handled design/security review and independent implementation/revalidation. The reviewer found missing activity identifiers/reasons (SEC-I01), and its fix was independently closed. Review was retained rather than removed to reduce overhead.
4. Current snapshots cover26 selected source files versus100 in the historical final intake manifest (83tested source files). Scope is more focused, although a browser-only locator change still invalidated a broad PostgreSQL evidence association.
5. Test evidence expanded and remained independent: all final checks passed, and the formal activity defect was found and corrected. Fewer formal findings (6first versus1second) do not by themselves prove fewer defects: second-run integration corrections were often logged outside the formal finding registry.

## Problems not improved

- Resource intervals still include unknown idle;19rows are not19distinct executions. Two test-recovery intervals overlap the same actual validation, adding about93seconds of duplicated summed attribution. Excluding just that duplication gives166.13min, still not active computation.
- Concurrent shared --clean builds caused deleted generated runtime outputs and a client import failure. The first run had already identified environment/preflight issues; coordination did not fully prevent recurrence.
- Quota interruption, stale-loaded integration retry, Windows command-launch failures, recorder locking, snapshot bookkeeping and a browser locator mismatch added rework. Some final recovery tests were repeated to satisfy structural evidence rather than changed product code.
- Token collector existed before both this implementation and this audit but was not used during the second run. Earlier unavailable claims meant not collected/imported into stage records, not absent local telemetry. This is corrected here, while exact historical per-stage attribution remains unavailable.
- Final completeness passes are structural evidence, not measured efficiency or full product acceptance. No remoteCI/deployment/fullWCAG/performance acceptance is claimed.

## Conclusion and next measurement

Observed improvement: substantially lower closure-cutoff tokens, fewer coordination artifacts and shorter merged elapsed windows while retaining independent review and expanded functional checks. Not demonstrated: causally attributable workflow speedup, reduced summed effort, better cache hit rate, equal quality per unit scope or monetary savings. The workloads, starting foundations, environment warmth, reviewer models and human pauses differ.

For the next run, capture a cumulative baseline/end through the existing collector, close intervals promptly at actual lifecycle boundaries, use one interval per actual execution and narrower source scopes for evidence. Use a matched task or controlled replay before attributing token/time reductions to one workflow policy.
