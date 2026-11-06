# C4 retention contract: bounded independent security review

security / security-retention-1; selected gpt-6.1-sol / high; prompter ngkhengyang from explicit assignment. Applied repository security-review skill. Product/specification read-only; no child agents. Reviewed concrete C4 coordinator task, with [prior design findings](../../2026-11-04-reviewer-completion/reports/security-design.md), not a new implementation. Human verification pending.

**SEC-D03 is resolved for design dispatch under the concrete contract below.** Implementation, PostgreSQL validation and independent revalidation remain required. The main agent's supplied authority is supported by [PLAN TASK-005](../../../../../workflow/PLAN.md): ngkhengyang with role owners owns the bounded shared gateway. Preserve exclusive file ownership: retention owns accounting/maintenance/tests/docs; evaluation alone integrates the agreed gateway call. This review does not independently grant shared-file permission.

## Settled concrete contract

Use one `PrismaAiAccounting.cleanup(deadline: AiDeadline)` transaction under the existing quota-coordinator row lock. A required deadline is the smaller interface: the request passes its existing deadline; the maintenance command creates and closes its bounded deadline. Do not create a fresh full request budget for opportunistic cleanup. Existing `bounded`/`locked` error and timeout behavior remains intact; missing coordinator fails safely. Capture one `now` **after** acquiring the coordinator, derive `recentCutoff = now - 24h`, and use it for all predicates.

Delete only leases with expiresAt <= now. Preserve every unexpired lease, including orphan leases without a parent FK. Delete only requests with retainedUntil <= now and **none** of the following protections:

- Any unexpired lease whose requestId equals that request ID.
- Request requestedAt or completedAt >= recentCutoff.
- Any related attempt dispatchedAt or completedAt >= recentCutoff.

Use lower-bound comparisons without an upper bound: future-dated records must also be protected. Null completion timestamps are not recent completion evidence; old abandoned incomplete rows may eventually expire. Request deletion cascades attempts in the same transaction; do not independently remove in-window quota evidence. No business-history/security-event tables, retention TTL, schemas, browser/public endpoint or deployed scheduler changes belong to this mechanism.

Replace gateway opportunistic retention deletes with the same cleanup authority before its normal request-creation transaction; retain request creation, safe failure paths and Contributor behavior. Per-request lease release and normal coordinator expired-lease reclamation remain operational queue behavior, not competing request-retention policies.

Why this closes the threat: enqueue/reserve and maintenance serialize on the same coordinator. An already-created recent attempt or live lease protects its parent; a newly created request is recent even before enqueue. Finishing a valid attempt is bounded by the existing <=20-second request deadline, far inside the 24-hour guard, so finishAttempt need not acquire a new coordinator lock. Twenty-four hours also covers the longest SGT daily quota window. Releasing a lease concurrently cannot broaden selection unsafely because recent request/attempt evidence remains protected. Changes to the request deadline, retry lifetime, timestamp trust or longest quota window require revisiting this argument. Do not extend incomplete-row protection forever: that would prevent eventual physical deletion after interrupted requests.

The maintenance command stays server-only and explicitly invoked, initializes only required database/config dependencies, invokes this authority once, disconnects in finally, and emits bounded safe outcomes without connection strings, record contents, raw prompts or provider output. It makes no provider calls. A bounded transaction may fail/roll back under contention; report failure rather than claim cleanup completed.

## Required implementation evidence

Retain the proposed PostgreSQL checks: expiry equality; old expired parent/attempt cascade; unexpired/future and recent request/attempt preservation; unexpired orphan lease preservation followed by eventual expiry; old abandoned incomplete deletion; daily quota evidence surviving cleanup; concurrent/repeated cleanup; enqueue/reserve/finish interleavings; injected rollback preserving related rows; and business-history survival. Include cleanup waiting behind the coordinator across cutoff, bounded timeout/abort without partial deletion, and missing coordinator fail-closed. Verify gateway delegates cleanup for Reviewer and Contributor without changing messages, accounting, authorization or provider behavior. These are acceptance obligations, not passing results.

SEC-D03 status: **closed for this design only, awaiting implementation verification**. Scheduler/cadence/execution identity/monitoring/retries/outage recovery and deployed physical-deletion evidence remain explicit external gates. This mechanism covers AI request/attempt/lease records only; it does not prove every restricted operational log is physically deleted after 90 days. No scheduled deletion or full retention-compliance claim is supported.

## Assessed state and checks

Code/spec HEAD `8707d19b94f1bf00e26564b67c84a0e76eee42f8`. SHA-256 inspected: accounting.ts `156b67e680db9d176e7cd1bc2edda96a881e879b8958e87253436332778b6a29`; gateway/index.ts `6f57ad9e57b0b12e82966a52973a60dd8c90b2f748ef75d88059b5524e460af2`; deadline.ts `b4434cb0f2af33d23755408ffbc0f83c79a56d0d3a9b56ff8f76c7e1753ef056`; PLAN.md `7e7d97f551b09994d22b3dd63020988edcaee49cb4e13229afd5bffbb55f346d`.

Actually ran Get-Content/rg for current accounting/deadline/gateway cleanup/20-second limit and PLAN ownership; git rev-parse HEAD; Get-FileHash above. Execution brief.md does not exist; that attempted read failed, and the explicitly supplied coordinator C4 contract is the reviewed design source. Prior shared/AI requirements and schema evidence were reused without broad rereading. No product edits, tests, database actions, server startup, network or provider calls.

## Resource evidence

Actual own thread `01a1a622-df1d-71d0-ba30-3a9214423e6f`; CLI interval `rec-8531c76407be48db` in [execution state](../state.json). Fresh outside-Git cumulative baseline `C:/Users/User/Documents/NUS/CS3227/MP4 sessions/local-resource-tracking/2026-11-04-security-retention-1-baseline.json`, flushed cutoff `2026-11-04T10:42:28.499Z`; prior invocation totals are excluded by baseline subtraction. End delta/import and interval closure follow report validation. Observed execution settings/tool/retry counters are unavailable; selected settings are from assignment. Final response and lagging samples are outside attributable measurement.

Coordinator acknowledged required deadline, post-lock single cutoff, all four recent timestamp protections without upper bound, and unexpired lease protection before closure. Evaluation integration ownership must still be acknowledged by that owner.

Resource closure: 2026-11-04T12:26:58.101484+00:00 to 2026-11-04T12:28:32.474857+00:00 UTC; elapsed 94.373373s, succeeded. [Usage import](../inputs/security-retention-1-usage.json): input 350,539; output 1,157; cached input 346,496 (within input), own-thread coverage 1/1. Delta source: C:/Users/User/Documents/NUS/CS3227/MP4 sessions/local-resource-tracking/2026-11-04-security-retention-1-delta.json; latest flushed cutoff 2026-11-04T12:27:31.889Z; sampled 2026-11-04T12:28:14.280216+00:00. Fresh baseline was sampled on resumption despite its older last-flushed cutoff; no previous invocation cumulative totals are imported. Lagging report/current-response tail is unavailable and excluded. summary --markdown completed; other participants remain running and are main-owned.
