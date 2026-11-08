# Final session banner and product website update

## Context and requests

- Prompter, date/timezone: Yu Sutong, 8 November 2026, Asia/Singapore. Name inferred from the repository Git identity (`Yu Sutong <e0483972@u.nus.edu>`).
- General task/conversation context: Production release `8cdaefa517baf1f4777cddcba766ed151ebf5510` was promoted through the protected GitHub Actions workflow and independently verified live on Render. A post-release visual check exposed misleading signed-out session copy, and the published GitHub Pages product site still described the initial scaffold.
- Explicit change requests and subsequent corrections or decisions:
  - Open and smoke-test the live website, fix the misleading fresh-visitor session banner, and create a final pull request.
  - Preserve the deployment-agent interaction evidence for presentation use and push as the `yu-sutong` account.
  - Update the required GitHub Pages product website because its status and links look old.
  - Configure the supplied NUS SoC key so every role assistant runs in both Render environments. The supplied `.env` remains outside the repository and its secret value is neither printed nor committed.
- Other development prompts/interactions and outcomes (including no-change advice/reviews): Production database migration and authenticated release smoke had already passed. A credential-free live request confirmed `/api/auth/session` now correctly returns `401`; inspection found the client incorrectly labelled every such response as an ended session, including a first visit.
- Human summary verification: pending.

## Changes and evidence

- Session handling: `src/client/src/App.tsx` now displays the ended-session warning only after the browser had adopted an authenticated session. `App.test.tsx` covers both a fresh anonymous visitor and later authenticated-session rejection.
- Product/release presentation: `src/website/index.html`, README, User Guide, Developer Guide, Deployment guide, Architecture, workflow plan/submission/traceability and AI specifications were reconciled with the verified production release, current GitHub Pages URL and live-AI evidence.
- Deployment declaration: `render.yaml` records `AI_LIVE_ENABLED=true` for synthetic development and `false` for production, plus the approved NUS SoC base, `AI_MODEL=default`, `AI_CONTEXT_WINDOW=262144` and only a `sync: false` placeholder for `AI_API_KEY` on both services. The secret-bearing source file remains outside Git and no secret value is present in repository artifacts.

### Live-AI activation and verification

1. Parsed the user-supplied environment file locally without printing its values. The key-scoped catalog request returned `HTTP 200`; alias `default` advertised context window `262144`.
2. Sent one bounded representative request through each role's exact preparation and strict decoder. Contributor, Reviewer and Maintainer returned `HTTP 200` with schema-valid results. These calls establish representative compatibility only, not broad edge-case quality or quota/retention policy.
3. Updated each existing Render service with merge semantics, preserving unrelated variables. Both received the five `AI_*` keys with the API key stored as a protected service variable; after security review, only development remains live-enabled and production is fail-closed.
4. A first synthetic development setup attempt incorrectly supplied a client-controlled `stableKey`; the strict API rejected that field. The retry used the server-owned identity contract and created only the disposable records required for verification.
5. Development deploy `dep-dbo89d2jnfac73e5ms40` completed. Authenticated Contributor generation returned `200` and a schema-valid result; Reviewer audit completed with `SUCCESS` and no error class; Maintainer readiness returned `200` and schema-valid `NOT_READY` for an intentionally empty candidate.
6. Production deploy `dep-dbo8c7lg1s2s73eft6e0` completed. Public `/api/health`, `/api/ready` and `/` returned `200`; signed-out `/api/auth/session` returned the expected `401`. Production role-AI UI was not exercised because private production account credentials were unavailable.
7. Independent security review identified that enabling production before the broader prompt-edge-case, quota and retention/data-use gate contradicted the normative AI security specification. The production switch was restored to `AI_LIVE_ENABLED=false`; development remains live for synthetic grader data. Render deploy `dep-dbo8hfpsrm7s73b8n1ug` reached `live`; fresh root/health/readiness checks returned `200` and signed-out session returned expected `401`. No security rule was weakened.
8. Independent release review verified the session regression, exact key absence, Render placeholder shape, public service/Page reachability, successful production release run and current-master base. It required reconciliation of stale task-ledger rows; `workflow/PLAN.md` now distinguishes completed live-development evidence from the remaining OPEN-002 production/human gates.

- Validation commands/results: targeted client regression passed 38/38 before the full repository gate. After the production fail-closed correction and fresh independent PASS reviews, root `npm run typecheck` and `npm run lint` passed; `npm test` passed 193 server, 290 client and 29 deployment-workflow tests; `npm run build` passed for shared/server/client with only the existing Vite chunk-size advisory. `npm run check:submission`, `git diff --check`, strict `render.yaml` dev/prod assertions and an exact supplied-key repository search passed. Production deploy `dep-dbo8hfpsrm7s73b8n1ug` reached `live`, followed by `200` root/health/readiness and expected `401` signed-out session checks. The GitHub CI result belongs to the pull-request publication step and is not inferred from these local checks.
- Unresolved items and unavailable checks: broader all-role model edge cases, quantitative key quotas, provider retention/data-use review, production AI activation/role-UI acceptance and human teammate sign-off remain open. The final Pages/session changes are not live until the pull request is merged and the corresponding deployments complete.

## Resource record

- Structured report / record references: `logs/yu-sutong/resources/2026-11-08-final-session-banner/` and the [generated report](2026-11-08-final-session-banner-resources.md).
- Timing coverage: resource recording started before the first repository edit.
- Record `start` before editing and `finish` after validation; run `report` before the final response. Missing tokens do not prevent measured time.

| Stage / agent / invocation | Selected model / effort; observed if exposed | Start / end with timezone | Elapsed | Input / output tokens | Cache usage | Tool calls / retries | Outcome / telemetry source or unavailable reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Main implementation / `main-1` | GPT-5 family / unavailable | See structured report | 196.108778s | unavailable | unavailable | unavailable | Failed: dependencies absent from the fresh worktree. |
| Main implementation / `main-2` | GPT-5 family / unavailable | See structured report | 39.936499s | unavailable | unavailable | unavailable | Failed: shared workspace build artifact absent after dependency install. |
| Main implementation / `main-3` | GPT-5 family / unavailable | See structured report | 3446.955243s | unavailable | unavailable | unavailable | Succeeded: implementation, live activation/evidence and full local validation complete. |
| Release verifier / `release-verifier-1` | GPT-5 family / unavailable | See structured report | 215.461271s | unavailable | unavailable | unavailable | Required task-ledger reconciliation; other release boundaries passed. |
| Security reviewer / `security-reviewer-1` | GPT-5 family / unavailable | See structured report | 215.461481s | unavailable | unavailable | unavailable | Required production fail-closed correction under the existing AI privacy/evaluation gate. |
| Release verifier / `release-verifier-2` | GPT-5 family / unavailable | See structured report | 113.453786s | unavailable | unavailable | unavailable | Fresh re-review PASS. |
| Security reviewer / `security-reviewer-2` | GPT-5 family / unavailable | See structured report | 113.453225s | unavailable | unavailable | unavailable | Fresh re-review PASS; SEC-FINAL-AI-001 closed. |
| Main correction/revalidation / `main-4` | GPT-5 family / unavailable | See structured report | 214.026792s | unavailable | unavailable | unavailable | Succeeded: corrected deployment/docs/logs, production redeploy/smoke and all local gates. |

- End-to-end wall time: 5,051.164417 seconds.
- Summed agent elapsed time (overlaps included): 4,554.857075 seconds.
- Measurement coverage and unavailable reasons: the three initial implementation attempts, both first reviews, both fresh re-reviews and the correction/revalidation attempt are finished. The `main-4` interval began after the first review-driven correction edits because the earlier main interval had already been closed; that small gap cannot be reconstructed and is not presented as measured. Token, cache, tool-call, retry, observed-model and observed-effort telemetry was not exposed. Final response rendering and later GitHub publication/CI observation are outside this measured repository-edit boundary.
