# Local draft creation recovery

- Prompter: `yooplo`, inferred from Git identity. Date: 2 November 2026, Asia/Singapore. Human verification of this AI-produced summary pending.
- Context: after instructions for local startup and manual Contributor AI testing, the user supplied a screenshot showing draft creation HTTP500 at `/api/proposals`, retained form text and the uncertainty lock. Earlier console401 responses were also visible, but were not assumed to cause the draft500. Previous manual testing advice covered synthetic saved draft → Generate → selection → Apply → Save, usage and disabled-AI manual recovery; that advice was not itself execution evidence.
- Task interpretation: diagnose and repair the local development blocker while preserving data, browser text, credentials and existing repository edits. No production operation or product-code change requested or performed.

## Diagnosis

- Read current controller/lifecycle transaction, activity service, database client, schema/migrations and CreateDraft uncertainty recovery. Corrected nonexistent exploratory file paths using source discovery; no check was inferred from failed reads.
- Read only schema/migration metadata and nonsecret connection metadata from the configured loopback development database. Five migrations were applied; four pending: `20261026090000_reviewer_ai`, `20261026160000_approval_revocation`, `20261101050000_contributor_responses`, `20261101060000_contributor_ai`.
- The database lacked `ProposalActivity.candidateId`; a zero-row column query returned PostgreSQL42703. The current Prisma activity create returns that column during the atomic draft-create transaction. This schema mismatch explains the draft500. Public health/readiness were both200 because readiness checks connectivity, not migration completeness. No raw draft, account/session data, API key or database credentials were printed or persisted in the log.

## Recovery and verification

1. Reviewed pending SQL: existing migrations add AI/release/response structures and associated constraints; no reset/truncation or new migration was used. Existing release migration includes its own safety checks against converting populated partial release structures.
2. First backup attempt with bundled PostgreSQL16.15 `pg_dump` failed against server17.11. The guarded command stopped before migrations. Failed tool attempt retained; no retrospective timing fabricated. An empty failed dump file remains ignored.
3. Confirmed the repository Compose database is the healthy PostgreSQL17 container on loopback5432. Used its matching `pg_dump --format=custom`, with credentials supplied via process environment and no credential values in command text/output. Backup succeeded (94,475 bytes), and container `pg_restore --list` accepted the archive. Private backup remains **ignored** at `.tools/local-db-recovery/before-pending-migrations-pg17.dump`; it is not copied into evidence or version control. Archive readability is verified; a full restore rehearsal was not performed.
4. Invoked existing Prisma `migrate deploy --config src/server/prisma.config.ts` using portable x64 Node, with process-only `DIRECT_DATABASE_URL` pointing to the diagnosed local application database. All four pending migrations applied, exit0. No ordinary `.env` edit, data reset/seed, application process stop, product source change or provider request.
5. Verified all nine migrations completed. A rollback-only Prisma transaction used one existing enabled Contributor's opaque ID and synthetic content to exercise root create → working-copy create → `DRAFT_CREATED` activity create, including `candidateId:null`. It completed those writes then intentionally rolled back. Follow-up counts confirmed zero synthetic root, working-copy or activity rows persisted. This is an administrative schema/ORM smoke check, not a fresh authenticated browser test or an authorization bypass added to the application.

## User recovery

Use **Back to your drafts**, confirm navigation and let the list finish loading. Check for an existing draft before creating again. Returning to Create draft within the workspace clears the uncertainty lock and retains form state by design. Continue the saved-draft AI workflow after successful creation. A fresh browser create after migration remains for the user to confirm; no claim that their existing screen updated automatically.

Only this log and resource artifacts were added to reviewable repository paths. Existing uncommitted schema integration and unrelated user edits preserved. No commit/push/deployment. [Resource report](resources/2026-11-02-draft-create-diagnosis/verification/resource-report.md) covers this single main-agent diagnostic/recovery invocation, including the failed backup and corrected attempt; no specialist invocation. Agent model/effort/token/cache/tool telemetry unavailable. Recording started before repository edits; final report rendering outside measured interval.
