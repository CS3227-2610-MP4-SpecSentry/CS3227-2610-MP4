# Database source (backend only)

`schema.prisma` defines the Prisma client and PostgreSQL connector. There are no
domain models or migrations yet; connectivity uses a read-only `SELECT 1`.
`../prisma.config.ts` selects the direct URL for migration commands.
Generated TypeScript goes to `../src/generated/prisma` and is ignored by Git.

From the repository root, run `npm run db:generate` after installation or schema
changes. For a feature schema, create and review SQL with
`npm run db:migrate:dev -w @specsentry/server -- --name <change>`.
Apply reviewed migrations with `npm run db:migrate:deploy` before deployment.
Never use `db push` as a deployment migration strategy.

Use a disposable local database for migration development. Neon runtime uses a
pooled `DATABASE_URL`; migrations use a non-pooler `DIRECT_DATABASE_URL`, with
TLS enabled. Never paste a connection string into logs or commit it.
