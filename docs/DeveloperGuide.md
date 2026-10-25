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

## Sources and dependencies

The scaffold is new source, with no prior-MP code reused. It uses the APIs described
in [NestJS](https://docs.nestjs.com/), [Vite](https://vite.dev/guide/),
[Prisma 7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7),
[React](https://react.dev/), [Zod](https://zod.dev/), and their test tooling.
CI uses the maintained [checkout](https://github.com/actions/checkout) and
[setup-node](https://github.com/actions/setup-node) Node24 actions, plus the
[Gitleaks CLI](https://github.com/gitleaks/gitleaks) container for secret scanning.
The runtime and PostgreSQL container digests were resolved from Docker Hub during
scaffolding. Update them deliberately alongside compatibility and security checks.
