# MP4 Product Specification and Delivery Plan

**SpecSentry**

CS3227 Agentic Software Engineering  |  AY 2026/27 Semester 1  |  22 October 2026

We will build SpecSentry as a new secure web application for managing specification driven code changes. Contributors turn issues into reviewable change specifications, Reviewers compare submitted patches with those specifications, and Release Maintainers assemble approved changes into release candidates. Each role receives one bounded SoC LLM assistant. The model may draft or recommend, but it cannot submit a change, approve a review, change evidence, mark a release ready, deploy software, or bypass server-side authorization.

## Decision Summary

| **Decision** | **Direction** |
| --- | --- |
| Application name | SpecSentry |
| Product | A secure specification and review workspace for small software teams |
| Roles | Contributor, Reviewer, Release Maintainer |
| GitHub organization | CS3227-2610-MP4-SpecSentry |
| Required repository | CS3227-2610-MP4, public, with master as the submission branch |
| Implementation rule | Build a new codebase, specification set, tests, and documentation. Do not copy source or documentation from earlier MPs. |
| Core stack | TypeScript, Node.js 24 LTS, NestJS with Express, React with Vite, PostgreSQL, Prisma ORM and migrations, Zod, Docker, GitHub Actions |
| AI service | SoC LLM through a single server-side gateway with role-specific prompts, typed output, rate limits, timeouts, and audit metadata |
| Deployment | Separate development and production Render services and PostgreSQL databases; GitHub Actions promotes the same tested image digest |
| Registration deadline | Submit the GitHub organization name through Canvas by 23 October 2026 at 2:00 PM SGT |
| Final deadline | 13 November 2026 at 2:00 PM SGT |

## Product Purpose and Scope

Small software teams often discuss requirements, code changes, review findings, and release evidence in separate tools. That fragmentation makes it hard to prove that a patch satisfies an agreed specification or that a release decision used complete evidence. SpecSentry keeps a structured record from issue to specification, patch review, and release readiness without connecting to a live source repository in the first release.

### Primary Users

| **Role** | **Core responsibility** | **LLM based feature** | **Coordination** |
| --- | --- | --- | --- |
| Contributor | Creates change proposals and specification revisions, submits a text patch with optional plain-text evidence, and responds to review findings | Spec Draft Assistant turns an issue and constraints into objectives, acceptance criteria, edge cases, ambiguities, and test ideas | yooplo |
| Reviewer | Claims submissions from a shared pool, reviews assigned submissions, maps evidence to requirements, records findings, and approves or requests changes | Patch Risk Assistant compares the immutable submitted specification, sanitized unified diff, and evidence and returns coverage gaps, risks, questions, and suggested tests | ngkhengyang |
| Release Maintainer | Creates release candidates, selects approved changes, checks deterministic gates, records rollback notes, and publishes a release record | Release Gate Assistant summarizes release item records and gate statuses, identifies missing gates and dependencies, and proposes readiness and rollback considerations | yu-sutong |

### Authorization Matrix

| **Action** | **Contributor** | **Reviewer** | **Release Maintainer** |
| --- | --- | --- | --- |
| Create or edit own working draft | Allowed in eligible states | No access to unsubmitted working drafts | No access to unsubmitted working drafts |
| Read submitted revisions and submission activity | Own proposals | Currently assigned proposals only | Submitted proposals within project scope |
| Submit proposal and patch | Allowed for own draft | Not allowed | Not allowed |
| Browse submission pool and claim review | Not allowed | Pool shows title, author, submission age, and summary; full review content requires assignment | Not allowed |
| Drop review assignment | Not allowed | Own assignment in IN_REVIEW or CHANGES_REQUESTED only | Not allowed |
| Record review findings | Read only | Allowed for assigned review | Read only |
| Approve or request changes | Not allowed | Allowed for assigned review | Not allowed |
| Revoke approval before release | Not allowed | Assigned reviewer only, with a reason; blocked after release | Not allowed |
| Create and edit release candidate | Not allowed | Read only | Allowed |
| Publish release record | Not allowed | Not allowed | Allowed after deterministic gates pass |
| Use role AI assistant | Own drafts only | Assigned submissions only | Selected approved changes only |
| View AI audit metadata | Own AI runs | Own runs for currently assigned proposals only; never another reviewer's AI history or metadata | All project AI metadata without raw prompts through the restricted audit view |

### Product Boundaries

- The first release accepts plain issue text, specification fields, a bounded unified diff, and optional contributor-authored plain-text evidence. Evidence has no predefined types, commands, pass/fail results, or mandatory classification. The Reviewer assesses it directly. The system does not clone repositories, execute submitted code, browse the web, or call external developer tools.
- The system does not merge code, create pull requests, approve its own output, or deploy application code. Release publication creates an internal auditable record only.
- No direct messages, billing, public profiles, mobile application, file uploads, arbitrary rich text, or real-time collaboration are required.
- The normal specification, review, and release workflow remains usable when the SoC LLM is unavailable, rate limited, or disabled.

### Change Lifecycle

| **State** | **Primary actor** | **Permitted behavior** | **Next state** |
| --- | --- | --- | --- |
| DRAFT | Contributor | Create, edit, or delete before submission | SUBMITTED |
| SUBMITTED | Reviewer / Contributor | Revision waits in shared pool; Reviewer may claim; Contributor may submit a replacement revision or withdraw | IN_REVIEW, SUBMITTED on replacement, or WITHDRAWN |
| IN_REVIEW | Reviewer / Contributor | Reviewer assesses or drops assignment; Contributor may submit a new immutable revision, retaining the reviewer, or withdraw | IN_REVIEW, CHANGES_REQUESTED, APPROVED, SUBMITTED, or WITHDRAWN |
| CHANGES_REQUESTED | Contributor / Reviewer | Contributor revises and resubmits or withdraws; reviewer may claim/drop while state remains unchanged; no new decision before resubmission | IN_REVIEW on resubmission if assigned, otherwise SUBMITTED; WITHDRAWN on withdrawal |
| APPROVED | Reviewer / Contributor | Eligible for a release candidate; Contributor may reopen before revision, or assigned Reviewer may revoke approval with a reason | IN_RELEASE or CHANGES_REQUESTED on reopening/revocation |
| IN_RELEASE | Release Maintainer / Reviewer | Attached to one OPEN candidate; Reviewer may revoke approval before publication, blocking candidate readiness and notifying its responsible Maintainer | RELEASED on publication; APPROVED if removed with valid approval, otherwise CHANGES_REQUESTED |
| RELEASED | Release Maintainer | Immutable terminal record with evidence snapshot | None |
| WITHDRAWN | Contributor | Terminal alternative before approval | None |

### Confirmed Workflow Clarifications

- There is no separate specification approval stage. Reviewer assessment and the Patch Risk Assistant use the immutable specification, diff, and evidence from the same submitted revision.
- New submissions enter a shared pool. A Reviewer claims a submission to become its assigned reviewer. Dropping is permitted only during IN_REVIEW or CHANGES_REQUESTED. Dropping during IN_REVIEW returns it to SUBMITTED; dropping during CHANGES_REQUESTED preserves that state and lists it as unassigned and awaiting revision. A replacement Reviewer may claim it but cannot decide until contributor resubmission.
- Contributors may create and submit a new revision during IN_REVIEW without waiting for a request for changes. The assigned reviewer is retained, receives an in-app notification and a new-revision badge, and must decide against the latest submitted revision. Opening that revision marks its notification read and clears its badge. Submitted revisions remain immutable.
- An APPROVED proposal must be explicitly reopened before revision. Reopening moves it to CHANGES_REQUESTED and invalidates its approval. Reopening is blocked while it is attached to a release candidate; RELEASED remains terminal.
- Dropping an assignment preserves findings, coverage assessments, and their authorship. The next reviewer must confirm coverage before deciding; unresolved HIGH or CRITICAL findings remain approval blockers. Dropping removes access to full review content; the submission's pool metadata remains visible.
- Before claiming, reviewers can see only title, author, submission age, summary, and the awaiting-revision status for CHANGES_REQUESTED items. Full submitted specification, diff, evidence, and review details require assignment.
- Acceptance criteria default to required. Approval requires every required criterion to be marked covered. Optional criteria may have another coverage status with a rationale. Unresolved HIGH or CRITICAL findings block approval.
- Unresolved findings carry forward to new revisions until the assigned reviewer explicitly resolves them. Their severity continues to determine whether they block approval. Each new revision requires fresh coverage assessments; coverage from an earlier revision is history, not a current assessment.
- Contributors classify criteria as required or optional before submission. Classification changes require a new revision. Reviewers cannot waive required criteria by marking them not applicable.
- Assigned reviewers may modify findings during IN_REVIEW and CHANGES_REQUESTED. Approval freezes ordinary finding/coverage edits until explicit reopening or approval revocation. An attached IN_RELEASE review permits the specific approval-revocation action but otherwise remains frozen until removal from the candidate; RELEASED remains immutable. Original decisions and audit history are preserved.
- A request for changes cannot be reversed into approval without Contributor resubmission. A replacement reviewer must confirm or replace each criterion assessment individually before approving; requesting changes does not require complete coverage assessment.
- Contributors may submit a new revision while the proposal is unassigned in SUBMITTED; it stays in the pool. Withdrawal during IN_REVIEW closes the assignment, notifies the reviewer, and blocks further review mutations.
- Assignments do not expire automatically. When a reviewer account is disabled through the existing administrative seed/migration process, unfinished assignments are released into the appropriate unassigned queue. An IN_REVIEW proposal becomes SUBMITTED; CHANGES_REQUESTED remains awaiting revision. This does not revoke a completed approval.
- Evidence is optional plain text chosen by the Contributor. Criterion-to-evidence links are optional and one evidence item may support several criteria. There are no evidence-type, result, mandatory-evidence, or vouching fields; review is a human assessment.
- Submission detail includes a chronological, append-only activity history for submission-related actions. It preserves actors, timestamps, revision references, reasons, and changes within each viewer's access scope. Reviewer AI history and metadata are excluded from this shared history.
- The assigned Reviewer may explicitly revoke approval with a reason before release. For an unattached APPROVED proposal this enters CHANGES_REQUESTED and retains the reviewer. For an item attached to an OPEN candidate, approval is invalidated immediately, the item remains attached in IN_RELEASE, publication is blocked, and the responsible Maintainer receives an in-app notification. The Maintainer must explicitly remove the item before the Contributor can revise it; removal enters CHANGES_REQUESTED. Retaining the blocked item prevents revocation from silently changing release contents.
- A released candidate or proposal cannot have its approval revoked. Publication and revocation serialize against the same candidate/item state: if revocation commits first, publication fails its gates; if publication commits first, revocation is rejected. Revocation, activity records, and any required Maintainer notification commit atomically.

### Remaining Workflow Clarifications

The numbered follow-up decisions about assignments, findings, evidence, history, and AI behavior, followed by pre-release approval revocation with Maintainer notification, were confirmed on 24 October 2026. Exact AI schemas and per-field/input/output limits still require the planned AI security specification.

## Contributor Requirements

| **ID** | **Capability** | **Acceptance criteria** |
| --- | --- | --- |
| REQ-CON-001 | Draft proposal | An authenticated Contributor can create a proposal with title, problem, constraints, and expected behavior. The server stores it as DRAFT and assigns ownership to the current user. |
| REQ-CON-002 | Edit ownership | A Contributor can edit only their own working draft in DRAFT, SUBMITTED, CHANGES_REQUESTED, or IN_REVIEW. Editing after submission creates a new revision rather than modifying submitted content. Reviewers and Maintainers cannot read unsubmitted working drafts. APPROVED proposals require explicit reopening or approval revocation before revision. Reopening, editing, and resubmission are blocked while attached to a release candidate, including after approval revocation; the Maintainer must first remove the item. Direct requests for another user's proposal return 403 and do not reveal its content. |
| REQ-CON-003 | AI specification draft | For an eligible draft, the assistant returns typed objectives, acceptance criteria, edge cases, ambiguities, and test ideas. The result is shown as a suggestion and is never saved into the specification without an explicit user action. |
| REQ-CON-004 | Submit revision | Submission requires at least one required acceptance criterion and a non-empty sanitized diff. Evidence is optional plain text. The server creates an immutable revision and records a SUBMITTED audit event and visible activity entry. An initial submission enters the pool as SUBMITTED. Resubmission retains an existing reviewer and enters or remains IN_REVIEW, otherwise it enters or remains SUBMITTED in the pool. |
| REQ-CON-005 | Respond to changes | When changes are requested, the Contributor can read findings, clone the latest content into a new editable revision, and resubmit. Earlier revisions remain immutable. |
| REQ-CON-006 | Withdraw | The owner may withdraw a DRAFT, SUBMITTED, IN_REVIEW, or CHANGES_REQUESTED proposal if it is not in an open release candidate. Withdrawal requires confirmation and an audit reason, closes any assignment, notifies the reviewer if assigned, and blocks further review mutations. |
| REQ-CON-007 | Criterion classification | The Contributor sets required or optional on each criterion in an editable revision; required is the default. Changing a submitted criterion's classification requires a new revision. The Reviewer cannot waive a required criterion. |
| REQ-CON-008 | Finding response | The owner may add a plain-text response attached to a finding while the proposal is IN_REVIEW or CHANGES_REQUESTED. Responses are attributed and appear in submission activity. Contributors cannot resolve findings. |
| REQ-CON-009 | Criterion identity | Preserve a criterion's stable key across revisions only while its meaning is unchanged. A materially rewritten criterion receives a new key. Removed criteria remain in revision history; removing or rewriting a criterion does not automatically resolve its findings. |

## Reviewer Requirements

| **ID** | **Capability** | **Acceptance criteria** |
| --- | --- | --- |
| REQ-REV-001 | Review pool and assigned queue | A Reviewer can browse a shared pool of unassigned submissions and a queue of submissions assigned to them. Before claiming, only title, author, submission age, summary, and the awaiting-revision status needed to distinguish CHANGES_REQUESTED are visible. Full review content requires assignment. State, age, author, and unresolved-severity filters apply to the assigned queue; the pool supports age and author filters. |
| REQ-REV-002 | Criterion assessment | Each acceptance criterion is marked covered, partially covered, not covered, or not applicable, with a reason for the last three states. Evidence links are optional, including for covered criteria; one plain-text evidence item may support several criteria. The Reviewer checks the submission directly; no evidence vouching or automated test execution is implied. |
| REQ-REV-003 | AI risk review | During IN_REVIEW or CHANGES_REQUESTED, the assigned Reviewer may run the assistant against the latest submitted revision only. Context contains only its immutable submitted specification, sanitized diff, optional plain-text evidence, and required grounding identifiers. No separate specification approval is required. It returns requirement coverage, ranked risks, questions, and suggested tests in typed JSON. |
| REQ-REV-004 | Finding management | The assigned Reviewer can add, resolve, and reopen findings with severity LOW, MEDIUM, HIGH, or CRITICAL during IN_REVIEW and CHANGES_REQUESTED. Approval freezes ordinary finding/coverage edits until explicit reopening or revocation. IN_RELEASE permits only the separate pre-release revocation action, with other review edits blocked until removal from the candidate; RELEASED remains frozen. The system records the author and timestamps for every transition. |
| REQ-REV-005 | Review decision | Decisions are permitted only in IN_REVIEW against the latest submitted revision. Acceptance criteria default to required and submission requires at least one required criterion. Approval is blocked while any HIGH or CRITICAL finding is unresolved, any criterion lacks an assessment, any preserved assessment lacks individual confirmation by the replacement reviewer, or any required criterion is not covered. Optional criteria may use another status with a rationale. Requesting changes requires at least one finding or an explanatory note but does not require completed coverage. A request for changes remains final for that review round; another decision requires Contributor resubmission. |
| REQ-REV-006 | Stale review | A new submitted revision retains the assigned reviewer and requires fresh coverage assessments and a new decision against that revision. Unresolved findings carry forward with their original provenance until explicitly resolved; HIGH and CRITICAL findings remain blockers. Prior assessments and decisions remain visible as history. Reopening an approved proposal invalidates its approval before any new revision is submitted. A decision submitted against an outdated revision is rejected as a conflict. |
| REQ-REV-007 | Claim and drop | A Reviewer may claim an unassigned SUBMITTED or CHANGES_REQUESTED proposal. Claiming SUBMITTED enters IN_REVIEW; claiming CHANGES_REQUESTED preserves that state and cannot enable a decision before resubmission. Only one Reviewer may hold the current assignment. Dropping is allowed only in IN_REVIEW or CHANGES_REQUESTED, returns the proposal to the appropriate unassigned queue, and removes the former reviewer's full-content access. IN_REVIEW becomes SUBMITTED; CHANGES_REQUESTED remains unchanged. Findings and coverage retain authorship and history; the next reviewer must confirm or replace each assessment individually before approving. Unresolved HIGH or CRITICAL findings continue to block approval. Claims and drops are audited, visible in activity, and concurrency checked. |
| REQ-REV-008 | New revision notification | A new revision of an assigned submission generates an in-app notification and new-revision badge for its reviewer. Opening that revision marks its notification read and clears its badge; opening an older revision does not acknowledge a newer one. Notification access follows current assignment permissions. |
| REQ-REV-009 | Finding contents and provenance | A finding requires severity and description; criterion and diff-location references are optional. The current assigned reviewer may resolve, reopen, or change severity on findings from prior reviewers, with a reason and transition history. Findings cannot be deleted or silently rewritten. Preserve the original author and description; corrections are append-only amendments. Resolving, reopening, and severity changes require an explanation. |
| REQ-REV-010 | Resolved finding history | Resolved findings remain in history across revisions and are not automatically reopened. If a problem recurs, the assigned Reviewer may reopen the finding while preserving its origin and prior transitions. |
| REQ-REV-011 | Assignment availability | There is no automatic assignment expiry. Disabling a reviewer account through the existing administrative process releases unfinished assignments atomically, audits the action, and preserves findings and history. IN_REVIEW returns to SUBMITTED; CHANGES_REQUESTED remains awaiting revision. Disabled accounts cannot access or mutate reviews. Completed approvals are not silently revoked. |
| REQ-REV-012 | AI response race | Before returning AI output, recheck current assignment and access. Discard the output if access has been lost, including drop, withdrawal, or account disablement. If a newer revision was submitted, label the older result stale and prevent applying it to the current review. Before a suggestion is saved as a finding, recheck actor, assignment, eligible state, and revision/version again. |
| REQ-REV-013 | AI suggestion handling | Suggestions are advisory and may be shown only for the current page session; raw suggestions are not saved for later reopening. Create finding opens an editable form prefilled from a selected risk; an explicit authorized save creates the human finding. AI never saves findings or coverage automatically. Rerunning may produce different output; communicate this in the interface. Persist only human-created review records and safe, access-controlled AI metadata. |
| REQ-REV-014 | AI size limits | A submission remains manually reviewable when its AI context exceeds configured limits. Reject the AI analysis with a clear explanation before the call; never silently truncate specification, diff, or evidence to fit. Define exact per-field, total input, and output limits in AI-SECURITY-SPEC before implementation. Existing diff and output caps remain the baseline until that contract is specified. |
| REQ-REV-015 | Human history and AI privacy | The current assigned reviewer can read submitted revisions, human findings/responses, prior review decisions, and permitted submission activity. They cannot read unsubmitted working drafts or another reviewer's AI history or metadata. Reviewer AI events and metadata are excluded from the shared submission history, including after reassignment. Own safe AI metadata is available only through the separately scoped AI audit view. |
| REQ-REV-016 | Revoke approval | Only the current assigned Reviewer may explicitly revoke an effective approval, with a non-empty reason, before release. Preserve the original approval and append a revocation record. An unattached APPROVED proposal enters CHANGES_REQUESTED with its reviewer retained. An attached item remains IN_RELEASE in its OPEN candidate with invalid approval, blocking publication; the responsible Maintainer receives an in-app notification identifying candidate, proposal, reviewer, and reason. Candidate removal then enters CHANGES_REQUESTED. Reject revocation for a RELEASED proposal or RELEASED candidate, stale versions, non-assignees, or already invalid approval. Revocation, approval invalidation, activity/audit entries, and required notification are atomic. |

## Release Maintainer Requirements

| **ID** | **Capability** | **Acceptance criteria** |
| --- | --- | --- |
| REQ-REL-001 | Release candidate | A Release Maintainer can create one or more release candidates and add only APPROVED proposals that are not attached to another open candidate. |
| REQ-REL-002 | Deterministic gates | Readiness requires every item to retain approval against its latest submitted revision, all required criteria covered, no unresolved HIGH or CRITICAL finding, a rollback note, and a successful Maintainer release smoke-test record. Contributor evidence is optional plain text and has no type, mandatory flag, or pass/fail status; it is not an automated gate. The separate release smoke-test record remains a Maintainer release requirement. |
| REQ-REL-003 | AI readiness summary | The assistant receives structured item summaries and gate statuses, not raw credentials or unrelated source. It returns blockers, dependencies, release notes, rollback considerations, and confidence. |
| REQ-REL-004 | Publish release | Only a Release Maintainer may publish. The server reevaluates every gate in one transaction, snapshots the evidence, assigns a unique release version, and records the action. |
| REQ-REL-005 | Post-release record | Released records are immutable. A correction creates an append-only annotation and cannot rewrite the original decision or evidence snapshot. |
| REQ-REL-006 | Audit view | The Maintainer can filter audit events by actor, proposal, release, action, date, and outcome, but raw LLM prompts and secrets are never displayed. |
| REQ-REL-007 | Candidate responsibility and revocation notice | Each candidate has a responsible Release Maintainer, initially its creator (createdBy). A member approval revocation creates a durable in-app notification for that Maintainer and a visible blocker on candidate detail. Opening the affected candidate marks the notice read but does not clear the blocker. The item stays attached until the Maintainer explicitly removes it; a notification or acknowledgement never restores approval. |
| REQ-REL-008 | Publication and revocation race | Publication and approval revocation use shared transactional locking or equivalent version checks on candidate and member approvals so both cannot succeed against the same stale approved state. If revocation wins, publication is blocked. If publication wins, the candidate/items become RELEASED and revocation is rejected without altering the release snapshot. |

### Release Candidate States

| **State** | **Meaning and permitted behavior** | **Next state** |
| --- | --- | --- |
| OPEN | Responsible Maintainer may edit candidate details and add/remove items. Readiness is computed from current deterministic gates; revocation leaves the candidate OPEN with a visible blocker. Publication requires every gate to pass. | RELEASED |
| RELEASED | Published immutable release record and member snapshots. Approval revocation, membership edits, and reopening are forbidden; corrections use append-only annotations under REQ-REL-005. | None |

Readiness is computed rather than persisted as a separate READY state, so revocation cannot leave a stale ready flag. OPEN is the definition of an open candidate throughout this specification. An IN_RELEASE item's review approval remains a separate gate from its proposal lifecycle state.

## Shared Product Requirements

| **ID** | **Area** | **Acceptance criteria** |
| --- | --- | --- |
| REQ-SHR-001 | Authentication | All product routes except login and health checks require a valid server-side session. Passwords use an adaptive one-way hash and never appear in logs. |
| REQ-SHR-002 | Role enforcement | Every protected service method checks role, object scope, ownership or assignment, current state, and record version. Hidden buttons are not treated as authorization. |
| REQ-SHR-003 | Concurrency | Mutable records use optimistic locking. A stale update returns a conflict message and does not overwrite newer data. |
| REQ-SHR-004 | Audit | State changes, decisions, AI requests, rejected security checks, and release publication create append-only events with actor, target, time, outcome, and safe metadata. |
| REQ-SHR-005 | Accessibility | All workflows support keyboard navigation, visible focus, programmatic labels, status text that does not rely on color, and a logical heading order. |

### Shared Product Requirements Continued

| **ID** | **Area** | **Acceptance criteria** |
| --- | --- | --- |
| REQ-SHR-006 | Failure behavior | An AI error never discards form content or blocks manual work. The user sees a safe retry message with a correlation identifier, not stack traces or model responses. |
| REQ-SHR-007 | Visible submission activity | Submission detail includes append-only chronological activity for submission creation, saved edits, submissions/resubmissions, claims, drops, automatic assignment releases, requests for changes, approvals, approval revocations and their reasons, reopening, withdrawal, findings and their transitions/amendments, criterion and coverage changes/confirmations, evidence changes/links, contributor responses, release attachment/removal/publication, notifications, and other submission-related actions. Each entry identifies actor or system, time, action, affected revision/entity, outcome, and a safe change summary or reason. Successful mutations and their activity records commit together. Viewer access is checked before activity retrieval; entries never disclose private draft contents, secrets, security diagnostics, or reviewer AI history/metadata. |

### Submission Activity and Private Audit

- The owner and currently assigned Reviewer see the activity history when viewing an authorized submission; the Maintainer sees it within their submitted-proposal scope. History does not grant content access to a former reviewer or an unassigned pool browser. Protected linked revisions, findings, or diffs are authorized again when opened.
- Log submission-related requests and actions in the server audit, including views and rejected actions. The submission timeline shows permitted human/system activity and safe outcomes; rejected security checks and internal diagnostics remain in the restricted audit rather than exposing another user's attempted access. Reviewer AI requests/outcomes/metadata remain in their separate private audit scope and do not appear in the shared timeline. This is the explicit exception to shared visibility for submission-related actions.
- Record saved working-draft changes, but show their contents only to the owner. Other authorized submission viewers may see a safe edit event without unsubmitted text. Submitted revisions and append-only change history preserve the reviewable content; activity summaries do not replace revision snapshots.

## AI Contracts and Decision Boundaries

| **AI feature** | **Allowed context** | **Typed output** | **Forbidden effects** |
| --- | --- | --- | --- |
| Contributor Spec Draft | Problem, constraints, current structured draft; maximum 6,000 input characters | objective, acceptanceCriteria[], edgeCases[], ambiguities[], testIdeas[] | Submit, assign reviewer, change lifecycle, or persist text without user selection |
| Reviewer Patch Risk | Immutable submitted spec, sanitized diff up to 20,000 characters, optional plain-text evidence and grounding identifiers from the same assigned revision; reject rather than silently truncate oversized context | coverage[], risks[], questions[], suggestedTests[], confidence | Approve, resolve findings, execute code, fetch repository data, alter evidence, or persist suggestions without human action |
| Maintainer Release Gate | Approved item summaries, deterministic gate statuses, dependencies, rollback notes | blockers[], releaseNotes[], rollbackConsiderations[], readinessRecommendation, confidence | Mark gates passed, publish, deploy, or override a deterministic blocker |

## AI Security Model

The SoC LLM is an untrusted advisory dependency. The application authenticates the user, authorizes access, selects the minimum context, normalizes and delimits untrusted text, calls the model without tools, validates typed output, applies deterministic policy checks, and returns a suggestion. The AI endpoint and every state-changing endpoint remain separate.

| **Threat** | **Abuse case** | **Required controls** |
| --- | --- | --- |
| Direct prompt injection | Issue text or a diff asks the model to ignore rules, reveal prompts, or approve work | Delimit untrusted text, version prompts, omit secrets, validate schemas, and test representative payloads |
| Indirect injection | Submitted comments or test evidence contain instructions aimed at the model | Treat every retrieved field as data, preserve provenance, use no tools, and never feed unrelated records |
| Cross-user or cross-role leak | A crafted identifier requests another user's proposal or an unassigned review | Authorize before retrieval, query by scoped identifiers, minimize fields, and run IDOR and role matrix tests |
| Secret exposure | A diff contains credentials or private keys | Run secret-pattern detection before the AI call, redact matches, reject high-confidence secrets, and avoid raw prompt logging |
| Malformed or unsafe output | The model invents IDs, severities, approvals, or markup that breaks the interface | Strict typed JSON, enum allowlists, length caps, escaped rendering, unknown-field rejection, and safe fallback |
| Approval bypass | A client copies AI text into a mutation request or calls publication directly | Separate endpoints, CSRF protection, fresh server-side role and state checks, optimistic locking, and deterministic release gates |
| Resource exhaustion | Repeated large requests consume SoC LLM quota or block the service | Per-user and global limits, one bounded retry only for transient errors, timeout, token budget, queue cap, and Retry-After handling |
| Sensitive observability | Prompts, diffs, credentials, or model output leak through logs | Record hashes, template version, token counts, latency, outcome, and error class; exclude raw content by default |

### Security Test Minimum

- Direct, obfuscated, Unicode, delimiter-breaking, and indirect prompt-injection cases for all three assistants.
- Horizontal and vertical authorization tests across owners, non-owners, assigned and unassigned Reviewers, Contributors, and Release Maintainers.
- CSRF, stored and reflected XSS, SQL injection, oversized input, mass assignment, stale version, forced browsing, and session-fixation tests.
- Malformed JSON, unknown fields, invalid enums, hallucinated identifiers, excessive output, markdown links, unsafe HTML, and refusal responses.
- Secret-bearing diffs, high-entropy tokens, raw authorization headers, error pages, and logs inspected for disclosure.
- Timeout, HTTP 429, HTTP 5xx, partial response, invalid response, concurrent requests, exhausted budget, and disabled-AI behavior.

## Nonfunctional Requirements

| **ID** | **Quality** | **Target** |
| --- | --- | --- |
| NFR-PERF-001 | Performance | For seeded data, 95 percent of non-AI page requests complete within 800 ms at 20 concurrent users. AI calls time out after 20 seconds. |
| NFR-REL-001 | Reliability | A failed AI call leaves records unchanged. Database mutations use transactions, and release publication is atomic. |
| NFR-SEC-001 | Transport and session | Production uses HTTPS, Secure and HttpOnly cookies, SameSite=Lax or stricter, CSRF tokens, security headers, and a short idle timeout. |
| NFR-PRV-001 | Data minimization | AI context contains only fields required for the current feature. Raw prompts and responses are not retained in production by default. |
| NFR-A11Y-001 | Accessibility | Critical flows meet WCAG 2.2 AA checks used by the team and pass keyboard-only smoke tests. |
| NFR-OBS-001 | Observability | Structured events include correlation ID, actor pseudonymous ID, template version, model status, token counts, latency, and safe error class. |
| NFR-PORT-001 | Portability | A documented Docker image starts from environment variables and a clean PostgreSQL database without local-machine assumptions. |
| NFR-RES-001 | Resource budget | Each AI feature has a configured input and output token cap. The dashboard reports daily calls, failure rate, cache use, and token consumption. |

## Specification Driven Development

The repository specifications under workflow/specs are the source of truth. Stable identifiers connect product intent, acceptance criteria, architecture decisions, implementation tasks, tests, pull requests, guides, evaluation evidence, and reflections. A material behavior change is incomplete until the specification, tests, traceability record, and user-facing documentation agree.

| **Artifact** | **Purpose** |
| --- | --- |
| workflow/specs/PRODUCT-SPEC.md | Actors, lifecycle, product requirements, boundaries, glossary, and open questions |
| workflow/specs/ROLE-CONTRIBUTOR.md | Contributor flows, permissions, AI feature, edge cases, and acceptance criteria |
| workflow/specs/ROLE-REVIEWER.md | Reviewer flows, finding rules, AI feature, stale review behavior, and acceptance criteria |
| workflow/specs/ROLE-MAINTAINER.md | Release gates, publication rules, AI feature, audit access, and acceptance criteria |
| workflow/specs/AI-SECURITY-SPEC.md | Threat model, context policy, schemas, approval gates, limits, adversarial cases, and retention |
| workflow/specs/TECHNICAL-SPEC.md | Architecture, data model, interfaces, quality attributes, environments, and observability |
| workflow/PLAN.md | Sequenced tasks, dependencies, owners, estimates, status, and actual outcomes |
| workflow/TRACEABILITY.md | Requirement to test, code, documentation, release, and reflection evidence |
| workflow/decisions | Architecture and security decisions with alternatives, consequences, and reviewers |
| workflow/evaluations | Versioned AI usefulness, security, latency, and resource evaluation cases and results |

### Specification Change Flow

1. Specify. The Requirements Agent drafts a change with stable IDs, examples, edge cases, failure paths, and exclusions. The role owner and one teammate review it.
1. Plan. The Architect maps approved requirements to data, interfaces, dependencies, migrations, tests, and small tasks in workflow/PLAN.md.
1. Secure. The Security Reviewer checks authentication, authorization, prompt injection, context exposure, rate limits, output handling, and audit effects before implementation.
1. Implement. A role implementer changes only the approved scope, adds requirement-linked tests, and records material assumptions.
1. Verify. A fresh Test Verifier derives normal, boundary, failure, authorization, and adversarial tests from the specification. Failed tests are evidence and are not weakened to fit the code.
1. Review and integrate. A Spec and Docs Verifier compares behavior with the source specification and guides. A human teammate approves the pull request after traceability and logs are updated.

## Multi Agent Software Engineering Workflow

| **Agent** | **Responsibility** | **Required input** | **Handoff** | **Permission** |
| --- | --- | --- | --- | --- |
| Orchestrator | Break an approved goal into bounded work, select agents, track dependencies and budget, reconcile handoffs | Goal, approved specs, plan, budget | Updated plan, decisions, blockers | Workflow files only |
| Requirements Agent | Draft and refine requirements and acceptance criteria | Stakeholder text, existing specs | Spec diff, assumptions, open questions | workflow/specs only |
| Architect | Design module boundaries, data model, interfaces, migrations, and deployment | Approved specs, current code | Plan tasks and decision records | workflow planning files |
| Security Reviewer | Threat model proposed changes and derive abuse cases | Specs, diff, data flow | Findings, tests, risk decision | Read only |
| Role Implementer | Implement one approved vertical slice | Requirement IDs, interfaces, plan | Code, tests, implementation notes | Assigned code and tests |
| Test Verifier | Derive and run acceptance, authorization, integration, and adversarial tests | Specs, diff, previous failures | Evidence and defect report | Tests only unless asked |
| Spec and Docs Verifier | Compare behavior, guides, and traceability with the release | Specs, code, tests, guides | Mismatch report and documentation edits | Docs and traceability |
| Release Verifier | Check repository structure, CI, image provenance, environments, smoke tests, and submission evidence | Release candidate and logs | Release checklist and blockers | Read only by default |

### Coordination Rules

- Use an orchestrator and bounded specialists for work with clear dependencies. Use one agent for small local edits where coordination cost would exceed the benefit.
- Do not allow concurrent writers on the same files. Parallel agents use separate worktrees or non-overlapping ownership and declare their write sets before work starts.
- Every handoff names the goal, requirement IDs, spec version, context sources, assumptions, changed files, commands or tools used, test evidence, remaining risks, budget used, and next authorized action.
- After an implementer fixes a failed test or security finding, a fresh verifier reruns the relevant checks. The implementer may not self-certify the fix.
- When agents disagree, preserve both claims, identify the conflicting requirement or evidence, run the smallest discriminating test, and obtain a human decision if the specification remains ambiguous.
- Stop and ask for human input when a requirement is materially ambiguous, a permission would expand, a secret may be exposed, a production change is requested, or the remaining budget cannot support reliable verification.

## Context Engineering and Resource Aware Use

Each agent receives a task-specific context pack instead of the entire repository history. The orchestrator records what was supplied, what the agent retrieved, and why. Repository instructions, current specification sections, relevant interfaces, the smallest useful diff, and prior failure evidence take priority over broad logs or unrelated documentation.

| **Task** | **Context supplied first** | **Context retrieved only if needed** | **Recorded measures** |
| --- | --- | --- | --- |
| Requirements work | Assignment constraints, relevant role spec, glossary, open decisions | Production code, old logs, unrelated role details | Context size, number of unresolved assumptions, reviewer corrections |
| Implementation | Approved requirement IDs, interfaces, target files, tests, decisions | Whole repository dumps and completed historical plans | Input tokens, cache hit rate, files retrieved, first-pass test success |
| Security review | Threat model, data flow, auth rules, AI contract, diff | Marketing copy and unrelated UI files | Findings by severity, false positives, adversarial cases added |
| Verification | Acceptance criteria, changed files, exact commands, prior failures | Implementer reasoning transcript | Independent failures found, reruns, test runtime |
| Documentation | Released behavior, UI evidence, specs, traceability | Draft claims without test or release evidence | Mismatch count, corrections, verified sections |

### AI and Development Resource Budgets

| **Resource** | **Budget** | **Control** |
| --- | --- | --- |
| Product AI request | Input capped by feature; output at most 800 tokens | Reject oversized input before the call; no automatic retry for validation errors |
| Transient SoC LLM error | One retry with jitter when the remaining request deadline permits | Respect Retry-After; then return manual fallback |
| Per-user product limit | Initial value 10 calls per 10 minutes and 60 per day | Configuration may be lowered after the SoC quota spike; never raise without evidence |
| Global product limit | Initial value 30 calls per minute with a bounded queue of 10 | Shed excess work with 429 and a retry time |
| Development agent task | Record model, reasoning setting, input and output tokens, cache reads, tool calls, wall time, and retries | Stop or re-scope repeated exploration with no new evidence |
| Persisted context | Store decisions, specs, compact handoffs, test evidence, and verified summaries | Do not persist hidden reasoning, secrets, raw credentials, or unnecessary personal data |

### Required Experiments for Reflections

| **Experiment** | **Method** | **Evidence** |
| --- | --- | --- |
| Context size | Run the same bounded task with a focused context pack and a broad repository context | Compare tokens, latency, defects, retrievals, and reviewer corrections |
| Single agent versus coordinated agents | Implement comparable low-risk and high-risk tasks with one agent and generator-verifier coordination | Compare wall time, tool calls, defects found, rework, and handoff overhead |
| Prompt template version | Evaluate a baseline prompt and an improved typed, delimited prompt on the same cases | Compare schema validity, injection resistance, usefulness, and token use |
| Cache and persisted summaries | Repeat a task with and without a stable context summary or reusable prefix | Compare cache reads, input tokens, repeated retrievals, and correctness |
| Model choice | Use a lower-cost model for bounded extraction and a stronger model for one complex review set | Compare cost proxy, latency, agreement, and human corrections |

## Architecture and Data Design

A TypeScript modular monolith keeps deployment, security, and testing manageable. A React client built with Vite calls a NestJS HTTP API under /api. In deployed environments, the NestJS service serves the built client and API from the same origin in one Docker image. Role-specific controllers call application services. Services enforce authorization, lifecycle transitions, version checks, and transactions before repositories access PostgreSQL through Prisma. A separate server-side AI Gateway owns prompt construction, SoC LLM calls, schema validation, budgets, and safe audit metadata.

| **Layer** | **Decision** |
| --- | --- |
| Runtime and workspace | Node.js 24 LTS, TypeScript strict mode, npm workspaces, and a committed lockfile; pin compatible supported package versions and the runtime image digest when creating the skeleton |
| Presentation | React and Vite with React Router; accessible forms and simple navigation under /contributor, /reviewer, and /maintainer; shared components and ordinary CSS |
| Application | NestJS with the Express adapter; role-specific controllers and use-case services for proposals, revisions, submissions, reviews, findings, evidence, release candidates, audit, and AI suggestions |
| Security | Server-side sessions using express-session with a PostgreSQL-backed store, Argon2id password hashing, session rotation on login, expiry and logout invalidation, synchronizer CSRF tokens, role guards plus service-level object authorization, secure cookies, validation, escaped rendering, and security headers |
| Contracts and AI Gateway | Shared Zod schemas for request/response contracts and strict AI output validation; role templates, context selection, redaction, server-side SoC LLM HTTP client, rate limits, timeouts, one bounded retry, fallback, and metadata |
| Persistence | PostgreSQL with Prisma ORM and versioned reviewed migrations, explicit version-checked writes, foreign keys, transactions, immutable revisions and audit events; database constraints enforce one active reviewer and release membership invariants |
| Quality | Jest and Nest testing utilities with Supertest for backend tests, Vitest and React Testing Library for client tests, isolated PostgreSQL integration tests, Playwright browser and accessibility checks, TypeScript checking, ESLint, dependency and secret scanning |
| Operations | Structured logs, health and readiness checks, migration status, deployment marker, metrics, backup, rollback, and incident runbook |

### TypeScript Stack Rationale and Boundaries

- React suits the review forms, evidence mappings, revision comparisons, and notification state. Vite provides a client build without introducing server-rendering or search-engine optimization requirements for authenticated screens.
- NestJS provides explicit modules, controllers, dependency injection, and test seams for three role workflows and shared infrastructure. Choose one modular service rather than separate role services. Role guards are only the first check: services must still verify assignment, ownership, lifecycle, and version before retrieving protected data or applying mutations.
- PostgreSQL remains the relational source of truth. Prisma provides typed persistence and migrations; transactions and explicit version predicates must enforce concurrent claims, stale decisions, and atomic publication. ORM types alone do not implement those invariants. Review generated migration changes, retain SQL constraints where needed, and apply the same reviewed migrations in separate development and production databases.
- Zod validates untrusted HTTP input and model output at runtime; TypeScript types do not provide runtime validation. Browser-safe contracts may be shared, but database clients, password/session code, AI credentials, prompts, and authorization policies remain server-only.
- Use one same-origin web service and one PostgreSQL database per environment. Local Vite development proxies /api to NestJS. Sessions remain in PostgreSQL rather than process memory; browser code receives only the opaque session cookie and permitted response fields. Mutations require a session-bound CSRF token. SameSite cookies and client route guards do not replace CSRF checks or server authorization.
- The SoC LLM remains the only product AI provider. Calls go through the existing bounded server gateway; no browser-held AI keys, repository execution, or agent tools are added by this stack change. Initial deployment uses one application instance per environment; global AI limits and queue bounds must remain effective if replication is introduced.
- Keep production source under src/server, src/client, and src/shared; keep schema/migration source under src/server/prisma and workflow tooling under workflow. Root package manifests, lockfile, Docker configuration, and CI files may live in their conventional locations. Existing Python workflow tooling remains development infrastructure and need not be rewritten into TypeScript.
- GitHub Actions builds, tests, scans, and publishes the Docker image. Render runs the prebuilt image with separate services, databases, secrets, and hostnames for development and production. The assignment forbids AI build-and-host environments; application development and deployment remain team-managed. GitHub Pages hosts the separate product website.

This is the selected planning baseline, not an implemented migration: the repository currently has no Java or TypeScript application skeleton. Exact library versions and migration commands must match the supported versions pinned during scaffolding.

Technical references checked on 24 October 2026: [Node.js releases](https://nodejs.org/en/about/previous-releases), [NestJS architecture](https://docs.nestjs.com/), [NestJS testing](https://docs.nestjs.com/fundamentals/testing), [Vite](https://vite.dev/guide/), [Prisma transactions](https://www.prisma.io/docs/orm/fundamentals/transactions), [Prisma migrations](https://www.prisma.io/docs/orm/migrations/applying-a-migration), [Express sessions](https://expressjs.com/en/resources/middleware/session/), [Zod](https://zod.dev/), and [Render prebuilt images](https://render.com/docs/deploying-an-image).

### Core Data Entities

| **Entity** | **Key fields** | **Invariant** |
| --- | --- | --- |
| UserAccount | id, username, passwordHash, role, enabled, version | Role changes are administrative seed or migration work, not a user action |
| ChangeProposal | id, ownerId, title, state, currentRevisionId, createdAt, version | Owner and lifecycle root |
| ProposalRevision | id, proposalId, number, problem, constraints, expectedBehavior, diffText, createdAt | Immutable after submission |
| AcceptanceCriterion | id, revisionId, stableKey, statement, required | Stable keys support coverage mapping; required defaults to true |

### Core Data Entities Continued

| **Entity** | **Key fields** | **Invariant** |
| --- | --- | --- |
| TestEvidence | id, revisionId, text, evidenceHash | Optional plain text only; no evidence types, result enums, mandatory flags, vouching, or uploads; immutable as part of a submitted revision |
| CriterionEvidenceLink | criterionId, evidenceId | Optional links within the same revision; an evidence item may support multiple criteria |
| ReviewAssignment | id, revisionId, reviewerId, status, decision, decidedAt, revokedAt?, revocationReason?, version | At most one current assignment per proposal; new revisions retain reviewer through a new revision-specific record; approval/revocation history preserved; released approvals cannot be revoked |
| ReviewFinding | id, assignmentId, originFindingId, criterionId?, diffLocation?, severity, description, status, createdBy, timestamps | Required severity/description; original author/description preserved; amendments and reasoned transitions are append-only; unresolved findings carry forward with provenance |
| FindingResponse | id, findingId, revisionId, authorId, text, createdAt | Plain-text Contributor response; cannot resolve a finding; visible in permitted submission history |
| CriterionCoverage | assignmentId, criterionId, status, rationale, assessedBy, confirmedBy, confirmedAt | Unique per criterion and assignment; fresh assessments for a new revision; a replacement reviewer confirms preserved assessments on the same revision |
| ReleaseCandidate | id, versionLabel, status, rollbackNote, createdBy, publishedAt, version | OPEN or RELEASED; createdBy is responsible Maintainer; readiness computed from current gates; publication snapshots evidence and is terminal |
| Notification | id, recipientId, kind, proposalId?, revisionId?, releaseCandidateId?, createdAt, readAt? | Durable, access-scoped in-app notices; approval revocation notifies responsible Maintainer atomically; reading does not clear release blockers |
| AiRun | id, actorId, feature, templateVersion, inputHash, tokens, latency, outcome, errorClass | No raw prompts by default |
| AuditEvent | id, actorId, proposalId?, revisionId?, action, targetType, targetId, outcome, safeMetadata, timestamp | Append only; successful business mutations record activity atomically; authorized timeline projection excludes private drafts, reviewer AI activity/metadata, secrets, and security diagnostics |

### Environment Separation

| **Environment** | **Source** | **Service** | **Database** | **Control** |
| --- | --- | --- | --- | --- |
| Local | Feature branch | Docker Compose | Local PostgreSQL | Synthetic fixtures and stubbed AI by default |
| Development | develop branch | specsentry-dev | Separate development PostgreSQL | Automatic deployment after CI; synthetic data; separate secrets |
| Production | protected master branch | specsentry-prod | Separate production PostgreSQL | Manual GitHub Environment approval; promote tested image digest |

GitHub Actions will compile, test, scan, build and sign one Docker image, publish it to GitHub Container Registry, deploy that digest to development, run smoke tests, and allow manual promotion of the same digest to production. Render is the runtime platform, not the build source of truth. Development and production use separate services, databases, hostnames, secrets, cookies, and SoC LLM configuration.

## Testing and Evaluation Strategy

| **Level** | **Scope** | **Exit condition** |
| --- | --- | --- |
| Unit | Validation, lifecycle transitions, rate limits, redaction, schemas, deterministic release gates | Every rule branch and error path |
| Repository | Queries scoped by owner, reviewer, role, state, and tenant-like project boundary | No out-of-scope row returned |
| Application integration | Authentication, CSRF, service authorization, transactions, explicit optimistic version checks, Prisma migrations | Critical flows and denied alternatives |
| AI contract | Mocked SoC responses for valid, malformed, oversized, refusal, timeout, 429, and 5xx cases | Deterministic and repeatable |
| Adversarial AI | Prompt injection, secret-bearing diff, data leakage, approval language, invalid identifiers | No state change or unauthorized disclosure |
| Browser | Login and one complete flow for each role, keyboard access, validation and error recovery | Development and production smoke suites |
| Performance | Non-AI endpoints at 20 concurrent users and bounded AI concurrency | Meet NFR-PERF-001 and degrade safely |
| Release | Clean database migration, image provenance, smoke tests, backup and rollback rehearsal | Recorded evidence before production |

### AI Evaluation Gates

| **Measure** | **Cases** | **Release target** |
| --- | --- | --- |
| Schema validity | All three features | 100 percent across the versioned normal and adversarial set after gateway validation |
| Unauthorized disclosure | Cross-user and cross-role cases | Zero unrelated record fields disclosed in all test cases |
| Forbidden action language | Injection and approval-bypass cases | No output is interpreted as authorization and no application state changes |
| Usefulness | Human rating against feature rubric | At least 80 percent of normal cases rated useful without a material unsafe correction |
| Grounding | IDs, criteria, findings, and gates | All referenced identifiers exist in the supplied context or the response is rejected |
| Latency | Development environment | Median under 8 seconds and 95th percentile under 18 seconds for the evaluation set |
| Resource use | Per successful request | Recorded input and output tokens remain within the configured feature budget |

## Team Allocation

| **Member** | **Primary role focus** | **Shared area coordinated** | **Planned contribution** |
| --- | --- | --- | --- |
| yooplo | Contributor | Authentication, sessions, role routing, CSRF, and account access controls | Contributor spec, interface, service, tests, and User Guide flows |
| ngkhengyang | Reviewer | AI Gateway, typed output, rate limits, evaluation harness, and AI observability | Reviewer spec, interface, service, tests, and AI evaluation |
| yu-sutong | Release Maintainer | PostgreSQL migrations, audit model, CI/CD, deployment, and release evidence | Maintainer spec, interface, service, tests, and release operations |

These focuses organize work and do not create exclusive ownership. The contributor to a feature owns its interface, service behavior, persistence integration, authorization tests, documentation, traceability, session summary, and reflection evidence. At least one teammate reviews every non-trivial change. Each member must also complete a substantial share of team-level work.

## Delivery Schedule

| **Date** | **Work** | **Exit evidence** |
| --- | --- | --- |
| 22 October | Approve product name, scope, roles, AI boundaries, organization name, and this specification | Team decision recorded |
| 23 October by 2 PM | Create public organization and repository, add all members, submit organization name through Canvas | Administrative deadline met |
| 23 to 25 October | Create specification baseline, threat model, traceability, agent definitions, clean NestJS and React TypeScript workspace, database skeleton, and CI | Specification and walking-skeleton gates approved |
| 26 to 28 October | Implement authentication, role routing, migrations, audit foundation, SoC LLM spike, and both empty deployment environments | Authenticated deployment and AI contract proof |
| 29 October to 2 November | Implement one complete vertical slice per role with mocked and live AI paths | All role flows work on development |
| 3 to 5 November | Integrate lifecycle, run authorization and AI adversarial tests, fix findings, and exercise failure paths | Security and integration gates approved |
| 6 to 8 November | Run context, coordination, caching, model-choice, and resource experiments; analyze results | Reflection evidence reviewed |
| 9 to 10 November | Complete product site, User Guide, Developer Guide, Reflections, logs, traceability, and acknowledgements | Documentation matches development release |
| 11 November | Feature freeze and production release candidate | Only verified defect fixes after freeze |
| 12 November | Independent smoke test, accessibility check, production deployment, backup and rollback rehearsal | Release candidate accepted with one-day buffer |
| 13 November by 2 PM | Confirm public access, master branch, deployed app, product site, required structure, and no post-submission changes | Final submission complete |

## Repository and Submission Structure

| **Path** | **Required content** |
| --- | --- |
| src | All production source code and resources |
| workflow/specs | Living product, role, technical, integration, and AI security specifications |
| workflow/agents | Specialized agent definitions, permissions, inputs, outputs, and stop rules |
| workflow/evaluations | AI evaluation cases, rubrics, scripts, results, and resource measurements |
| workflow/decisions | Architecture, security, context, and model-choice decision records |
| workflow/PLAN.md | Dependencies, ownership, status, estimates, and actual outcomes |
| workflow/TRACEABILITY.md | Requirement links to code, tests, guides, evidence, and reflections |
| docs/UserGuide.md | Accurate deployed features, role accounts, access URL, limitations, and test instructions |
| docs/DeveloperGuide.md | Architecture, design, security, workflow, testing, deployment, resource use, and acknowledgements |
| docs/Reflections.md | Concrete Multi-Agent SE, Context Engineering, and Resource-aware Use experiments and analysis |
| docs product website | GitHub Pages site with product summary, screenshots, guides, deployment link, and team |
| logs | Human-verified summaries of prompts, interactions, decisions, corrections, evidence, and token/resource notes |
| .github | Pull request template and CI, security, Pages, development deployment, and production promotion workflows |

## Project Risks

| **Risk** | **Exposure** | **Mitigation** |
| --- | --- | --- |
| SoC LLM quota or instability | High | Mockable gateway, configured budgets, rate limits, manual fallback, early live spike, and evidence from 429 and timeout tests |
| Scope exceeds three weeks | High | No repository integration, code execution, uploads, chat, or external tools; freeze the lifecycle and three AI assistants first |
| AI security evidence is superficial | High | Versioned adversarial cases, typed schemas, data-isolation tests, logs inspection, and a fresh Security Reviewer |
| Multi-agent work creates conflicts | Medium | Explicit write sets, isolated worktrees, small handoffs, one integrator, and measured coordination overhead |
| Documentation drifts from release | Medium | Requirement traceability, Spec and Docs Verifier, screenshots and smoke tests against the deployed candidate |
| Environment separation is incomplete | Medium | Create both services and databases in week one, separate secrets, and promote the same immutable digest |
| Prior MP material is reused accidentally | Medium | Clean repository, no copied source or docs, acknowledgement review, and file-origin check before release |

## Definition of Done

- The public GitHub organization contains a public repository named CS3227-2610-MP4 with the required src, workflow, docs, logs, website, and automation content, and master is the current submission branch.
- Each role has a complete deterministic workflow, one working SoC LLM assistant, clear authorization boundaries, and a usable manual path when the LLM fails.
- Every protected operation rechecks authentication, role, object scope, ownership or assignment, state, CSRF token, and record version on the server.
- AI suggestions use minimum context, typed output, input and output limits, no tools, safe rendering, rate limits, timeouts, audit metadata, and no automatic business action.
- Specifications are current, acceptance criteria are testable, requirement IDs trace to implementation and evidence, and material behavior changes update specs and tests together.
- Security evidence covers prompt injection, data isolation, IDOR, XSS, CSRF, malformed output, secret-bearing input, approval bypass, resource exhaustion, and failure handling.
- Development and production use separate services, data, configuration, and secrets. Production deployment requires human approval and promotes a tested immutable image digest.
- The User Guide matches production, the Developer Guide explains the released design and process, Reflections uses reviewed experiment evidence, and all reused ideas or dependencies are acknowledged.
- A teammate who did not implement each major feature has reviewed its specification, security impact, test evidence, documentation, and released behavior.

## Sources and Open Confirmations

| **Source** | **Use** |
| --- | --- |
| MP4 assignment brief supplied on 22 October and pasted again on 24 October 2026 | Product constraints, team size, role and AI requirements, security, SDD, Multi-Agent SE, environment separation, resource use, repository structure, deadlines, grading focus, simple UI, and prohibition on AI build-and-host environments; no Java-specific stack requirement |
| SoC LLM start guide | The implementation team must confirm current authentication, model, rate, token, and data-handling rules before the live integration is accepted |
| Existing team repository metadata | GitHub usernames ngkhengyang, yooplo, and yu-sutong; used only for planning ownership and organization invitations |

- The team must confirm the SoC LLM's current rate limits and approved model before replacing the initial configurable budgets.
- The team must review role ownership, Render as the deployment platform, and the proposed schedule before treating this plan as approved.
- The GitHub organization name must be submitted through Canvas by 23 October 2026 at 2:00 PM SGT even if the same team worked together previously.

**Product decision.** Build SpecSentry as a new, narrowly scoped software engineering web application in the GitHub organization CS3227-2610-MP4-SpecSentry. Keep every AI capability advisory, typed, rate limited, reviewable, and separate from state-changing endpoints. Prioritize three complete role workflows, explicit security evidence, measurable context and resource experiments, and a reproducible two-environment release over optional integrations.
