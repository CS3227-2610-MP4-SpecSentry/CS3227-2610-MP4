# Release Maintainer and deployment foundation

## Context and requests

- Prompter: `yu-sutong`, inferred from Git identity `Yu Sutong <e0483972@u.nus.edu>` and confirmed by the Release Maintainer ownership in the product specification.
- Date/timezone: 4 November 2026, Asia/Singapore.
- General context: the user asked for the current teammate/role and deployment status, then explicitly requested implementation and confirmed that the proposed deployment-agent workflow must actually be used.
- Change requests: begin Release Maintainer implementation; create and use a distinct deployment-agent workflow that provides individual presentation evidence. The initial request did not authorize provider provisioning, credentials, remote deployment, commit, push or merge. The user later authorized commit/push specifically through the `yu-sutong` GitHub account; deployment and merge remain unauthorized.
- Human verification of this AI-produced summary: pending.

## Workflow execution

- Main agent: Deployment Coordinator and integrator; owns client/workflow/docs/log integration.
- Maintainer Architect: read-only analysis of existing release contracts, APIs, tests and missing browser flow. Recommended candidate create/list/open/edit as the first complete slice.
- Deployment Architect: read-only analysis of Docker/CI/Render/Neon. Proposed immutable GHCR digest publication, separate development deployment, protected production promotion, and manual rollback/recovery gates. No external mutation occurred.
- Security Reviewer: read-only pre-review required server-authoritative readiness, creator-only mutation controls, stale/uncertain reconciliation, secret isolation, least-privilege deployment triggers and an immutable digest. The bounded post-fix pass then found one P2 older-list/create overlap; the coordinator disabled overlapping list/create controls and added a regression test. A fresh security invocation passed that disposition with no new regression.
- Role Implementer: implemented the disjoint strict release-list contracts, Maintainer-only endpoint, scoped deterministic cursor pagination and focused server tests. Its shared build, 124 server tests, type-check, owned lint and diff check passed.
- Database and Recovery Specialist: confirmed the slice changes no Prisma schema/migration, requires no new migration and is locally backward-compatible. It kept image rollback separate from human-approved database restore and left Neon/provider verification blocked.
- Release Verifier: independently reviewed the frozen code candidate. The first invocation found four actionable UI findings; the coordinator corrected all four, and a fresh read-only invocation passed every disposition with no new regression.
- Spec and Docs Verifier: found an overstated smoke step, stale Deployment-guide product status, missing post-fix Security Reviewer evidence and pending push-authorization reconciliation. The documentation issues were corrected; a fresh bounded Security Reviewer passed after one fixed P2, and the final docs recheck passed all four dispositions without a new contradiction.

## Implemented foundation

- Added `workflow/deployment/` with Coordinator, Deployment Implementer, Database/Recovery Specialist, Security Reviewer, Release Verifier and Spec/Docs Verifier instructions plus a run template and explicit external stop conditions.
- Added a strict paginated Maintainer-only `GET /api/release-candidates`, status filtering and project/filter-bound `(createdAt,id)` cursors.
- Added the `/releases/*` workspace for list/filter/create/open/detail/edit, responsible-Maintainer display, server-computed blockers, owner-only edit controls and safe plain-text rendering.
- Create and edit uncertainty now prevents another mutation until an authoritative refresh succeeds. Late mutation responses are ignored after workspace unmount/session replacement.
- Added eight focused client cases and three focused server cases. Reconciled README, User/Developer/Deployment guides, plan and traceability without claiming the unfinished role or a live deployment.
- External state: no provider, repository setting, secret, migration, deployment, commit, push or merge was changed.

## Findings and validation

The first Release Verifier reported:

1. uncertain create could unlock before refresh succeeded;
2. stale/uncertain edit copy did not enforce refresh;
3. late mutation callbacks were not bound to the mounted/current session;
4. the responsible Maintainer was not displayed.

All four were fixed with regression coverage. Fresh independent re-verification
passed. A later bounded Security Reviewer found that a list request started before
an uncertain create could theoretically clear its lock. Creation, filtering and
pagination now cannot overlap list loading or a pending/uncertain create; the new
race regression and fresh security invocation passed. Final local validation passed:

- server unit tests: 18 suites, 124 tests;
- client tests: 16 files, 259 tests;
- root type-check, lint, production build and `git diff --check`;
- focused Maintainer client tests: 8/8;
- focused release-list server tests: 3/3 within the server suite.

The build retains a non-failing large-client-chunk warning. The list endpoint has
mocked service coverage rather than authenticated HTTP/PostgreSQL acceptance; no
browser E2E, live image, migration, provider smoke, rollback/recovery rehearsal or
production approval was run.

## Deployment decision

The designed path is: successful reviewed development source → one GHCR image with
provenance/signature → deploy the immutable digest to a separate Render development
service → bounded migration/role smoke evidence → protected human production
approval → promote the exact same digest. Production rollback redeploys a previously
verified digest only when schema compatibility holds; database recovery is a
separate reviewed Neon restore decision. Current `render.yaml` remains a template,
the existing CI does not publish/deploy, and the live path remains blocked on
provider targets, secrets, protected environments, migration/UTC checks and real
smoke/rollback evidence.

The instantiated run and frozen code hashes are in
[the run record](2026-11-04-maintainer-deployment-run.md).

## Resource record

- Structured records: `logs/yu-sutong/resources/2026-11-04-maintainer-deployment/`.
- Timing coverage began before the first repository edit. Token/cache/tool/retry and observed child-model telemetry are unavailable because the runtime does not expose attributable per-agent counters.
- One verifier interval began immediately after dispatch rather than before it; that boundary limitation is retained in its record. The first verifier's optional broad security sub-scan was interrupted to keep the release gate bounded; the manual release review completed, followed by fresh focused Release Verifier and Security Reviewer passes.
- The generated report and complete resource table are appended after all intervals finish.
