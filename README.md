# SpecSentry

Secure specification and review workspace for CS3227 MP4. This repository currently
contains a runnable infrastructure scaffold; authentication, role workflows, domain
models and AI integration are subsequent work. No deployed application is claimed.

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
    prisma/schema.prisma  Database schema source (connectivity only for now)
    prisma.config.ts      Prisma CLI / direct migration connection configuration
    test/                 Backend HTTP and PostgreSQL integration tests
  client/                 FRONTEND — React browser application
    index.html            HTML entry point
    src/main.tsx          React entry point and browser router
    src/App.tsx           Initial page and API health display
    src/styles.css        Shared frontend styles
    vite.config.ts        Frontend build, test and local /api proxy configuration
  shared/                 Browser-safe contracts shared by frontend and backend
    src/index.ts          Zod response schemas and TypeScript types
workflow/                 Specifications, plans, developer tooling and browser tests
docs/                     Developer setup and deployment guides
.github/workflows/ci.yml   Automated checks (no live deployment yet)
package.json              Root workspace commands and tooling dependencies
package-lock.json         Exact dependency resolution; commit changes together
tsconfig.base.json        Shared strict TypeScript compiler settings
eslint.config.mjs         Lint rules and client/server import boundary
.env.example              Local environment template; live .env files are ignored
Dockerfile                One production image serving frontend and backend
compose.yaml              Local PostgreSQL and optional full application
render.yaml               Render service template; requires a real image digest/secrets
playwright.config.ts      Browser and automated accessibility smoke-test setup
```

Each workspace has its own `package.json` and `tsconfig.json`. Install packages in
the workspace that uses them; for example `npm install <package> -w @specsentry/server`.
Keep credentials, database clients, prompts and authorization code in `src/server`.
Never put secrets in `VITE_*` variables or export server code through `src/shared`.

## Architecture and submission artifacts

The [architecture guide](docs/Architecture.md) describes module responsibilities and
transaction seams. Backend domain folders are empty NestJS registrations; frontend
role folders will be added with their features. Shared wire schemas live under
`src/shared/src/contracts/`. No product workflow is implemented by these folders.

- [User Guide](docs/UserGuide.md): current behavior and testing limitations.
- [Developer Guide](docs/DeveloperGuide.md): setup, design, workflow and acknowledgements.
- [Reflections](docs/Reflections.md): observations and pending experiments.
- [Workflow index](workflow/README.md): process files, templates and tools.
- [Submission readiness](workflow/SUBMISSION.md): assignment deliverables and remaining gaps.
- [Product website setup](docs/DeveloperGuide.md#product-website): static site and GitHub Pages publication.

`npm run check:submission` checks local required-artifact presence only. It does not
certify product completion or live access. The Pages workflow publishes the product
site from `master` after repository Pages configuration; deployment is unverified.

## Local startup

Install Node.js 24 LTS (24.15 or newer), npm 11/12, and Docker with Compose.
Run these commands from the repository root:

```sh
npm ci --ignore-scripts
npm run db:generate
```

Copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell), then:

```sh
docker compose up -d db
npm run dev
```

Open the frontend at http://localhost:5173. The backend listens on port 3000;
Vite proxies `/api` to it. Keep `PORT=3000` for local development unless you also
update the Vite proxy. Alternatively, run the production-style application with:

```sh
docker compose --profile app up --build -d --wait
```

Then open http://localhost:3000. `/api/health` checks the process; `/api/ready`
checks PostgreSQL. These are the only implemented public APIs. The setup page
contains no product data, and no protected role screens are implemented yet.

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
