# Conservative AI preflight budget

## Request, authority and scope

- Prompter yooplo (Git identity established in this session), 1 November 2026 Asia/Singapore. User explicitly approved option 2: revise the exact verified-token-count requirement to a documented conservative preflight budget, without calling estimates verified counts or provider usage.
- Context: user-run qwen3.6:35b synthetic probe passed schema validation, catalog advertises 262144 context tokens, but supplied provider PDFs lack tokenizer/framing and data-handling details. No key accessed or recorded; prior exposed screenshot key rotation remains user action, not claimed complete.
- Work: shared server AI budget policy/counter and relevant specs, tests and documentation. No live enablement, credentials, model/provider calls, migrations, UI changes, deployment, commits or pushes. Existing Contributor completion changes are pre-existing and must be preserved.
- Requirements: AI-SECURITY feature budgets, OPEN-002, NFR-RES-001, privacy/strict typed output/manual fallback and request limits. User approves policy direction; shared owner/teammate review and production readiness remain pending. This patch prepares a concrete reviewable result and does not claim cross-role sign-off.
- Roles: coordinator edits specifications/docs/logs; implementer owns server counter/contracts/gateway/module and affected tests; independent security and acceptance review. Shared workflow DEVELOPMENT applies; no Reviewer-specific workflow invoked.
- Skills: logging, Ponytail and security/specification review. No new dependency needed.

## Proposed behavior and checks

- Use complete normalized outbound system/user messages for a deterministic UTF-8 byte-based conservative allowance with explicit fixed framing reserve and versioned method ID. This is a resource-admission heuristic, not actual tokens or a guaranteed bound for undocumented tokenizers.
- Retain numeric 4000/10000 feature admission caps, character limits, 800 output reserve, context-window headroom, no truncation, authorization, deadlines, quotas and strict output validation. Maintainer 6000 remains policy only, not a new feature.
- Keep provider token/cache accounting unchanged and unknown values unknown. Default live mode remains disabled; unsupported/mismatched budget configuration fails closed. Preserve synthetic test injection and block native transport in test mode.
- Verify byte handling for ASCII, CJK, emoji, empty content, framed messages and cap boundaries; reject invalid numeric budgets before dispatch; verify existing Contributor/Reviewer gateway regressions and default live disablement.

## Assignments and resources

- Main coordination interval: resources/2026-11-01-conservative-ai-budget/9f6ce04a282c4335be12337d65f7d4ce.json. Started before first repository edit; initial inspection outside timing.
- Security design review: budget_security; read only; ~5 minute budget; resources/2026-11-01-conservative-ai-budget/5d38578c65264bc58016dcb35027070c.json. Inspect proposed resource heuristic/claims, fail-closed behavior, telemetry separation and test obligations before code changes.
- Exact model variant/effort and attributable usage unavailable. Recorded family GPT-6 with inherited settings; no model override. Human verification of this summary pending.

## Outcomes

Implemented method `utf8-bytes-framing-v1`: `512 + sum(64 + UTF8(role) + UTF8(content))` over every prepared outbound message. Counter/method identity retains model binding. Context admission uses subtraction to avoid addition overflow. The module supplies the conservative counter while retaining disabled options. No schema/database migration, product UI, business authorization, credentials, provider usage persistence or live configuration changes were made.

Current-task source delta (isolated against pre-task copies in ignored `.tools/conservative-ai-budget-baseline`, not all existing Git changes):

- src/server/src/ai/ai.module.ts, contracts.ts, gateway/index.ts, gateway/transport.ts.
- src/shared/src/contracts/ai.ts: renamed numeric input cap exports to contributorInputUnits/reviewerInputUnits.
- src/server/test/ai-fixtures.ts, ai-gateway.spec.ts, contributor-ai-gateway.spec.ts, contributor-ai.integration.ts, patch-risk.integration.ts; new input-budget.spec.ts.
- workflow/tests/browser/fixtures/reviewer-patch-risk.ts: DI caller renamed.
- workflow/specs/AI-SECURITY-SPEC.md, SHARED-REQUIREMENTS.md, OPEN-DECISIONS.md; docs/AI-Integration.md, Architecture.md, DeveloperGuide.md, UserGuide.md; workflow/PLAN.md, TRACEABILITY.md; this log and resource records. Existing completion work in these files was retained, not attributed to this task.

### Executed validation

- Shared build passed after an initial sandbox esbuild access failure interrupted its clean build. Escalated build restored generated shared JS. Two new-test TypeScript typing issues were fixed before final passing checks; no assertions weakened.
- Implementer: four focused AI suites, 38 tests passed; server typecheck passed. Added explicit native-transport blocking assertion; affected Reviewer suite 18/18 passed.
- Independent acceptance verifier: four focused suites 38/38, server and client typechecks passed; final affected Reviewer suite 18/18 passed. Read scoped baseline delta, specs and all renamed callers; no findings. No writes by verifier.
- Independent final security reviewer: four focused suites 38/38 passed; no new blockers. Confirmed full prepared-message counting, unit/provider-usage separation, native transport and environment/module live blocks, limits and rejection before outbound attempt reservation.
- Main: root `npm.cmd run lint` passed, followed by `npm.cmd exec -- eslint src/server/test/ai-gateway.spec.ts` after the final assertion. Old verified-counter/input-token-cap identifiers absent from active source and browser fixture.
- Focused command: `npm.cmd run test -w @specsentry/server -- --runTestsByPath test/input-budget.spec.ts test/ai-gateway.spec.ts test/contributor-ai-gateway.spec.ts test/ai-foundation.spec.ts`.
- Coverage includes ASCII/CJK/emoji/combining text, framed/escaped and system message growth, real counter through both adapters, exact 4000/10000 versus cap+1, NaN/Infinity/fractional/negative/unsafe counts, context exact boundary/one below, method mismatch, and unknown usage despite known units.
- No fresh PostgreSQL/browser/live-provider/deployment run: no persistence/UI change or live enablement. Existing integration/browser fixture callers were typechecked/renamed, not execution-certified. No all-role production readiness or human sign-off claimed.

### Findings and limitations

- Design BUD-SEC-001 was a nonblocking evidence gap under disabled mode. Final review supersedes exact-tokenizer verification as a mandatory gate under the approved policy; empirical model-specific margin evaluation, live wiring, actual key limits and provider data-handling assessment remain pending. Budget units can reject inputs an exact tokenizer would admit and are not a proven bound for undocumented aliases.
- Main dispatch/run settings inherit this session; exact model variant/effort and per-record usage are unavailable, not estimated. Security and verifier reports are independent agent evidence, not human teammate approval.
- Shared-owner/teammate review and human verification of summaries remain pending. User approval is the actual authority for the policy direction; no fabricated teammate coordination or approval.

### Assignment/resource receipts

- Implementer budget_implementer: bounded source/test ownership above, approximately 10-minute budget; interval 1a7a417cefe34e9fb3b76f8c024946ea. No writes after final source readiness. Final native assertion file timestamp 14:47:18 UTC precedes interval closure14:47:25.546109; exact per-command end time unavailable. Extra interval4141d444eb204cb68b4c0f5068b4bd2a was started conservatively for an anticipated edit but contained resource/timing clarification only; no fictional second edit claimed.
- Acceptance budget_verifier: read only, approximately 8-minute budget; interval83568a1103604897919fbecd4c5ed05b includes waiting for shared build restoration, code inspection, independent tests and final regression.
- Security budget_security final review: read only, approximately 5-minute budget; interval311badfec1e2408e96daf6129f265ed5. Design and final reviews separately recorded; no resource double-counting.
- Child boundaries are coordinator-observed and include dispatch/wait time. Failed tooling/build/test attempts within implementation are disclosed above, not assigned retrospectively invented timings. No subagent logs or sensitive prompts copied. Final main closure/report follows.

### Resource closure

[Generated resource report](resources/2026-11-01-conservative-ai-budget/verification/resource-report.md): six finished succeeded intervals; CLI report passed. Measured end-to-end boundary 395.232659 seconds (2026-11-01 14:42:29.920936–14:49:05.153595 UTC); summed overlapping agent-stage time1051.744617 seconds, not additive wall time or model compute. Final native assertion remained within the first implementation interval; the extra anticipated-fix interval captured clarification only. All token/cache/tool/retry usage remains unavailable, not zero. Bootstrap reads before recording and final report/log/response rendering are outside the measured boundary. The report writer initially used a wrong JSON end-time key for its optional aggregate print after successfully generating the report; actual ended_at fields above supply the corrected measured boundary. Human review remains pending; changes uncommitted, no push/merge/deployment.
