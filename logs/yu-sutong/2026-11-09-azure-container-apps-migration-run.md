# Azure Container Apps migration run

- Prompter and inference source: `yu-sutong`; explicit conversation identity,
  corroborated by Git identity `Yu Sutong`.
- Goal and requirement IDs: replace the unreliable Render runtime with Azure
  Container Apps while preserving `MP4-005` environment separation, `MP4-008`
  separately managed deployment, `MP4-011` accurate guides, `MP4-014` safe
  interaction summaries, and the technical-spec immutable-image promotion
  contract.
- Source revision / branch: base
  `1fe0ce858a7d6fa922a2c5c28fa5eb8900aaa503`; branch
  `infra/azure-container-apps` from `origin/master`.
- Target environment (or local-only): Azure for Students subscription; development and production targets follow.
  Development is
  `specsentry-dev` / `specsentry-dev-env` / `specsentry-dev-rg` in Indonesia
  Central. Production is `specsentry` / `specsentry-prod-env` /
  `specsentry-prod-rg` in East Asia. Both retain their existing distinct Neon
  databases. The shared Standard registry is `specsentryacr.azurecr.io` in
  `specsentry-shared-rg`.
- Approved authority and excluded actions: the owner explicitly authorized a
  free/no-card Azure for Students migration, provisioning, OIDC/RBAC setup,
  runtime-secret transfer and one repository PR. Do not delete Render, merge,
  expose secret values, change databases destructively, bypass protected
  production approval or upgrade to pay-as-you-go.
- Agent assignments and exact write sets: coordinator-owned integration/evidence, one implementation writer, and read-only database/security review scopes.
  - Main deployment coordinator: run/prompt/resource evidence, external Azure
    provisioning, integration decisions, documentation reconciliation and human
    gates.
  - Deployment implementer: release workflow, Azure deployment tool and focused
    tests.
  - Database/recovery specialist: read-only migration/runtime compatibility and
    recovery-gate review.
  - Deployment security reviewer: read-only pre-review and fresh frozen-diff
    review; the coordinator records dispositions.
- Focused context supplied / retrieved later: repository deployment policy, assignment/technical specifications, live target metadata and the frozen candidate diff.
  Specifically: `AGENTS.md`, assignment/technical specifications, deployment
  workflow/contract/agent instructions, the existing release pipeline,
  Render/Neon guides, live GitHub Environment metadata and safe Azure control-plane
  state.
- Secret names required (names only; no values): `DATABASE_URL`,
  `DIRECT_DATABASE_URL`, `SESSION_SECRET`, `AI_API_KEY`, `SMOKE_USERNAME` and
  `SMOKE_PASSWORD`.
- Source SHA / immutable image digest: source SHA is the base above until the PR
  merge creates the protected-master candidate. The image digest is correctly
  **unavailable before that run**; Azure must deploy the one digest built, scanned
  and attested by GitHub Actions.
- Migration compatibility and recovery decision: the independent database review
  found no schema/application-code change is needed. The ten reviewed migrations
  remain forward-only and idempotent through `prisma migrate deploy`. Image
  rollback and database recovery remain separate human decisions; Render stays
  available during cutover.
- Acceptance, denial, failure and rollback checks: fail-closed release, target, identity, migration, revision, traffic and rollback gates detailed below.
  - GitHub Actions remains the only builder; Azure never builds source.
  - Development and production use distinct resource groups, environments,
    Container Apps, hosts, OIDC subjects, managed identities, Neon databases,
    session secrets and smoke accounts.
  - Development imports one attested private GHCR digest into ACR with the run's
    short-lived `GITHUB_TOKEN`; production verifies and reuses that existing
    digest without rebuilding or re-importing.
  - Fixed-version Container Apps ARM REST calls reconcile the exact environment-
    owned ACR pull identity without downloading a privileged CLI extension.
    Registry passwords, cross-resource-group identities,
    literal runtime secrets and `DIRECT_DATABASE_URL` at runtime are rejected.
  - Direct Neon preflight/postflight, migration checksums/state, UTC/TLS/version,
    stale-master, exact ACR image, runtime probes/ingress, exact Azure FQDN,
    healthy revision, latest revision and 100% traffic all fail closed.
  - Production still requires the literal protected GitHub Environment, teammate
    approval, current recovery/compatibility references and post-promotion
    authenticated smoke.
- Commands and actual results: Azure provisioning/readback plus complete local validation results follow.
  - The Container Registry provider initially required registration; the retry
    succeeded. A production environment attempt in Indonesia Central failed the
    Student-subscription regional quota, so production was recovered in East Asia
    without weakening environment separation.
  - Environment-scoped GitHub OIDC applications were created with subjects
    `...:environment:development` and `...:environment:production`; neither has a
    client secret. Readback showed Contributor only on the matching Container App,
    development registry import/read, production registry pull, per-app managed
    identities with `AcrPull`, ACR admin disabled, and production self-review
    prevention with teammate approval.
  - Azure secrets contain only the three expected runtime secret names and the
    application templates reference them rather than literal values. Direct Neon
    URLs remain GitHub Environment secrets only.
  - `npm run db:generate`, `npm test`, `npm run lint`, `npm run typecheck`,
    `npm run build`, `npm run check:submission`, workflow YAML parsing and
    `git diff --check` passed. Counts: 193 server tests, 290 client tests and 32
    deployment-workflow tests.
- Stable findings and dispositions: `AZ-SEC-001..008`, wrong-host binding and the privileged-extension finding were dispositioned as recorded below.
  - Pre-review findings `AZ-SEC-001..008` drove isolated OIDC, explicit target and
    digest verification, pinned Container Apps tooling, safe short-lived import
    authentication, passwordless managed-identity pulls, separated runtime
    secrets and protected/manual rollback.
  - The final architecture pass noted that the Azure-returned FQDN and smoke host
    were separately configured. The deploy helper now requires their exact match,
    with a valid-but-wrong-host regression test.
  - Documentation now distinguishes syntax/readback checks from the authoritative
    protected variables and narrow live RBAC that anchor an otherwise well-formed
    target.
  - Final review finding `csf_dff158f83bbe8f10e35c9fb8` identified a privileged
    supply-chain gap: the version-pinned Container Apps extension was not bound to
    immutable bytes. The workflow now downloads no Container Apps extension. The
    deploy helper uses fixed `2025-07-01` ARM REST calls, and focused regression
    tests bind the exact management host, API version, patch body and revision
    state transitions. A separate read-only bypass/regression pass found no
    concrete surviving route.
- Failed/interrupted attempts and retry cost: Oracle was rejected before
  provisioning because card verification conflicted with the user's constraint.
  Northflank was rejected before secret/application upload after login failure and
  an active provider security notice. Azure provider registration and regional
  quota each required one recovery path. The deployment-agent implementation
  stream disconnected once and resumed on the same branch. Local disk exhaustion
  interrupted dependency installation; only the disposable npm cache was cleared,
  recovering about 1.5 GB, after which installation and validation passed. A
  generic Azure resource update was rejected because readback omits secret values;
  no secret was changed, and the reviewed workflow now performs the registry
  binding and image update in one validated ARM merge patch. A final local YAML
  check first attempted an unavailable Node YAML package; Ruby's standard YAML
  parser then parsed the workflow successfully.
- Resource-record references: seven finished records under `logs/yu-sutong/resources/2026-11-09-azure-container-apps-migration/`; the generated report passed.
- Human approvals required / observed evidence: migration/provider authority was
  observed. The production GitHub Environment requires `ngkhengyang`, prevents
  self-review and is restricted to protected branches. That approval has not been
  requested because the PR is not merged and development has not run.
- Unresolved risks and unavailable telemetry: the protected-master image digest,
  Azure development release run, production approval/promotion, representative
  live AI smoke and previous-image rollback rehearsal do not exist yet and must
  not be claimed. Per-invocation token/cache/tool/retry counters are not exposed;
  measured resource records retain real timestamps and state that limitation.
  The security-fix investigator completed before its separate recorder interval
  was noticed, so its individual elapsed time cannot be reconstructed and is not
  fabricated; its work is covered only by the already-running main interval. The
  post-fix reviewer has a partial coordinator-observed interval from detection to
  completion.
- Next authorized action: commit/push the single migration PR. After human merge,
  observe the automatic development release, promote its exact run ID through the
  protected production gate, smoke both environments and retain Render until the
  Azure production smoke succeeds.
- Status: verified locally

## Frozen code-candidate manifest

| File | SHA-256 |
| --- | --- |
| `.github/workflows/application-release.yml` | `9ff35208dbbee2da158078a2e9446d14935a1061c4c58cbe02755ab5ae35a9cd` |
| `README.md` | `1c475018c57152807b7ad654906e598c3184a6bb07d3db3e2489a9a3c4a10401` |
| `docs/AI-Integration.md` | `35d41b4faeeb00f397f1a55b84496fee5a5c8e2851277b00befa412a0581e9f0` |
| `docs/Architecture.md` | `8c9abc631fc4ce50945ce16c77c4ab83c2906373039f5a711d34b89b02348a12` |
| `docs/Deployment.md` | `cfc8405d3386addf2d0d48224b1f67787aa206fdb2fd2032b639276c658286d9` |
| `docs/DeveloperGuide.md` | `ef3b2c53fe45b375ef0eba59d74b77e43f16559322d1788c54b261dde767f644` |
| `docs/UserGuide.md` | `7187d71ed2ca9c30e9048d19fa5598653ef38fba1be95d6383183b7fdae26472` |
| `src/website/index.html` | `e65fa66a06baa72b629f2da415286a4f2ead1dec09c0dcbb6cf84ddccb5bacb1` |
| `workflow/README.md` | `bafc8486ea56f3a3cedcbb0ca3b32cf2671c028abdfddca50f539f13032bdc08` |
| `workflow/SUBMISSION.md` | `b2fe8d0a28757c9db4499b08942ac3dd857829460ce4204a1de9eb9036832efc` |
| `workflow/TRACEABILITY.md` | `8eedfc9dadee7bedf82752ddaf606281e5eda15fd1e53a26eb26e51803e2400d` |
| `workflow/deployment/tests/release-pipeline.test.mjs` | `fe402cf3b2f9d9475aee848d4a0362c4032db606e0d0cb9fdfac0f26f936acfe` |
| `workflow/deployment/tooling/azure-deploy.mjs` | `5d9d3827a262432b07a6296031609a818d1dea066beb831440fbeaa17fabc48c` |
| `workflow/deployment/tooling/release-candidate.mjs` | `9d89d9455ba6f4584970187a4daae93e153071561d97c30abc89bf354a0c70d2` |
| `workflow/specs/AI-SECURITY-SPEC.md` | `e1f3f039e8dfcd5799399941420bafa0b23bbb9e7ff685fdebb5be1157aaee0e` |
| `workflow/specs/OPEN-DECISIONS.md` | `daf122cc03ab2b156f95f1ef0fdee43bc6b650be5eee804c1f4627c2e4de61c8` |
| `workflow/specs/TECHNICAL-SPEC.md` | `b4725e23534290414abb4148ba9c5d353bbb2c35533ee97d2bef42d9e01e146d` |
| `workflow/specs/UI-UX-SPEC.md` | `c2f9664a3d07b74864fe9b78725a437d418a8b01bd21a853095a4c579a8f51c6` |

## Live cutover closure

- Development release run: `42605859917`.
- Production release run: `42619894195`.
- Released source: `6dfe10db7958dac8f378f2a96118ab3b4ee69a5d`.
- Released digest:
  `sha256:b53a5573676b4af43357dd19ee32dc7805c32c8b95ee78f53054d5446ee2e759`.
- Production authenticated smoke passed; the health endpoint returned `200` with
  the expected source revision.
- Production GitHub identity has exact-registry `AcrPull` and `Reader`.
- Production approval remains restricted to protected branches, names `yu-sutong`
  as reviewer and permits self-review.
- The migration objective is released. The documentation cleanup is tracked by
  successful resource session `2026-11-09-azure-cutover-finalization`; its lint,
  34 deployment-workflow tests, submission check, diff check, GitHub run readback
  and both Azure health probes passed. The cleanup remains a separate repository
  PR until human merge.
