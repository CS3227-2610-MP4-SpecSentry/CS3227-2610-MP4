# SpecSentry product specification

Baseline: 25 October 2026. Normative design; implementation evidence is tracked in [traceability](../TRACEABILITY.md).

[Product index](PRODUCT-SPEC.md) | [Open decisions](OPEN-DECISIONS.md)

We will build SpecSentry as a new secure web application for managing specification driven code changes. Contributors turn issues into reviewable change specifications, Reviewers compare submitted patches with those specifications, and Release Maintainers assemble approved changes into release candidates. Each role receives one bounded SoC LLM assistant. The model may draft or recommend, but it cannot submit a change, approve a review, change evidence, mark a release ready, deploy software, or bypass server-side authorization.

## Specification map and authority

Each requirement ID has one authoritative definition. These linked documents form one versioned specification set; their existence does not imply implemented behavior.

| Document | Responsibility |
| --- | --- |
| [MP4 assignment](ASSIGNMENT-SPEC.md) | Page-referenced course constraints, deliverables, academic integrity, reflection guidance and submission/assessment logistics; team product choices remain below |
| [Contributor](ROLE-CONTRIBUTOR.md) | REQ-CON requirements, UI flows and acceptance scenarios |
| [Reviewer](ROLE-REVIEWER.md) | REQ-REV requirements, review interface and failure cases |
| [Maintainer](ROLE-MAINTAINER.md) | REQ-REL requirements, candidate lifecycle and publication |
| [Shared requirements](SHARED-REQUIREMENTS.md) | REQ-SHR and NFR definitions, activity/privacy and quality |
| [Technical](TECHNICAL-SPEC.md) | TypeScript stack, module boundaries and deployment constraints |
| [Integration](INTEGRATION-SPEC.md) | Logical entities, operation semantics, concurrency and errors |
| [AI security](AI-SECURITY-SPEC.md) | Context/output contracts, threats, budgets and evaluation |
| [Open decisions](OPEN-DECISIONS.md) | Resolved policy defaults and remaining live-verification gates |
| [Traceability](../TRACEABILITY.md) | Requirement ownership, planned verification and actual evidence |
| [Plan](../PLAN.md) | Tasks, dependencies, delivery milestones and execution progress |
| [Development process](../DEVELOPMENT.md) | Specification maintenance, coordination and verification |

Product lifecycle and role/shared criteria govern observable behavior. Technical/integration contracts must satisfy them. Record conflicts explicitly; neither implementation nor execution plans authorize changing agreed behavior. Smaller changes need proportionate acceptance criteria rather than a full rewrite.


## Product decisions

| **Decision** | **Direction** |
| --- | --- |
| Application name | SpecSentry |
| Product | A secure specification and review workspace for small software teams |
| Roles | Contributor, Reviewer, Release Maintainer |
| GitHub organization | CS3227-2610-MP4-SpecSentry |
| Required repository | CS3227-2610-MP4, public, with master as the submission branch |
| Implementation rule | Build a new codebase, specification set, tests, and documentation. Do not copy source or documentation from earlier MPs. |
| AI service | SoC LLM through a single server-side gateway with role-specific prompts, typed output, rate limits, timeouts, and audit metadata |

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
| Browse submission pool and claim review | Not allowed | Title, author, submission age, summary, and awaiting-revision status only; full content requires assignment | Not allowed |
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

### Cross-role invariants

- There is no separate specification approval stage. Reviewer assessment and the Patch Risk Assistant use the immutable specification, diff, and evidence from the same submitted revision.
- New submissions enter a shared pool. A Reviewer claims a submission to become its assigned reviewer. Dropping is permitted only during IN_REVIEW or CHANGES_REQUESTED. Dropping during IN_REVIEW returns it to SUBMITTED; dropping during CHANGES_REQUESTED preserves that state and lists it as unassigned and awaiting revision. A replacement Reviewer may claim it but cannot decide until contributor resubmission.
- Contributors may create and submit a new revision during IN_REVIEW without waiting for a request for changes. The assigned reviewer is retained, receives an in-app notification and a new-revision badge, and must decide against the latest submitted revision. Opening that revision marks its notification read and clears its badge. Submitted revisions remain immutable.
- An APPROVED proposal must be explicitly reopened before revision. Reopening moves it to CHANGES_REQUESTED and invalidates its approval. Reopening is blocked while it is attached to a release candidate; RELEASED remains terminal.
- Dropping an assignment preserves findings, coverage assessments, and their authorship. The next reviewer must confirm or replace each coverage assessment before approving; unresolved HIGH or CRITICAL findings remain approval blockers. Dropping removes access to full review content; the submission's pool metadata remains visible.
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

## Glossary

| Term | Meaning |
| --- | --- |
| Proposal | Contributor-owned lifecycle root with working content and submitted revisions |
| Working draft | Editable owner-private content; saving does not replace the submitted revision |
| Submitted revision | Immutable specification, diff, criteria and optional plain-text evidence submitted together |
| Submission | Proposal considered at a particular submitted revision; activity belongs to the proposal |
| Assignment | Current Reviewer responsibility; decisions and coverage are revision-specific |
| Approval | Human decision for a revision; distinct from proposal state IN_RELEASE |
| Finding | Attributed issue with severity, amendments and audited transitions |
| Coverage | Human assessment of a criterion; evidence links are optional |
| Candidate | OPEN release grouping that becomes terminal RELEASED on publication |
| Activity | Authorized projection of append-only submission events, excluding private AI/security audit |

## Verification and evolution

Specifications evolve alongside code and tests. Acceptance scenario IDs connect intent to verification. A material behavior change updates affected criteria, contracts, tests and guides together. No application completion or teammate sign-off is inferred from this baseline.


## Approved operating scope

The current baseline is one project and exactly one role per account. API/input/idempotency defaults are authoritative in [integration](INTEGRATION-SPEC.md); sessions/activity/quality in [shared requirements](SHARED-REQUIREMENTS.md); AI batches/schemas/provider compatibility in [AI security](AI-SECURITY-SPEC.md). All nine decision groups were accepted provisionally on 25 October 2026. Only key-specific provider compatibility remains unverified; no live integration is claimed.
