# Opt-in live AI wiring and synthetic verification

## Request and baseline

- Prompter yooplo, previously established Git identity, 1 November 2026 Asia/Singapore. User said 'start doing those' after proposed opt-in server wiring, synthetic production-prompt verification, failure/selection/manual fallback checks and separate verified changes. Key rotation was user-reported; no actual key exposed in this log.
- Branch feature/contributor-completion, clean HEADf9ab2b6 before recording. User authorized implementation and synthetic live verification using a locally configured key; no production deployment, push/merge, automatic app activation or external messages authorized.
- Applied logging/Ponytail and independent security/spec acceptance workflow for this shared gateway change. No dependency addition planned. Preserve full existing quota, authorization, session/state, retry/deadline, output validation and provider-only usage paths.
- Safe presence inspection found no AI credentials in process environment; local .env SoC credentials are placeholders. Asked user asynchronously to configure AI_API_KEY locally without sharing it, leaving AI_LIVE_ENABLED=false. No authenticated probe will run until a usable local key exists. Missing key does not block implementation, offline tests, dry-run harness or docs.

## Brief, design and ownership

- Scope: config live flag defaultfalse; required server key/model/context when true; fixed approved base. Gateway live variant dispatches key only to native approved transport, test mode retains synthetic key/native denial. Conservative unit policy remains unchanged. No browser provider controls or secrets.
- Synthetic harness reuses actual Contributor prompt construction, conservative budget and strict transport envelope/result parsing. Use bounded built-in normal/multilingual/delimiter/near-cap cases; no arbitrary private input. Output safe metadata only (case/model/status/latency/units/reported usage/schema acceptance), not raw prompts/results/errors/key. No DB/business mutation; does not certify app-level authorization or quota persistence.
- Runtime app stays disabled locally; docs distinguish wiring availability from verified production activation and unresolved key-limits/retention review.
- Main owns docs/spec/logs/plan/traceability and resource records. Implementer owns src/server/src/config.ts, ai config/contracts/module/gateway helpers, affected tests and harness/package scripts/.env.example as assigned. Security/verifier read-only; no overlapping writers.
- User approves opt-in wiring direction. Shared-owner/teammate review remains pending; agent review is not teammate sign-off.

## Assignments/resources

- Main coordination interval64c28f58a4494e3dbab16c49f038c6e6; security design intervalabb3a4d0305c435e84e3f85a571c56c0. Both under resources/2026-11-01-live-ai-wiring/. Started before first repository edit; bootstrap reads precede timing. Family GPT-6; exact variant/effort and attributable usage unavailable.
- Security live_security: read-only design/final review, approximately5minutes per invocation. Initial assessment no blocker if flag stays off, complete validation/secret isolation maintained and harness uses real preparation/parsing/budget.
- Implementer: bounded shared wiring/harness/test write set above, approximately15minutes. Validation includes config completeness/false default, blank/invalid/mismatch fail-closed behavior, live fake-network key routing, native-test denial, provider-only usage and bounded synthetic harness dry-run/failure tests. No auth key values in outputs.

## Outcomes

Execution, findings, exact checks and resource closure appended after validation. Human summary verification pending.

### Implementation and first independent checks

- Added explicit validated live server options through existing gateway; test/native guard retained. Example corrected from SOCLAAS_* to canonical AI_*; no local .env edited. No new dependencies, schema or client changes.
- Harness exports/reuses actual prepareContributorDraft, strict response/usage decoding and bounded native transport. Fixed five cases, at most four outbound calls and no retries; no DB. Unit costs normal1781, multilingual1770, delimiters1821, near-cap4000 and over-cap4001. Dry-run passed with last case rejected locally; usage unknown, not measured zero. Configured context is supplied configuration, not fresh catalog verification.
- Main direct compiled harness dry-run and root lint passed. Canonical model/context were process-only overrides; AI_LIVE_ENABLED remained off and no key was used.
- Initial implementer five AI suites44/44, server typecheck and shared/server build passed. Independent acceptance full server17suites/112tests, full client15files/241tests, server/client typechecks, exact template bytes and dryrun passed. Placeholder-key --live and unknown CLI argument both failed safely with CONFIGURATION exit1.
- Independent test runs initially collided with shared clean build (missing generated @specsentry/shared JS, zero executed checks); preserved as sequencing failures, then rerun after build restoration. No assertion weakened. Subsequent source fixes need fresh final affected checks.

### Findings and fix assignments

- LIVE-ACC-001: extraction briefly introduced actual UTF-8 mojibake into unchanged v1 prompt. Implementer restored exact HEAD prompt bytes; independent verifier confirmed equality. No prompt-version drift claimed.
- LIVE-SEC-001: missing provider input-token usage incorrectly allowed passing margin verification. Fixed to INCONCLUSIVE/INPUT_MARGIN_UNKNOWN with overall passedfalse; regression added. Unknown stays unknown; sample comparisons never prove a universal bound.
- LIVE-SEC-002 (high): documented standalone SoC key format could pass context screening without an api_key label. Assigned minimal NFKC-normalized high-confidence rejection with raw/fullwidth synthetic examples in both adapters; no actual key used. Separate fix stage interval231ef73bf09a41f7bf5ba0bea030a6bd started before edits. Reviewer/Contributor contexts must reject before attempt reservation or dispatch, without echoing input in safe metadata.
- Additional evidence correction assigned: preserve valid safe usage in non200 provider envelopes in synthetic reports, matching production accounting. Keep malformed/absent usage unknown and strict200 role decoding mandatory.
- Canonical AI_API_KEY was still absent at latest safe presence check; user replied they will configure it locally. No readiness or authenticated probe claimed from that future intent.

### Final independent revalidation and delivery

- LIVE-ACC-001 independently closed: exact HEAD production template preserved. LIVE-SEC-001 independently closed: missing reported input usage cannot pass live margin evaluation. LIVE-SEC-002 independently closed: documented SoC key format rejected after NFKC in both adapters, no attempt/transport or metadata disclosure. Valid reported usage from HTTP503 and invalid-role output is retained safely. No remaining scoped security/acceptance findings.
- Fresh verifier run after all fixes:17server suites/115tests passed (23.001s), server typecheck passed, compiled dryrun and placeholder-live negative CLI passed. Earlier independent client241tests and client typecheck passed; no client source changed afterward, so not repeated. Final security independently5AI suites/47tests passed; server-only build and targeted lint passed implementer; final root lint and diff --check passed main.
- Saved [offline harness metadata](live-ai-wiring/verification/dry-run.json), confirmed mode dry-run, all HTTP statuses null, configured context262144, five fixed case costs1781/1770/1821/4000/4001 and overcap rejection. This is not provider latency/token/shape evidence. The configured context field is honestly named configuredContextWindow.
- Source files: config.ts, ai/contracts.ts, ai.module.ts, gateway/index.ts; new ai/live-verification.ts; ai-foundation.spec.ts, ai-gateway.spec.ts, contributor-ai-gateway.spec.ts and new live-ai-verification.spec.ts; workflow/tooling/verify-live-ai.mjs, package.json, .env.example. Specs/guides/plan/traceability/workflow index updated to describe opt-in availability, default off and pending external gates. No package lock/dependency/schema/client changes.
- Final safe presence check: canonical AI_API_KEY absent, app live flag not true. Actual authenticated provider evaluation could not run. No key value was printed, no local .env changed, no production app/flag/restart/deploy/push/merge. User must supply AI_API_KEY locally (plus AI_MODEL and AI_CONTEXT_WINDOW) to run explicit synthetic verification; keep app flagfalse. CLI remains ready for that external step.
- Next after credentials: run npm.cmd run verify:ai:live -- --live with fixed synthetic data, inspect per-case schema/margin/usage; investigate failures without weakening validation. Key-specific limits/retention review, actual app/browser acceptance and human shared-owner review remain separate production gates.
- Local commit of this verified wiring/evidence is authorized by the user's 'start doing those' following the proposed next-step list including a separate wiring commit. Resource closure and the final receipt commit follow; no remote action authorized.

### Resource accounting

- Initial implementation5b26b0276cfa4601b837c0fc940c5d69 closed after44focused checks/build/dryrun; fix stage231ef73bf09a41f7bf5ba0bea030a6bd covered standalone SoC key rejection and report corrections,47focused checks/server build. Both succeeded with actual failed build/sequencing attempts disclosed rather than silently removed.
- Initial independent verifier23e8d0375c9f4276b9b8c22e7f73a8b8 and evolving security2073dee2e7514203a1d6d4b41fee6fdd closed before fresh revalidation. Final verifier82d5b3dd59fc4eb89fdc4a03cb44b8df and securityc49f5d101b264dc1abf2777e396ddb78 cover actual final checks. Boundaries are coordinator-observed, including dispatch/wait time. No invented provider/token/price/effort counters. Final report linked after closure.
- [Resource report](resources/2026-11-01-live-ai-wiring/verification/resource-report.md) passed: eight finished succeeded intervals. Measured wall boundary813.739244seconds; summed overlapping stage time2562.330367seconds is not additive wall time/model compute. Attributable token/cache/tool/retry counts and exact model variant/effort unavailable, not zero. Bootstrap reads precede timing; report/receipt rendering, final local commit/status and response are outside the closed interval. Human summary verification and teammate approval remain pending.
