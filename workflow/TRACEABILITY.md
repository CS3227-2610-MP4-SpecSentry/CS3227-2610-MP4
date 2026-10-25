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

## Reviewer intake increment — 25 October 2026

This increment supplies development/test submissions and implements Reviewer
intake. It does not complete the full Reviewer role. Effective acceptance scope
INT-01–INT-11 and exclusions are in the [session brief](../logs/ngkhengyang/reviewer/2026-10-25-reviewer-intake/brief-v1.md)
and its [security refinements](../logs/ngkhengyang/reviewer/2026-10-25-reviewer-intake/brief-v2.md).

| Requirement / delivered boundary | Source and verification evidence | Remaining scope |
| --- | --- | --- |
| REQ-REV-001 partial: pool/own queues, author/original-age/state filters, original/latest ages, bounded pages | `src/server/src/reviews`, `src/shared/src/contracts/reviewer.ts`, `src/client/src/features/reviewer`; `reviews.integration.ts` INT-02/03 and client tests | Unresolved-severity filter requires findings; full performance protocol pending |
| REQ-REV-007 partial: concurrent claim, eligible-state drop, takeover, immediate server access loss and retained assignment provenance | `reviews.integration.ts` INT-04/06/07 includes actual claim/claim, drop/reclaim and stale-assignment races; migration enforces one ACTIVE row and immutable historical provenance; Chromium intake walkthrough | Finding/coverage preservation and takeover confirmation need future finding/coverage modules |
| REQ-REV-011 partial: no expiry; atomic account disable/release into correct queues; frozen assignment noninterference | Account administration and `reviews.integration.ts` INT-08: claim/drop/disable races, session version/role recheck, assignment-write and activity rollback | Effective approval/decision preservation remains to be verified when approval records exist |
| REQ-REV-015 partial: assigned-only immutable submitted detail/history and permitted human activity | Explicit server projections; INT-05/09 cross-proposal and revoked-page checks; paginated revisions; private drafts/AI data absent from contracts | Findings/responses/decisions and private AI audit integration remain pending |
| REQ-SHR-001/002/003/004/007 partial: Reviewer authorization, optimistic versions, atomic business events and retention separation | Real HTTP/CSRF/role checks, locked account/session version and proposal roots; business activity separate from prunable SecurityEvent; INT-01/05/07/08/09/11 | Other role domain operations and remaining event families remain pending |
| REQ-SHR-005 / NFR-A11Y-001 partial: keyboard activation/focus and automated intake scan | `workflow/tests/browser/reviewer-intake.spec.ts`; axe scan of the selected review detail; escaped hostile-text checks; client response-race tests | Full keyboard-only, zoom/reflow, all-role and deployed accessibility acceptance remains pending |

Recorded local checks after independent-review fixes include schema validation,
typecheck, lint, 32 backend unit/HTTP tests, 38 client tests and 31 PostgreSQL
integration tests. Production build and five Chromium tests are also recorded in
the session evidence. The initial integrated client run
failed two expiry cases; the reproduced initial-load/navigation race was fixed with
explicit intent invalidation and a deterministic regression. Failures and fresh
source-bound command evidence are retained in the [session log](../logs/ngkhengyang/2026-10-25-reviewer-intake.md).
Independent review additionally identified missing restricted audit for controller
validation rejections, pagination controls stuck pending after focus refresh, and
omitted revision/entity/outcome context in the activity UI. Original owners fixed
each with regression coverage; the session records independent revalidation.
Independent review status and any subsequent fixes are recorded there; these
command results alone are not a release or full product acceptance claim.

## Product acceptance plan

| Requirement | Authoritative definition / capability | Planned scenario | Implementation / test evidence |
| --- | --- | --- | --- |
| [REQ-CON-001](specs/ROLE-CONTRIBUTOR.md#requirements) | Draft proposal | [AC-CON-001](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Pending |
| [REQ-CON-002](specs/ROLE-CONTRIBUTOR.md#requirements) | Edit ownership | [AC-CON-002](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Pending |
| [REQ-CON-003](specs/ROLE-CONTRIBUTOR.md#requirements) | AI specification draft | [AC-CON-003](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Pending |
| [REQ-CON-004](specs/ROLE-CONTRIBUTOR.md#requirements) | Submit revision | [AC-CON-004](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Pending |
| [REQ-CON-005](specs/ROLE-CONTRIBUTOR.md#requirements) | Respond to changes | [AC-CON-005](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Pending |
| [REQ-CON-006](specs/ROLE-CONTRIBUTOR.md#requirements) | Withdraw | [AC-CON-006](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Pending |
| [REQ-CON-007](specs/ROLE-CONTRIBUTOR.md#requirements) | Criterion classification | [AC-CON-007](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Pending |
| [REQ-CON-008](specs/ROLE-CONTRIBUTOR.md#requirements) | Finding response | [AC-CON-008](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Pending |
| [REQ-CON-009](specs/ROLE-CONTRIBUTOR.md#requirements) | Criterion identity | [AC-CON-009](specs/ROLE-CONTRIBUTOR.md#acceptance-scenarios) | Pending |
| [REQ-REL-001](specs/ROLE-MAINTAINER.md#requirements) | Release candidate | [AC-REL-001](specs/ROLE-MAINTAINER.md#acceptance-scenarios) | Pending |
| [REQ-REL-002](specs/ROLE-MAINTAINER.md#requirements) | Deterministic gates | [AC-REL-002](specs/ROLE-MAINTAINER.md#acceptance-scenarios) | Pending |
| [REQ-REL-003](specs/ROLE-MAINTAINER.md#requirements) | AI readiness summary | [AC-REL-003](specs/ROLE-MAINTAINER.md#acceptance-scenarios) | Pending |
| [REQ-REL-004](specs/ROLE-MAINTAINER.md#requirements) | Publish release | [AC-REL-004](specs/ROLE-MAINTAINER.md#acceptance-scenarios) | Pending |
| [REQ-REL-005](specs/ROLE-MAINTAINER.md#requirements) | Post-release record | [AC-REL-005](specs/ROLE-MAINTAINER.md#acceptance-scenarios) | Pending |
| [REQ-REL-006](specs/ROLE-MAINTAINER.md#requirements) | Audit view | [AC-REL-006](specs/ROLE-MAINTAINER.md#acceptance-scenarios) | Pending |
| [REQ-REL-007](specs/ROLE-MAINTAINER.md#requirements) | Candidate responsibility and revocation notice | [AC-REL-007](specs/ROLE-MAINTAINER.md#acceptance-scenarios) | Pending |
| [REQ-REL-008](specs/ROLE-MAINTAINER.md#requirements) | Publication and revocation race | [AC-REL-008](specs/ROLE-MAINTAINER.md#acceptance-scenarios) | Pending |
| [REQ-REV-001](specs/ROLE-REVIEWER.md#requirements) | Review pool and assigned queue | [AC-REV-001](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Partial: Reviewer intake evidence above; severity filter pending |
| [REQ-REV-002](specs/ROLE-REVIEWER.md#requirements) | Criterion assessment | [AC-REV-002](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-003](specs/ROLE-REVIEWER.md#requirements) | AI risk review | [AC-REV-003](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-004](specs/ROLE-REVIEWER.md#requirements) | Finding management | [AC-REV-004](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-005](specs/ROLE-REVIEWER.md#requirements) | Review decision | [AC-REV-005](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-006](specs/ROLE-REVIEWER.md#requirements) | Stale review | [AC-REV-006](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-007](specs/ROLE-REVIEWER.md#requirements) | Claim and drop | [AC-REV-007](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Partial: claim/drop/race/access evidence above; finding/coverage takeover integration pending |
| [REQ-REV-008](specs/ROLE-REVIEWER.md#requirements) | New revision notification | [AC-REV-008](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-009](specs/ROLE-REVIEWER.md#requirements) | Finding contents and provenance | [AC-REV-009](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-010](specs/ROLE-REVIEWER.md#requirements) | Resolved finding history | [AC-REV-010](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-011](specs/ROLE-REVIEWER.md#requirements) | Assignment availability | [AC-REV-011](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Partial: atomic disable/release/race evidence above; approval-record integration pending |
| [REQ-REV-012](specs/ROLE-REVIEWER.md#requirements) | AI response race | [AC-REV-012](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-013](specs/ROLE-REVIEWER.md#requirements) | AI suggestion handling | [AC-REV-013](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-014](specs/ROLE-REVIEWER.md#requirements) | AI size limits | [AC-REV-014](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Pending |
| [REQ-REV-015](specs/ROLE-REVIEWER.md#requirements) | Human history and AI privacy | [AC-REV-015](specs/ROLE-REVIEWER.md#acceptance-scenarios) | Partial: assigned submitted detail/history/activity evidence above; finding/decision/private AI integration pending |
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

## Evidence update rule

Add actual source/test paths, scenario/test names, commands/results, environment/version and independent review evidence for each implemented slice. Record failures and open decisions. Documentation or mock existence alone is not a pass. Expand multi-clause requirements into normal, boundary, failure and authorization cases. Update affected criteria, contracts, scenarios and guides with material behavior changes; tests verify intent rather than mirror implementation. OPEN-001 through OPEN-009 now record approved baseline policy; OPEN-002 live verification and actual implementation/evidence remain pending.


## Decision acceptance cases

All cases below are planned and currently unexecuted. They supplement rather than replace the original 48 requirement mappings. Detailed limits/schemas in the linked specs are the authority; these cases test their effect.

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
| AC-DEC-009 | OPEN-009; REQ-CON-006, REQ-SHR-004/007 | Confirm never-submitted draft deletion removes text but retains non-content tombstone; deletion after submission fails; draft withdrawal stays terminal and submitted revision/activity history survives withdrawal. | Pending |
