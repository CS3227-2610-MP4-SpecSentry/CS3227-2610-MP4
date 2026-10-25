# Developer Guide

## Current state

The base scaffold implements NestJS/Express, React/Vite, browser-safe Zod health
contracts and Prisma PostgreSQL connectivity, plus account provisioning, login,
PostgreSQL sessions, CSRF, role guards and restricted security events. The first
Reviewer increment adds pool/assigned queues, claim/drop, immutable submitted
detail/history, business activity and transactional assignment release on account
disablement. Contributor writes, findings, coverage, decisions, notifications,
releases and AI integration remain pending. See [Authentication](Authentication.md).
The detailed specifications describe planned product behavior, not delivered features.

See the root [directory map](../README.md#directory-map) for frontend/backend
ownership and important files. Production uses one same-origin Docker service;
local development runs Vite on 5173 and NestJS on 3000. `src/shared` builds first,
then both consumers. `npm run dev` watches all three workspaces.

## Install and run

Use Node.js 24 LTS, at least 24.15, and npm 11/12. Exact dependencies are pinned;
`package-lock.json` records transitive resolution. `packageManager` records the
npm version used to generate the lockfile. TypeScript 5.9 is deliberately pinned
within the supported range of ESLint/Jest integrations; Prisma CLI/client/adapter
all use stable 7.10.1, rather than the registry's Prisma 8 release candidate.

Use `npm ci --ignore-scripts`, then `npm run db:generate`. Install lifecycle hooks
are disabled; Prisma generation is explicit, and platform binaries arrive as
optional dependencies. NestJS 11.2.8 is pinned for the CommonJS/Jest scaffold;
the root `multer` override selects patched 2.5.0 for Nest's transitive dependency.
No upload API is exposed. Re-run generation after schema changes. Copy the root
`.env.example` to `.env`, start `docker compose up -d db`, then `npm run dev`.
Set a random `SESSION_SECRET` of at least 32 characters. Run
`npm run db:migrate:deploy` and provision accounts as documented in
[Authentication](Authentication.md) before signing in. Readiness checks connectivity only.

Database schema source lives in `src/server/prisma/schema.prisma`; generated code
under `src/server/src/generated/` is ignored. For a feature schema, create and
review SQL with `npm run db:migrate:dev -w @specsentry/server -- --name <change>`,
then apply reviewed migrations with `npm run db:migrate:deploy`. Never use `db push`
for deployment. Develop migrations against a disposable database. Runtime uses
the pooled `DATABASE_URL`; migrations use the direct `DIRECT_DATABASE_URL` with
TLS verification enabled. Keep connection strings out of Git and logs.

`npm run build` writes ignored `dist/` folders in each workspace. To serve the
built client and backend locally, set `NODE_ENV=production` and run `npm start`.
Production startup requires the built client. Container startup uses environment
variables directly, runs as the nonroot `node` user and needs no `.env` file.

## Verification commands

Root commands: `npm run db:validate`, `npm run typecheck`, `npm run lint`,
`npm test`, and `npm run build`. Unit/HTTP tests use isolated mocks for session/role/CSRF behavior;
client tests cover login, logout, role routing and session expiry.
HTTP tests verify generic readiness failure, security headers and API/asset 404
behavior in the presence of frontend fallback.

For real PostgreSQL integration, use a disposable test database and set
`TEST_DATABASE_URL` explicitly. In PowerShell:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://test_user:test_password@localhost:5433/specsentry_test'
$env:DIRECT_DATABASE_URL = $env:TEST_DATABASE_URL
npm run db:migrate:deploy
npm run test:integration
```

Auth integration tests create and remove synthetic fixtures in the migrated test
database. Never substitute production URLs.

Reviewer integration tests require the intake migration as well as identity.
Submitted snapshots, activity and historical assignments reject row updates or
deletions. Test cleanup can truncate fixture tables only in an explicitly
disposable test database; it must not weaken those production constraints.

## Reviewer intake fixtures

After configuring a development database and applying migrations, run
`npm run db:seed` to provision the existing synthetic demo accounts, followed by
`npm run db:seed:reviewer` to add synthetic submitted revisions for the Reviewer
walkthrough. The latter requires the demo Contributor and Reviewer accounts to
exist. Both commands refuse production configuration. Reruns preserve existing
accounts and existing proposal snapshots; they do not reset edited credentials,
disablement or review state. Never use these fixture commands against production.

The intake API provides `GET /api/review-pool`, `GET /api/reviews/assignments`,
`POST /api/proposals/:id/claim`, `POST /api/proposals/:id/drop`, and assigned-only
detail, `/revisions` and `/activity` reads. Wire schemas live in
`src/shared/src/contracts/reviewer.ts`. Every protected read reauthorizes its
scope; cursor contents never grant access. Review commands carry root versions,
and drop additionally carries revision/assignment identities and assignment version.
Claim/drop use version checks rather than idempotency keys. Read current state
before retrying after an uncertain response.

The database migration adds partial uniqueness and deferred pointer-consistency
triggers beyond Prisma's schema syntax. Do not replace it with `db push` or omit
its SQL constraints. Account disablement, assignment release, lifecycle changes
and required activity commit in the same transaction. No code/diff is executed.

## Browser verification

For the built-client browser/accessibility smoke test:

```sh
npm run build
npx playwright install chromium
npm run test:e2e
```

Port 3000 must be free; Playwright starts its own production-mode server. This
suite uses the disposable `TEST_DATABASE_URL` to test all three account roles and
scans the login page. It does not establish full product WCAG conformance.

CI runs the checks with PostgreSQL, Chromium, dependency audit, secret scanning,
Docker Compose and an HTTP smoke test. Local checks are not proof that remote CI
has executed. CI publication/signing and live environment promotion are later
release work, documented in [Deployment](Deployment.md).

## GitHub PR review with Codex

Use the native Codex GitHub integration for this repository. Review guidance lives
in the root [Code Review Rules](../AGENTS.md#code-review-rules); no API key or
additional GitHub Actions workflow is required for this setup.

Activation is an account setting, not a setting committed in this repository:

1. Open [Codex code review settings](https://chatgpt.com/settings/code-review)
   and connect `CS3227-2610-MP4-SpecSentry/CS3227-2610-MP4`. If missing,
   check the GitHub connection's repository access and organization approval.
2. Select the repository, enable **Automatic review** under **Review code**,
   and choose **All PRs** for team coverage. Configuring this requires GitHub
   push or admin permission. With personal preferences, each author enables
   automatic review and selects a trigger.
3. Push the guidance and open a representative PR. Verify that Codex responds;
   comment `@codex review` to request a manual review.

If no response appears, check repository access, review settings and the trigger.
GitHub connection alone does not prove automatic reviews are enabled.
For a missing repository, check the organization's [installed GitHub Apps](https://github.com/organizations/CS3227-2610-MP4-SpecSentry/settings/installations).
Configure the Codex connector to include this repository. If absent, install it
through Codex's GitHub connection flow and choose the SpecSentry organization.

Keep CI and human approvals as merge gates. This developer tool is separate from
the product's Reviewer role and SoC gateway.

See the [official setup and troubleshooting guide](https://learn.chatgpt.com/docs/third-party/github).

## Security boundaries

The frontend shell and login bootstrap are public; protected API content requires
an active session. Global authentication, CSRF and optional role guards run before
protected handlers. Domain services must still enforce object scope and lifecycle
constraints. Unknown API routes and missing assets stay JSON 404 responses.
Proxy trust defaults to zero and must match the controlled deployment topology.
See [Authentication](Authentication.md) for the session and administration contract.

Health responses expose only status. Database query and connection timeouts are
bounded; connection failures produce generic 503 errors with generated correlation
IDs. Configuration errors never print supplied values. Helmet supplies baseline
headers. Keep server/client/shared imports separated; ESLint prohibits server
imports from frontend/shared TypeScript. Do not log request bodies or URLs that
may contain credentials. TLS verification must remain enabled for Neon.

## Architecture and module ownership

See [Architecture](Architecture.md) for responsibilities, the diagram and transaction
seams. `AppModule` registers Identity, Proposals, Reviews, Releases, Activity,
Notifications and AI modules. These are empty registrations, not working features.
`DatabaseModule` encapsulates the configured Prisma provider. Add frontend role
folders as their features are implemented; `shared/src/contracts` holds wire
schemas while retaining the existing package exports.

Each business module owns its rules and scoped persistence access. Cross-module
submission, revocation and publication use cases must coordinate one transaction
with activity and required notifications. Never grant access based on client routes.

## Development process and grading artifacts

The [workflow directory guide](../workflow/README.md) describes the specifications,
agent definitions, procedures, templates, scripts and tests. Start at
[Development](../workflow/DEVELOPMENT.md) for spec-driven development and coordinated
agent responsibilities. Reviewer-specific execution starts at
[its entry point](../workflow/reviewer/README.md). Workflow-tool tests do not prove
product acceptance. Root `AGENTS.md` and `.agents/skills` stay at natural discovery
locations; workflow content is otherwise consolidated under `workflow/`.

The [AI security specification](../workflow/specs/AI-SECURITY-SPEC.md) defines planned
context restrictions, validation, quotas, timeouts and adversarial tests. Implement
and test them before exposing role AI endpoints. Session, CSRF, IDOR, concurrency,
injection and malformed-output verification must be linked in traceability as real
evidence, not inferred from module names or configuration.

Record prompt/change summaries under `logs/<prompter>/` using
[the prompt log template](../workflow/templates/PROMPT-LOG.md), with measurements
following [RESOURCES](../workflow/RESOURCES.md). Humans must verify summaries.
Controlled context, coordination, model and cache experiments use
[EXPERIMENT](../workflow/templates/EXPERIMENT.md); store safe results under
`workflow/evaluations/` (create it with the first result) and analyze them in
[Reflections](Reflections.md). Each result should identify source revision,
conditions, case IDs, commands, outcomes and measurement sources. Use synthetic
inputs and safe metadata; planned cases are not executed evidence. Mark
unexposed telemetry unavailable; never log hidden reasoning or credentials.

Run `npm run check:submission` to check local artifact presence. It does not certify
implementation, public accessibility or grading completion. See
[Submission readiness](../workflow/SUBMISSION.md) for outstanding checks.
The [User Guide](UserGuide.md) describes only current features.

## Product website

`src/website/index.html` is a dependency-free static product site. Preview it with
any local static server. `.github/workflows/pages.yml` publishes only that directory
from `master`, including manual dispatch. In repository Settings → Pages, select
**GitHub Actions**; after merging, inspect the workflow's deployment URL. Environment
protection still applies. Documentation links target `master` and reflect changes
after merge. Add screenshots and the application link only after release verification.
Application hosting remains separate and team-managed; see [Deployment](Deployment.md).
Neither live deployment is claimed here.

## Acknowledgements

The scaffold is new source, with no prior-MP code reused. It uses the APIs described
in [NestJS](https://docs.nestjs.com/), [Vite](https://vite.dev/guide/),
[Prisma 7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7),
[React](https://react.dev/), [Zod](https://zod.dev/), and their test tooling.
CI uses the maintained [checkout](https://github.com/actions/checkout) and
[setup-node](https://github.com/actions/setup-node) Node24 actions, plus the
[Gitleaks CLI](https://github.com/gitleaks/gitleaks) container for secret scanning.
The runtime and PostgreSQL container digests were resolved from Docker Hub during
scaffolding. Update them deliberately alongside compatibility and security checks.

The user-supplied CS3227 MP4 assignment description informed the submission checklist
and required guide/reflection/site structure. Codex assisted with the architecture,
module scaffold and documentation; prompt summaries record scope and checks. No
prior-MP source or documentation was imported by this initialization. The AI
specification separately cites earlier public protocol compatibility references;
those are references, not imported application code. Record future adapted ideas,
code, text or assets here with source, license and affected files.
