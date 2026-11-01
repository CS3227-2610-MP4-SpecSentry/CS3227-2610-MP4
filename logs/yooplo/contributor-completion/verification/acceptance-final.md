# Independent Contributor acceptance

Status: approved Contributor implementation is locally verified through static/unit/contracts/PostgreSQL, real browser workflows and the prescribed performance workload. Live SoC provider acceptance and deployment are not verified. One synthetic popup-routing harness limitation remains explicitly recorded below. Verifier is independent of product implementers. Coordinator owns prompt logs, guides and traceability. Human teammate review and human verification of AI summaries remain separate.

## Boundary and preparation

Baseline HEAD `03cbea9f94c28011142c3a2a453ce7692df06053`, plus the uncommitted Contributor completion patch. Scope: all approved REQ-CON-001–017, deletion policy, applicable shared/integration/AI security and assignment requirements; PROP-CON-001 excluded. Sources read: ROLE-CONTRIBUTOR, PRODUCT-SPEC, SHARED-REQUIREMENTS, INTEGRATION-SPEC, AI-SECURITY-SPEC, ASSIGNMENT-SPEC, workflow/contributor instructions, review-changes-to-specs skill, changed connected code and tests. Teammate coordination is recorded by the coordinator from the user's reported agreements; it is not independent final patch approval.

Resource preparation interval: `f467c9187932440b89c7f532927590d3`. No final test/build is permitted until both source writers freeze and the security fix CON-SEC-P004 is ready. Existing implementer passes are inputs, not this verifier's execution results.

Prepared a new dedicated `specsentry_contributor_perf_test` database on the isolated loopback PostgreSQL16 cluster at 55447. Database did not exist before creation; all nine migrations applied cleanly; current database and UTC confirmed. Accounts/proposals/revisions/findings/sessions each zero. A PowerShell psql quoted-identifier verification command failed after successful migration; corrected stdin SQL verification passed. No runtime database or old cluster was selected. This database remains empty until the separately reserved fixed six-minute workload.

## Requirement coverage

The obligations in the table below are covered by the final101server/241client units,238PostgreSQL cases,16-case browser run, added real-session modified-navigation case,28corrected functional UX checks and the performance run described below. The synthetic popup harness failure is not counted as passing; real authenticated browser coverage supplies REQ-CON-014 evidence. Provider compatibility/usefulness, deployed HTTPS/containers, and human sign-offs remain outside these local results.

| Requirement | Connected implementation | Independent verification obligation |
| --- | --- | --- |
| REQ-CON-001 | Existing create, server ownership, private list/detail | Contributor contracts/HTTP/PG and drafts browser |
| REQ-CON-002 | Eligible working-copy editor, deterministic lifecycle guards, private saved reads | Owner/non-owner/role/session/CSRF/state/attachment/stale denials; immutable snapshots; submitted-access PG |
| REQ-CON-003 | Contributor assistant controller/service, shared SoC gateway, typed schema and explicit selection UI | Gateway/contracts/AI PG, assistant unit/browser; disabled/malformed/timeout/oversize/secret/stale/manual fallback |
| REQ-CON-004 | Existing submit transaction, idempotency, new confirmation/recovery UI | Required criterion/diff/summary limits, empty evidence, initial/replacement/assigned resubmit, original-key recovery, atomic audit/notice |
| REQ-CON-005 | Explicit clone endpoint/UI and changes-requested revision loop | Latest snapshot even when old revision selected; overwrite confirmation; retained assignee/history |
| REQ-CON-006 | Withdraw/reopen commands and confirmation UI | Reason/confirmation, assignment closure/notification, attachment/terminal rejection, immutable approval history |
| REQ-CON-007/009 | Required defaults, explicit meaning declarations, server stable-key authority | Criteria editor/server tests; immutable classification and removed/materially rewritten findings remain open |
| REQ-CON-008 | Append-only FindingResponse storage, owner API, attributed UI/activity | New independent real SQL barriers and lost-HTTP-reply browser; ownership/state/version/rollback/history/non-resolution |
| REQ-CON-010 | Existing navigation guard plus lifecycle/response/AI transient state | Dirty/clean/pending/uncertain/history exits, forced session loss, no browser storage; late authentication denial investigation |
| REQ-CON-011 | Private detail stored-order/plain-text criteria | Functional UX/criteria/preparation tests and browser |
| REQ-CON-012 | Existing sticky Save and reconciliation | Long editor reachability, accurate outcomes, duplicate prevention, focused controls/feedback clearance |
| REQ-CON-013/014 | Semantic headings/breadcrumbs/row links | Navigation tests plus new all-state list names, long-title/reflow/authorized routes |
| REQ-CON-015/016/017 | Existing editor sections, guidance, responsive recovery/design | Existing phase1/2 unit/browser regressions, enlarged text/keyboard/focus/reduced motion and truthful page counts |
| Deletion policy | Existing strict never-submitted cleanup and immutable tombstone | Deletion HTTP/SQL/PG/browser; submitted history cannot be removed |
| Shared authorization/integration | IdentityGuard, business transactions, root locks, versions, scoped cursors | Complete PostgreSQL suite and Reviewer revision/PatchRisk regression after shared gateway change |
| Shared AI resource/security | Shared deadlines/accounting/transport, per-attempt authorization, metadata-only records, own usage UI | P004 final recheck; injection/output/quotas/queue/retry/unknown usage/manual fallback, no live configuration |
| NFR-PERF-001 | Dedicated guarded workload script | Exactly 1,000 proposals/3,000 revisions/10,000 findings, 20 authenticated users, 60s warmup/300s measurement, endpoint/status/error/p95 report; unexecuted so far |
| Assignment/deployment | New code, recorded agent attempts, acknowledgements and guides | No earlier MP source import detected in reviewed patch; live/deployed/container/teammate review evidence remains external/unavailable where not executed |

## Findings during preparation

- Late-401 lifecycle/assistant ordering: reported to security/coordinator/implementer for confirmation. New components return after local unmount/invalidation before calling the generation-bound global session-loss callback. Existing editor regression requires late mutation401 after route-only navigation to invalidate the same login. No executed reproduction yet; do not mark fixed or dismiss without discriminating coverage.
- Guide wording reported to coordinator: old31October/private-draft-only status, Reviewer walkthrough requiring owner API for resubmission, and an obsolete Reviewer landing-placeholder statement. Coordinator is updating shared documentation.

## Results

Both product writers froze source before final execution. Security independently released the shared disposable completion database after its17PG checks; this verifier then ran the complete suite serially. Final interval `7f52ced1b6b44166927c4df57be9621c`:

| Command | Observed result |
| --- | --- |
| `npm.cmd run test -w @specsentry/client` |15files,241tests passed;6.03s |
| `npm.cmd run test -w @specsentry/server` |15suites,101tests passed;30.034s; includes all server contract/unit tests |
| `npm.cmd run lint` |Passed |
| explicit ESLint on performance script and independent browser test |Passed |
| `npm.cmd run build` |Shared bundles/declarations, server TypeScript and client production bundle passed; approved escalation for known esbuild ancestor-read restriction;535.16kB minified JS chunk warning retained |
| `npm.cmd run typecheck --workspaces --if-present` |All three workspaces passed without redundant shared rebuild |
| `npm.cmd run test:integration -w @specsentry/server` |19suites,238tests passed;236.32s; isolated completion database, all9migrations; includes independent SQL barriers and Contributor/Reviewer AI P004 cases |

Server tests used existing portable x64Node24.19.0 prepended to PATH, NODE_PATH pointing to the existing locked unrs native binding, and ELECTRON_RUN_AS_NODE unset. Client/build/static used installed ARM64Node24.19.0. TEST_DATABASE_URL and DIRECT_DATABASE_URL explicitly selected the synthetic loopback completion database; no runtime URL was used. Known `pg` concurrent-query deprecation warnings occurred; no test failure. Raw outputs remain ignored under `.tools/contributor-completion/final-*.log`.

CON-ACC-F001 (late401 after route-only unmount/local invalidation) is independently verified fixed: source now invokes the auth-generation-bound callback before local liveness checks, and the full241client run includes24actualApp cases proving same-login invalidation, replacement-login isolation and ignored late successes. No assertion was removed to close it.

Product SHA256 fingerprints at final execution: ContributorWorkspace `27B0E87A4EF82C762AB732D0D6DD12A860B284E50E81866285431860E27A86D8`; SubmittedProposal `8823E362FE1367034B89269EDCF289A433C202BE4C1ED66D29F8164FAF287632`; SpecDraftAssistant `7AE12497A5CF3559B5FB381C8DB526CA803445A750D3C96D92209DD43B072141`; accounting `156B67E680DB9D176E7CD1BC2EDDA96A881E879B8958E87253436332778B6A29`; gateway `A3402061BF4833EF1A667DFE5F29889CA584CC4DF744439930733ABD81B9FE1B`; Contributor assistant service `BA32A249CDE2C43C807C5F1BD9CCB97DC25B8020C73E97370063B270BA0D9EAE`.

Earlier independent baseline16PG/213tests and new SQL barriers3tests were historical checkpoints; final238test run supersedes them for PostgreSQL scope.

## Final browser results and preserved failures

- Initial default-config run stopped before any tests because `http://127.0.0.1:3000/api/health` was already occupied. No unknown server was reused or stopped. Read-only process/port inspection did not identify an owned listener.
- Coordinator authorized ignored copies of the10selected browser spec files and4fixtures at the same directory depth under `.tools/contributor-completion/browser`, with an ignored config on3193. Only6literal `http://127.0.0.1:3000` substitutions and the fixture's unique `app.listen(3000,...)` argument changed. Reverse replacement verified every other source character/assertion unchanged. Relative imports retain their original depth. The original root config/specs/fixtures were not edited for transport adaptation.
- A PID-printing Node ESM preload caused ts-node startup to reject `require` before tests; this runner-only mistake was removed. Normal CJS startup then ran correctly. Both preflight/startup failures and their intervals are retained.
- `node node_modules/@playwright/test/cli.js test --config .tools/contributor-completion/playwright.final.config.ts --reporter=line`: **16passed, exit0**, reported5.5minutes. Covers all existing Contributor drafts/editing/deletion/criteria/preparation, new lifecycle and AI, independent committed-lost-reply recovery, Reviewer revision cycle and all4PatchRisk cases. Reported time includes waiting for Windows fixture teardown while the UX harnesses used its owned server; it is not a claim of5.5minutes solely executing assertions.
- Fixture PID5212 was captured from its startup output; worker30400 exited before it was stopped. The known Windows teardown hang resolved after stopping only5212, and the actual runner returned exit0. Unknown3000 was untouched.
- The synthetic `functional-ux.mjs` initially returned22passed/6failed: one removed `.breadcrumb` CSS selector and five assumptions that detailed alerts remain inside the compact sticky Save area. Current semantics expose adjacent status/Recovery details and detailed alerts in the recovery region. Coordinator transferred that test-file ownership and authorized narrow semantic locator corrections. No case/outcome/retained-input/navigation assertion was removed; recovery focus, reachability and outcome text checks were strengthened. The corrected full harness returned **28passed/0failed, exit0**, zero console errors/warnings. Syntax and explicit ESLint with its browser globals passed.
- The fresh `navigation-phase2.mjs` superset returned **47passed/1failed, exit1**, zero console errors/warnings. The Control-click popup reached its correct3193detail URL but displayed login rather than the expected detail heading. Six unchanged focused Control/middle assertions with passive post-check diagnostics reproduced the synthetic fixture issue: popup document complete, login visible, parent still privately signed in; no popup auth/detail requests entered the synthetic context's mock handler. All observed API origins and popup destinations were3193. No timeout, popup reload or forced focus was added; the failed assertion remains failed, not silently waived or called fixed. Background scheduling was not accepted as the cause.
- A stronger test was added in the independently owned `contributor-acceptance.spec.ts`: real HTTP login/session cookies, a real saved owned DRAFT, both Control-click and middle-click, unchanged default5-second URL/detail-heading assertions, authorized private text and unchanged parent location. The added case returned **1passed, exit0,3.8seconds** on the owned3193server. This supplies actual REQ-CON-014 evidence without synthetic routing. It is a separate pass, not an invented17-case combined run.
- The separately owned UX fixture PID4480 was stopped after these checks. No browser/server/test process remains owned by this verifier.

Both synthetic harnesses used explicit `UI_BASE_URL=http://127.0.0.1:3193`. Their original5185/5186defaults were unused. Temporary copies changed only their declared output destination; prior31October artifacts were preserved. Corrected functional output and the six passive diagnostic failures remain ignored artifacts; actual results/dispositions are retained here.

Browser resource intervals: `745df3e5f9734d058549c90354817a2f` failed preflight65.095s; `e0fc1aa4ee5e42b0ae135bb2b7eff646` failed startup735.477s including coordination/adaptation wait; `745e629e315d429888d35377d162e4ad` mixed real-browser pass/legacy-fixture failures329.707s; `a70c75079e3e41f491350a17296132eb` functional28pass/diagnostic6fail259.391s; `d8c949c9b105469a9042291afe70a15e` real-session modified navigation success82.667s. Failed stages remain failed even where part of their checks passed.

## Prescribed performance

Exact UTF-8 result: [performance-final.json](performance-final.json). Dedicated fresh database `specsentry_contributor_perf_test`, all9migrations, loopback55447, built production server on3197 with AI disabled. The seed asserted1,000proposals/3,000submitted revisions/10,000findings/20Reviewers/400current assignments. Ten Contributor owners and the lifecycle mix are documented in the workload README. Twenty users authenticated normally; there was no direct session bypass. No other test/load or product source changes ran during the workload.

| Endpoint | Requests | HTTP200 | Errors / rate | Successful p95 ms |
| --- | ---: | ---: | ---: | ---: |
| Pool |13,729|13,729|0 /0|97.46839999998338|
| Assigned queue |13,729|13,729|0 /0|128.29330000001937|
| Submitted detail |13,728|13,728|0 /0|108.15630000000237|
| Revision history |13,728|13,728|0 /0|99.84910000002128|
| Activity |13,730|13,730|0 /0|101.58580000000075|
| Overall |68,644|68,644|0 /0|113.96850000000268|

Warmup:60,062.8527ms for the requested60,000ms; measurement:300,060.8564ms for the requested300,000ms. Each phase drains requests started before its deadline; the60.8564ms measurement excess is drain/scheduling overhead, not a shortened interval. Measurement began2026-11-01T05:10:37.091Z and finished2026-11-01T05:15:37.258Z. The five-minute deadline therefore preceded the reported finish by approximately167ms; the JSON's monotonic elapsed value is the precise phase-duration measurement, while wall-clock timestamps include summary preparation. Local Windows/x64Node24.19.0/PostgreSQL16loopback measurements include full response JSON retrieval. Static assets, AI calls, login setup and warmup are excluded; any measured error would invalidate passing. **NFR-PERF-001 passed: aggregate p95=113.9685ms, strictly below800ms, with zero errors.** No production/deployed-network latency is claimed.

Performance preparation/failures: the original empty-table guard needed an explicit exception for the exact migration-created `AiQuotaCoordinator` singleton ID `reviewer-patch-risk`; missing/wrong/additional rows remain rejected and every other application table must be empty. Its guard self-checks, syntax and lint passed. The first execution safely refused before seeding/warmup because PostgreSQL `inet_server_addr()::text` includes `/32`; verified accounts/proposals remained zero. The corrected query uses `host(inet_server_addr())` while preserving exact loopback/database restrictions. No seeded fixture was reset or shortened run substituted. Failed record `e3ca32f9008c4374a9356407f393383a`:48.679s. Full successful record `c821c2c49e3642ce83d4be3f79e2441d`:385.794s. Known owned production server6772 was stopped after completion; synthetic data files remain for coordinator cleanup of this run's fresh cluster only.

## Closure and remaining gates

No confirmed unresolved Contributor product defect remains in the independently tested local scope. CON-ACC-F001 is verified fixed; CON-SEC-P004 has separate security evidence and passed the final full PostgreSQL regression. The synthetic popup interception failure is a retained test-fixture limitation, with stronger real authenticated navigation evidence passing.

Local implementation/acceptance does not establish live SoC compatibility or usefulness: OPEN-002 still requires authorized key-scoped model/catalog, tokenizer/context accounting, parameters, quotas/spend and retention verification plus credentialed role evaluations. Live configuration stays disabled. Team-managed deployment, deployed HTTPS/cookie/backup/rollback/container checks, final teammate patch review and human verification of AI summaries remain external gates; no commit, push, merge or deployment occurred. No complete WCAG certification or deployed latency is claimed from bounded local keyboard/axe/reflow checks. All verifier-owned app/fixture processes have stopped and no database/test work remains; coordinator owns final resource report and stopping the fresh test cluster while preserving its files.

## Initial dedicated-port copy fingerprints

These snapshots identify the initial16-case real-browser execution. Afterward, the independently owned acceptance test gained the additional real modified-navigation case; its final fingerprint appears below. All original-source assertions outside the explicitly added test remained unchanged.

| Source basename | URL replacements | Listen replacements | Original SHA256 | Initial3193copy SHA256 |
| --- | ---: | ---: | --- | --- |
| contributor-drafts.spec.ts | 0 | 0 | 6F6D55E5E6FD44D8D7877B842D9C5D992FE12DAEACBE767A355B63A74A0E5D21 | 6F6D55E5E6FD44D8D7877B842D9C5D992FE12DAEACBE767A355B63A74A0E5D21 |
| contributor-editing.spec.ts | 0 | 0 | 551E29A93BC0160C0CB10ED58BDED83F555943F17CFDFB11FD04AF1BCB3A5CDF | 551E29A93BC0160C0CB10ED58BDED83F555943F17CFDFB11FD04AF1BCB3A5CDF |
| contributor-deletion.spec.ts | 0 | 0 | 0D941282E653578899092F6A82B52E57E01AFE99B65CCED6D7FBEEC587EB90F8 | 0D941282E653578899092F6A82B52E57E01AFE99B65CCED6D7FBEEC587EB90F8 |
| contributor-criteria.spec.ts | 0 | 0 | C5D02A37337AE0867E425EF0078E7D87427F64453FD1F3EB3ECFEBB23339C2CF | C5D02A37337AE0867E425EF0078E7D87427F64453FD1F3EB3ECFEBB23339C2CF |
| contributor-preparation.spec.ts | 0 | 0 | DC7ABE88B2F1783853FBBD47F34DDFD974D974FAC3A022F44AF9E1D3CBE0A301 | DC7ABE88B2F1783853FBBD47F34DDFD974D974FAC3A022F44AF9E1D3CBE0A301 |
| contributor-lifecycle.spec.ts | 3 | 0 | EA7658A9B311291735E77AA5D821B8EF1EA13A135F2346F21CB837DD37E78117 | B09EF17A82CF90F9D4F3E63BF47717C546B37AE65E8C6FB98E47C6A31A70C5D3 |
| contributor-ai.spec.ts | 0 | 0 | C101D343BF11D370261A38A8A76A92AE3874A1B9FE5BF9AC87AF69D7BA5A3181 | C101D343BF11D370261A38A8A76A92AE3874A1B9FE5BF9AC87AF69D7BA5A3181 |
| contributor-acceptance.spec.ts | 1 | 0 | ABBF8EF1B8A89A180667CA615CBBD4056D637F467B3040A5986FE79BAA4F5797 | 8B052F7B56A62EAC9A2D9927D8394054E18FD2490904C9420C88D57557ADC845 |
| reviewer-revision-cycle.spec.ts | 1 | 0 | 563991E2C3C81B50A19D729CEF9EE244B377D88A3C4DDEB024186FC9326FDBF6 | 961BE4C3008E09A7FEC6D4ACC7F40E2D56A8BBC9D3B171CEEF6E19C2879B83FC |
| reviewer-patch-risk.spec.ts | 1 | 0 | EF1360CEC14E78B8FE3FC9AD3B73D1D1A5C842EB454341451DF004A755480361 | 2944A1BF75EA01CC92406208022F0A2DC7ADD3FAA8BA17BFC2FC19C5F3A020F2 |
| reviewer-intake.ts | 0 | 0 | 6CC4A90BFA476EA1CCBE7F2A49EF51ACBA4BB8877402D5A219C24DA0183C08E2 | 6CC4A90BFA476EA1CCBE7F2A49EF51ACBA4BB8877402D5A219C24DA0183C08E2 |
| reviewer-patch-risk.ts | 0 | 1 | 11F127A91D3675B9A9EB9BFB6A6EA2A9E287C3C9A0C3604789173126F3FA0436 | 26FC7A6E2221479ADCBFB1ADCB067E0E78DFCB091D64253C698AC160A36B707F |
| reviewer-revision-cycle.ts | 0 | 0 | EF6D38FA7DD503B007F680FA521845CCE1F4F1D52199297479AF3CCAAC20DEA8 | EF6D38FA7DD503B007F680FA521845CCE1F4F1D52199297479AF3CCAAC20DEA8 |
| reviewer-revocation.ts | 0 | 0 | 3917E4F7680AB86767E45F7CEDDB36C735086BBF68CB498477B50F543013F553 | 3917E4F7680AB86767E45F7CEDDB36C735086BBF68CB498477B50F543013F553 |

Final test/script fingerprints:

- workflow/tests/browser/contributor-acceptance.spec.ts : 98029CC185DC105243C5CA13AE265A568310E38EE08EEBF4B95096EA71ED90CF
- workflow/tests/browser/functional-ux.mjs : 8951119C3FDA3BE03BB4D87A3F17E470719784E6A1A71F1B5DEE05E807D8BB11
- workflow/tests/performance/contributor-workload.mjs : 721E29F87586A66F713034444A2627E457D265A1EBD98AB4DB603134090847AC
- logs/yooplo/contributor-completion/verification/performance-final.json : B659C93B9436E3B64A785A85A775E79368C5D8A98A93200653A0187B816260DE

Final syntax checks passed for the independently added TypeScript browser test and corrected functional/performance scripts. Explicit ESLint passed for all three with the appropriate browser globals declared; no lint rules were disabled. No unchanged product suite was repeated for these test-only corrections.
