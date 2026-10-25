# Proposed implementation ownership — not dispatched

Run `2026-10-25-reviewer-intake`. User requires a pause before implementation. All selections and paths below are proposals; only the read-only security agent has been started. Security findings may refine these boundaries before they are frozen.

## Sequence, selections, and rationale

1. Foundation implementer: `gpt-6.1-sol`, high. Own physical persistence and browser-safe wire schemas first; relational constraints and assignment provenance need careful implementation. Finish foundation checks and handoff before dependent domain implementation starts.
2. Backend implementer: `gpt-6.1-sol`, high. Own claim/drop/read authorization, account-disable serialization, transactions and real PostgreSQL tests. These coupled security invariants stay with one worker.
3. Frontend implementer: `gpt-6.1-sol`, medium. Own typed Reviewer pages, access-loss handling, client tests and browser flow. Can run alongside backend once foundation contracts are frozen; browser integration awaits backend.
4. Independent implementation reviewer: `gpt-6-astra`, high, read-only. Derive requirement/denial/race checks and assess integrated implementation; never author its production fixes. Same reviewer may revalidate fixes.
5. Existing security reviewer: `gpt-6-astra`, high, read-only. Design review now; re-review material access, persistence, lifecycle or transaction changes during implementation.

Main owns shared-contract decisions, coordination/integration, configuration and evidence, not concurrent implementation workers' files. Four concurrent slots include main. Foundation is sequential; backend/frontend plus main occupy three; independent review starts after implementation writers finish. Security can be reused as a read-only specialist but independent implementation review retains a distinct assignment. The exact selected parent model/effort is not exposed; no guessed parent identifier is recorded.

## Exclusive proposed write sets

| Assignment | Allowed files/subtrees | Dependencies and completion evidence |
| --- | --- | --- |
| foundation | `src/server/prisma/schema.prisma`; `src/server/prisma/migrations/20261025070000_reviewer_intake`; `src/server/src/generated/prisma`; `src/shared/src/contracts/reviewer.ts`; `src/shared/src/index.ts` | Brief and settled security controls. Own all schema/generated artifacts and exports. Validate migration/unique constraint on disposable PostgreSQL, generate Prisma, build shared; return concrete signatures/schema/migration evidence. |
| backend | `src/server/src/reviews`; `src/server/src/proposals`; `src/server/src/activity`; `src/server/src/identity/manage-account.ts`; `src/server/src/identity/account-administration.service.ts`; `src/server/test/reviewer-contracts.spec.ts`; `src/server/test/reviews.spec.ts`; `src/server/test/reviews.integration.ts`; `src/server/test/reviewer-seed.integration.ts`; `src/server/test/reviewer-disable.integration.ts` | Foundation complete. Own all account-disable and assignment transaction participants and tests; export transaction-aware operations, module registration and fixture interfaces. Prove real DB races/rollback/authorization and preserve auth behavior. No schema/contract edits without main coordination. |
| frontend | `src/client/src`; `workflow/tests/browser/reviewer-intake.spec.ts`; `workflow/tests/browser/fixtures/reviewer-intake.ts` | Foundation contracts complete; API can initially be mocked; final browser flow waits for backend/main integration and seeded disposable DB. Own UI, App routing, client regression and keyboard/axe evidence. Do not alter existing browser scaffold tests unless reassigned. |
| main-integration | `src/server/src/app.module.ts`; `src/server/src/http.ts`; `src/server/src/identity/identity.module.ts`; `package.json`; `src/server/package.json`; `playwright.config.ts`; `docs/Architecture.md`; `docs/UserGuide.md`; `docs/DeveloperGuide.md`; `docs/Authentication.md`; `workflow/TRACEABILITY.md`; `logs/ngkhengyang/2026-10-25-reviewer-intake.md`; `logs/ngkhengyang/reviewer/2026-10-25-reviewer-intake` | Integration only after owners provide changes. Own shared config/scripts/module wiring, safe-error integration if needed, evidence, docs and traceability. Do not add dependencies unless implementation establishes a need; lockfile remains unassigned until then. |

The schema/migration path is a proposed new migration, not an existing artifact. Generated outputs remain ignored where repository conventions say so. Each worker must preserve others' changes and request coordination before crossing its write set. Workers return handoff content; main persists run artifacts.

## Interfaces to freeze before dispatch

- Shared browser schemas and types: PoolItem, AssignedItem, ReviewerSubmissionDetail, SubmittedRevisionSummary, SafeActivityItem, ClaimRequest/DropRequest/AssignmentCommandResponse, scoped list queries/responses and safe error response. Foundation supplies final exported names matching the brief; main approves before parallel workers start.
- Proposals exposes a transaction-aware root-lock and submitted-content authorization interface; Reviews coordinates assignment commands and Activity append. Account administration calls Reviews release operation using the SAME transaction/client after acquiring the account lock; no second commit.
- Backend modules expose `register(config)` when requiring the configured DatabaseModule; main wires them through AppModule. No hidden global mutable database instance.
- Backend fixture function accepts explicit database/transaction and validated development/test mode. Browser fixture setup invokes the function under test configuration against TEST_DATABASE_URL before the production-mode test server starts, never through an HTTP seed endpoint.
- Review detail response generation tags and cleanup are frontend-owned; backend enforcement remains authoritative.

## Completion evidence expected later

Trace INT-01–INT-11 to actual test names and results, especially claim/claim, disable/claim, drop/reclaim stale identity, projection field leakage and activity rollback/pruning. Run manifest-discovered schema validation/generation, typecheck, lint, unit/HTTP/client tests, PostgreSQL integration, production build and relevant Chromium checks. Report environment limitations rather than invent passes. Freeze integrated files and snapshot before independent review; batch fixes by original owner and revalidate. No product acceptance is claimed at this checkpoint.
