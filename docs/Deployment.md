# Render application + Neon PostgreSQL

## Current automation status

`.github/workflows/application-release.yml` defines the repository-managed release
path. A scanned and attested image for source revision
`8cdaefa517baf1f4777cddcba766ed151ebf5510` was published and verified in
development, then its exact registry digest was promoted to the separate production
service in Singapore. Two separate Neon projects contain all ten reviewed Prisma
migrations. Both isolated databases contain the public synthetic demo accounts and
their own dedicated private smoke identity; no data is copied between them. The
protected production run
completed direct database preflight/postflight, recovery and schema-compatibility
gates, teammate approval, Render deployment and authenticated application smoke on
8 November 2026. The release workflow remains fail-closed for future revisions.

The release source is an exact successful CI revision on protected `master`. The
workflow builds one `linux/amd64` GHCR image, records its registry digest, emits
BuildKit provenance/SBOM, creates a GitHub artifact attestation and scans that exact
digest. Development is the canary environment for that protected-master candidate.
Production accepts only the successful development release run ID and promotes the
same digest after verifying the CI/release runs, source SHA/tree, current `master`,
attestation identity, migration manifest and distinct service/host/database targets.

Manual operations are intentionally separate:

- `publish-image` creates only the signed/scanned GHCR image and safe identity
  artifact. It has no Render/Neon credentials and exists to bootstrap image-backed
  Render services.
- `release-development` publishes and, when development automation is enabled,
  migrates/deploys/verifies development.
- `promote-production` accepts a verified development release run ID. It never
  rebuilds the image.

An automatic protected-`master` push follows the development-release path only when
both image publication and deployment have been explicitly enabled.

## Database timezone prerequisite

The shared proposal/activity migrations use `TIMESTAMP WITHOUT TIME ZONE` defaults;
Prisma interprets stored values as UTC. Before starting application connections in
each environment, configure the database default timezone to UTC, reconnect and
verify `SHOW timezone` returns UTC. Database owners can set the per-database default
with `ALTER DATABASE <name> SET timezone TO 'UTC'`; use the actual authorized environment
database name. Check a newly generated creation/audit timestamp against current UTC
time during smoke verification. Do not rewrite shared migration history to compensate
for a local timezone. The safe setup evidence and remaining limits are recorded in
the linked deployment prompt/run logs; this guide alone is not release evidence.

## Intended topology

Each environment uses one Render web service serving the built React client and
NestJS `/api`, plus its own Neon PostgreSQL project. Development and production
must have separate databases, service hostnames and secrets. Render services run
the same tested Docker image digest promoted through GitHub Actions. Application
queries use Prisma's official Neon WebSocket adapter with the pooled URL; reviewed
migrations and release verification continue to use the direct endpoint. The Neon
and Render resources exist. The protected GitHub Environments contain the
non-secret service IDs, hosts and database-host expectations. Their secret database
and smoke values, dedicated Render automation credential and production-only
release evidence are configured separately in protected GitHub Environments.

`render.yaml` is pinned to the CI-published immutable digest used by both initial
services. It references the separately stored read-only private-registry credential;
no registry token or database URL belongs in the file. Future releases still use
the workflow's `publish-image` operation and promote an exact verified digest
through the guarded development and production jobs rather than changing a mutable
tag.
The runtime listens on Render's supplied `PORT` and `0.0.0.0`; the readiness
endpoint is `/api/ready`. Do not add a Render source-build command.

## Setup checklist

Keep all three repository variables unset or `false` while creating resources:
`IMAGE_RELEASE_ENABLED`, `DEPLOYMENT_AUTOMATION_ENABLED`, and
`PRODUCTION_RELEASE_ENABLED`.

1. Protect `master` and require the repository's `CI` check before merge. Create
   literal GitHub Environments named `development` and `production`, restricted to
   `master`. Production must require a teammate reviewer, prevent self-review where
   available and disallow protection-rule bypass where the repository plan permits.
2. Create two Neon projects, one for development and one for production. Use separate
   roles/passwords and databases. From each project's connection details retain both
   the pooled runtime URL and direct migration URL. For the direct URL, use exactly
   `sslmode=verify-full`; optional `channel_binding=require` is the only other query
   parameter accepted by the release verifier. The direct host must not contain
   `pooler`.
3. Set each selected database's default timezone to UTC, reconnect both endpoint
   types and confirm `SHOW timezone` returns `UTC`. Do this before running any
   migration or application connection.
4. Set repository variable `IMAGE_RELEASE_ENABLED=true`, run **Application release**
   on `master` with `publish-image`, and wait for its exact CI, attestation and scan
   gates. Download the run's `published-image` artifact (or copy its immutable
   `image` value) for the next step. This creates the first image without accessing
   a deployment environment.
5. Create two Render image-backed web services, for example `specsentry-dev` and
   `specsentry-prod`, from that immutable GHCR digest. Disable Render auto-deploy;
   GitHub Actions owns deployment. Set `/api/ready` as the health path and use the
   service's HTTPS `onrender.com` host (or one verified custom host).
6. If GHCR is private, give Render a separate read-only GitHub credential with only
   package-read access. Render must never receive the Actions publisher token.
7. On each Render service set `NODE_ENV=production`, a unique random
   `SESSION_SECRET` of at least 32 characters, `TRUST_PROXY_HOPS=1`, and that
   environment's pooled Neon URL as secret `DATABASE_URL`. Render supplies `PORT`.
8. Configure a dedicated Release Maintainer smoke identity separately in each
   environment. The guarded release job idempotently creates it after the reviewed
   migrations exist and fails closed if an existing account has a different role,
   disabled state or password. Use synthetic development data; do not copy production
   contents into development.
9. Configure the GitHub Environment names below. Values differ between development
   and production; never reuse a Render service, application host, Neon host, database
   URL, session secret or smoke password across them.

| Scope | Name | Kind | Meaning |
| --- | --- | --- | --- |
| Each environment | `EXPECTED_DATABASE_HOST` | Variable | Exact direct Neon hostname only; no scheme, path or credentials |
| Each environment | `RENDER_SERVICE_ID` | Variable | Exact image-backed Render service ID (`srv-...`) |
| Each environment | `DEPLOYMENT_BASE_URL` | Variable | Exact HTTPS application origin, with no path |
| Each environment | `EXPECTED_DEPLOYMENT_HOST` | Variable | Hostname from the preceding origin |
| Each environment | `DIRECT_DATABASE_URL` | Secret | Matching direct/non-pooler Neon URL with exactly `sslmode=verify-full` and optional `channel_binding=require` |
| Each environment | `RENDER_API_TOKEN` | Secret | Dedicated Render automation API credential; prefer separate least-privilege credentials if supported |
| Each environment | `SMOKE_USERNAME` | Secret | Environment-specific Release Maintainer smoke account |
| Each environment | `SMOKE_PASSWORD` | Secret | Its password |
| Production only | `RECOVERY_EVIDENCE_ID` | Variable | Reviewed identifier for the current restore rehearsal/recovery point |
| Production only | `SCHEMA_COMPATIBILITY_EVIDENCE_ID` | Variable | Reviewed identifier proving the prior image remains compatible with the migrated schema |

10. After an independent configuration check, set
    `DEPLOYMENT_AUTOMATION_ENABLED=true` and run `release-development` (or allow the
    next protected-master push). The job verifies direct-target identity, PostgreSQL
    14-18, UTC, Prisma checksums/state and required schema objects before and after
    `prisma migrate deploy`, provisions the dedicated smoke identity, then deploys by
    Render API image digest and performs bounded source-marker, readiness,
    secure-session, CSRF and Maintainer-read smoke.
11. Before production, create and successfully restore a real recovery point into an
    isolated target, record the approved retention/RPO decision, and test the exact
    previous image against the migrated schema. Only then set the two production
    evidence IDs and `PRODUCTION_RELEASE_ENABLED=true`.
12. Run `promote-production` with the successful development Application-release
    run ID. A teammate approves the protected production job. A changed `master`,
    target reuse, missing evidence, checksum drift, non-UTC session, failed migration,
    unsigned/different digest or smoke failure stops promotion.

The environment variables are gates and references, not proof by themselves that a
review, restore or compatibility test occurred. Preserve the real reviewed evidence.
Use the [Release Maintainer and deployment-agent workflow](../workflow/deployment/README.md)
to separate implementation, database/recovery review, security review, immutable-
digest verification and protected production approval. The workflow definition and
local checks are process evidence only; they are not a deployed environment.
Set an independent random `SESSION_SECRET` of at least 32 characters per service
and configure `TRUST_PROXY_HOPS` to the verified TLS proxy topology (the template
assumes one trusted hop). Provision accounts from a trusted checkout using
[Authentication](Authentication.md). Authentication and all three role workflows
are implemented to the limits described in their guides. Development and production
deployment verification completed on 8 November 2026. Live NUS SoC AI is enabled
on both services using a protected `AI_API_KEY`; `render.yaml` declares only the
non-secret base/model/context settings and `sync: false` key placeholder. One
representative strict-contract call per role and all three deployed development
workflows passed. The application owner explicitly accepted the documented residual
provider uncertainty and authorized production activation. Production role-AI UI,
broader model evaluation, quantitative provider quotas, retention/data-use review
and teammate sign-off remain open evidence rather than hidden claims.

On 9 November 2026, all six published production demo accounts passed HTTPS login,
correct-role session retrieval, logout and post-logout rejection. These identities
were created with the fail-closed administrative `account ensure` path rather than
the development-only database seed.

## Free-tier considerations

Render free web services sleep after idle periods and share a monthly instance-hour
allowance. Neon has compute/storage quotas and may suspend idle compute. Account
for cold starts when demonstrating the application; steady-state performance
targets do not imply cold-start guarantees. Two environments share provider/account
quotas as applicable. Confirm current limits before provisioning:
[Render free services](https://render.com/docs/free),
[Neon plans](https://neon.com/pricing).

Use Neon rather than Render's expiring free database. Provider retention and restore
windows vary by plan; confirm the current project setting before relying on it. An
image rollback redeploys a previously attested digest only when schema compatibility
is proven. Database recovery is a separate human-approved restore-and-connection
decision; never reverse Prisma history automatically. The recovery restore and
schema-compatibility rehearsals were recorded before the 8 November promotion;
future schema or rollback changes require fresh evidence.
