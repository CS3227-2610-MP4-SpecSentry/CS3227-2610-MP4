# Contributor completion acceptance ledger

Baseline: `03cbea9f94c28011142c3a2a453ce7692df06053`. This ledger records the current run, not earlier tests as newly executed evidence. Human review is pending. [Prompt/run log](2026-11-01-contributor-completion.md).

The table below preserves the initial inspection. It is superseded for current
implementation by the checkpoint following it and, on closure, the final
independent evidence. Pending markers here are historical gaps at run start.

| Requirement | Existing implementation / new obligation | Initial disposition |
| --- | --- | --- |
| CON-001 | Owner create/list/detail; role denial | Existing regression suites; current execution pending |
| CON-002 | Owner working edits in eligible states, submitted snapshots immutable, approvals/attachments frozen | Existing server; new lifecycle editor UI in progress; explicit clone coordination pending |
| CON-003 | Typed Spec Draft Assistant, explicit user selection, manual fallback | Not implemented; shared gateway/accounting coordination then implementation and tests required |
| CON-004 | Initial/replacement/resubmission, required criterion, sanitized diff, summary, atomic activity/notice, idempotency | Existing server; new UI/checks in progress |
| CON-005 | Findings, explicit latest-content clone and retained-reviewer resubmission | Existing server revision cycle; submitted-read UI in progress; clone command coordination pending |
| CON-006 | Confirmed reasoned withdrawal, assignment closure and notice; later review writes denied | Existing server; new UI/checks in progress |
| CON-007 | Required default and classification across immutable revisions | Existing server/draft UI; new submitted-edit regression pending |
| CON-008 | Attributed plain-text responses, state/ownership/version checks, transactional activity, no resolution | Not implemented; shared persistence/API coordination then implementation and tests required |
| CON-009 | Explicit meaning decisions and stable criterion identity, preserved unresolved findings/history | Existing server/draft UI; clone identity path coordination pending |
| CON-010 | All navigation/unload safety, uncertain saves, forced session loss, no browser content storage | Existing navigation guards; new lifecycle path regression pending |
| CON-011 | Ordered classified saved criteria and escaped text | Existing private detail; current regression pending |
| CON-012 | Reachable Save/status, precise reconciled outcomes and focus | Existing editor; current lifecycle editor regression pending |
| CON-013 | One task h1, semantic breadcrumbs, truthful mobile task context | Existing draft screens; new submitted route checks pending |
| CON-014 | Semantic descriptive draft row links and standard navigation | Existing draft list; current regression pending |
| CON-015 | Overview/criteria/patch/evidence section navigation and reading widths | Existing editor; lifecycle regression pending |
| CON-016 | Responsive guidance, labels, recovery copy, accessible drawer/reflow | Existing draft screens; lifecycle regression pending |
| CON-017 | Compact list/create, truthful page counts and loading/error states, design identity | Existing draft list; lifecycle discovery contract pending |
| Approved deletion policy | Owner confirmed never-submitted deletion, minimal tombstone, submitted history retained | Existing server/UI/migration; current regression pending |
| Submitted discovery/detail | Owner-only all states, latest revision, selection/history/findings/decisions/reviewer/activity | Existing submitted reads; new detail UI in progress; all-state discovery coordination pending |
| Shared integration/security | Session/CSRF/account checks, authorization, version races, rollback, idempotency and private drafts | Real disposable PostgreSQL and browser regression pending |
| AI/security/resource requirements | Isolation, bounded typed suggestions, secret/injection/output/size/quota/deadline cases, safe usage dashboard | Contributor implementation pending; synthetic tests cannot establish live operation |
| MP4 requirements | Separate implementer/security/acceptance, resource intervals, prompt summaries, acknowledgements | Assignments and records active; human teammate review, deployment and live evidence remain separate |

## Current implementation checkpoint

All approved Contributor slices now have source: additive owner discovery,
submitted history, eligible working edits, initial/replacement/resubmission,
explicit latest clone, confirmed withdrawal/reopening, append-only finding
responses, bounded Spec Draft Assistant, safe own usage and existing draft/UX
requirements. PROP-CON-001 remains inactive. Current code/test/guide mappings are
in [traceability](../../workflow/TRACEABILITY.md#contributor-lifecycle-ui-extension--1-november-2026).

Verified checkpoints:213baseline PostgreSQL tests;3new contracts;8new lifecycle
PostgreSQL tests;3independent real-barrier acceptance tests;31gateway/foundation
units;9Contributor AI PostgreSQL tests;215client tests;2lifecycle and3AI browser
cases. These counts are separate scoped runs, not a summed final suite. Current
typecheck/lint/build passes are source-bound checkpoints. Final combined
regression and seeded workload results are recorded below.

Security findings P001–P005 are independently closed in the frozen final source,
including safe error references, same-transaction quota admission authorization
and late401 session handling. See the [final security report](contributor-completion/verification/security-final.md):
59client,33gateway and17PostgreSQL tests passed independently, with zero sends and
zero attempts in the original admission-revocation reproduction. Form/list
accessibility refinements are implemented. No whole-product or deployed readiness
is inferred from this scoped security result.

## Final independent results

| Check | Result |
| --- | --- |
| Client units |241passed,15files,6.03s |
| Server units/contracts |101passed,15suites,30.034s |
| Full disposable PostgreSQL regression |238passed,19suites,236.32s; all nine migrations also applied cleanly and via upgrade |
| Build/typecheck/lint | Passed; existing bundle-size and pg deprecation advisories retained |
| Real API browser regression |16passed on isolated3193fixture; one additional real modified-navigation case passed separately in3.8s |
| Legacy functional UX |28/28passed after exact current semantic locator repairs, with original failures retained |
| Legacy synthetic navigation |47/48passed; popup mock routing limitation reproduced. Real cookies/owned draft/Control+middle clicks pass the unchanged five-second URL/content assertions |
| Independent security | P001–P005 closed; fresh59client/33gateway/17PostgreSQL checks passed |
| Prescribed performance |1000proposals,3000revisions,10000findings,20authenticated users;60.063s warmup and300.061s measured including drain;68,644HTTP200,zero errors;overall p95=113.97ms<800ms |

The final [acceptance report](contributor-completion/verification/acceptance-final.md)
and [performance JSON](contributor-completion/verification/performance-final.json)
retain commands, source boundaries, per-endpoint counts/timings, failed attempts
and environment adaptations. This is local evidence, not deployed latency or live
SoC certification. One synthetic popup-fixture limitation remains; it is not
reported as a passing check or a confirmed product defect.

All approved Contributor slices are implemented and locally verified to the
bounded evidence above. Production-complete Contributor AI is still gated by
OPEN-002, reviewed live wiring and actual provider/deployment/human acceptance.

## External verification handover

Shared interface gate resolved by the user's four Yes replies relaying named-owner
agreement to the [concrete proposal](2026-11-01-contributor-contract-coordination.md).
Implementation and independent verification are now in progress. This is not final teammate patch approval.

Provider gate OPEN-002: after the Contributor gateway adapter and its synthetic/security evaluations exist, an authorized operator must use secret configuration to verify the current key-scoped `/models` catalog, approved model alias and smallest advertised context limit, verified tokenizer including framing, chat parameter compatibility, quantitative key/shared-environment rate and spend quotas, and current data handling/retention policy. Run the versioned normal/adversarial evaluations and record real usage/latency and human usefulness ratings. Capture only safe metadata, never keys or raw sensitive prompts. Keep live configuration disabled until evidence meets the specification; no live call is authorized or claimed by this document.

Production wiring is also intentionally gated: current gateway options are
disabled/test and native transport is rejected in test mode. Following verified
provider evidence, an approved change must introduce and wire live configuration,
the server-held key, approved alias and verified counter. This run does not claim
that setting an environment key would activate the completed synthetic path.

Deployment gate: after complete local acceptance and human teammate review, separately authorize deployment of a tested immutable image digest to isolated development services/database. Apply reviewed migrations with backup/rollback evidence, exercise real Contributor → Reviewer → Contributor and owner denial/session/CSRF flows over HTTPS, check cookies/headers/accessibility, and verify health/readiness and required performance workload. Production promotion requires its separate human authorization. This run does not commit, push, merge or deploy.

Skipped/inactive: PROP-CON-001 remains inactive; creation continues to open saved detail. No prior-MP source or integrated build-and-host tools are used.
