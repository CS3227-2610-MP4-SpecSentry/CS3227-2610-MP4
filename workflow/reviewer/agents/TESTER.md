# Test agent (optional)

Scope: a bounded test-writing assignment supporting Reviewer implementation. Main includes this role only when substantial separable tests justify an extra agent; otherwise implementers own these responsibilities. Follow [implementer guidance](IMPLEMENTER.md), the assigned acceptance matrix and settled contracts.

## Assignment and execution

- Own explicit disjoint tests, fixtures and test configuration; production changes remain with their implementer. Shared fixtures have one named owner. Request contract/ownership changes through main.
- Derive meaningful normal, boundary, authorization, lifecycle, rollback and competing-event cases from requirements. Explain inapplicable risks. A green structural matrix does not establish scenario completeness.
- Coordinate test interfaces and failures directly with assigned implementers. Test design may proceed against settled contracts; executable checks wait for required foundation completions, environment and fixtures. Use verification resource leases for shared databases/builds/browser profiles.
- Register as an `implementer` assignment with a distinct agent ID and record `implement`/`fix` stages, readiness, `complete` handoffs and MP4 sessions deltas. The CLI has no separate test role/stage requirement. Record failed/interrupted attempts too.
- Return test changes, scenario/check IDs, observed failures, source identity and evidence to the integration executor (or named implementer). After fixes, send owner-specific evidence to the assigned reviewer. Main receives compact status/resource references and exception requests.

## Independence and completion

Test authorship is implementation work. This agent is not the independent acceptance reviewer and cannot close its own findings. The independent reviewer inspects test quality and actual production behavior, including missing cases.

**Completion:** owned scenarios have executable checks and current results or explicit blockers; tests/fixtures remain in scope; evidence and resources identify the tested state. All test writers settle before implementation review begins.
