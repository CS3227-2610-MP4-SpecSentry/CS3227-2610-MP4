# Azure Container Apps + Neon PostgreSQL

## Deployment status

`.github/workflows/application-release.yml` is the repository-managed release path.
GitHub Actions remains the only builder: it accepts an exact successful protected-
`master` CI revision, builds one `linux/amd64` image, records its immutable digest,
emits provenance and an SBOM, creates a GitHub artifact attestation and scans that
exact digest.

The Azure foundation was provisioned on 9 November 2026 under an Azure for Students
subscription with no credit card:

| Environment | Container App | Region | Neon project | Public host |
| --- | --- | --- | --- | --- |
| Development | `specsentry-dev` in `specsentry-dev-rg` | Indonesia Central | `specsentry-development` | `specsentry-dev.greensea-443a99a3.indonesiacentral.azurecontainerapps.io` |
| Production | `specsentry` in `specsentry-prod-rg` | East Asia | `specsentry-production` | `specsentry.livelymeadow-62e3ed89.eastasia.azurecontainerapps.io` |

The environments, applications, Neon databases, hostnames, managed identities,
session secrets and smoke accounts are separate. The shared private Azure Container
Registry is `specsentryacr.azurecr.io`; sharing the registry does not share runtime
state.

The Azure release path is live. Development run
[`42605859917`](https://github.com/CS3227-2610-MP4-SpecSentry/CS3227-2610-MP4/actions/runs/42605859917)
and production run
[`42619894195`](https://github.com/CS3227-2610-MP4-SpecSentry/CS3227-2610-MP4/actions/runs/42619894195)
successfully promoted source `6dfe10db7958dac8f378f2a96118ab3b4ee69a5d` and ACR
digest `sha256:b53a5573676b4af43357dd19ee32dc7805c32c8b95ee78f53054d5446ee2e759`.
The production workflow completed its authenticated smoke, and the public health
endpoint returned `200` with the same source revision.

Both Azure jobs use the Azure CLI's built-in `az rest` command with the fixed,
stable Container Apps ARM API version `2025-07-01`; they do not download or execute
a Container Apps extension in the privileged deployment jobs. One merge patch
atomically reconciles the ACR server to the exact environment-owned identity in
`AZURE_CONTAINER_REGISTRY_IDENTITY` and changes only the validated container image.
A different subscription, resource group or app response, an identity outside the
configured target resource group, a different public host, or password-based
registry configuration fails closed.
Protected GitHub Environment variables and the narrow live Azure RBAC assignments
remain the authoritative anchors for which otherwise well-formed target is trusted.

## Release operations

Manual operations remain deliberately separate:

- `publish-image` builds, scans, attests and publishes the GHCR image only. It has
  no Azure or Neon deployment authority.
- `release-development` publishes the protected-master candidate, imports that
  exact private GHCR digest into ACR with the run's short-lived `GITHUB_TOKEN`,
  migrates development, deploys the ACR digest and performs authenticated smoke.
- `promote-production` accepts a successful development run ID, verifies the
  frozen candidate again, requires the protected production approval and deploys
  the same existing ACR digest without rebuilding or importing it again.

An automatic protected-`master` push follows the development-release path only
when `IMAGE_RELEASE_ENABLED` and `DEPLOYMENT_AUTOMATION_ENABLED` are both `true`.
Production is never automatic.

## Identity and secret boundaries

GitHub authenticates to Azure with two Entra applications and environment-bound
federated credentials:

- `specsentry-github-development` trusts only
  `repo:CS3227-2610-MP4-SpecSentry/CS3227-2610-MP4:environment:development`.
- `specsentry-github-production` trusts only the corresponding `production`
  environment subject.

Neither identity has a client secret. Each has `Contributor` only on its exact
Container App. Development has `Container Registry Data Importer and Data Reader`
on the shared ACR; production has `AcrPull` and `Reader` on that registry. Each Container App uses its own
user-assigned managed identity with `AcrPull`, so Azure stores no registry password.

Runtime secrets are stored directly as Azure Container App secrets:
`DATABASE_URL`, `SESSION_SECRET` and `AI_API_KEY`. `DATABASE_URL` is the matching
pooled Neon URL. The direct Neon URL remains only in its protected GitHub
Environment as `DIRECT_DATABASE_URL` for migrations and release verification; it
must never reach the running container. No secret value belongs in this repository,
GitHub variable output, deployment evidence or screenshots.

## Runtime contract

Both Container Apps use:

- one container and single-revision mode;
- external HTTPS ingress with insecure HTTP disabled and target port `3000`;
- `NODE_ENV=production`, `PORT=3000` and `TRUST_PROXY_HOPS=1`;
- secret references for `DATABASE_URL`, `SESSION_SECRET` and `AI_API_KEY`;
- liveness `/api/health` and readiness `/api/ready` probes;
- zero minimum replicas and one maximum replica during the student-credit period;
- the approved NUS SoC base, `default` model alias and bounded context setting.

Zero minimum replicas permits Azure scale-to-zero. A first request can be slower,
but Azure must resume automatically; a manual redeploy is not normal recovery.
Readiness tolerates database/application cold start while liveness checks only the
process. Maximum replicas remains one because the current technical contract uses
process-wide AI limits and a five-connection Prisma pool.

## Database prerequisite

Application traffic uses each environment's pooled Neon connection. Migrations,
verification, dump/restore and administrative work use the matching direct endpoint.
The direct URL must use exactly `sslmode=verify-full`; optional
`channel_binding=require` is the only other query parameter accepted by the release
verifier. Its host must not contain `pooler`.

The database default timezone is UTC. Before a release, the workflow verifies the
expected direct host, PostgreSQL 14-18, UTC, migration checksums/state and required
schema objects before and after `prisma migrate deploy`. Image rollback and database
recovery remain separate decisions: only redeploy a previously attested image after
schema compatibility is proven, and restore a database only into an isolated target
before a separate human-approved connection switch.

## GitHub Environment configuration

Both literal GitHub Environments, `development` and `production`, are restricted to
the protected release branch. Production currently names `yu-sutong` as the
required reviewer and permits self-review; the protected-branch deployment policy
remains enabled. This preserves an explicit approval pause while allowing the
repository owner to approve when no second eligible reviewer is available.

| Scope | Name | Kind | Meaning |
| --- | --- | --- | --- |
| Each | `AZURE_CLIENT_ID` | Variable | Environment-specific Entra application client ID |
| Each | `AZURE_TENANT_ID` | Variable | Azure tenant ID |
| Each | `AZURE_SUBSCRIPTION_ID` | Variable | Azure for Students subscription ID |
| Each | `AZURE_RESOURCE_GROUP` | Variable | Exact environment resource group |
| Each | `AZURE_CONTAINER_APP_NAME` | Variable | Exact target Container App |
| Each | `AZURE_CONTAINER_REGISTRY_RESOURCE_GROUP` | Variable | Shared ACR resource group |
| Each | `AZURE_CONTAINER_REGISTRY` | Variable | Registry name (`specsentryacr`) |
| Each | `AZURE_REGISTRY_SERVER` | Variable | Exact ACR login server |
| Each | `AZURE_CONTAINER_IMAGE_NAME` | Variable | Repository path inside ACR |
| Each | `AZURE_CONTAINER_REGISTRY_IDENTITY` | Variable | Exact environment-owned user-assigned identity resource ID used for ACR pulls |
| Each | `EXPECTED_DATABASE_HOST` | Variable | Exact direct Neon hostname only |
| Each | `DEPLOYMENT_BASE_URL` | Variable | Exact HTTPS application origin |
| Each | `EXPECTED_DEPLOYMENT_HOST` | Variable | Hostname from that origin |
| Each | `DIRECT_DATABASE_URL` | Secret | Matching direct/non-pooler Neon URL |
| Each | `SMOKE_USERNAME` | Secret | Environment-specific Maintainer smoke account |
| Each | `SMOKE_PASSWORD` | Secret | Its password |
| Production | `RECOVERY_EVIDENCE_ID` | Variable | Reviewed current recovery evidence |
| Production | `SCHEMA_COMPATIBILITY_EVIDENCE_ID` | Variable | Reviewed previous-image compatibility evidence |

The Azure runtime values are not GitHub secrets because OIDC identifies the target
without a password. Runtime application secrets stay in Azure rather than being
copied through every release job.

## Release checklist

1. Require the repository `CI` check before merge to `master`.
2. Keep the two Neon projects, pooled/direct URL pairs, UTC configuration and secret
   sets isolated.
3. Run `release-development` or allow the protected-master push. Confirm the job
   imports one attested GHCR digest, verifies the ACR digest, applies reviewed
   migrations, deploys one healthy revision with 100% traffic and passes the source,
   readiness, session, CSRF and Maintainer-read smoke.
4. Preserve the development run ID and its `verified-development-candidate`
   artifact. A stale `master`, different digest or missing evidence blocks promotion.
5. Reconfirm the recovery point and previous-image/schema compatibility evidence.
6. Run `promote-production` with the development run ID and have a teammate approve
   the protected production job.
7. Confirm production root, `/api/health` and `/api/ready` return `200`; signed-out
   `/api/auth/session` returns `401`; and the dedicated authenticated smoke passes.
8. Exercise the six published demo identities and representative live-AI flows.

## Cost and recovery notes

Azure for Students supplies time-limited credit and disables the subscription when
credit is exhausted unless the owner deliberately upgrades; no pay-as-you-go upgrade
is authorized. Container Apps can scale to zero, while the Standard ACR and managed
environment consume subscription allowance. Monitor Azure Cost Management and keep
budget alerts enabled. Neon has separate compute/storage limits and can also suspend
idle compute.

See the [deployment-agent workflow](../workflow/deployment/README.md),
[Authentication](Authentication.md), and the 9 November Azure migration interaction
log for the complete review and evidence boundaries.
