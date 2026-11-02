# Controlled Contributor model comparison

## Request and design

- Prompter yooplo, session Git identity previously established; 1 November 2026 Asia/Singapore. User authorized the next controlled prompt/model comparison after qwen3.6:35b v2 passed only2/4 synthetic cases.
- Preserve existing uncommitted compatibility/promptv2 changes and all earlier failed evidence. Current branch feature/contributor-completion, committed baselinef6f3573 plus reviewed v2 patch. Do not change production prompt, schemas, limits or local configuration during this comparison.
- Reuse compiled production v2 preparation/strict decoder and fixed normal/multilingual/delimiter/near4000cases with4001local rejection. Candidate models llama3.1:8b and gemma4:26b, subject to fresh key-visible catalog/context check. Eight generation calls maximum across two models, sequential, no retries, same800output/20sdeadline/conservative4000units; stop the entire comparison on authentication/quota failure. No arbitrary private input, raw results/prompts/errors or credential values in artifacts.
- Comparison changes model/context only in process memory. App AI_LIVE_ENABLED remainsfalse. Harness runs independently of application auth/database/quota records; evaluate reported metadata without claiming an authenticated workflow. No local.env writes, production activation, commit/push/deploy or dependency changes.
- Baseline is prior v2 same-prompt/same-case qwen result (2/4), not rerun merely to obtain green output. Compare rejection reasons, response timing and provider-reported usage with unknown cache leftunknown. Passing one batch is bounded evidence, not full usefulness/security/production acceptance.

## Recording

- Main intervalf1feb58aebb54c629e4e8f0882506a43 under resources/2026-11-01-ai-model-comparison/, started before first edit/network evaluation. Bootstrap reads precede measurement. FamilyGPT-6; exact variant/effort and attributable agent token/cache/tool/retry telemetry unavailable. Product provider usage separate.
- This stage reuses independently reviewed code; no new product implementation or specialist agent needed solely to run fixed probes. Human summary verification pending.

## Results

Catalog and bounded actual comparisons appended after completion; do not infer success from dispatch.

- Fresh authenticated catalog confirmed chat capability and advertised minimum context65536 for llama3.1:8b,131072 for gemma4:26b. App flagfalse confirmed. Catalog output omitted key and unrelated records.
- Eight actual generation calls completed as bounded (four per model), serial, no retries; provider did not return auth/quota rejection. Both overcap cases rejected before dispatch. Saved metadata-only [Llama](ai-model-comparison/verification/llama3.1-8b-v2.json) and [Gemma](ai-model-comparison/verification/gemma4-26b-v2.json) artifacts.
- Llama4/4 SUCCESS, strict role-schema and input-margin checks passed, HTTP200. Latencies2241/2391/1905/1671ms; complete provider-reported totals2058tokens (1612input,446output), cacheunknown.
- Gemma3/4 SUCCESS; normal case hit deadline20012ms with no HTTP/usage returned. Completed multilingual/delimiter/nearcap cases5772/5650/4020ms, schema/margin passed; known subtotal2008tokens across3cases only, timeout usageunknown. Do not treat missing usage as zero or subtotal as full consumption.
- Earlier same-v2 Qwen baseline2/4 successful; all four reported usage2669tokens. Its sample was earlier, not a fresh contemporaneous rerun. [Calculated comparison](ai-model-comparison/verification/comparison.json) asserts same template and case-unit values2158/2147/2198/4000/4001 across all artifacts, same800output and20sdeadline, distinct advertised context windows (all above application caps).
- Applied resource-use analysis skill to measurement interpretation; actual provider execution is authorized by user, not by skill. Product metrics are separate from development-agent telemetry. No price/cache savings claim: no validated applicable rate calculation or cache data. Sequential ordering/backend load/routing/warmup are confounders; one batch/fourattempts per model is not statistically reliable or a human usefulness rating.
- Recommended next authenticated synthetic app-test candidate: llama3.1:8b with catalog context65536. This does not change local.env, example model, default app switch or other roles. Qwen LIVE-PROBE-001 remains open for that alias; a passing alternative does not erase its failures. Actual authenticated UI/transaction/selection flow, Reviewer live evaluation, key limits, retention/data handling and human shared-owner review remain pending.
- Only new prompt/evidence/resource artifacts written; preserved all pre-existing uncommitted v2 source/spec/test changes. No product implementation, source tests, database/browser/deployment actions, commits or remote operations in this comparison. Existing fixed harness reused unchanged; artifact equality/assertions and git diff --check passed.
- [Resource report](resources/2026-11-01-ai-model-comparison/verification/resource-report.md) passed: one finished succeeded interval239.622572seconds; summed single-agent time equals measured wall interval. Bootstrap reads and final report/log/response rendering excluded. Agent input/output/cache/tool/retry telemetry unavailable, not zero; actual model/provider usage remains separate above. No human summary verification or teammate sign-off claimed.
