# Deployment release pipeline prompt and change log

Date: 7 November 2026 (Asia/Singapore)
Prompter: `yu-sutong` (explicit account identity from the conversation)
Branch/base: `feature/deployment-release-pipeline` /
`637b56e1e769ebf4778bdd71e0141715b80c0c50`

## Context and requests

After PR #22 was merged, the user said to continue the separately managed
deployment phase. Earlier steering required the repository's deployment-agent
workflow, presentation-ready interaction evidence and GitHub publication through
`yu-sutong`, never `yust-planner`. During implementation the user additionally
asked for a precise explanation of anything they must create in Render, Neon and
GitHub.

Authorized work was local repository source, workflows, tools, tests,
specifications, guides and safe read-only inspection of provider documentation.
No request authorized a commit, push, pull request, merge, provider-resource
creation, registry publication, remote migration, deployment, promotion, rollback
or credential handling. No secret values were requested or recorded.

The scope was corrected during the run. Three pre-review specialists held all
external mutations because targets, GitHub Environment protections, provider
credentials, recovery and image/schema compatibility were not established. The
coordinator replaced the first `develop`/`workflow_run` proposal with a
protected-`master` development canary so attestation source identity matches the
code built. A second implementer pass added a provider-free `publish-image`
bootstrap after the first-image dependency for Render was identified.

An independent Security review then found a Neon URL TLS-downgrade path
(`DEP-SEC-007`); canonical `sslmode=verify-full` parsing and adversarial tests
closed it. The first Release verification found that an unlisted Prisma migration
could be applied before postflight rejection (`DEP-REL-001`); exact regular-file
migration inventory validation now fails before migration. The first Spec/Docs
verification requested workflow-index, submission-status and final evidence
updates. A verifier mistakenly edited the shared tree after context compaction;
that boundary error is retained in the records, and fresh read-only Release and
Security passes checked the corrected candidate.

Human verification of this AI-written summary is required before presentation or
submission; no human verification is claimed in this run.

## Changes and evidence

The new Application-release workflow waits for exact-SHA protected-`master` CI,
builds one `linux/amd64` GHCR image, records its immutable registry digest,
produces SBOM/provenance and a GitHub attestation, scans that digest, verifies
reviewed migrations and UTC, deploys/verifies a development canary and permits a
protected production job to reuse only the successful development digest. Manual
`publish-image`, `release-development` and `promote-production` operations
separate bootstrap, development and production authority. All GitHub Actions and
the Gitleaks container are immutable pins with default-deny/per-job permissions.

Deployment tooling validates strict release-candidate/run identities, exact
migration inventory/checksums, direct Neon host/TLS/UTC/PostgreSQL/migration/schema
state, the exact Render API host/deploy ID/digest with bounded redacted failures,
and HTTPS source-marker/readiness/session/CSRF/Maintainer smoke behavior. The Docker
image exposes only a validated source revision. Technical design, plan,
traceability, workflow index, submission state, Developer/Deployment guides,
Reflections and the workflow observation now describe the protected-master canary
and its non-live boundary.

Final local evidence passed 187 server tests, 289 client tests and 28 deployment
workflow tests; type-check, production build, lint, ten-migration inventory/checksum
verification, submission presence, workflow YAML parsing, Docker Compose
configuration with a synthetic required secret and `git diff --check` also passed.
The production build retains its existing non-failing large-chunk warning. The
first implementer full-suite attempt hit one existing intermittent client
session-race case; the immediate client rerun and later complete runs passed.

No GHCR image, GitHub Environment, Render service, Neon project/database, remote
migration, deployed URL, production approval, restore rehearsal or rollback was
created or observed. The exact human setup sequence and variable/secret names are
in [Deployment](../../docs/Deployment.md).

## Resource record

Structured intervals are under
`logs/yu-sutong/resources/2026-11-07-deployment-release-pipeline/`. They cover
coordinator design/integration/corrections, architecture/security/database
pre-review, two implementer attempts, failed-then-corrected independent reviews and
fresh passes. The generated report is
[2026-11-07-deployment-release-pipeline-resources.md](2026-11-07-deployment-release-pipeline-resources.md).

Timing was recorded before the first edit and at each real attempt boundary.
Intervals overlap, so summed agent time is not end-to-end time. Per-record input,
output, cache, tool-call, retry, observed-model and observed-effort telemetry was
not exposed; these fields remain unavailable rather than zero. Account percentages
or estimated token counts were not used.

| Stage / invocation | Selected model / effort | Outcome |
| --- | --- | --- |
| Design and three specialist pre-reviews | inherited / inherited | Source-only scope and stop conditions frozen |
| Implementer 1 and bootstrap correction | inherited / inherited | Pipeline/tooling/marker/tests implemented; first-image bootstrap separated |
| First independent reviews | inherited / inherited | TLS, migration-inventory and documentation findings retained |
| Corrections and fresh rechecks | inherited / inherited | Security and Release findings closed with complete local gates |
| Final evidence and docs check | inherited / inherited | Prompt/run/manifest/resources reconciled against the final tree |

The detailed report contains actual UTC timestamps, elapsed seconds, statuses,
outcomes and unavailable-telemetry reasons for every interval.
