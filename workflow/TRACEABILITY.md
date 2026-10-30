# Requirement traceability

Baseline review: 25 October 2026. Every existing requirement ID has one definition and a planned acceptance scenario. Product acceptance and deployed evidence remain **pending** until verified; existing workflow-tool tests do not satisfy product acceptance. The infrastructure evidence below covers only the initialized scaffold.

## Base infrastructure evidence — 25 October 2026

| Scope / related requirement | Implementation | Verification / boundary |
| --- | --- | --- |
| Technical workspace and portability foundation; NFR-PORT-001 partial | src/server, src/client, src/shared; root package manifests, Dockerfile, compose.yaml | Clean npm ci, Prisma generation, typecheck, production build and local built-server smoke passed. Real PostgreSQL 16 connectivity passed; PostgreSQL 17 Compose and Docker checks are configured in CI but have not run locally. Full AC-NFR-PORT-001 remains pending |
| Safe HTTP failure/header foundation; NFR-SEC-001 and integration error contract partial | src/server/src/http.ts, config.ts, health/health.controller.ts | src/server/test/http.spec.ts: health independent of database, readiness success/failure without secrets, headers, API/asset404 and configuration validation. No authentication/session/CSRF implementation or acceptance completion claimed |
| Browser response validation and initial accessibility; NFR-A11Y-001 partial | src/client/src/App.tsx, src/shared/src/index.ts | Four client tests; workflow/tests/browser/scaffold.spec.ts Chromium and axe smoke passed for the public setup page only. Product role flows and manual accessibility checks pending |
| Deployment topology | render.yaml, docs/Deployment.md; TECHNICAL-SPEC.md | Render/Neon dev/prod separation documented. Image URLs intentionally require configuration; cloud resources, image publishing/signing/promotion, backups and rollback are pending |

Command outcomes, corrections, independent review and resource limitations are in
[the base-source session log](../logs/ngkhengyang/2026-10-25-base-source-initialization.md).

## Architecture and submission initialization — 25 October 2026

`src/server/src/app.module.ts` registers seven empty business modules and imports
the configured `DatabaseModule`. Health/readiness remain the only public APIs.
Health contracts moved to `src/shared/src/contracts/health.ts` with unchanged public
exports. Client role folders are planned and will be added with their features. See
[Architecture](../docs/Architecture.md) for target responsibilities.

Required guide/reflection/site artifacts and a presence-check command are initialized;
see [Submission readiness](SUBMISSION.md). Presence does not satisfy role, AI,
deployment or experiment acceptance. Validation and limitations for this change are
recorded in [the session log](../logs/ngkhengyang/2026-10-25-architecture-initialization.md).

## Base authentication evidence — 25 October 2026

The earlier infrastructure tables describe historical scaffold evidence. Current
base auth is implemented in `src/server/src/identity`, the account/session migration,
shared identity contracts, and the React login/role landing pages. See
[Authentication](../docs/Authentication.md) and the
[auth session log](../logs/ngkhengyang/2026-10-25-authentication-rbac.md).

| Requirement / boundary | Evidence | Remaining scope |
| --- | --- | --- |
| REQ-SHR-001 / AC-SHR-001: authentication | HTTP tests cover protection, session rotation, logout replay, disablement/version changes and absolute expiry; PostgreSQL tests cover hashing, persistence and idle expiry; administrative create/disable/prune smoke passed | Automatic release of disabled reviewers' unfinished assignments requires future assignment implementation |
| REQ-SHR-002 / AC-SHR-002: base roles | Direct HTTP tests exercise all three roles against role-guarded handlers; strict login schema rejects client role fields; Chromium tests restore each role workspace | Ownership, assignment, lifecycle and expected-version checks belong in future domain services; full criterion remains partial |
| NFR-SEC-001 / AC-NFR-SEC-001 | PostgreSQL rolling-window account/IP and concurrent-throttle tests; HTTP CSRF/429 tests; Chromium Secure/HttpOnly/SameSite cookie checks behind simulated TLS proxy | Actual deployed HTTPS/proxy topology unverified |
| REQ-SHR-004: restricted security evidence | Auth paths write safe security events; account management uses transactional account/event changes; 90-day operational pruning command | Business audit/timeline and automated pruning scheduling remain pending |

Local checks: schema validation, typecheck, lint, production build, 23 backend
HTTP tests, eight client tests, eight PostgreSQL integration tests, four Chromium
tests, and production dependency audit (zero vulnerabilities) passed. The login
page axe scan reported zero violations; full product accessibility is unverified.

## Assignment and development-process evidence

[ASSIGNMENT-SPEC](specs/ASSIGNMENT-SPEC.md) defines MP4-001 through MP4-015. Its evidence-home column and [SUBMISSION](SUBMISSION.md) map the assignment to deliverables; documentation presence is not completion. The assignment capture/session checks are recorded in [the 26 October log](../logs/yooplo/2026-10-26-mp4-assignment.md). Role, live AI, deployment, experiment, contribution and human-verification evidence remain governed by their existing records.

| Obligation | Planned verification | Current evidence / gap |
| --- | --- | --- |
| MP4-004: development-process security | [AC-DEVSEC-001 through AC-DEVSEC-004](specs/AI-SECURITY-SPEC.md#development-agent-security-and-evidence) | Planned; no new adversarial workflow run executed by the assignment-capture task |
| MP4-006 / MP4-013: context/resource evidence and reflections | [Team experiment protocol](DEVELOPMENT.md#required-experiments-for-reflections), Reflections and linked evaluations | Capture preserves required analysis topics; experiments/results remain pending |
| MP4-014 / MP4-015: interaction summaries and declaration | Prompter logs, human accuracy/completeness review, Developer Guide acknowledgements | Current task logged and AI assistance declared; complete historical coverage and human sign-off not inferred |

## Product acceptance plan

Contributor Increment 1 local acceptance (27 October 2026): the initial foundation
gate was resolved by the two agreements relayed by yooplo, scoped in the
[integration proposal](../logs/yooplo/2026-10-27-contributor-foundation-proposal.md).
Independent acceptance revalidation executed 26 server/15 client unit tests, 22 PostgreSQL
tests and five Chromium cases, plus typecheck/lint/build. See
[run evidence, findings and security disposition](../logs/yooplo/2026-10-27-contributor-increment-1-run.md).
This verifies local create/list/detail, not editing, the full Contributor role, deployed
behavior, complete WCAG compliance or performance targets.

| Requirement / tested portion | Implementation | Executed evidence |
| --- | --- | --- |
| REQ-CON-001 / AC-CON-001 | [proposal create/list/detail service](../src/server/src/proposals/proposal-lifecycle.service.ts), strict contracts, private WorkingRevision and root/activity transaction | [PostgreSQL HTTP acceptance](../src/server/test/contributor-drafts.integration.ts): session-owned DRAFT, persistence, creation/activity rollback |
| REQ-CON-002 / AC-CON-002 private read only | Owner-scoped list and detail; private title remains outside shared root projection | Same PG suite: other-owner/role denial, cursor isolation and bounded equal-timestamp pages. Editing/attached-state/revision behavior unimplemented in this slice |
| REQ-SHR-001/002, NFR-SEC-001 local domain checks | Guard plus [business transaction context](../src/server/src/identity/business-context.ts), session-touch locking | Same PG suite: CSRF/role/unknown fields/account/session denials; pg_blocking_pids barriers for disable/logout/expiry, transaction-end expiry and touch wait |
| REQ-SHR-004/007 draft audit portion | Atomic DRAFT_CREATED activity; restricted content-free successful read audit | PG rollback/fail-closed assertions; independent rollback-only activity UPDATE rejected SQLSTATE 23514. UTC session/default-timestamp checked; remaining lifecycle activity not implemented |
| Authoritative limits / safe failures | [contracts](../src/server/test/contributor-contracts.spec.ts), 1 MiB [HTTP parser/filter](../src/server/src/http.ts) | Normalized Unicode max/max+1, >100 KiB valid payload, safe >1 MiB 413, strict injected-field rejection |
| REQ-SHR-005 / NFR-A11Y-001 tested draft flow | [Contributor workspace](../src/client/src/features/contributor/ContributorWorkspace.tsx) | [RTL cases](../src/client/src/features/contributor/ContributorWorkspace.test.tsx) and [Chromium flow](tests/browser/contributor-drafts.spec.ts): labels/error focus, keyboard, axe form/list/detail, 200% text at 640px and session loss. Full manual WCAG audit unavailable |
| Shared failure contract, DRAFT-SEC-005 | Workspace-level pending/uncertain creation state | RTL deferred Back→New request test: no duplicate POST, retained input and required reconciliation; independently rerun |

28 October review follow-up: [App auth-generation fix](../src/client/src/App.tsx) and
[App-level deferred-response tests](../src/client/src/App.test.tsx) cover obsolete-login401,
same/different-account relogin, focus-adopted account/CSRF replacement, normal refresh,
failed/obsolete logout and concurrent session-check invalidation. Independent acceptance
reran28client tests, clienttypecheck and rootlint; DRAFT-SEC-007 / DRAFT-ACC-002 fixed.
See [follow-up security/acceptance evidence and limitations](../logs/yooplo/2026-10-28-stale-session-response.md).
The original27October manifest/results describe the pre-fix source; this delta has separate
review hashes. No new server/database or deployed/browser verification is implied.

### Increment 2: never-submitted DRAFT editing — 28 October 2026

Local slice on `feature/contributor-own-draft-editing` is stacked on unmerged Increment1
commit `bb485ff`; final Increment1 teammate review remains pending. Existing PATCH/save DTO,
version/root-lock/helper and DRAFT_SAVED rules reused, no new shared interfaces or migrations.
See [Increment2 log and final review results](../logs/yooplo/2026-10-28-contributor-increment-2.md).

| Requirement / portion | Implementation and evidence |
| --- | --- |
| REQ-CON-002, AC-CON-002 never-submitted edit/owner denial | Proposal lifecycle save/controller; [real PG cases](../src/server/test/contributor-drafts.integration.ts) verify own repeated saves, other roles/owners, every excluded state/submission marker/attachment, preserving snapshots/hidden content |
| REQ-SHR-001/002/003, local NFR-SEC-001 | Same PG suite verifies session/CSRF, exact/stale/overflow version, one concurrent winner, access rechecks after lock wait and no denied mutation |
| REQ-SHR-004/007 / NFR-REL-001 draft-save transaction | DRAFT_SAVED committed with content/version; forced activity/expiry failure rolls all three back; safe metadata no private content |
| Shared failure contract / REQ-SHR-005 / NFR-A11Y-001 tested portion | [Editor RTL cases](../src/client/src/features/contributor/EditDraft.test.tsx) and [Chromium flow](tests/browser/contributor-editing.spec.ts): retained input, conflict/uncertain write lock, confirmed reload/reload failure, proposal/auth late-response isolation, current401, labels/keyboard/axe/reflow |

Independent runtime acceptance executed26server/43client unit,28PostgreSQL and6Chromium tests;
typecheck/lint/build and independent security checks also passed, as recorded in the log. One unchanged App500
test failed once during implementation but isolated/full/independent reruns passed unchanged;
INC2-VER-001 remains an unreproduced timing concern, not a claimed bug fix. Full manual WCAG,
performance and deployed verification unexecuted. Submitted editing, deletion, criteria management,
submission, responses, lifecycle/AI and Increment3 remain deferred; no full REQ-CON-002 claim.

### Increment 3: never-submitted DRAFT deletion — 28 October 2026

Subsequent authorization and both-teammate agreement are recorded in the
[deletion run](../logs/yooplo/2026-10-28-contributor-increment-3-run.md).
The branch starts at Increment2 head `1de749c`; PR10/11 remain unmerged at the latest
check and final patch approval is pending. The earlier Increment2 exclusions describe
that slice, not a prohibition on this separately authorized work.

| Requirement / portion | Implementation / validation status |
| --- | --- |
| AC-DEC-009 deletion portion; approved deletion policy | Strict DELETE DTO, owner service/controller, four-field DraftTombstone and guarded new migration; independent PG verifies full private-content removal, no submitted-history deletion, minimal tombstone and clean/upgrade migration evidence in run |
| REQ-SHR-001/002/003/004/007, NFR-REL-001 | Contributor PG cases independently passed, covering auth/versions/actual submitted history, duplicate/edit/fixture-submit races, rollback/expiry/lock waits, timestamp/ID reuse and direct guard misuse. Full PG36cases/four suites passed |
| REQ-SHR-005, NFR-A11Y-001, shared failure contract | [Delete RTL tests](../src/client/src/features/contributor/DeleteDraft.test.tsx) and [Chromium deletion flow](tests/browser/contributor-deletion.spec.ts) independently passed: confirmation/cancel focus/pending/conflict/uncertainty/lost committed response, fresh recheck and scoped late responses; full units27server/55client and7Chromium passed |

This is local deletion acceptance, not withdrawn/submitted deletion, actual submit integration,
deployed/manual full WCAG or whole-Contributor requirement completion. Final security
probe results and finding disposition are recorded in the run. INC2-VER-001's cause
remains unconfirmed despite passing reruns; no App assertions were changed.
The [independent test design](../logs/yooplo/2026-10-28-contributor-increment-3-tests.md)
distinguishes planned D01–D24 checks from executed evidence.

### Increment 4: private draft criteria — 28 October 2026

Scope and ngkhengyang's reported identity-contract agreement are recorded in the
[run](../logs/yooplo/2026-10-28-contributor-increment-4.md). Branch starts at unmerged
Increment3 head `86dc8f2`; PR10/11/12 final patch approval remains pending.

| Requirement / portion | Executed local evidence |
| --- | --- |
| REQ-CON-007 never-submitted classification | Existing PATCH/fullDTO defaults required, persists optional/classification with stable identity; zero/alloptional drafts valid, blank rows retained unsaved; contract/helper/PG/RTL/browser checks |
| REQ-CON-009 never-submitted identity | Explicit same-meaning assertion retains issued key; new/material rewrite omits key for server UUID; removal/re-add/foreign/duplicate/removed-key denial/repeated saves verified. No similarity/AI |
| REQ-CON-002, REQ-SHR-001/002/003/004/007, NFR-REL-001 | Owner/role/sessionCSRF/state/actual-history/version bounds and races; criteria and content-free DRAFT_SAVED atomic; audit/expiry rollback; existing deletion guards and create/edit/delete regression passed |
| REQ-SHR-005, NFR-A11Y-001, shared failure contract | [Criteria RTL](../src/client/src/features/contributor/CriteriaDraft.test.tsx), [Chromium criteria](tests/browser/contributor-criteria.spec.ts): keyboard/labels/focus/axe/reflow, validation/retained input, explicit meaning, failed/newer/malformed identity read recovery and proposal/auth callbacks |

Independent final30server/71client units,38PG cases/four suites,eightChromium cases,
typecheck/lint/build passed on the final manifest. INC4-UI-001 and INC4-VER-001 fixes
independently revalidated. No sharedDTO/schema/migration/App/auth edits. Separate final
security report is attributed in the run. Submitted classification changes/immutable
criterion history/finding resolution and complete AC-CON-007/009 remain deferred.
No full manual WCAG/deployment/performance evidence; INC2-VER-001 remains unresolved.

### Increment 5: draft submission preparation — 30 October 2026

PR10–13 merges verified; new branch starts at fetched origin/master `c384d39`.
[Brief/run and actual evidence](../logs/yooplo/2026-10-30-contributor-increment-5.md)
distinguish verified draft preparation from deferred submission and sanitization gates.

| Requirement / portion | Independent local evidence |
| --- | --- |
| REQ-CON-004 preparation/UI only; REQ-CON-002 ownership | Editor summary/diff/optional evidence plus safe detail; existing PATCH/DTO/WorkingRevision and auth/state/history/version/audit reused. No actual submission, revision, assignment or notification created |
| Integration input limits / strict references | Contract/PG cases verify500/501summary,100000/100001diff,50000/50001aggregate evidence, normalizedUnicode, blank evidence, exact1MiB/+1 and field-valid escaped JSON overflow; existing criterion/evidence ID preservation and scoped ID denial |
| REQ-SHR-001/002/003/004/007, NFR-REL-001 | Preparation auth/CSRF/owner/role/state/history/stale/CAS denials and audit/expiry rollback passed; safe summaries contain no preparation text; create/edit/criteria/delete regressions passed |
| REQ-SHR-005, NFR-A11Y-001, shared failure contract | [Preparation RTL](../src/client/src/features/contributor/PreparationDraft.test.tsx) and [Chromium](tests/browser/contributor-preparation.spec.ts): labels/focus, retained field/aggregate/413errors, conflict/read-failure recovery, keyboard/axe/reflow, inert escaped detail |

Independent31server/84client units,43PG/four suites,nineChromium,typecheck/lint/build passed
against final five-file manifest. Separate security report is attributed in the run.
No backend/sharedDTO/schema/migration/App/auth changes. Sanitization here is existing
LF normalization/strict bounded validation/escaped text, not a submission diff parser.
Empty summary/diff/evidence and zero/alloptional criteria remain saveable drafts.
Full AC-CON-004/immutable submitted summary/revisions/lifecycle/notifications/AI remain
deferred. Deployment/performance/full manual WCAG unavailable; INC2-VER-001 unresolved.

| Requirement | Authoritative definition / capability | Planned scenario | Implementation / test evidence |
| --- | --- | --- | --- |
| [REQ-CON-001](specs/ROLE-CONTRIBUTOR.md#requirements) | Draft proposal | [AC-CON-001](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Local create acceptance verified above; deployed verification pending |
| [REQ-CON-002](specs/ROLE-CONTRIBUTOR.md#requirements) | Edit ownership | [AC-CON-002](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Local private-read and never-submitted DRAFT edit/ownership/version/state/attachment portions covered above; submitted editing/revision lifecycle pending |
| [REQ-CON-003](specs/ROLE-CONTRIBUTOR.md#requirements) | AI specification draft | [AC-CON-003](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Pending |
| [REQ-CON-004](specs/ROLE-CONTRIBUTOR.md#requirements) | Submit revision | [AC-CON-004](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Increment5 draft-preparation portion locally verified above; actual submission/immutable revision/activity/notification gates pending |
| [REQ-CON-005](specs/ROLE-CONTRIBUTOR.md#requirements) | Respond to changes | [AC-CON-005](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Pending |
| [REQ-CON-006](specs/ROLE-CONTRIBUTOR.md#requirements) | Withdraw | [AC-CON-006](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Pending |
| [REQ-CON-007](specs/ROLE-CONTRIBUTOR.md#requirements) | Criterion classification | [AC-CON-007](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Private-draft portion verified above; submitted-classification scenario pending |
| [REQ-CON-008](specs/ROLE-CONTRIBUTOR.md#requirements) | Finding response | [AC-CON-008](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Pending |
| [REQ-CON-009](specs/ROLE-CONTRIBUTOR.md#requirements) | Criterion identity | [AC-CON-009](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | [Increment4 private-draft portion](../logs/yooplo/2026-10-28-contributor-increment-4.md) verified; submitted history/finding scenario pending |
| [REQ-REL-001](specs/ROLE-MAINTAINER.md#requirements) | Release candidate | [AC-REL-001](specs/ROLE-MAINTAINER.md#acceptance-scenarios) | Pending |
| [REQ-REL-002](specs/ROLE-MAINTAINER.md#requirements) | Deterministic gates | [AC-REL-002](specs/ROLE-MAINTAINER.md#acceptance-scenarios) | Pending |
| [REQ-REL-003](specs/ROLE-MAINTAINER.md#requirements) | AI readiness summary | [AC-REL-003](specs/ROLE-MAINTAINER.md#acceptance-scenarios) | Pending |
| [REQ-REL-004](specs/ROLE-MAINTAINER.md#requirements) | Publish release | [AC-REL-004](specs/ROLE-MAINTAINER.md#acceptance-scenarios) | Pending |
| [REQ-REL-005](specs/ROLE-MAINTAINER.md#requirements) | Post-release record | [AC-REL-005](specs/ROLE-MAINTAINER.md#acceptance-scenarios) | Pending |
| [REQ-REL-006](specs/ROLE-MAINTAINER.md#requirements) | Audit view | [AC-REL-006](specs/ROLE-MAINTAINER.md#acceptance-scenarios) | Pending |
| [REQ-REL-007](specs/ROLE-MAINTAINER.md#requirements) | Candidate responsibility and revocation notice | [AC-REL-007](specs/ROLE-MAINTAINER.md#acceptance-scenarios) | Pending |
| [REQ-REL-008](specs/ROLE-MAINTAINER.md#requirements) | Publication and revocation race | [AC-REL-008](specs/ROLE-MAINTAINER.md#acceptance-scenarios) | Pending |
| [REQ-REV-001](specs/ROLE-REVIEWER.md#requirements) | Review pool and assigned queue | [AC-REV-001](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-002](specs/ROLE-REVIEWER.md#requirements) | Criterion assessment | [AC-REV-002](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-003](specs/ROLE-REVIEWER.md#requirements) | AI risk review | [AC-REV-003](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-004](specs/ROLE-REVIEWER.md#requirements) | Finding management | [AC-REV-004](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-005](specs/ROLE-REVIEWER.md#requirements) | Review decision | [AC-REV-005](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-006](specs/ROLE-REVIEWER.md#requirements) | Stale review | [AC-REV-006](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-007](specs/ROLE-REVIEWER.md#requirements) | Claim and drop | [AC-REV-007](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-008](specs/ROLE-REVIEWER.md#requirements) | New revision notification | [AC-REV-008](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-009](specs/ROLE-REVIEWER.md#requirements) | Finding contents and provenance | [AC-REV-009](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-010](specs/ROLE-REVIEWER.md#requirements) | Resolved finding history | [AC-REV-010](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-011](specs/ROLE-REVIEWER.md#requirements) | Assignment availability | [AC-REV-011](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-012](specs/ROLE-REVIEWER.md#requirements) | AI response race | [AC-REV-012](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-013](specs/ROLE-REVIEWER.md#requirements) | AI suggestion handling | [AC-REV-013](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-014](specs/ROLE-REVIEWER.md#requirements) | AI size limits | [AC-REV-014](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-015](specs/ROLE-REVIEWER.md#requirements) | Human history and AI privacy | [AC-REV-015](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-016](specs/ROLE-REVIEWER.md#requirements) | Revoke approval | [AC-REV-016](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-SHR-001](specs/SHARED-REQUIREMENTS.md#shared-behavior) | Authentication | [AC-SHR-001](specs/SHARED-REQUIREMENTS.md#acceptance-scenarios) | Base authentication evidence above; assignment integration pending |
| [REQ-SHR-002](specs/SHARED-REQUIREMENTS.md#shared-behavior) | Role enforcement | [AC-SHR-002](specs/SHARED-REQUIREMENTS.md#acceptance-scenarios) | Base role guard verified; domain authorization pending |
| [REQ-SHR-003](specs/SHARED-REQUIREMENTS.md#shared-behavior) | Concurrency | [AC-SHR-003](specs/SHARED-REQUIREMENTS.md#acceptance-scenarios) | Pending |
| [REQ-SHR-004](specs/SHARED-REQUIREMENTS.md#shared-behavior) | Audit | [AC-SHR-004](specs/SHARED-REQUIREMENTS.md#acceptance-scenarios) | Pending |
| [REQ-SHR-005](specs/SHARED-REQUIREMENTS.md#shared-behavior) | Accessibility | [AC-SHR-005](specs/SHARED-REQUIREMENTS.md#acceptance-scenarios) | Pending |
| [REQ-SHR-006](specs/SHARED-REQUIREMENTS.md#shared-behavior) | Failure behavior | [AC-SHR-006](specs/SHARED-REQUIREMENTS.md#acceptance-scenarios) | Pending |
| [REQ-SHR-007](specs/SHARED-REQUIREMENTS.md#shared-behavior) | Visible submission activity | [AC-SHR-007](specs/SHARED-REQUIREMENTS.md#acceptance-scenarios) | Pending |
| [NFR-PERF-001](specs/SHARED-REQUIREMENTS.md#nonfunctional-requirements) | Performance | [AC-NFR-PERF-001](specs/SHARED-REQUIREMENTS.md#acceptance-scenarios) | Pending |
| [NFR-REL-001](specs/SHARED-REQUIREMENTS.md#nonfunctional-requirements) | Reliability | [AC-NFR-REL-001](specs/SHARED-REQUIREMENTS.md#acceptance-scenarios) | Pending |
| [NFR-SEC-001](specs/SHARED-REQUIREMENTS.md#nonfunctional-requirements) | Transport and session | [AC-NFR-SEC-001](specs/SHARED-REQUIREMENTS.md#acceptance-scenarios) | Pending |
| [NFR-PRV-001](specs/SHARED-REQUIREMENTS.md#nonfunctional-requirements) | Data minimization | [AC-NFR-PRV-001](specs/SHARED-REQUIREMENTS.md#acceptance-scenarios) | Pending |
| [NFR-A11Y-001](specs/SHARED-REQUIREMENTS.md#nonfunctional-requirements) | Accessibility | [AC-NFR-A11Y-001](specs/SHARED-REQUIREMENTS.md#acceptance-scenarios) | Pending |
| [NFR-OBS-001](specs/SHARED-REQUIREMENTS.md#nonfunctional-requirements) | Observability | [AC-NFR-OBS-001](specs/SHARED-REQUIREMENTS.md#acceptance-scenarios) | Pending |
| [NFR-PORT-001](specs/SHARED-REQUIREMENTS.md#nonfunctional-requirements) | Portability | [AC-NFR-PORT-001](specs/SHARED-REQUIREMENTS.md#acceptance-scenarios) | Pending |
| [NFR-RES-001](specs/SHARED-REQUIREMENTS.md#nonfunctional-requirements) | Resource budget | [AC-NFR-RES-001](specs/SHARED-REQUIREMENTS.md#acceptance-scenarios) | Pending |

## Existing application UI redesign — 30 October 2026

Presentation coverage for REQ-CON-001/002/007/009 (implemented private-draft portions),
REQ-SHR-005 and NFR-A11Y-001 is recorded in the
[redesign run](../logs/yooplo/2026-10-30-saas-ui-redesign-run.md).
The client adds a role-scoped collapsible navigation shell, responsive draft dashboard,
consistent forms/status/confirmation styling and a shared decorative icon component.
Existing business/API contracts remain intact. Independent synthetic-API Chrome
checks and screenshots cover the implemented screens; they do not establish live
backend authorization, submitted-revision behavior or full WCAG compliance.
The run records exact checks, environment failures and remaining manual review.

## Evidence update rule

Shell refinement, 31 October 2026: REQ-SHR-005 / NFR-A11Y-001 presentation checks
now include independent workspace/navigation scroll containers, stationary desktop
sidebar/topbar, accessible collapsed icon rail and native mobile navigation dialog.
The [refinement run](../logs/yooplo/2026-10-31-shell-scroll-refinement.md) links the
actual browser assertions, responsive screenshots, unit/build checks and remaining
manual accessibility gaps. No domain-contract or authorization change is included.

Add actual source/test paths, scenario/test names, commands/results, environment/version and independent review evidence for each implemented slice. Record failures and open decisions. Documentation or mock existence alone is not a pass. Expand multi-clause requirements into normal, boundary, failure and authorization cases. Update affected criteria, contracts, scenarios and guides with material behavior changes; tests verify intent rather than mirror implementation. OPEN-001 through OPEN-009 now record approved baseline policy; OPEN-002 live verification and actual implementation/evidence remain pending.


## Decision acceptance cases

Unless a row links executed evidence, cases below remain planned and unexecuted. They supplement rather than replace the original 48 requirement mappings. Detailed limits/schemas in the linked specs are the authority; these cases test their effect.

| Scenario | Decision / requirements | Verification obligation | Evidence |
| --- | --- | --- | --- |
| AC-DEC-001 | OPEN-001; REQ-REV-003/014, REQ-CON-003, REQ-REL-003 | Analyze batches of 1 and 5 selected criteria; reject 0/6, missing/duplicate/unknown coverage IDs, invalid confidence/severity, extra fields and truncated JSON. Label unselected criteria not analyzed; never write human coverage. Validate all three exact role schemas. | Pending |
| AC-DEC-002 | OPEN-002; NFR-RES-001/PRV-001 | Verify configured endpoint/key-scoped catalog and actual alias context/parameters; test 4k/10k/6k input and 800 output caps, retry attempt accounting, SGT application versus UTC provider reset, unknown usage, no cache and safe disabled-AI fallback. | Pending live provider and mocked tests |
| AC-DEC-003 | OPEN-003; REQ-SHR-002/003, REQ-CON-004, REQ-REV-005/016, REQ-REL-004 | Boundary-test text/count/body limits and cursor sizes. Same actor/key/body replays one committed mutation/event/notice; changed body gives conflict; access loss denies replay disclosure; stale writes and concurrent keys never duplicate state. | Pending |
| AC-DEC-004 | OPEN-004; REQ-SHR-001/002, NFR-SEC-001 | Enforce one role/project, seed without Git credentials, 30-minute idle/eight-hour absolute expiry, rotation/logout/disablement, account and IP throttles, generic errors and saved-draft-only recovery. | Pending |
| AC-DEC-005 | OPEN-005; REQ-REL-001/002/004/007/008 | Other Maintainer cannot edit/publish; empty or duplicate-version publication fails. PASS smoke test must match current content version; add/remove/change revision invalidates it; revocation independently blocks release. | Pending |
| AC-DEC-006 | OPEN-006; REQ-SHR-004/007, REQ-REV-015 | Order equal-time events by ID, page by cursor, retain business events while pruning operational records after 90 days; views/rejections/read acknowledgments stay restricted and no prior-reviewer AI data leaks. | Pending |
| AC-DEC-007 | OPEN-007; REQ-CON-004, REQ-REV-001/008/015 | Submit with summary, resubmit later, preserve original age and show latest age. Severity filter matches unresolved findings only. Withdrawn owner/Maintainer access works and former-reviewer notice cannot reopen content. | Pending |
| AC-DEC-008 | OPEN-008; NFR-PERF-001/A11Y-001/OBS-001/RES-001 | Run fixed workload and applicable accessibility checks; dashboard computes failure denominator correctly, displays N/A for zero attempts, unknown for absent token/cache usage, and enforces aggregate/own-user privacy. | Pending |
| AC-DEC-009 | OPEN-009; REQ-CON-006, REQ-SHR-004/007 | Confirm never-submitted draft deletion removes text but retains non-content tombstone; deletion after submission fails; draft withdrawal stays terminal and submitted revision/activity history survives withdrawal. | Increment3 deletion portion locally acceptance-verified above; withdrawal portion remains pending |
