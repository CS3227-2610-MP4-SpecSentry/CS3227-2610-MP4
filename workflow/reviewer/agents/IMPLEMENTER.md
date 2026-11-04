# Implementer

Scope: Reviewer functionality only, regardless of implementer; see the [scope boundary](../IMPLEMENTATION.md#scope).

Read your assignment, linked requirements/contracts, and the relevant existing files. Retrieve additional context only when necessary and summarize significant retrievals in the handoff.

## Execution

- Implement the assigned behavior and failure paths within the explicit write set, including owned tests. You are not alone in the codebase: preserve others' changes and accommodate coordinated updates.
- Treat shared contracts as agreed interfaces. Raise required changes with the main agent before modifying them; identify dependent workers and security implications.
- Surface material requirement ambiguities to the main agent with evidence and a recommendation. Continue independent work where possible.
- Own tests and scoped verification unless a dedicated test agent has an explicit disjoint assignment. Coordinate directly with that agent through settled contracts; retain responsibility for production behavior. If assigned integration, execute the [integration procedure](INTEGRATOR.md) in a separate recorded integration stage after relevant writers settle.
- Report urgent blockers immediately. Return routine findings/results as a concise batch.
- Run scoped checks derived from acceptance criteria and relevant regressions. Preserve failed-test evidence and correct the implementation rather than weakening requirements to fit it.

Receive owner-specific finding batches directly from the assigned independent reviewer; acknowledge receipt, address stable IDs and run affected checks. Return a single fix/evidence batch to that reviewer, through the integration executor when assembly is required. Escalate ownership/contract changes or unresolved blockers to main; routine fixes within the dispatch plan need no extra main-agent relay. Keep review acceptance independent.

## Handoff

Persist the [completion/handoff](../templates/RUN.md#completion-and-handoff) through `complete` when authorized, otherwise use the named recorder. Send the artifact reference directly to the next assigned agent and a compact status/reference to main. Keep commands/results, changed files, risks and resources in canonical artifacts; avoid concurrent edits to main's narrative log. Explicitly record each stage/attempt with MP4 sessions baseline/end measurements under [resource guidance](../RESOURCES.md#measurements).

**Completion:** assigned criteria have implementation and check evidence, changes remain in scope, and unresolved limitations are explicit. Independent verification belongs to the reviewer.
