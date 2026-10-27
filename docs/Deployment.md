# Render application + Neon PostgreSQL

## Database timezone prerequisite

The shared proposal/activity migrations use `TIMESTAMP WITHOUT TIME ZONE` defaults;
Prisma interprets stored values as UTC. Before starting application connections in
each environment, configure the database default timezone to UTC, reconnect and
verify `SHOW timezone` returns UTC. Database owners can set the per-database default
with `ALTER DATABASE <name> SET timezone TO 'UTC'`; use the actual authorized environment
database name. Check a newly generated creation/audit timestamp against current UTC
time during smoke verification. Do not rewrite shared migration history to compensate
for a local timezone. No deployed configuration or smoke result is implied by this guide.

## Intended topology

Each environment uses one Render web service serving the built React client and
NestJS `/api`, plus its own Neon PostgreSQL project. Development and production
must have separate databases, service hostnames and secrets. Render services run
the same tested Docker image digest promoted through GitHub Actions. No cloud
resources have been provisioned by the scaffold.

`render.yaml` is a template with deliberately non-deployable placeholder image
references. Replace each with a real CI-published `ghcr.io/...@sha256:...` digest
before applying it. Configure private registry access in Render if required.
The runtime listens on Render's supplied `PORT` and `0.0.0.0`; the readiness
endpoint is `/api/ready`. Do not add a Render source-build command.

## Environment configuration

1. Create two Neon projects, one for development and one for production.
2. Store each pooled connection URL as its Render service's secret `DATABASE_URL`.
   Keep the provider's TLS parameters; never disable certificate verification.
3. Store each non-pooler connection URL as `DIRECT_DATABASE_URL` in the corresponding
   protected GitHub Environment for migration jobs. It is not needed by the runtime.
4. Apply the reviewed identity/proposal migration chain before first use. Run `npm ci --ignore-scripts`,
   `npm run db:generate` and `npm run db:migrate:deploy` in the release job using
   the matching environment's direct URL. Review SQL before committing it.
5. Build/test/scan/sign/publish one image in CI, deploy its digest to development,
   and run `SMOKE_BASE_URL=<development-url> node workflow/tooling/smoke.mjs`.
6. Promote that same digest after manual production-environment approval. Never
   rebuild independently on Render or automatically deploy unreviewed production tags.

Steps 4-6 describe the intended release pipeline; the initial CI workflow validates
the scaffold and Docker image but does not publish, sign or deploy it. Real cloud
IDs, credentials, environment approvals and release workflows remain unconfigured.
Set an independent random `SESSION_SECRET` of at least 32 characters per service
and configure `TRUST_PROXY_HOPS` to the verified TLS proxy topology (the template
assumes one trusted hop). Provision accounts from a trusted checkout using
[Authentication](Authentication.md). Base authentication and Contributor private drafts
are implemented locally; other domain workflows and actual deployed verification
remain pending. No AI keys are needed or used at this stage.

## Free-tier considerations

Render free web services sleep after idle periods and share a monthly instance-hour
allowance. Neon has compute/storage quotas and may suspend idle compute. Account
for cold starts when demonstrating the application; steady-state performance
targets do not imply cold-start guarantees. Two environments share provider/account
quotas as applicable. Confirm current limits before provisioning:
[Render free services](https://render.com/docs/free),
[Neon plans](https://neon.com/pricing).

Use Neon rather than Render's expiring free database. Backups, retention, migration
rollback rehearsals and incident procedures require dedicated release work; the
scaffold makes no production durability or availability claim.
