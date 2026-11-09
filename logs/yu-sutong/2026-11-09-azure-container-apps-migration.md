# Azure Container Apps migration

## Context and requests

- Prompter, date/timezone: `yu-sutong`, 9 November 2026, Asia/Singapore. The
  explicit conversation identity agrees with Git identity `Yu Sutong`.
- General context: Render Free accepted wake requests but repeatedly failed to
  resume the development and production containers. The application and Neon
  databases were not identified as the cause. The owner required a zero-
  out-of-pocket replacement without supplying card details while preserving the
  assignment's separately managed build/deployment model.
- Explicit change requests and subsequent decisions:
  - Find another deployment provider while retaining Neon.
  - Stop Oracle because signup required card details.
  - Require a free/no-card path; stop Northflank after login failure and a current
    provider security notice.
  - Retry after Azure for Students activation, use the documented deployment-agent
    workflow, keep one migration PR, preserve Render until verified cutover, and
    operate GitHub as `yu-sutong`.
  - Authorize environment-scoped OIDC identities, least-privilege Azure roles,
    managed identities and transfer of the existing pooled Neon/session/NUS AI
    runtime secrets without exposing their values.
- Other interactions and outcomes:
  - Oracle and Northflank received no application secret or SpecSentry resource.
  - Azure for Students was verified active and no pay-as-you-go upgrade was made.
  - Provisioning recovered from a Container Registry provider-registration delay
    and an Indonesia Central production quota failure by retaining development
    there and creating production in East Asia.
  - A deployment-agent stream disconnection resumed against the same branch. A
    disk-full dependency failure was recovered by deleting only the disposable npm
    cache. An attempted generic Azure registry update was rejected because Azure
    redacts secret values on readback; no live secret changed.
  - A read-only final control-plane audit confirmed the exact OIDC subjects, narrow
    app/registry roles, per-app `AcrPull`, disabled ACR admin user, distinct hosts,
    secret-reference names/probes and protected production reviewer settings.
- Human summary verification: pending; the repository owner and teammates must
  verify this AI-produced summary and their own contribution/AI declarations.

## Changes and evidence

- Azure foundation:
  - Development: `specsentry-dev-rg`, `specsentry-dev-env`, `specsentry-dev`,
    Indonesia Central,
    `https://specsentry-dev.greensea-443a99a3.indonesiacentral.azurecontainerapps.io`.
  - Production: `specsentry-prod-rg`, `specsentry-prod-env`, `specsentry`, East
    Asia,
    `https://specsentry.livelymeadow-62e3ed89.eastasia.azurecontainerapps.io`.
  - Shared private Standard ACR: `specsentryacr.azurecr.io` in
    `specsentry-shared-rg`; admin credentials disabled.
- Identity/security changes:
  - Separate Entra applications trust only the literal GitHub `development` or
    `production` environment subject and have no client secret.
  - Each has Contributor only on its exact Container App; development has registry
    import/read and production registry pull. Each app has an environment-owned
    user-assigned pull identity with `AcrPull`.
  - Pooled Neon URLs and independent session/NUS AI secrets are Azure app secrets.
    Direct Neon URLs and private smoke credentials stay in their protected GitHub
    Environments. Only names and reference shape were recorded.
  - GitHub variables now identify the exact Azure target, registry, public host
    and pull identity. Old Render configuration is retained only for cutover
    fallback.
- Repository changes:
  - `.github/workflows/application-release.yml` logs into Azure with environment
    OIDC, imports the approved private digest once in development, reuses it in
    production and keeps migrations and authenticated smoke behind their existing
    gates without downloading a privileged Container Apps extension.
  - `workflow/deployment/tooling/azure-deploy.mjs` validates targets, ACR identity,
    digest, runtime secret references, probes, HTTPS/FQDN, revision health and 100%
    traffic. It uses fixed-version ARM REST calls instead of a downloaded privileged
    extension, removes the GHCR token from child environments and emits only safe
    evidence.
  - Deployment tests cover wrong identity/image/host, password registry, unsafe
    secret mapping, missing probes, insecure ingress, ambiguous failures,
    unhealthy revision and wrong traffic.
  - README, guides, architecture/spec/traceability/submission text and
    `src/website/index.html` now identify Azure accurately without claiming the
    still-pending protected release. Render artifacts remain explicit temporary
    rollback evidence.
- Validation results:
  - Prisma generation passed.
  - Server: 193/193; client: 290/290; deployment workflow: 32/32.
  - ESLint, TypeScript checks, production build, submission presence, YAML parsing
    and `git diff --check` passed.
  - The Vite build retained its existing large-chunk warning; npm reported the
    existing dependency findings (4 low, 25 moderate) during installation. Neither
    was introduced or silently reclassified by this migration.
- Independent review: pre-review controls were implemented. The final review found
  and prompted exact Azure-FQDN/smoke-host binding plus narrower documentation of
  external trust anchors. It also identified the unverified privileged Container
  Apps extension; the final candidate removes that download and uses fixed-version
  ARM REST calls. The corrected focused suite is green, and a fresh read-only
  bypass/regression review found no concrete surviving route. Final reviewer closure
  is recorded in the resource interval before commit.
- Unresolved and next actions:
  - The Azure apps intentionally still run a placeholder image. The real digest can
    exist only after the PR merges into protected `master`.
  - Do not call the cutover released until the automatic development run succeeds,
    a teammate approves the same-digest production promotion, authenticated role
    and representative AI smoke pass, and rollback evidence is retained.
  - Render remains available until those gates pass. Human interaction-summary,
    contribution and submission checks remain human responsibilities.

## Resource record

- Structured records:
  `logs/yu-sutong/resources/2026-11-09-azure-container-apps-migration/`.
- Timing coverage: the main interval started before the first repository edit.
  Separate real intervals cover database review, implementation, hardening,
  security pre-review and final independent review. The post-fix reviewer interval
  measures only the portion after its late recorder registration. Earlier provider
  research and the already-completed security-fix investigation are summarized
  without fabricated retrospective resource timing.

| Stage / agent / invocation | Selected model / effort | Start / end | Elapsed | Input / output tokens | Cache | Tool calls / retries | Outcome / source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Main coordination / `main-1` | GPT-5 / unavailable | 2026-11-08T18:11:10.333254Z / 2026-11-09T08:18:53.067285Z | 50,862.734 s | unavailable | unavailable | unavailable | Succeeded; provisioning, integration, hardening and complete validation |
| Database review / `database-review-1` | GPT-5 / unavailable | 2026-11-08T18:12:47.803002Z / 2026-11-08T18:15:50.167225Z | 182.364 s | unavailable | unavailable | unavailable | Succeeded; compatibility with explicit gates |
| Implementation / `implementer-1` | GPT-5 / unavailable | 2026-11-08T18:12:47.719504Z / 2026-11-09T05:57:43.029946Z | 42,295.310 s | unavailable | unavailable | unavailable | Succeeded; includes stream wait/disconnection time |
| Hardening / `implementer-2` | GPT-5 / unavailable | 2026-11-09T05:58:28.628395Z / 2026-11-09T05:58:58.261309Z | 29.633 s | unavailable | unavailable | unavailable | Succeeded; child-environment credential removal and revalidation |
| Security pre-review / `security-design-review-1` | GPT-5 / unavailable | 2026-11-08T18:12:47.891092Z / 2026-11-08T18:18:27.991249Z | 340.100 s | unavailable | unavailable | unavailable | Succeeded; `AZ-SEC-001..008` returned |
| Final independent review / `security-final-review-1` | GPT-5 / unavailable | 2026-11-09T07:40:37.326118Z / 2026-11-09T08:18:43.241640Z | 2,285.916 s | unavailable | unavailable | unavailable | Succeeded; FQDN and privileged-extension findings returned |
| Post-fix review / `security-fix-review-1` | GPT-5 / unavailable | 2026-11-09T08:12:11.867193Z / 2026-11-09T08:16:45.192402Z | 273.325 s | unavailable | unavailable | unavailable | Succeeded; partial measured interval, no concrete surviving bypass/regression |

- End-to-end measured wall time: 50,862.734 s from the main interval. Summed
  registered interval time: 96,269.382 s. Concurrent and long-lived intervals
  overlap and are not CPU/model-only time.
- Unavailable reasons: the interface does not expose attributable token, cache,
  tool-call or retry counters. They are `unavailable`, never estimated from account
  limits.

## Cutover finalization — 9 November 2026

- Additional explicit request: update the repository from migration-candidate
  wording to the completed Azure deployment, including README, GitHub Pages,
  Reflections and other current Markdown; publish the development and production
  links and remove obsolete Render fallback implementation.
- Decision: Azure is the sole active repository deployment path. Preserve dated
  Render history and evaluation evidence, but remove the temporary `render.yaml`
  and Render deployment helper. Do not delete external Render resources or
  credentials in this repository-only cleanup.
- Prompter identity remains `yu-sutong`, explicitly supplied in the continued
  conversation and corroborated by Git identity `Yu Sutong`.
- Human summary verification remains pending.
- Changes made: current Azure status, run evidence, URLs and approval/RBAC details
  were reconciled across README, User/Developer/Deployment/Architecture/AI guides,
  Reflections, the public GitHub Pages source, plan, workflow index, submission,
  traceability and OPEN-002. The temporary Render manifest/helper were removed;
  dated historical Render evidence was preserved.
- Validation passed: `npm run lint`; `npm run test:deployment-workflow` (34/34);
  `npm run check:submission`; `git diff --check`; both GitHub run conclusions/SHA;
  and development/production `/api/health` responses with the expected source SHA.
- The first PR CI run passed secret scanning, typecheck, lint and all 193 server
  tests, then had one timing-sensitive failure in the unchanged client
  `FunctionalUx.test.tsx`. That exact file passed 11/11 in three consecutive focused
  local reruns; no unrelated client source/test change was made. A fresh full CI run
  is required on the evidence-only follow-up commit.
- Remaining action: human review and merge of the cleanup PR. External Render
  services and credentials were not changed or deleted.

### Cutover-finalization resource record

- Structured record:
  `logs/yu-sutong/resources/2026-11-09-azure-cutover-finalization/1c262256ea704c8ea093d2f90245cd22.json`.
- Timing coverage: the interval began before the first repository edit and ended
  after validation. Final report rendering and this measurement transcription are
  outside the closed interval as required by the recording procedure.

| Stage / agent / invocation | Selected model / effort | Start / end (UTC) | Elapsed | Input / output tokens | Cache | Tool calls / retries | Outcome / source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Cutover finalization / main / `main-1` | GPT-5 / unavailable | 2026-11-09T12:56:43.398770Z / 2026-11-09T13:02:05.881756Z | 322.482986 s | unavailable | unavailable | unavailable | Succeeded; shared resource-session report |
| CI failure investigation / main / `main-2` | GPT-5 / unavailable | 2026-11-09T13:04:56.683198Z / 2026-11-09T13:05:27.354425Z | 30.671227 s | unavailable | unavailable | unavailable | Succeeded; existing focused test passed three consecutive reruns |

- End-to-end wall time from first start to final finish: 523.955655 seconds. Summed
  agent elapsed time: 353.154213 seconds; the two intervals do not overlap and the
  gap covers commit/push/remote-CI waiting outside registered execution stages.
- Per-record input/output tokens, cache, tool calls, retries, observed model and
  observed effort were not exposed by the interface and were not estimated.
