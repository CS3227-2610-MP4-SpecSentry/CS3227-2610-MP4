# Deployment-agent workflow observation — 7 November 2026

## Question and boundary

How did specialized deployment roles change a repository-only release-automation
increment? This is an observed coordinated run, not the required controlled
single-agent comparison. Source base was `637b56e1e769ebf4778bdd71e0141715b80c0c50`
on `feature/deployment-release-pipeline`. No registry, provider, database or deployed
environment was mutated.

## Coordination pattern

The coordinator supplied the current CI/container/deployment scaffold and normative
MP4-005/008 boundaries to three read-only specialists. The Deployment Architect
proposed the smallest source pipeline; the Security Reviewer returned nine stable
trust-boundary findings; the Database/Recovery Specialist returned seven migration
and recovery findings. One Deployment Implementer then owned the complete workflow,
tooling, marker and test write set. The coordinator owned specifications, guides,
traceability and evidence. Fresh independent Release, Security and Spec/Docs roles
reviewed the frozen candidate after implementation.

## Observable effects

- The pre-reviews agreed that provider mutations must stop until accounts, targets,
  environment protections, recovery and compatibility evidence exist. This kept the
  work source-only without inventing successful deployment evidence.
- The first architecture used a privileged `workflow_run` over a `develop` checkout.
  Coordinator reconciliation found that GitHub attestation identity would refer to
  the default-branch workflow context, not truthfully bind the checked-out source.
  The final graph instead waits for exact-SHA CI on protected `master`, uses
  development as the release canary, and promotes the identical digest.
- After the first green implementation handoff, the coordinator found that Render
  cannot create an image-backed service before a GHCR image exists. A second bounded
  implementer attempt added `publish-image`, separate from provider/database
  environments, plus `release-development` and `promote-production`.
- Database review added lexical migration checksums, direct/non-pooler TLS target
  validation, UTC and PostgreSQL 14-18 checks, failed/drifted migration rejection,
  schema probes, serialization and separate recovery/rollback stop conditions.
- Security review added full action/container pins, default-deny job permissions,
  immutable digest/attestation checks, exact Render API host and deploy-ID polling,
  target isolation, bounded/redacted smoke and no production rebuild.

## Quality and resource observations

The first implementer pass reported 10 focused deployment tests, 10 HTTP tests,
type-check, build, lint, full root tests (187 server, 289 client and 26 deployment
tests), Compose configuration and diff checks passing. One first full-suite attempt
hit an existing intermittent client session-race test; the focused client rerun and
subsequent complete root run passed. The bootstrap correction then passed the ten
focused deployment tests, workflow YAML parsing, lint and diff checks. Final
independent results belong in the deployment run rather than being inferred here.

Structured interval timestamps are under
`logs/yu-sutong/resources/2026-11-07-deployment-release-pipeline/`. Elapsed intervals
can overlap. Attributable token, cache, tool-call, retry, observed-model and
observed-effort telemetry was not exposed and remains unavailable rather than zero.

## Interpretation

Specialization materially exposed two design defects before publication and added
tests for the resolved trust boundaries. It also added coordination and rework: one
large implementation pass and one correction pass followed three pre-reviews. With
no comparable single-agent condition, the run supports a presentation discussion of
defect prevention, handoff overhead and stop conditions, but not a claim that the
workflow was faster, cheaper or more token-efficient.
