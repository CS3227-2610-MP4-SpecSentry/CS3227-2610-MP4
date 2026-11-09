# Technical specification

Baseline: 25 October 2026. Normative design; implementation evidence is tracked in [traceability](../TRACEABILITY.md).

[Product index](PRODUCT-SPEC.md) | [Open decisions](OPEN-DECISIONS.md)

The [assignment constraints](ASSIGNMENT-SPEC.md) require a simple UI, well-designed shared components (SRP/DRY), separate online dev/prod environments, and separately team-managed deployment. These constrain this team-selected TypeScript design; they do not prescribe this stack. Do not use an integrated build-and-host environment, including those supplied by coding-agent tools. Keep builds/deployment automation separate from runtime hosting.

A TypeScript modular monolith keeps deployment, security, and testing manageable. A React client built with Vite calls a NestJS HTTP API under /api. In deployed environments, the NestJS service serves the built client and API from the same origin in one Docker image. Role-specific controllers call application services. Services enforce authorization, lifecycle transitions, version checks, and transactions before repositories access PostgreSQL through Prisma. A separate server-side AI Gateway owns prompt construction, SoC LLM calls, schema validation, budgets, and safe audit metadata.

| **Layer** | **Decision** |
| --- | --- |
| Runtime and workspace | Node.js 24 LTS, TypeScript strict mode, npm workspaces, and a committed lockfile; pin compatible supported package versions and the runtime image digest when creating the skeleton |
| Presentation | React and Vite with React Router; accessible forms and simple navigation under /contributor, /reviewer, and /maintainer; shared components and ordinary CSS |
| Application | NestJS with the Express adapter; role-specific controllers and use-case services for proposals, revisions, submissions, reviews, findings, evidence, release candidates, audit, and AI suggestions |
| Security | Server-side sessions using express-session with a PostgreSQL-backed store, Argon2id password hashing, session rotation on login, expiry and logout invalidation, synchronizer CSRF tokens, role guards plus service-level object authorization, secure cookies, validation, escaped rendering, and security headers |
| Contracts and AI Gateway | Shared Zod schemas for request/response contracts and strict AI output validation; role templates, context selection, redaction, server-side SoC LLM HTTP client, rate limits, timeouts, one bounded retry, fallback, and metadata |
| Persistence | PostgreSQL with Prisma ORM and versioned reviewed migrations, explicit version-checked writes, foreign keys, transactions, immutable revisions and audit events; database constraints enforce one active reviewer and release membership invariants |
| Quality | Jest and Nest testing utilities with Supertest for backend tests, Vitest and React Testing Library for client tests, isolated PostgreSQL integration tests, Playwright browser and accessibility checks, TypeScript checking, ESLint, dependency and secret scanning |
| Operations | Structured logs, health and readiness checks, migration status, deployment marker, metrics, backup, rollback, and incident runbook |

### TypeScript Stack Rationale and Boundaries

- React suits the review forms, evidence mappings, revision comparisons, and notification state. Vite provides a client build without introducing server-rendering or search-engine optimization requirements for authenticated screens.
- NestJS provides explicit modules, controllers, dependency injection, and test seams for three role workflows and shared infrastructure. Choose one modular service rather than separate role services. Role guards are only the first check: services must still verify assignment, ownership, lifecycle, and version before retrieving protected data or applying mutations.
- PostgreSQL remains the relational source of truth. Prisma provides typed persistence and migrations; transactions and explicit version predicates must enforce concurrent claims, stale decisions, and atomic publication. ORM types alone do not implement those invariants. Review generated migration changes, retain SQL constraints where needed, and apply the same reviewed migrations in separate development and production databases.
- Zod validates untrusted HTTP input and model output at runtime; TypeScript types do not provide runtime validation. Browser-safe contracts may be shared, but database clients, password/session code, AI credentials, prompts, and authorization policies remain server-only.
- Use one same-origin web service and one PostgreSQL database per environment. Local Vite development proxies /api to NestJS. Sessions remain in PostgreSQL rather than process memory; browser code receives only the opaque session cookie and permitted response fields. Mutations require a session-bound CSRF token. SameSite cookies and client route guards do not replace CSRF checks or server authorization.
- The SoC LLM remains the only product AI provider. Calls go through the existing bounded server gateway; no browser-held AI keys, repository execution, or agent tools are added by this stack change. Initial deployment uses one application instance per environment; global AI limits and queue bounds must remain effective if replication is introduced.
- Keep production source under src/server, src/client, and src/shared; keep schema/migration source under src/server/prisma and workflow tooling under workflow. Root package manifests, lockfile, Docker configuration, and CI files may live in their conventional locations. Existing Python workflow tooling remains development infrastructure and need not be rewritten into TypeScript.
- GitHub Actions builds, tests, scans, attests and publishes the Docker image. Azure Container Apps runs the prebuilt image with separate applications, managed identities, secrets and hostnames for development and production; Neon hosts a separate PostgreSQL project/database for each environment. A shared private ACR stores the immutable development-tested digest, but runtime state is isolated. GitHub authenticates to Azure with environment-bound OIDC rather than a client secret, and each Container App pulls through its own managed identity. Runtime connections use Prisma's official Neon WebSocket adapter with the pooled endpoint; localhost and CI retain the TCP adapter, and reviewed migrations use Neon's direct endpoint with TLS verification enabled. Application development and deployment remain separately team-managed under the assignment restriction above. GitHub Pages hosts the separate product website.

This is the selected design baseline, not evidence of an implemented migration. Consult traceability for actual implementation status. Exact library versions and migration commands must match the supported versions pinned during scaffolding.

Technical references checked on 24 October and 9 November 2026: [Node.js releases](https://nodejs.org/en/about/previous-releases), [NestJS architecture](https://docs.nestjs.com/), [NestJS testing](https://docs.nestjs.com/fundamentals/testing), [Vite](https://vite.dev/guide/), [Prisma transactions](https://www.prisma.io/docs/orm/fundamentals/transactions), [Prisma migrations](https://www.prisma.io/docs/orm/migrations/applying-a-migration), [Express sessions](https://expressjs.com/en/resources/middleware/session/), [Zod](https://zod.dev/), [Azure Container Apps](https://learn.microsoft.com/azure/container-apps/overview), [Azure Container Registry import](https://learn.microsoft.com/azure/container-registry/container-registry-import-images), and [GitHub OIDC with Azure](https://learn.microsoft.com/azure/developer/github/connect-from-azure-openid-connect).

### Environment Separation

| **Environment** | **Source** | **Service** | **Database** | **Control** |
| --- | --- | --- | --- | --- |
| Local | Feature branch | Docker Compose | Local PostgreSQL | Synthetic fixtures and stubbed AI by default |
| Development | protected `master` release candidate after exact-SHA CI | Azure Container App `specsentry-dev` | Separate Neon development PostgreSQL project | Environment-bound OIDC; import exact digest into ACR; automatic canary after explicit enablement |
| Production | same protected `master` source and development-tested digest | Azure Container App `specsentry` | Separate Neon production PostgreSQL project | Separate OIDC identity; manual GitHub Environment approval; reuse ACR digest without rebuilding/importing |

GitHub Actions validates `develop` and `master` changes in ordinary CI. The release
workflow accepts only an exact successful protected-`master` CI revision, then builds,
scans, attests and publishes one Docker image. That revision is first deployed to the
separate development environment as a release canary; manual production promotion
reuses its verified digest without rebuilding. This protected-master canary model
avoids treating an earlier `develop` tree as the provenance of a later merge commit.
Azure is the runtime platform, not the build source of truth. Development and
production use separate applications, resource groups, identities, databases,
hostnames, secrets, cookies and SoC LLM configuration. The shared registry is only
an immutable image store and never a shared runtime environment.

## Related constraints

[Integration](INTEGRATION-SPEC.md) owns logical entities and operation/error contracts; [shared requirements](SHARED-REQUIREMENTS.md) owns quality targets; [AI security](AI-SECURITY-SPEC.md) owns untrusted-input constraints. Task sequence, dates and progress belong in [the plan](../PLAN.md).
