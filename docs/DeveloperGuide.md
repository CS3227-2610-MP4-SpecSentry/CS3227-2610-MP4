# Developer Guide

## Current state

The base scaffold implements NestJS/Express, React/Vite, browser-safe Zod health
contracts and Prisma PostgreSQL connectivity. It has no domain models/migrations,
accounts, sessions, CSRF tokens, role APIs, audit persistence or AI integration.
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
The initial `SELECT 1` readiness query needs no database tables.

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
`npm test`, and `npm run build`. Unit/HTTP tests use mocked database connectivity;
client tests cover safe handling of malformed and failed health responses.
HTTP tests verify generic readiness failure, security headers and API/asset 404
behavior in the presence of frontend fallback.

For real PostgreSQL integration, use a disposable test database and set
`TEST_DATABASE_URL` explicitly. In PowerShell:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://specsentry:specsentry_local@localhost:5432/specsentry'
npm run test:integration
```

This scaffold test is read-only and creates no schema; later feature tests must
use isolated databases and reviewed migrations. Never substitute production URLs.

For the built-client browser/accessibility smoke test:

```sh
npm run build
npx playwright install chromium
npm run test:e2e
```

Port 3000 must be free; Playwright starts its own production-mode server. This
smoke checks the setup page only, not full product WCAG conformance or role flows.

CI runs the checks with PostgreSQL, Chromium, dependency audit, secret scanning,
Docker Compose and an HTTP smoke test. Local checks are not proof that remote CI
has executed. CI publication/signing and live environment promotion are later
release work, documented in [Deployment](Deployment.md).

## Security boundaries

The setup page is public and contains no protected data. Only `/api/health` and
`/api/ready` are implemented. No product route may be added without the specified
session, CSRF and service-level authorization controls. Unknown API routes and
missing assets stay JSON 404 responses rather than receiving frontend HTML.
No CORS override or proxy trust is enabled before authentication design is implemented.

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
