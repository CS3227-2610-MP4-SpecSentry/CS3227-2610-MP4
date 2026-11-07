# Neon production setup prompt and change log

## Context and requests

- Prompter: `yu-sutong`, explicitly supplied earlier for repository/GitHub work.
- Date/timezone: 2026-11-07, Asia/Singapore.
- General context: continue the deployment-agent work by provisioning the supplied Neon project, installing and following Neon's current agent guidance, wiring the existing NestJS/Prisma application to Neon-managed environment variables, and verifying the result without publishing repository changes.
- Explicit requests:
  - install the Neon agent skills with `npx neon skills -y`;
  - use Neon CLI 9.0.0 through the global installation or the instructed `npx neon@latest` fallback;
  - initialise the supplied organisation/project/`production` branch for Postgres and run `neon deploy`;
  - preserve the existing application architecture, wire the pulled variables, pass `npm run build`, start the app, and test the service end to end;
  - fetch and follow `https://neon.com/.well-known/agent-skills/neon/SKILL.md`, verify project skills and the Neon MCP integration, install/update anything missing, preserve configuration, and summarize every change;
  - complete the remaining Neon/Render setup where prerequisites permit.
- Human summary verification: pending.

## Changes and external actions

- Installed the seven Neon skills locally under `.agents/skills/` and recorded them in `skills-lock.json`. The fetched Neon skill matched the installed copy by SHA-256. Updated the one stale `neon-functions` skill locally and in the user-level skill set; final status reported all seven skills current in both scopes.
- Verified the Codex Neon plugin at user scope and its credential-free MCP declaration for `https://mcp.neon.tech/mcp`. Per the Neon skill, no duplicate MCP server was installed after `neon init` installed the plugin.
- `npm i -g neon@latest` failed with a macOS `/usr/local` permission error. Used the requested `npx neon@latest` fallback successfully.
- Authenticated the Neon CLI through the browser OAuth flow. No API key or connection credential was recorded.
- Added `neon.ts`, the ignored `.neon` context, `.gitignore` coverage, and Neon config/env dependencies through `neon init`. The final local context points to the supplied `specsentry-production` project and `production` branch.
- Ran `neon config plan` and `neon deploy` for production. Both reported Postgres as the only utilized service and no infrastructure-policy changes; deploy pulled five managed variables to ignored `.env.local`.
- Created the separate `specsentry-development` Neon project in `aws-ap-southeast-1` on PostgreSQL 18, deployed the same Postgres-only policy, and kept its credentials separate from production.
- Set the `neondb` database default `TimeZone=UTC` in both Neon projects. Sanitized HTTPS queries verified PostgreSQL `180006`, the persisted `TimeZone=UTC` database setting, and no `_prisma_migrations` table in production; development was also confirmed empty before its failed migration attempt.
- During an early local diagnostic, a connection string reached local command output. The production default role password was immediately rotated and `.env.local` was refreshed. The obsolete credential and replacement were not written to repository logs or documentation.
- Added `.env.local` before `.env` loading for the server, account administration, seeds, reviewer fixtures, AI cleanup, and Prisma CLI. Added `DATABASE_URL_UNPOOLED` as the Neon-compatible direct migration fallback while preserving protected `DIRECT_DATABASE_URL` support.
- Preserved the existing Prisma 7 + `@prisma/adapter-pg`/`pg` architecture because the installed Neon PostgreSQL guidance recommends retaining an established ORM and using `node-postgres` for a long-running server. No Neon Auth, Functions, Data API, Realtime, Object Storage, or AI Gateway service was enabled.
- Normalized Neon `sslmode=require` URLs to explicit `sslmode=verify-full` in application and Prisma configuration while preserving `channel_binding=require`.
- Extended the release database guard and tests from PostgreSQL 14-17 to 14-18 because both selected Neon projects use PostgreSQL 18. Tests accept 18 and continue to reject 13 and 19.
- Render services were not created. The repository has no published immutable GHCR digest yet, and the deployment specification requires image-backed Render services created from that verified digest rather than a source-build or placeholder service.
- No repository commit, push, pull request, remote migration, Render deployment, or production application deployment occurred.

## Validation and outcomes

- `npx neon@latest skills status` and `--global`: all seven installed skills up to date.
- Codex plugin inspection: Neon MCP server declaration present; no credential embedded in the plugin manifest.
- `npx neon@latest config plan`: production already matched the Postgres-only policy.
- `npx neon@latest deploy`: succeeded for development and production, with managed environment variables pulled locally.
- Neon HTTPS verification: both projects reachable; PostgreSQL 18.6 confirmed; production migration table absent; database default setting contains `TimeZone=UTC`.
- `npm run verify:migrations`: passed all 10 committed migration checksums.
- `npm run db:migrate:deploy` against development: failed before applying a migration because this execution host cannot reach the Neon PostgreSQL TCP endpoint. A bounded direct `pg` check also ended in `timeout expired`; the Neon compute itself was reported active and HTTPS SQL succeeded.
- `npm run build`: passed after the final wiring changes. Vite emitted only its existing large-chunk advisory.
- `npm run typecheck`: passed all workspaces.
- `npm run lint`: passed.
- Server tests: 25/25 suites and 188/188 tests passed.
- Client tests: 19/19 files and 289/289 tests passed in the full run before the final server-only TLS normalization; the final change did not touch client code.
- Deployment workflow tests: 28/28 passed, including the PostgreSQL 14-18 guard.
- Started the built server with an injected synthetic session secret. `GET /api/health` returned HTTP 200 and the local source marker. `GET /api/ready` returned HTTP 503 because the same blocked TCP route prevents the Prisma connection; no TLS downgrade warning remained after normalization.
- `git check-ignore -v .env.local .neon`: both local credential/context files are ignored.
- `git diff --check`: passed.
- Docker PostgreSQL 18 fallback testing was unavailable because the local Docker daemon is not running.

## Unresolved items and next actions

- Run the reviewed Prisma migration chain from a network that can reach Neon TCP, preferably the protected development GitHub Environment after this release workflow is committed and merged. Do not migrate production until development migration, app smoke checks, recovery evidence, schema compatibility, and human approval pass.
- After `publish-image` produces a verified immutable GHCR digest, create separate image-backed Render development and production services and configure their isolated runtime secrets.
- Configure the GitHub `development` and `production` Environments with the provider IDs, exact hosts, direct URLs, tokens, smoke accounts, and production recovery/compatibility evidence described in `docs/Deployment.md`.
- Human review of this AI-generated summary remains pending.

## Resource record

- Structured interval: `logs/yu-sutong/resources/2026-11-07-neon-production-setup/0d6226bff27b49e09f0d80a4e738aab9.json`.
- Timing coverage: delayed bootstrap. `npx neon skills -y` wrote the initial skill files before the newly installed repository instructions exposed the mandatory recorder; the interval began immediately after those instructions were read and covers subsequent provisioning, implementation, validation, and logging.
- Final measured report:

| Agent / stage / attempt | Model / effort | Start / end (UTC) | Elapsed seconds | Input / output tokens | Status |
| --- | --- | --- | --- | --- | --- |
| main / implement / 1 | unavailable / unavailable | 2026-11-06T18:07:32.922297+00:00 / 2026-11-06T18:45:16.077376+00:00 | 2263.155079 | unavailable / unavailable | succeeded |

- End-to-end measured wall time: 2263.155079 seconds (one non-overlapping main-agent interval).
- Summed agent elapsed time: 2263.155079 seconds.
- Missing telemetry: per-record token, cache, tool-call, retry, observed-model, and observed-effort data are not exposed to the repository recorder. Selected model/effort were also unavailable to that recorder.

## Repair follow-up: supported Neon runtime path

This follow-up supersedes the earlier conclusion that the execution host's blocked raw PostgreSQL port prevented development migration and readiness verification. Raw TCP access remains unavailable, but the application now uses Prisma's official Neon WebSocket adapter for Neon hosts and retains the existing `pg` adapter for localhost and CI. Prisma remained the migration owner: an ephemeral localhost-only bridge carried PostgreSQL wire traffic over Neon's secure WebSocket endpoint solely so the reviewed migration chain could run without fabricating migration history. The bridge and all verification processes were stopped afterward.

### Changes made

- Added `src/server/src/database/database-adapter.ts` to select `@prisma/adapter-neon` for `.neon.tech` runtime URLs and `@prisma/adapter-pg` for localhost/CI PostgreSQL.
- Updated `DatabaseService` and the AI cleanup command to use the shared adapter factory.
- Added `src/server/test/database-adapter.spec.ts` and updated the deployment and technical documentation for the runtime/migration split.
- Added `@prisma/adapter-neon` at the same `7.10.1` version as the repository's Prisma packages.
- No migration files or migration-history rows were fabricated or rewritten.

### Superseding validation outcome

- Development preflight confirmed PostgreSQL 18.6, UTC, and zero applied migrations.
- `prisma migrate deploy` applied all 10 reviewed migrations to the development project. Postflight checks verified all 10 checksums and the required tables, constraints, triggers, and indexes.
- Development `GET /api/health` and `GET /api/ready` both returned HTTP 200. Release Maintainer login, session validation, role-owned read, and logout passed using synthetic demo data.
- Production `GET /api/health` and `GET /api/ready` both returned HTTP 200 through the supported runtime adapter. Production remains unmigrated and unseeded; no production schema or account mutation occurred.
- Final verification passed: build; 189/189 server tests; 289/289 client tests; 28/28 deployment-workflow tests; typecheck; lint; Prisma validation; `git diff --check`; and a production-dependency audit with zero vulnerabilities. The existing Vite large-chunk advisory remains non-blocking.

### Remaining protected actions

- Render services still require the workflow to publish and verify an immutable GHCR image digest first.
- GitHub `development` and `production` Environments still require configuration.
- Production migration, seed, Render deployment, and promotion remain human-gated actions and were not performed.

### Repair resource record

- Structured interval: `logs/yu-sutong/resources/2026-11-07-neon-production-setup/950551b219174a50ae5625b00eec7fb0.json`.
- Timing coverage: the repair interval began before the adapter repair and finished after the final validation. The report below includes the earlier implementation interval for the same session.

| Agent / stage / attempt | Model / effort | Start / end (UTC) | Elapsed seconds | Input / output tokens | Status |
| --- | --- | --- | --- | --- | --- |
| main / implement / 1 | unavailable / unavailable | 2026-11-06T18:07:32.922297+00:00 / 2026-11-06T18:45:16.077376+00:00 | 2263.155079 | unavailable / unavailable | succeeded |
| main / fix / 2 | unavailable / unavailable | 2026-11-06T18:54:47.599236+00:00 / 2026-11-06T19:06:34.001351+00:00 | 706.402115 | unavailable / unavailable | succeeded |

- End-to-end measured wall time: 3541.079054 seconds, including the gap between intervals.
- Summed agent elapsed time: 2969.557194 seconds.
- Measurement coverage: two non-overlapping main-agent intervals in this session. Final response/report rendering is outside the measured boundary.
- Missing telemetry: per-record token, cache, tool-call, retry, observed-model, and observed-effort data are not exposed to the repository recorder. Selected model/effort were also unavailable to that recorder.
