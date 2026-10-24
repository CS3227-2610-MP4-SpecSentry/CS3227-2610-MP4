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

## Initial harness and future enforcement

The initial harness consists of routing guidance, stage gates, ownership contracts, and structured records. These are procedural controls. Application build/test tooling and automated evidence validators must be established by relevant future tasks; they are not currently enforced merely because this document exists.

As executable checks become available, run them at integration/review: build, requirement tests, authorization/AI contracts, static analysis, and relevant regressions. Later evidence validation can check required fields, links, finding dispositions, and reviewed-state identifiers. Such structural checks cannot establish behavioral correctness.

After the first implemented feature, evaluate missed defects, first-pass success, corrections, repeated retrievals, elapsed time, resource use, and coordination overhead. Improve the smallest ineffective part of the workflow. Use the product spec's controlled experiments for Reflections; distinguish actual measurements from planned experiments.
