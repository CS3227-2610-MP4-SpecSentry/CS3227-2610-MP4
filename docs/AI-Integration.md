# Advisory AI integration

## Contributor Spec Draft Assistant

The Contributor editor requests suggestions from its eligible saved working copy
through `POST /api/proposals/:id/ai/draft`, with strict `expectedVersion` and
`workingRevisionId`. The server selects title, summary, problem, constraints,
expected behavior and criterion statements/classification. It excludes patch,
evidence, criterion identities, actor/session and proposal/working identifiers
from outbound messages. Context is bounded to 6,000 Unicode code points before and
after normalization and 4,000 conservative framed input-budget units, with 800 output tokens.
Oversized input and detected high-confidence secrets are rejected without truncation.

Owner/session/account, lifecycle, attachment, version and working identity are
checked before protected retrieval, before every outbound attempt and before
returning typed output. Changed scope returns safe failure; no business state is
written by AI. The Contributor adapter uses the existing transport, strict JSON/
envelope parser, queue, quota coordinator, deadline, retry and safe accounting.
Feature-aware metadata checks distinguish Contributor working scope from Reviewer
submitted assignment scope without fabricated IDs. Existing Reviewer audit reads
filter their feature explicitly.

The UI requires explicit item selection and application into the unsaved editor.
It preserves unrelated content and validates the whole proposed form before
applying; criteria get fresh identities through ordinary save rules. Manual edits
invalidate late results and manual operation remains available on AI failure.
`GET /api/contributor/ai/usage` returns independently authorized own SGT-day
aggregates, separates requests/attempts/retries/preflight rejections, and reports
missing usage as unknown. Provider UTC spend windows and disabled application
caching are labeled separately.

Local configuration remains off by default under OPEN-002. Both Azure Container Apps
explicitly enable live NUS SoC AI through server-only secrets. Current synthetic tests and
remaining live-evaluation steps are tracked in the
[Contributor completion run](../logs/yooplo/2026-11-01-contributor-completion.md).
The gateway supports a separate server-only live configuration while rejecting
native transport in test mode. Credentials alone do not enable it: application
traffic requires explicit live opt-in and complete model/context configuration.
Wiring availability is not provider, data-handling or deployment approval.

## Reviewer Patch Risk integration

The Reviewer assistant analyzes a selected batch of one to five criteria from the
latest assigned submitted revision. It produces advisory coverage, ranked risks,
questions and test ideas. Human coverage, findings and decisions remain separate.
Implementation, integration and independent fix revalidation are complete for
this bounded increment. All five review findings were fixed and independently
closed. Current evidence belongs to the
[iteration 3 log](../logs/ngkhengyang/2026-10-26-reviewer-iteration3.md).

## Release Maintainer Release Gate Assistant

The responsible Maintainer may request an advisory readiness summary for an exact
OPEN candidate version and content version through
`POST /api/release-candidates/:id/ai/readiness`. The server selects the semantic
version, rollback/dependency notes, deterministic blocker codes and at most 1,000
attached item titles, submitted summaries, revision numbers and per-item gate
statuses. It excludes patches, evidence and finding bodies, acceptance-criterion
text, approval identifiers, account/session data, notifications and publication
snapshot content.

The shared gateway admits at most 6,000 conservative framed input units and 800
output tokens. A versioned prompt treats every selected field as untrusted data;
secret screening runs before dispatch. Strict duplicate-key and envelope parsing,
the exact six-field Maintainer result schema, supplied-item grounding and the rule
that failed deterministic gates cannot produce a READY recommendation all fail
closed. Role, persisted session, creator ownership, OPEN state, candidate/content
versions and attached-item count are checked before context retrieval, before each
outbound attempt and before delivery. A continuously authorized changed candidate
returns a labeled STALE result; access loss returns no advisory result.

The assistant never changes membership, smoke evidence, gates or publication.
The browser keeps manual release controls available when generation is disabled,
rejected or unavailable, discards stale/invalid output and clears protected state
on access loss or scope change. `GET /api/maintainer/ai/usage` is a separate
Maintainer-authorized SGT-day project aggregate across all three features. It
returns counts and provider-usage coverage only, without per-user rows, prompts,
outputs or run history.

Local strict-contract, gateway, service and client tests establish these boundaries.
The 8 November live activation adds representative exact-contract and deployed
development evidence, but it does not establish broad provider usefulness/latency,
quota sufficiency, retention/data-use approval or production role-UI acceptance.

## Current deployed live-AI status

On 8 November 2026, the key-scoped NUS SoC catalog returned the configured
`default` alias with a 262,144-token advertised context window. One representative
call prepared and decoded through each role's exact contract passed strict output
validation for Contributor, Reviewer and Release Maintainer. All three authenticated
development workflows then passed end to end against the deployed application:
Contributor suggestion generation returned a schema-valid response, Reviewer patch
risk completed successfully, and Maintainer readiness returned a schema-valid
`NOT_READY` result for an intentionally empty candidate.

Both Azure Container Apps use the live configuration below and store the API key
only as a protected Azure secret reference. After an independent review initially
held production activation, the application owner explicitly accepted the documented
residual provider uncertainty and directed production enablement on 8 November.
Azure development run `42605859917` and production run `42619894195` then promoted
the same immutable digest. Production authenticated smoke passed, and the public
health endpoint returned `200` with source revision
`6dfe10db7958dac8f378f2a96118ab3b4ee69a5d`. Broader model edge cases, actual key
quotas, provider retention/data-use review and teammate sign-off remain open;
deterministic manual workflows remain the fallback.

## Configuration and operation

`AI_LIVE_ENABLED` defaults to false for local development. True requires a nonblank server-only
`AI_API_KEY`, `AI_MODEL` and a positive safe-integer `AI_CONTEXT_WINDOW`; missing,
placeholder or invalid live settings fail startup with field names only. The
approved base is `https://soclaas-api.comp.nus.edu.sg/v1`. The canonical server
settings are `AI_*`; `SOCLAAS_*` shell examples from the provider are not read by
the application. Never prefix the key with `VITE_` or put it in a browser request.

Keep the app flag false for ordinary local work unless a live test is intentional.
Contributor, Reviewer and Maintainer share this switch and the same gateway
protections. No local flag is automatically changed by the verification harness.
The earlier Render activation and completed Azure post-promotion smoke are
operational evidence, not proof of broad model quality, quota sufficiency or
provider retention/data-use approval.

The current Azure runtime configuration is:

```dotenv
AI_LIVE_ENABLED=true
AI_BASE_URL=https://soclaas-api.comp.nus.edu.sg/v1
AI_MODEL=default
AI_CONTEXT_WINDOW=262144
# AI_API_KEY is a protected Azure Container App secret; never commit or expose it to the browser.
```

`.env.example` intentionally retains `AI_LIVE_ENABLED=false` as the safe local
default. The deployed context value is the key-scoped catalog value observed on
8 November, not a universal provider default. Recheck catalog metadata and
evaluation when switching aliases.

## Synthetic live verification

The verification command uses the application's exact Contributor message
preparation, conservative admission units, bounded transport and strict
envelope/result decoder. Fixed normal, multilingual, delimiter-heavy and near-cap
drafts exercise production prompts; an over-cap case must be rejected locally.
It does not connect to the application database, save suggestions or certify
authenticated UI/authorization/transaction behavior.

```powershell
# Build server/shared and inspect synthetic case budgets; no network calls.
npm.cmd run verify:ai:live

# Explicitly send the bounded synthetic cases using the locally configured key.
# Keep AI_LIVE_ENABLED=false; this harness is separate from app activation.
npm.cmd run verify:ai:live -- --live
```

The command prints safe case metadata only: acceptance/error class, budget units,
latency and provider-reported usage where available. Raw prompts, suggestions,
provider error bodies and credentials are excluded. A passing shape/margin check
does not rate usefulness or prove a universal token bound. Missing provider usage
remains unknown; a live verification run cannot pass its empirical input-margin
check without reported input-token usage for every dispatched case. A failed live case stays failed; do not relax schemas or truncate
context to turn it green. Dry-run evidence is never live-provider evidence.

Authenticated browser acceptance is separate. The opt-in
`workflow/tests/browser/live-ai.config.ts` expects a separately managed loopback
server at3197 and an explicitly disposable loopback `_test` database. Its tests
skip unless `RUN_LIVE_AI_ACCEPTANCE=1`, use zero retries and disable raw page/model
captures. Do not point them at an ordinary database or private drafts. The first
prompt-only Llama app run failed strict output validation, as preserved in the
[earlier app run](../logs/yooplo/2026-11-01-live-ai-app-acceptance.md).
The [v3 schema integration run](../logs/yooplo/2026-11-02-contributor-schema-integration.md)
passed all three browser cases: real generation, explicit selection/application/save,
real authentication/CSRF/input-limit denials with manual recovery, and simulated
HTTP failure recovery. The successful real generation used one provider attempt
with no retry; saved content remained unchanged until explicit Save. This is
synthetic local acceptance, not approval for private-draft traffic or deployment.

Manual review remains available when AI is disabled or fails. Application tests
inject transport, input-budget counter and clock providers in a test bootstrap; those
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

SoC may include `tool_calls: []` and `function_call: null` on an ordinary text
completion. Absent/null call metadata and an empty tool-call array mean no
invocation; actual calls or malformed call metadata remain rejected. This
compatibility rule never relaxes finish reason, refusal or role-schema checks.
Contributor generation v3 retains those field bounds and requests a fixed,
server-owned `response_format` with `type: json_schema` and `strict: true`.
The five required fields, string lengths and array counts match the runtime
contract; additional fields are forbidden. Reviewer requests omit this format.
Provider enforcement supplements local validation: whitespace-only text,
oversized lists and malformed output still fail without trimming, repair or
automatic fallback to unconstrained generation. A schema HTTP 400 is not retried.
The [provider investigation](../logs/yooplo/2026-11-02-structured-output-investigation.md)
records observed support, including invalid-schema and conflicting-prompt controls.

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

The Reviewer input budget is 10,000 conservative units, including templates, identifiers
and framing; complete diff limit is 20,000 code points. Output is at most 800
tokens, response transport at most 64 KiB. Reject excess without truncating or
omitting evidence. The UI explains an input-limit rejection and preserves manual
review entries. Rejected transport responses are aborted and cancelled without
waiting indefinitely for stream cleanup. A single 20-second monotonic deadline includes authorization,
database waits, queueing, provider work, permitted retry and final disclosure.

Preflight request-record creation is serialized on the shared coordinator and bounded
at 120 per actor per rolling ten minutes, 1,000 per actor per SGT day and 300
project-wide per rolling minute. Excess requests fail before a row is created. These
limits are separate from the stricter provider-facing outbound-attempt quotas.
Project aggregate usage uses database counts/sums over indexed time windows rather
than loading per-request or per-attempt rows into application memory.

The server-owned `utf8-bytes-framing-v1` admission method uses 512 units plus
64 per message and the UTF-8 byte lengths of every prepared message's role and
content. It counts complete escaped/framed prompts, not just the user's draft.
For Contributor schema requests, append one counting-only system frame containing
the complete serialized `response_format` object before applying that same
algorithm. This frame is never sent as a model message. The actual gateway and
synthetic verifier use the same accounting path; schema overhead reduces the
remaining draft allowance within the unchanged 4,000-unit cap.
These units are a cautious estimate, not exact tokens or a proven upper bound
for an undocumented tokenizer. The context check adds the 800-token output
allowance and 128 reserve to these units; it is also a heuristic. Non-ASCII or
heavily escaped inputs can be rejected earlier than with exact token counting.
No estimate is saved into token/cache usage fields: those remain provider-reported
or unknown. Contributor/Reviewer caps stay 4,000/10,000 units; the planned Maintainer
cap stays 6,000. No model tokenizer dependency is added.

Exact tokenizer documentation is no longer required by the approved policy.
Live activation still needs actual production-prompt and near-cap multilingual/
escaped-input evaluation against the selected alias, verified advertised context,
key limits, data-handling review and live configuration wiring. Compare units
with returned usage as evaluation evidence, never as proof of a universal bound.
The application remains off by default; the explicit synthetic harness can be
used to gather provider evidence before an operator enables application traffic.

Durable short PostgreSQL transactions serialize attempt/queue reservations across
application instances: 10 outbound attempts per user per rolling ten minutes,
60 per SGT day, 30 globally per rolling minute, and ten waiting slots. Retries
count as attempts. Preflight rejection does not. At most one permitted transient
retry fits the same deadline and Retry-After; validation/auth/refusal and ambiguous
or exhausted-quota errors are not retried. Application SGT windows remain distinct
from provider UTC spend windows. No business lock crosses the network call.

Historical checks, failures and source-revision fingerprints are recorded in the
[compact evidence summary](../logs/ngkhengyang/reviewer/2026-10-26-patch-risk-i3-implementation/state.json).
The [retention index](../logs/ngkhengyang/reviewer/RETAINED-EVIDENCE.md) explains
Git recovery of full original state and the retired replay/freshness boundary.
Read its [fix and review report](../logs/ngkhengyang/reviewer/2026-10-26-patch-risk-i3-implementation/reports/final-fix-review.md)
for actual verification; this guide is not a
claim that every acceptance or live-provider gate has passed.
