# Deployment-agent workflow contract

This contract turns the Release Maintainer and deployment workflow into observable
requirements. It complements [the procedure](README.md); it does not authorize a
provider, migration, deployment, promotion, rollback, merge or production action.

## Coordination pattern

Use an **orchestrator-subagent** pattern for bounded architecture, recovery or
security analysis with distinct read-only scopes. After implementation freezes,
use **generator-verifier** separation: an agent that authored the change cannot
claim independent acceptance. Do not delegate a localized task when coordination
cost, duplicated context or permission surface outweighs the expected quality gain.

## Observable requirements

| Requirement | Observable evidence |
| --- | --- |
| Read applicable specifications and source before editing | Prompt/run log identifies the focused context and first write boundary |
| Define scope, authority and stop conditions | Run record names requirement IDs, allowed actions, exclusions and target environment |
| Keep responsibilities disjoint | Run record names each agent, exact write set and read-only reviewers |
| Make the smallest complete change | Diff and traceability identify one bounded behavior plus explicit exclusions |
| Test behavior and failure paths | Run record lists commands and actual results; changed behavior has focused regression coverage |
| Freeze before independent review | Source revision or file manifest identifies the reviewed candidate |
| Correct findings and re-verify freshly | Stable finding IDs retain dispositions; a new verifier invocation checks the corrected state |
| Gate privileged actions | Human approvals and unresolved deployment/migration/credential gates remain explicit |
| Preserve traceability | Prompt log includes requests, steering, failures, handoffs, changes, checks and limitations |
| Record resource use honestly | Every known invocation has a finished resource record; missing telemetry is null with a reason |
| Keep the harness verifiable | `npm run test:deployment-workflow` tests the evidence checker; root `npm test` runs it in CI |
| Verify a completed run | Terminal status, substantive logs, strict finished resources and a Git-complete manifest make `npm run verify:deployment-run -- --run ... --prompt-log ... --resources ... --base-ref ...` exit successfully |

## Context and handoff budget

Supply requirement IDs, relevant interfaces, current diff, prior findings, exact
write scope and stop conditions. Prefer links to authoritative files over copied
histories. A handoff returns decisions, evidence, unresolved risks and the next
authorized action, not a raw transcript or hidden reasoning. If a child invocation
is interrupted or unmeasured, disclose the gap rather than reconstructing timing.

## Evaluation and maintenance

For each completed run, report outcome quality, defects/findings, wall time, summed
agent time, retries and available token/cache/tool telemetry. Null telemetry is
unavailable, not zero. A single run is an observation, not a controlled comparison.
Turn recurring workflow failures into deterministic checker or regression cases and
update this contract when the workflow changes.

The checker rejects symlinks, repository escape, non-terminal status text, headings
hidden in Markdown fences, unbounded files/directories and diagnostics containing
structured input values. It compares every non-log candidate file with the Git diff
from the declared base and requires a successful independent-review interval. These
files are editable self-reports, not signed provenance; teammate review and provider
evidence remain separate controls.
