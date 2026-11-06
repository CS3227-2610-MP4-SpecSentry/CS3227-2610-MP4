# Deployment release pipeline run

- Prompter and inference source: `yu-sutong`; explicitly supplied in the conversation and required for any later GitHub publication.
- Goal and requirement IDs: implement the repository-automation portion of MP4-005, MP4-008, MP4-010 and MP4-014 with protected development/production separation, immutable same-digest promotion and presentation-ready deployment-agent evidence.
- Source revision / branch: base `637b56e1e769ebf4778bdd71e0141715b80c0c50`; branch `feature/deployment-release-pipeline`; frozen uncommitted candidate identified by the SHA-256 manifest below.
- Target environment (or local-only): local repository source, deterministic tests, workflow parsing and Compose configuration only; no registry, GitHub deployment environment, Render service, Neon database or online application target.
- Approved authority and excluded actions: source/workflow/tooling/tests/specification/guide/evidence changes and read-only official-document inspection were authorized; commit, push, PR, merge, provider creation, registry publication, remote migration, deploy, promotion and rollback were excluded.
- Agent assignments and exact write sets: coordinator owned scope, integration docs and evidence; Deployment Architect, Database/Recovery Specialist and initial Security Reviewer were read-only; Deployment Implementer owned CI/release/container/marker/tooling/tests; fresh Release, Security and Spec/Docs invocations were read-only, except one recorded verifier boundary error after compaction whose corrections received fresh checks.
- Focused context supplied / retrieved later: MP4-005/008, TECHNICAL-SPEC operations, deployment role instructions, current CI/Docker/Render/Neon scaffold and stop conditions were supplied first; official Render deploy/image API behavior, GitHub attestation/environment rules, migration inventory, TLS parser behavior and first-image bootstrap dependency were retrieved as needed.
- Secret names required (names only; no values): environment secrets `DIRECT_DATABASE_URL`, `RENDER_API_TOKEN`, `SMOKE_USERNAME`, `SMOKE_PASSWORD`; Render runtime secrets `DATABASE_URL`, `SESSION_SECRET`; no values were accessed.
- Source SHA / immutable image digest: base/candidate source is identified above and by the manifest; no image was built or pushed, so no registry-produced digest or source-bound live attestation exists.
- Migration compatibility and recovery decision: ten migrations remain unchanged and checksum/inventory protected; direct Neon verification requires exact host, non-pooler endpoint, canonical `sslmode=verify-full`, UTC and PostgreSQL 14-17; production remains held until a real recovery point is restored successfully and N-1 image/schema compatibility is evidenced.
- Acceptance, denial, failure and rollback checks: trusted master CI/run/SHA/tree; immutable GHCR digest and signer/ref/source attestation; exact candidate artifact; action/container pins and least permissions; unlisted/symlink/extra migration denial; TLS downgrade/duplicate/override denial; UTC/version/drift/schema probes; Render auth/redirect/429/5xx/timeout/body/identity failures; cold start/redirect/marker/readiness/session/CSRF/role smoke; distinct dev/prod service, host and database fingerprints; production no-rebuild and separate rollback/recovery gates.
- Commands and actual results: `npm test` passed 187 server, 289 client and 28 deployment tests; `npm run typecheck`, `npm run lint`, `npm run build`, `npm run verify:migrations`, `npm run check:submission`, workflow YAML parsing, synthetic-secret `docker compose config --quiet` and `git diff --check` passed.
- Stable findings and dispositions: DEP-SEC-007 TLS downgrade was corrected with an allowlist and exact `verify-full`; DEP-REL-001 unlisted migration was corrected with exact regular-file inventory validation; DOC-DEP-001/002 workflow-index/submission wording and the published-image usability note were corrected; fresh Security and Release checks reported no remaining source finding.
- Failed/interrupted attempts and retry cost: one initial implementer full-suite client race was not reproduced and complete reruns passed; first independent Security, Release and Spec/Docs intervals held the candidate and required corrections; a Release-verifier context-compaction mistake caused out-of-role TLS/docs edits, preserved as a workflow-boundary failure before fresh read-only rechecks.
- Resource-record references: `logs/yu-sutong/resources/2026-11-07-deployment-release-pipeline/` plus `logs/yu-sutong/2026-11-07-deployment-release-pipeline-resources.md`; intervals are actual boundary records and may overlap.
- Human approvals required / observed evidence: teammate patch review, commit/push/PR authorization, merge, master protection, GitHub production reviewer protection, configuration sign-off, recovery/compatibility approval and production deployment approval are required; none was observed.
- Unresolved risks and unavailable telemetry: provider accounts/quotas, live target mapping, token scope, GHCR visibility, Render registry pull, remote PostgreSQL 17/upgrade behavior, restore retention/RPO, N-1 compatibility, deployed smoke and immutable rollback evidence were not exercised; attributable token/cache/tool/retry/model telemetry was unavailable.
- Next authorized action: present the verified local candidate and setup checklist, then wait for explicit commit/push/PR authority; provider setup starts with both deployment flags false and follows docs/Deployment.md.
- Status: verified locally

## Frozen non-log candidate manifest

Base `637b56e1e769ebf4778bdd71e0141715b80c0c50` plus these working-tree files.
Log/resource files are evidence and are excluded by the verifier's candidate
inventory rules.

| File | SHA-256 |
| --- | --- |
| `.github/workflows/application-release.yml` | `7d9762f279e146ce50e664a77923b3d127b8d1e40410daff5bdcfd889404db08` |
| `.github/workflows/ci.yml` | `66d98e14dedcdf5f01044450ac8640823b045880f964ba3fb01124ec69c191e1` |
| `.github/workflows/pages.yml` | `9c8f2c55107250cf9a2f4171dd3f700621011d8aa8fcbb984098a1395b10e5b4` |
| `Dockerfile` | `33d19963d205d5db489eeb9d9081747191fe65b5afbe816bd0e6e122c318e777` |
| `docs/Deployment.md` | `0bbf9490e5e6dffeb14f65deb2eebe2703e13dc1b1198d1158805cf2ad7f8346` |
| `docs/DeveloperGuide.md` | `44dcfea2fefe29f61420bf4fab1b65ccfcec5a6132afd1b1e1835e1849403cf6` |
| `docs/Reflections.md` | `989d27eddb228a6b2cd9f55f4d3a19caf02738080747dc42f5047b3b178a5714` |
| `package.json` | `f9ec2c7ddf30689bcfd68dd1cbac0099358413ae7ed6ca81a61cbb09a5156251` |
| `src/server/src/config.ts` | `c9d328f0a87540c42d08bb0d0b4b9fbd6a1e3406bc07ac6c25159f7928660c02` |
| `src/server/src/health/health.controller.ts` | `d2edb9321e1b57b93f57503d786e1fe0827e95219df9346f6f925252a072238c` |
| `src/server/test/http.spec.ts` | `3c5527e93aa972c517bdb40782a1231ac681bfdac5ae36c68922b4860a2ca336` |
| `src/shared/src/contracts/health.ts` | `7174020c377de7c5c33a00683bd37f075fe7a28027fd4e3ff6cf444ab92a482f` |
| `workflow/PLAN.md` | `51440718db7d1d3181f524b68c1bb2c12e3bbb147ccb9b761607348f192c2fb1` |
| `workflow/README.md` | `339b138e93e3e69b3cf12886abb611381c9097e872276201bcfabab7e7c7f903` |
| `workflow/SUBMISSION.md` | `b8bf93638449bed2383fa40b3f1541d866ef0dd3876fbad6c4deb546a27d5465` |
| `workflow/TRACEABILITY.md` | `98992545c96c819b845e47a77b69d42bf86a4ba0de3c7682f7b4f280cb9cafe1` |
| `workflow/deployment/migrations.sha256` | `42d5ec7a41018a99030de696b5832e3bda76f4547a7c2e368625e1c7b9f674ac` |
| `workflow/deployment/tests/release-pipeline.test.mjs` | `53185204e06944dfd99f1eb6da359f6ec3812df79ffe8fc07b0636deeae88df9` |
| `workflow/deployment/tooling/release-candidate.mjs` | `40457646c56f42de7cff070d5a496ff94446d379f244be1ffc6392186212dd78` |
| `workflow/deployment/tooling/render-deploy.mjs` | `f871b4a5c6251873721f967f10c054f6b76c325cb34ada26fc28b8be5d75b8f3` |
| `workflow/deployment/tooling/verify-database.mjs` | `82a7081e58931b609516a1a18830ac14fd0b8adbf32e1d60bfb1568e798a0345` |
| `workflow/deployment/tooling/verify-remote.mjs` | `de4df209ef525b4b7a7b03e13cb11afe1b4e04e02b76d1f91da91882f2ec967b` |
| `workflow/evaluations/2026-11-07-deployment-agent-workflow-observation.md` | `d246cfa8431d4a6dc3322d29af4d18d12272ce33b867721e9edd54632cd5f437` |
| `workflow/specs/TECHNICAL-SPEC.md` | `21b82a37ed0eef70d41139189bf4c5954976bc70ec022bcb3da744ead05490e6` |
