# SpecSentry

Secure specification and review workspace for CS3227 MP4. This repository currently
contains authentication, single-role accounts, Contributor drafting/submission/
revision/response workflows, the Reviewer workspace and the Release Maintainer
workspace. Release Maintainers can assemble approved proposals, record exact-version
smoke evidence, inspect deterministic blockers, explicitly publish an immutable
snapshot, acknowledge recipient-scoped revocation notices, append released
corrections and filter a restricted project audit. The optional Release Gate
Assistant is advisory and cannot mutate or publish release state.
All three role assistants use the bounded server gateway. Live NUS SoC AI is
enabled in both Render services through server-only secrets. On 8 November 2026,
one representative exact-contract call passed for each role and all three deployed
development workflows passed end to end. The application owner then explicitly
accepted the remaining provider uncertainty and authorized production activation;
existing quotas, strict schemas, authorization rechecks and manual fallback remain
in force. Broader edge-case/model evaluation, quantitative provider quotas,
retention/data-use review, production role-UI acceptance and teammate sign-off
remain open. Maintainer implementation evidence is in the
[final Maintainer run](logs/yu-sutong/2026-11-06-maintainer-final.md); earlier
foundation and smoke-test increments remain historical checkpoints. Broader
release gates are also tracked in the
[Contributor run](logs/yooplo/2026-11-01-contributor-completion.md).

## Live grader access

> **First-visit notice:** Production runs on Render's free tier and may take about
> one minute to wake after inactivity. If the first request is slow, please wait
> for startup and refresh once.

**Production application and primary grader test environment:
<https://specsentry-prod-bi1f.onrender.com>**

A separate development deployment is available for team testing without sharing
production data:

**Development application: <https://specsentry-dev-bi1f.onrender.com>**

These are synthetic demo-only accounts. Each account uses password
`Password123!`:

| Role | Primary account | Alternate account |
| --- | --- | --- |
| Contributor | `contributor1` | `contributor2` |
| Reviewer | `reviewer1` | `reviewer2` |
| Release Maintainer | `release_maintainer1` | `release_maintainer2` |

The same six identities are provisioned independently in production and
development. On 9 November 2026, every production account passed deployed HTTPS
login, correct-role session retrieval, logout, and post-logout rejection. There is
no public registration or role picker; signing in opens the workspace assigned to
that account. Both services have the same free-tier cold-start behavior described
above. These public demo credentials are
intentionally separate from private deployment smoke accounts, database
credentials and provider tokens. Data created in one environment does not appear
in the other.

Production promotion completed on 8 November 2026 after recovery and compatibility
evidence, teammate approval, all ten reviewed migrations and authenticated release
smoke passed. The six public demo identities were subsequently provisioned through
the fail-closed administrator command in each environment; the development seed is
still blocked from running in production.

## Directory map

```text
src/
  server/                 BACKEND — NestJS API and PostgreSQL access
    src/main.ts           Server entry point; environment loading and startup
    src/app.module.ts     Backend module composition
    src/config.ts         Validated server-only environment configuration
    src/http.ts           Security headers, safe errors and production frontend serving
    src/health/           Liveness and database-readiness endpoints
    src/database/         Prisma connection service
    prisma/schema.prisma  Account/session schema and reviewed migrations
    prisma.config.ts      Prisma CLI / direct migration connection configuration
    test/                 Backend HTTP and PostgreSQL integration tests
  client/                 FRONTEND — React browser application
    index.html            HTML entry point
    src/main.tsx          React entry point and browser router
    src/App.tsx           Login, session handling and role landing pages
    src/styles.css        Shared frontend styles
    vite.config.ts        Frontend build, test and local /api proxy configuration
  shared/                 Browser-safe contracts shared by frontend and backend
    src/index.ts          Zod response schemas and TypeScript types
workflow/                 Specifications, plans, developer tooling and browser tests
docs/                     Developer setup and deployment guides
.github/workflows/ci.yml   Automated source, test, browser, audit and container checks
.github/workflows/application-release.yml  Guarded image publication and deployment
package.json              Root workspace commands and tooling dependencies
package-lock.json         Exact dependency resolution; commit changes together
tsconfig.base.json        Shared strict TypeScript compiler settings
eslint.config.mjs         Lint rules and client/server import boundary
.env.example              Local environment template; live .env files are ignored
Dockerfile                One production image serving frontend and backend
compose.yaml              Local PostgreSQL and optional full application
render.yaml               Render services pinned to the verified immutable image digest
playwright.config.ts      Browser and automated accessibility smoke-test setup
```

Each workspace has its own `package.json` and `tsconfig.json`. Install packages in
the workspace that uses them; for example `npm install <package> -w @specsentry/server`.
Keep credentials, database clients, prompts and authorization code in `src/server`.
Never put secrets in `VITE_*` variables or export server code through `src/shared`.

## Architecture and submission artifacts

The [architecture guide](docs/Architecture.md) describes module responsibilities and
transaction seams. See the User Guide and implemented UI/UX specification below
for current Contributor behavior and the role-screen limitations. Shared wire
schemas live under `src/shared/src/contracts/`; folder presence alone does not
establish product completion.

- [User Guide](docs/UserGuide.md): current behavior and testing limitations.
- [Implemented UI/UX specification](workflow/specs/UI-UX-SPEC.md): shell, draft interactions, design tokens and verified responsive/accessibility scope.
- [Developer Guide](docs/DeveloperGuide.md): setup, design, workflow and acknowledgements.
- [Reflections](docs/Reflections.md): measured observations, analysis and explicit evidence limits.
- [Workflow index](workflow/README.md): process files, templates and tools.
- [Submission readiness](workflow/SUBMISSION.md): assignment deliverables and remaining gaps.
- [Product website setup](docs/DeveloperGuide.md#product-website): static site and GitHub Pages publication.

`npm run check:submission` checks local required-artifact presence only. It does not
certify product completion or live access. The Pages workflow publishes the product
site from `master`; the verified site is
<https://cs3227-2610-mp4-specsentry.github.io/CS3227-2610-MP4/>.

## Local startup

Install Node.js 24 LTS (24.15 or newer), npm 11/12, and Docker with Compose.
Run these commands from the repository root:

```sh
npm ci --ignore-scripts
npm run db:generate
```

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell), set a
random `SESSION_SECRET` of at least 32 characters, then:

```sh
docker compose up -d db
npm run db:migrate:deploy
# Provision accounts using docs/Authentication.md before signing in.
npm run dev
```

Open the frontend at http://localhost:5173. The backend listens on port 3000;
Vite proxies `/api` to it. Keep `PORT=3000` for local development unless you also
update the Vite proxy. Alternatively, run the production-style application with:

```sh
docker compose --profile app up --build -d --wait
```

The production-style container requires HTTPS through a controlled TLS proxy for
sign-in because production cookies are Secure. Use Vite development for local HTTP
authentication. Health and the login shell remain available at http://localhost:3000. `/api/health` checks the process; `/api/ready`
checks PostgreSQL connectivity. Login/CSRF bootstrap is public; session lookup and
logout require authentication. See [Authentication](docs/Authentication.md) for
account provisioning, API contracts, and role-guard integration.

## Checks

```sh
npm run db:validate
npm run typecheck
npm run lint
npm test
npm run build
```

For database and browser checks, see [Developer Guide](docs/DeveloperGuide.md).
For Render + Neon setup and current operational limitations, see
[Deployment](docs/Deployment.md). Product requirements start at
[the specification index](workflow/specs/PRODUCT-SPEC.md).
