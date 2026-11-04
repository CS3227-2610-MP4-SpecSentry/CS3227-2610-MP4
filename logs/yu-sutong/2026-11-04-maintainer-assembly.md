# Release Maintainer smoke-test increment

## Context and requests

- Prompter: `yu-sutong`, explicitly established by the user's GitHub account instruction and current request.
- Date/timezone: 4 November 2026, Asia/Singapore.
- General context: PR #19 had merged the first Maintainer workspace. The user asked to start the next PR and explicitly requested that every deployment-agent workflow interaction be documented for the final presentation.
- Explicit change request: implement the next bounded Maintainer slice using the deployment-agent workflow, preserve presentation evidence, publish through the `yu-sutong` account, and open a PR only after checks pass.
- Human verification of this AI-produced summary: pending.

## Interaction timeline and outcomes

1. The Deployment Coordinator started measurement before repository edits, confirmed base `191e65c`, branch `feature/release-maintainer-assembly`, local-only authority and external stop conditions.
2. A read-only Maintainer Architect compared proposal assembly with smoke-test recording. It recommended smoke recording because the endpoint, strict contracts, ownership/version transaction and history projection already existed; safe assembly requires a new eligible-proposals API and additional optimistic-version data.
3. A separate read-only Security Reviewer pre-reviewed the chosen boundary and supplied `SEC-SMOKE-01` through `SEC-SMOKE-07`: uncertain-result duplicate prevention, stale reconciliation, current CSRF/session and late-response safety, server-only readiness, escaped text, creator/OPEN controls and exact content-version binding.
4. The coordinator implemented the client form and PostgreSQL regressions. The first focused run failed two test-harness assertions, not product behavior. A separately measured correction fixed the split-text matcher and unmounted the first of two same-test renders; the focused suite then passed 15/15.
5. Local verification passed 124 server unit tests, 266 client tests, type-check, lint, build and diff checks. PostgreSQL execution was unavailable because no disposable test URL or Docker daemon existed.
6. A fresh read-only Release Verifier passed the frozen implementation with no reportable findings and independently reran 15 focused client tests.
7. A fresh read-only Security Reviewer closed all seven pre-review controls with no stable findings and passed 7/7 smoke contract cases. Both reviewers retained PostgreSQL CI as a required acceptance gate and made no deployment claim.
8. An unexpected nested architect child was shown as interrupted without a handoff, file edits or registered coordinator timing. It contributed no decision or evidence; exact model/timing/usage are unavailable. This process gap is preserved rather than reconstructed.
9. Documentation distinguishes the implemented smoke UI from pending membership/publication and links this interaction record for presentation use. A fresh read-only Spec/Docs Verifier passed the complete diff with no findings, confirmed the evidence counts/hashes and resolved links, and found no deployment overclaim.
10. Git identity was rechecked as `Yu Sutong <e0483972@u.nus.edu>` and GitHub CLI as active `yu-sutong`; `yust-planner` remained inactive. Feature-branch and PR publication outcomes are appended after they occur.

## Changes and evidence

- `src/client/src/features/maintainer/MaintainerWorkspace.tsx`: creator-only OPEN-candidate PASS/FAIL form; strict shared validation; exact candidate/content versions; CSRF; success/stale/uncertain reconciliation; protected-state cleanup; server-authoritative refresh.
- `src/client/src/features/maintainer/MaintainerWorkspace.test.tsx`: PASS/FAIL, bounds, read-only states, exact request, CSRF, old PASS/current blocker, escaping, conflicts, uncertainty and late-response regressions.
- `src/server/test/release-revocation.integration.ts`: stale/released no-insert and transaction rollback coverage, complementing existing ownership and content-invalidation checks.
- `README.md`, `docs/UserGuide.md`, `docs/DeveloperGuide.md`, `workflow/PLAN.md`, `workflow/TRACEABILITY.md`: current behavior, workflow evidence and remaining limitations.
- Full run details: [run record](2026-11-04-maintainer-assembly-run.md).
- Validation: focused Maintainer 15/15; smoke contracts 7/7; full server 124; full client 266; type-check, lint, production build and diff check passed. PostgreSQL integration and browser E2E remain unavailable locally.

## Resource record

- Structured records: `logs/yu-sutong/resources/2026-11-04-maintainer-assembly/`.
- Timing coverage began before the first repository edit. Each coordinator stage and every known direct specialist/reviewer invocation has a measured interval. The unexpected interrupted nested attempt has no reconstructable interval and is disclosed above.
- Per-stage token/cache/tool/retry and observed-model telemetry are unavailable because the collaboration runtime does not expose attributable counters.
- Final generated resource table/report: pending completion of final docs verification and publication stages.
- End-to-end wall time and summed overlapping interval time: pending final report.
