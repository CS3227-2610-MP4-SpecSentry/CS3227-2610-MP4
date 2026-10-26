# Reviewer Patch Risk integration

The Reviewer assistant analyzes a selected batch of one to five criteria from the
latest assigned submitted revision. It produces advisory coverage, ranked risks,
questions and test ideas. Human coverage, findings and decisions remain separate.
Implementation, integration and independent fix revalidation are complete for
this bounded increment. All five review findings were fixed and independently
closed. Current evidence belongs to the
[iteration 3 log](../logs/ngkhengyang/2026-10-26-reviewer-iteration3.md).

## Configuration and operation

Live SoCLaaS calls remain disabled under OPEN-002. A nonempty API key/model or an
environment flag cannot assert verified model/tokenizer, parameter, quota and
retention compatibility. `readConfig` rejects `AI_LIVE_ENABLED=true`. The approved
base is `https://soclaas-api.comp.nus.edu.sg/v1`. Do not replace it with a browser
value or infer that deterministic synthetic tests establish live compatibility,
usefulness or latency. Contributor and Maintainer assistants are not exposed.

Manual review remains available when AI is disabled or fails. Application tests
inject transport, verified-counter and clock providers in a test bootstrap; those
providers cannot be selected by an HTTP request. The browser test bootstrap is
test infrastructure rather than a production feature switch.

## Contracts and authorization

`POST /api/proposals/:id/ai/patch-risk` requires the current Reviewer session and
CSRF header. Its strict body contains `revisionId`, `assignmentId`,
`expectedVersion`, `expectedAssignmentVersion` and `selectedCriterionIds`.
Unknown fields, duplicate IDs, historical criteria and selections outside 1–5 are
rejected. Protected context is selected after current account/session, role,
assignment, version, revision and eligible-state authorization.

The server supplies the complete same-revision submitted summary/specification,
all criteria, complete sanitized diff and all optional text evidence. Selection
does not slice context to fit. Private working revisions and human/AI histories
are excluded. Authorize again before every outbound attempt and before returning
validated output. Account/session/root locks are never held across provider I/O.

`ReviewAssignment.accessGenerationId` is immutable. A claim creates a new value;
retained-reviewer resubmission copies it. A call spanning a new revision can return
a read-only STALE result under continuous current access. Drop/reclaim, withdrawal,
disablement or access loss cannot revive an old call, even for the same reviewer.
The server checks eligible lifecycle again after completion.

Results identify their analyzed scope and exact selected criterion IDs. Remaining
criteria are not analyzed. A human may open an editable finding from a current
risk, cancel without a write, or explicitly save through the existing finding
endpoint using the original analyzed versions. Refresh never rebases an old risk
onto a new scope. Finding, proposal version and human activity commit together.

## Gateway and privacy

The [runtime schemas](../src/shared/src/contracts/ai.ts) implement the normative
[AI contract](../workflow/specs/AI-SECURITY-SPEC.md). JSON parsing rejects duplicate
keys before object construction; envelope and role output are validated
separately. Refusal, truncation, unknown role fields and invalid grounding fail
safely without repair or validation retries. Severity ordering is stable.

Requests use versioned prompts with delimited untrusted data, no tools, secret
screening before dispatch and no raw prompt, submitted text, reasoning or result
retention. Raw suggestions and unsaved AI-prefilled forms exist only in the page
session; navigation/reload/pagehide/access loss clears them. Suggestions never
enter local/session storage, recoverable caches or shared activity.

`GET /api/proposals/:id/ai/audit` separately authorizes current proposal access and
returns only the actor's bounded safe request/attempt metadata. AI operational
records are excluded from the audit after 90 days and pruned opportunistically
on subsequent gateway requests, separately from durable human history. A scheduled
physical deletion guarantee has not been established. Valid safe provider usage
is retained even when advisory content is rejected; absent or invalid usage is
unknown, rather than reported as zero. Each retry has its own usage record.

## Resource controls

The full input budget is 10,000 verified tokens, including templates, identifiers
and framing; complete diff limit is 20,000 code points. Output is at most 800
tokens, response transport at most 64 KiB. Reject excess without truncating or
omitting evidence. The UI explains an input-limit rejection and preserves manual
review entries. Rejected transport responses are aborted and cancelled without
waiting indefinitely for stream cleanup. A single 20-second monotonic deadline includes authorization,
database waits, queueing, provider work, permitted retry and final disclosure.

Durable short PostgreSQL transactions serialize attempt/queue reservations across
application instances: 10 outbound attempts per user per rolling ten minutes,
60 per SGT day, 30 globally per rolling minute, and ten waiting slots. Retries
count as attempts. Preflight rejection does not. At most one permitted transient
retry fits the same deadline and Retry-After; validation/auth/refusal and ambiguous
or exhausted-quota errors are not retried. Application SGT windows remain distinct
from provider UTC spend windows. No business lock crosses the network call.

Executable checks, failures and source snapshots are recorded in the
[active canonical run](../logs/ngkhengyang/reviewer/2026-10-26-patch-risk-i3-implementation/state.json).
Read its [fix and review report](../logs/ngkhengyang/reviewer/2026-10-26-patch-risk-i3-implementation/reports/final-fix-review.md)
for actual verification; this guide is not a
claim that every acceptance or live-provider gate has passed.
