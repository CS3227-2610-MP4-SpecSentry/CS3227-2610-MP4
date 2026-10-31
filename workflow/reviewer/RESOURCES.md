# Reviewer functionality resource selection and harness evaluation

## Dispatch policy

The main agent chooses each subagent's available model and supported reasoning effort for the task. Record the exact selection and one-sentence task-complexity rationale in the existing assignment before dispatch; do not create a separate justification document. Respect runtime/user restrictions and disclose when a requested choice cannot be applied.

| Task | Selection basis |
| --- | --- |
| Mechanical bounded change with clear checks | Lowest sufficient available tier and low effort; use deterministic scripts for bookkeeping |
| Feature implementation with established contracts | Sol-family or comparable available coding model, normally medium effort |
| Complex design, transaction/concurrency invariants, subtle defect | Increase effort on the selected capable model when the concrete difficulty warrants it |
| Independent implementation or security review | Apply the same complexity assessment; independence and role title do not require a higher model tier |

Select capability and effort separately. Prefer an available Sol-family model; the runtime supplies exact IDs and supported settings. Higher effort requires a task-specific reason, not a blanket role default. Respect an explicitly configured main-agent setting; when per-stage switching is unavailable, use scripts for routine operations rather than adding an agent solely to lower effort. Product SoC LLM configuration is separate from development-agent selection; this policy makes no provider pricing claims.

**Astra is an exception, including for security review.** Use it only when a concrete material capability gap cannot reasonably be resolved with the available Sol model, appropriate effort, focused context and discriminating tools/checks. In the existing assignment, record the unresolved problem, attempted approach or specific reason an attempt would be inadequate, why Astra is necessary, and the bounded task/stop condition. A security label, routine reviewer independence, usage-limit failure or two unsuccessful attempts is not itself sufficient justification. Reassess the cause before escalating; report a resource blocker for exhausted quota and retry only when capacity is available. This exception does not introduce a routine permission pause or weaken required review gates.

Supply focused task packets without full-history inheritance where supported. Load only relevant specification/code sections and retrieve more when a concrete uncertainty requires it. Keep stable shared instructions first where supported by the platform; claim cache savings only from attributable hit/miss telemetry. Avoid extra calls to prewarm or maintain a cache without verified support and a measured benefit.

## Measurements

Follow the shared [resource recording rules](../RESOURCES.md) and include the measurements in the scoped run record.

The [Reviewer scripts](scripts/README.md) now provide expected-stage registration, start/finish timing, exact per-record usage imports, coverage summaries, and completeness reports. Record each agent/invocation/stage/attempt separately. The CLI measures boundaries when called; it cannot discover undeclared activity or access hidden model/token counters. Unavailable measurements remain explicit.

On an observed user pause, failure, interruption or completion, finish the relevant interval promptly and start a new attempt/stage only when work actually resumes. A parent waiting for a child remains measured parent elapsed time, not active model computation. If an interruption prevents recording, use the next actual observed checkpoint and disclose the unknown idle gap; never reconstruct a precise stop time.

Report calendar span, summed agent elapsed and parallel-merged elapsed separately. Distinguish environment setup, implementation/fixes, integration/checks, reviews and coordination; categories and command durations may overlap. Where actual state events expose wait/pause durations, report them separately. Call time model computation or active editing only with attributable instrumentation; otherwise label it unavailable. Preserve failed/interrupted attempts and token/cache coverage. Reasoning already included in output is not added again.

## Evaluation

Define useful outcomes before comparing runs: acceptance coverage, independent defects detected, rework, unresolved risk and completion quality alongside time and available tokens. Use the existing brief to note likely setup/coordination costs and any explicitly supplied budget; do not invent a token budget or relax an acceptance gate to meet one.

Compare like workloads and distinguish cold setup from warm runs. Change one factor at a time when testing context size, decomposition or model/effort choices. Keep requirements, environment and independent checks comparable; lower usage with missed defects is not an improvement. One run and unavailable token counters support observations and hypotheses, not causal or monetary savings claims. Use [resource-use analysis](../../.agents/skills/analyze-resource-use/SKILL.md) explicitly for comparisons.

## Harness implementation boundary

The harness combines procedural routing and stage gates with scripts for ownership, evidence, findings, and recording consistency. Application build/test tooling still depends on the product implementation. Checks execute only when invoked; these local evidence files remain editable and do not prove review quality or enforce operating-system permissions.

As executable checks become available, run them at integration/review: build, requirement tests, authorization/AI contracts, static analysis, and relevant regressions. Later evidence validation can check required fields, links, finding dispositions, and reviewed-state identifiers. Such structural checks cannot establish behavioral correctness.

Use the [evidence policy and tooling contract](scripts/README.md#7-evidence-efficiency-and-retention) for implemented capabilities, current fallbacks and proposed automation. Improve the smallest ineffective part of the workflow and test the harness itself. Use the product spec's controlled experiments for Reflections; distinguish actual measurements from planned experiments.
