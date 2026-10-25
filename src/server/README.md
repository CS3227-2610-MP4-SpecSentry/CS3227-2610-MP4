# Backend

This workspace owns the NestJS/Express API, server configuration and Prisma
database access. `src/main.ts` starts the service. `src/app.module.ts` composes
modules. `src/http.ts` configures security headers and production static serving.
`src/health/` defines the public health checks; `src/database/` owns connectivity.
`prisma/` contains schema and future reviewed migrations; `test/` contains checks.

Run root workspace commands from the repository root. Never import this workspace
into the frontend or shared contracts. Authentication, sessions, CSRF, authorization,
audit persistence and role services are not implemented by this scaffold.

`AppModule` registers empty `identity`, `proposals`, `reviews`, `releases`,
`activity`, `notifications` and `ai` modules. `database/database.module.ts` exports
the existing configured connection provider. See
[Architecture](../../docs/Architecture.md) for ownership and transactional seams.
Add controllers/use cases/repositories only with the corresponding implemented feature.
