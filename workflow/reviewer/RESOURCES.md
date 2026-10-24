# Reviewer functionality resource selection and harness evaluation

## Dispatch policy

The main agent chooses each subagent's available model and supported reasoning effort for the task. Record the exact selection and one-sentence rationale before dispatch. Respect runtime/user restrictions and disclose when a requested choice cannot be applied.

| Task | Selection basis |
| --- | --- |
| Mechanical bounded change with clear checks | Lower-cost capable model, lower effort |
| Feature implementation with established contracts | General coding capability, moderate effort |
| Complex design, security reasoning, subtle defect | Stronger capability/higher effort when justified |
| Independent review | Capability appropriate to the risks; independence does not imply weaker capability |

Select capability and effort separately. Escalate based on observed inadequacy, not repeated unproductive retries. Use focused briefs without full-history inheritance where supported. Discover available models/settings from the runtime; this policy does not prescribe model names or claim provider prices/capabilities. Product SoC LLM configuration is separate from development-agent selection.

## Measurements

Follow the shared [resource recording rules](../RESOURCES.md) and include the measurements in the scoped run record.

The [Reviewer scripts](scripts/README.md) now provide expected-stage registration, start/finish timing, exact per-record usage imports, coverage summaries, and completeness reports. Record each agent/invocation/stage/attempt separately. The CLI measures boundaries when called; it cannot discover undeclared activity or access hidden model/token counters. Unavailable measurements remain explicit.

## Initial harness and future enforcement

The harness combines procedural routing and stage gates with scripts for ownership, evidence, findings, and recording consistency. Application build/test tooling still depends on the product implementation. Checks execute only when invoked; these local evidence files remain editable and do not prove review quality or enforce operating-system permissions.

As executable checks become available, run them at integration/review: build, requirement tests, authorization/AI contracts, static analysis, and relevant regressions. Later evidence validation can check required fields, links, finding dispositions, and reviewed-state identifiers. Such structural checks cannot establish behavioral correctness.

After the first implemented feature, evaluate missed defects, first-pass success, corrections, repeated retrievals, elapsed time, resource use, and coordination overhead. Improve the smallest ineffective part of the workflow. Use the product spec's controlled experiments for Reflections; distinguish actual measurements from planned experiments.
