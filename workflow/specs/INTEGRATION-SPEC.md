# Integration specification

Baseline: 25 October 2026. Normative design; implementation evidence is tracked in [traceability](../TRACEABILITY.md).

[Product index](PRODUCT-SPEC.md) | [Open decisions](OPEN-DECISIONS.md)

## Logical data model

### Core Data Entities

| **Entity** | **Key fields** | **Invariant** |
| --- | --- | --- |
| UserAccount | id, username, passwordHash, role, enabled, version | Role changes are administrative seed or migration work, not a user action |
| ChangeProposal | id, ownerId, title, state, currentRevisionId, firstSubmittedAt, createdAt, version | Owner and lifecycle root |
| ProposalRevision | id, proposalId, number, summary, problem, constraints, expectedBehavior, diffText, submittedAt, createdAt | Immutable after submission |
| AcceptanceCriterion | id, revisionId, stableKey, statement, required | Stable keys support coverage mapping; required defaults to true |
| TestEvidence | id, revisionId, text, evidenceHash | Optional plain text only; no evidence types, result enums, mandatory flags, vouching, or uploads; immutable as part of a submitted revision |
| CriterionEvidenceLink | criterionId, evidenceId | Optional links within the same revision; an evidence item may support multiple criteria |
| ReviewAssignment | id, revisionId, reviewerId, status, decision, decidedAt, revokedAt?, revocationReason?, version | At most one current assignment per proposal; new revisions retain reviewer through a new revision-specific record; approval/revocation history preserved; released approvals cannot be revoked |
| ReviewFinding | id, assignmentId, originFindingId, criterionId?, diffLocation?, severity, description, status, createdBy, timestamps | Required severity/description; original author/description preserved; amendments and reasoned transitions are append-only; unresolved findings carry forward with provenance |
| FindingResponse | id, findingId, revisionId, authorId, text, createdAt | Plain-text Contributor response; cannot resolve a finding; visible in permitted submission history |
| CriterionCoverage | assignmentId, criterionId, status, rationale, assessedBy, confirmedBy, confirmedAt | Unique per criterion and assignment; fresh assessments for a new revision; a replacement reviewer confirms preserved assessments on the same revision |
| ReleaseCandidate | id, versionLabel, status, rollbackNote, dependencyNotes, contentVersion, createdBy, publishedAt, version | OPEN or RELEASED; createdBy is responsible Maintainer; readiness computed from current gates; publication snapshots evidence and is terminal |
| Notification | id, recipientId, kind, proposalId?, revisionId?, releaseCandidateId?, createdAt, readAt? | Durable, access-scoped in-app notices; approval revocation notifies responsible Maintainer atomically; reading does not clear release blockers |
| AiRun | id, actorId, feature, templateVersion, inputHash, tokens, latency, outcome, errorClass | No raw prompts by default |
| AuditEvent | id, actorId, proposalId?, revisionId?, action, targetType, targetId, outcome, safeMetadata, timestamp | Append only; successful business mutations record activity atomically; authorized timeline projection excludes private drafts, reviewer AI activity/metadata, secrets, and security diagnostics |

## Operation contracts

Operations below define logical inputs and outcomes derived from existing requirement IDs. HTTP names below are the approved initial interface baseline; they do not introduce permissions beyond role requirements. All requests authenticate before protected retrieval. Successful writes return the committed revision/state/version; rejected writes preserve business state. Assignment and resource versions prevent an old request from becoming valid after drop/reclaim.

| Operation / approved route | Required input and scope | Observable outcome / failure |
| --- | --- | --- |
| GET /api/auth/csrf | Public login bootstrap | Pre-login session cookie and `{csrfToken}`; no protected content |
| POST /api/auth/login | Session-bound CSRF header; strict `{username,password}` | Rotated session/CSRF and `{account,csrfToken,expiresAt}`; generic 401, validation 422 or throttled 429 with Retry-After |
| GET /api/auth/session | Valid session and enabled/version-matching account | `{account:{id,username,role},csrfToken,expiresAt}`; expiresAt is epoch milliseconds capped by idle/absolute expiry |
| POST /api/auth/logout | Valid session and CSRF header | Destroy session, clear cookie, 204 |
| GET /api/review-pool | Reviewer; scoped filters/page | Allowed metadata only; no submitted detail or private AI fields |
| GET /api/proposals/:id | Owner/current assignee or scoped Maintainer; submitted revision selector | Authorized representation; working drafts owner-only; linked content reauthorizes independently |
| POST /api/proposals | Contributor; draft fields | New owned DRAFT; validation/role failure creates none |
| PATCH /api/proposals/:id/draft | Owner; expected proposal version and draft content | Working content updated only in eligible state; submitted snapshots unchanged |
| POST /api/proposals/:id/submit | Owner; expected version, draft revision | Immutable revision, proper pool/assigned state, activity and assigned-reviewer notification together |
| POST /api/proposals/:id/claim or /drop | Reviewer; expected version/assignment identity | One active assignment or correct queue return; concurrent loser sees conflict |
| POST /api/proposals/:id/findings | Assignee; revision/assignment/version, severity, description, optional references | Human finding plus activity; frozen or stale state rejected |
| POST /api/findings/:id/transitions or /amendments | Assignee; expected version, transition/amendment and explanation | Preserve original description and history; no delete operation |
| PUT /api/proposals/:id/coverage/:criterionId | Assignee; same-revision criterion, expected version, status/rationale, optional evidence links or confirmation | Revision-specific assessment; no cross-revision evidence link |
| POST /api/findings/:id/responses | Owner; current scope/version and plain text | Attributed response; no resolution side effect |
| POST /api/proposals/:id/decision | Assignee; latest revision/assignment/version, approve/request-changes and note as applicable | Deterministic gates checked; decision plus activity; request-changes final until resubmission |
| POST /api/proposals/:id/reopen or /withdraw | Owner; expected version and required reason/confirmation | Existing lifecycle transitions; no attached-item edit bypass |
| POST /api/proposals/:id/revoke-approval | Assignee; effective approval/version and reason | Approval invalidation, activity and responsible-Maintainer notice atomic; released records reject |
| POST /api/proposals/:id/ai-risk | Assignee; latest submitted revision identity | Server builds context; no client-selected unrelated records. Response rechecks access; no business mutation |
| GET /api/proposals/:id/activity | Authorized submission viewer; cursor | Safe chronological projection; excludes private draft contents and reviewer AI/security audit |
| POST /api/release-candidates and candidate membership operations | Maintainer; candidate/item versions and approved revision identity | OPEN candidate/membership with constraints; Only candidate creator may mutate/publish; other Maintainers read only |
| POST /api/release-candidates/:id/publish | Maintainer; expected candidate version | Reevaluate gates with member approvals; publish snapshot or roll back everything |
| GET /api/notifications and acknowledgement | Recipient only; notification identity/version as applicable | No access grant through notice; acknowledgement never clears a readiness blocker |

## Error and concurrency semantics

- Approved HTTP mapping: 401 for absent/expired session; 403 for authenticated role/object denial (including the explicit Contributor non-owner rule); 404 for an absent object when no protected existence is disclosed; 409 for stale versions, assignment/state conflicts and failed current gates; 422 for invalid fields; 429 for local limits with retry information. Use the safe error envelope below.
- Error data exposes a safe code/message, correlation identifier, and authorized field errors only. Do not include prompts, stack traces, secrets, unauthorized record fields or submitted payload dumps.
- Each mutation rechecks actor, scope, revision/state and expected version in the transaction. Activity and required notification writes commit with the business mutation. Submission/claim/drop/publication races serialize against their shared lifecycle roots; publication and revocation must not both succeed on the same stale approval.
- A rejected business write has no partial success. Security/audit rejection records are separate safe evidence; their existence does not imply a successful submission action. An AI timeout does not roll back a separately completed human mutation.
- A client that loses a response does not assume success or blindly repeat a non-idempotent action. Use the idempotency policy below. Read current authorized state before offering retry; never retarget an old form to a newer revision.
- Notification creation is durable and transactional. Existing role rules define read acknowledgment. No email, external messaging, sockets or background delivery platform is required by these contracts.

## Event boundaries

Business event projection contains actor/system identity, target proposal/revision, action, outcome, safe summary/reason and timestamp. Revocation includes affected candidate and notification recipient references. Internal AI events have separate authorization and are never merged into the shared activity projection. The shared activity policy defines the field allowlist, 50-entry chronological cursor pages and retention.

The logical table above is not a physical schema. In particular, immutable approval/transition records must not be overwritten merely because optional revokedAt/revocationReason fields are present on an assignment summary. A new review round preserves prior decisions; a current-assignment pointer does not erase historical assignments.


## Input limits

All text limits count Unicode code points after line-ending normalization. Reject oversized values rather than silently truncate. Validate the same limits on private save and submission; required non-empty fields are trimmed for emptiness without rewriting submitted content. Strings render as escaped plain text. All JSON bodies reject unknown mutation fields and client-supplied actor/owner/state/audit timestamps.

| Field | Approved application limit |
| --- | --- |
| Title | 200 characters |
| Submitted summary | 500 characters; Contributor-authored |
| Each criterion, finding description/amendment, response, decision note or transition/revocation reason | 2,000 characters |
| Other narrative fields, including problem, constraints, expected behavior, rollback/dependency notes, smoke procedure/results | 10,000 characters each |
| Submitted unified diff | 100,000 characters |
| Evidence | Optional plain-text items; total 50,000 characters per revision, no types/results/mandatory flags |
| Criteria | 1-50 on submission, at least one required |
| JSON request body | 1 MiB UTF-8; lower operation-specific field limits also apply |

Evidence items must be non-empty when present; links must reference criterion/evidence in the same revision. Empty evidence collection is valid. API/body caps and AI caps are different: a 100,000-character diff is manually reviewable even though it cannot enter an AI call capped at 20,000 diff characters. Optional evidence is never silently omitted from AI context to fit a budget.

## Payload and response conventions

IDs are opaque server-issued strings; versions are nonnegative integers. All mutation bodies include expectedVersion for their mutable root, except create; review mutations additionally identify revisionId and assignmentId. A command affecting candidate membership includes expectedCandidateVersion and expectedProposalVersion. Actor identity, owner, scope, times, lifecycle state and gate results always come from server state. A same-revision reference is validated by scoped retrieval, not accepted on the basis of string shape.

| Operation | Additional allowed body fields |
| --- | --- |
| Create/save draft | title, problem, constraints, expectedBehavior, summary, criteria entries (stableKey if existing, statement, required), diffText, evidence entries (id if existing, text) |
| Submit/reopen/withdraw/delete draft | submitted workingRevisionId for submit; reason/confirmed for withdrawal; confirmed for delete; root version always required for existing records |
| Claim/drop | No client reviewer ID; expected assignment identity for drop |
| Create finding | severity LOW/MEDIUM/HIGH/CRITICAL, description, optional criterionId and diffLocation (path and positive line number) |
| Finding transition/amendment | resolve/reopen/change-severity action plus explanation, target severity when applicable; append-only amendment text instead of changing original description |
| Coverage assessment/confirmation | status COVERED/PARTIALLY_COVERED/NOT_COVERED/NOT_APPLICABLE, rationale, optional evidenceIds; explicit confirm action for preserved assessment |
| Contributor response | text and scoped finding ID |
| Review decision | decision APPROVE/REQUEST_CHANGES, optional note; gate rules determine when note is required |
| Approval revocation | non-empty reason and effective approval/revision identity |
| Reviewer AI | revisionId, assignmentId, selectedCriterionIds (1-5 unique); server selects the complete allowed same-revision context |
| Candidate create/edit | versionLabel, rollbackNote and advisory dependencyNotes; edits require candidate version |
| Candidate membership | proposalId, revisionId and expected candidate/proposal versions; no client approval assertion |
| Release smoke test | testedContentVersion, procedure, results, outcome PASS/FAIL; performer/time assigned by server |
| Publish | expected candidate version; server rechecks all gates and uniqueness |
| Notification acknowledgment | Recipient-scoped notification ID; no client recipient identity |

Create returns 201 and ID/state/version. Successful updates/commands return 200 with committed IDs/state/version; DELETE of a confirmed never-submitted draft returns 204. Protected list responses return items and nextCursor; errors return {code, message, correlationId, fieldErrors?}. Safe code families are UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, CONFLICT, VALIDATION_FAILED, RATE_LIMITED, AI_UNAVAILABLE and INTERNAL_ERROR. Validation uses 422, body-size rejection 413, optional AI provider unavailability 503, and unexpected server errors 500; no raw provider envelope is returned. Existing 401/403/404/409/429 mappings still apply.

List page size defaults to 20 with maximum 100. Pool/assigned queue order defaults to firstSubmittedAt ascending then ID ascending; latest revision age is displayed separately. Notifications and private audit default newest first; submission timeline remains oldest first with 50-entry pages. Cursors encode ordering position, never authorization; reauthorize every page.

DELETE /api/proposals/:id is owner-only for never-submitted DRAFT, confirmed and version-checked. Release smoke tests use POST /api/release-candidates/:id/smoke-tests. Other approved operation route names remain as listed above; read-only revision history and role-owned AI endpoints follow the same /api/proposals or /api/release-candidates scope.

## Idempotency and retries

Require Idempotency-Key on submission, review decision, approval revocation and release publication. Scope the key to authenticated actor, operation and target; bind it to a canonical request hash. The same key/body returns the original committed outcome without repeating mutation/activity/notification. A reused key with a different body returns 409. Concurrent identical keys serialize; idempotency record and successful mutation commit together. Retain entries for 24 hours; retry after expiry uses current version checks and cannot duplicate a committed transition. Keys are not credentials and never grant access.

Authentication, current account enablement, CSRF and object access are checked before replaying any result. Replay of a committed command may return its safe original result despite the state change caused by that command, but never disclose content after access loss. Network retries use the original key; never generate a new key to bypass a conflict. Other mutations rely on expected versions plus current-state checks; the client reads state after an uncertain response before offering another action.

Candidate-content version is distinct from general metadata version. Membership/included-revision changes invalidate smoke results; reading notifications does not. Application version checks must cover all relevant roots, including assignment generation, so drop/reclaim cannot revive an old mutation.


## Additional logical records

| Entity | Fields | Invariant |
| --- | --- | --- |
| ReleaseSmokeTest | id, candidateId, testedContentVersion, performerId, performedAt, procedure, results, outcome | PASS/FAIL; append-only history, current matching PASS required |
| IdempotentCommand | actorId, operation, targetId, keyHash, requestHash, committedOutcome, expiresAt | Unique scope/key, successful command committed atomically; authorize before replay |
| DraftTombstone | proposalId, actorId, action, timestamp | No working content; never used to delete submitted history |

Business audit history and operational/security audit retention are separated logically so operational pruning cannot erase required submission history. New physical schemas/migrations must implement these contracts without importing previous-project schema files.

### Authentication input defaults

Usernames contain 1–80 ASCII letters, digits, dots, underscores or hyphens;
trim and normalize to lowercase before lookup/provisioning. Login passwords are
1–256 characters without trimming or rewriting. Administrative provisioning
requires 12–256 characters. Role is server-owned and cannot be supplied at login.
These controls implement REQ-SHR-001/002 and NFR-SEC-001; the login CSRF bootstrap
is part of the public login exception. See [Authentication](../../docs/Authentication.md)
for implementation boundaries and administrative operation.
