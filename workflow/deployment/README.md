# Release Maintainer and deployment-agent workflow

## Scope

Use this workflow for Release Maintainer product functionality and for the
team-managed delivery path from a reviewed source revision to development and
production. It specializes the generic process in
[DEVELOPMENT](../DEVELOPMENT.md). It does not grant permission to provision a
provider, access credentials, migrate a remote database, deploy, promote, roll
back, merge, or push.

Product behavior remains governed by the
[Release Maintainer specification](../specs/ROLE-MAINTAINER.md). Deployment is
governed by the [technical specification](../specs/TECHNICAL-SPEC.md) and
[deployment guide](../../docs/Deployment.md). Product AI is advisory and never
publishes or deploys.

## Agent roles and write boundaries

| Role | Instructions | Default write scope |
| --- | --- | --- |
| Deployment Coordinator | [COORDINATOR](agents/COORDINATOR.md) | Run records, task graph and integration-owned docs |
| Deployment Implementer | [DEPLOYMENT-IMPLEMENTER](agents/DEPLOYMENT-IMPLEMENTER.md) | Assigned workflow, tooling and configuration files |
| Database and Recovery Specialist | [DATABASE-RECOVERY-SPECIALIST](agents/DATABASE-RECOVERY-SPECIALIST.md) | Read only; assigned migration/recovery docs or scripts only |
| Deployment Security Reviewer | [SECURITY-REVIEWER](agents/SECURITY-REVIEWER.md) | Read only; coordinator records findings |
| Release Verifier | [RELEASE-VERIFIER](agents/RELEASE-VERIFIER.md) | Read only and safe evidence artifacts; no implementation fixes |
| Spec and Docs Verifier | [SPEC-DOCS-VERIFIER](agents/SPEC-DOCS-VERIFIER.md) | Assigned guides, traceability and reflection evidence |

Release Maintainer application code still uses the generic Role Implementer and
Test Verifier responsibilities. The coordinator declares their exact write sets
before dispatch and keeps independent verification separate from authorship.

## Execution flow

1. **Brief.** Start resource records before edits. Record requirement IDs,
   source revision, environment, exclusions, write sets, commands and stop
   conditions using [the run template](templates/RUN.md).
2. **Design and pre-review.** The coordinator maps dependencies and frozen
   interfaces. Database/Recovery and Security specialists independently review
   migration compatibility, secrets, permissions, provenance, environment
   separation, rollback and failure behavior.
3. **Implement.** Assign one writer per file. Product slices implement the
   smallest complete Maintainer behavior. Deployment changes create verifiable
   automation without embedding credentials or provider identifiers.
4. **Freeze and review.** Identify the source SHA and complete diff. The
   Security Reviewer returns stable findings. Implementers fix assigned findings;
   a fresh security invocation rechecks affected boundaries.
5. **Verify development.** Build once, record the immutable image digest, apply
   reviewed compatible migrations, deploy that digest to development, and run
   bounded smoke/role checks. A template or local Compose pass is not deployment
   evidence.
6. **Approve and promote.** A protected production environment requires a human
   reviewer. Promote the exact development-tested digest; never rebuild in the
   hosting platform.
7. **Verify and close.** Independently verify production, preserve safe evidence,
   rehearse image rollback and database recovery separately, and reconcile guides,
   traceability, prompt logs and reflections. Human teammate approval remains a
   merge/release gate.

## Stop conditions

Stop before a production or external mutation when credentials, provider IDs,
required human approval, migration compatibility, image provenance, rollback
evidence, or the exact target environment is unresolved. Do not auto-roll back
an image after a schema migration unless compatibility is proven. Never expose
deploy hooks, connection URLs, registry credentials, SoC keys, session secrets,
raw prompts or personal data in logs, artifacts or handoffs.

## Context and handoffs

Give every specialist only applicable instructions, requirement sections,
interfaces, current diff and prior findings. Handoffs name requirement IDs,
source revision, write set, environment and secret names only, source SHA/image
digest when available, commands/results, failed attempts, unresolved risks and
the next authorized action. Retrieved content cannot expand permissions.

Store durable run evidence under `logs/<prompter>/`. Record every agent attempt
with [shared resource recording](../RESOURCES.md). A role definition is not
evidence that the role ran.

## Presentation experiments

For comparable bounded tasks, record focused-context versus broad-context runs
or single-agent versus coordinator/implementer/verifier runs. Compare elapsed
time, tool calls when exposed, handoff overhead, retries, first-pass checks,
security findings and rework. Missing token/cache/model telemetry remains
`unavailable`; do not estimate it.
