# Contributor implementation workflow

## Scope and authority

Use this workflow for Contributor functionality: private proposals, criteria, submission and revision, finding responses, withdrawal/reopening, and the Spec Draft Assistant. It is a development-agent workflow, separate from the product's advisory AI assistant.

The [product specification](../specs/PRODUCT-SPEC.md), [Contributor requirements](../specs/ROLE-CONTRIBUTOR.md), and applicable shared/integration/AI requirements govern product behavior. This procedure specializes agent responsibilities from [DEVELOPMENT](../DEVELOPMENT.md) for Contributor work; it does not change product requirements or authorize changing shared contracts unilaterally. Reviewer work continues to use its [own entry point](../reviewer/README.md). Standalone shared infrastructure uses the generic process; mixed tasks apply each role's procedure to its portion.

## Agents and permissions

The human Contributor owner sets goals and resolves material product ambiguity. The coordinator dispatches bounded specialists; the implementer integrates code. Agents may retrieve relevant source themselves and must report evidence, not infer completion from module names.

| Assignment | Instructions | Permitted writes |
| --- | --- | --- |
| Coordinate requirements interpretation, architecture, dependencies, and closure | [Coordinator](agents/COORDINATOR.md) | Assigned workflow, run records, and documentation; no product code |
| Implement and integrate one slice or fix | [Implementer](agents/IMPLEMENTER.md) | Declared source, tests, and assigned documentation only |
| Review design or patch security | [Security reviewer](agents/SECURITY-REVIEWER.md) | Read only; coordinator persists findings |
| Verify acceptance, specification alignment, guides, and fixes | [Acceptance verifier](agents/ACCEPTANCE-VERIFIER.md) | Assigned tests and documentation only; no product-code fixes |

For a substantive implementation slice, use an implementer and an independent acceptance verifier. Use security review before implementation and on the resulting patch when ownership/privacy, lifecycle, sessions/CSRF, persistence transactions, AI context/external calls, or sensitive data handling changes. These include the initial Contributor slices. A small local documentation correction can remain single-agent; never label self-review independent verification. Spawn specialists only for actual assignments, not to fill every role on every task.

## Execution

1. **Brief and record.** Resolve the prompter and start the [shared resource interval](../tooling/RESOURCE-SESSION.md) before editing. The coordinator creates a [run record](templates/RUN.md) with the goal, requirement/scenario IDs, source revision and spec references, success/denial/failure cases, exclusions, dependency status, file write sets, commands, and dispatch budget. Interpret existing requirements without silently inventing new behavior. Material requirement changes need role-owner and teammate review under DEVELOPMENT before dependent implementation.
2. **Coordinate and secure.** Identify shared schema/contracts and transaction seams; record agreement with affected owners before those edits. Have the security specialist review affected boundaries and derive abuse checks. Resolve blockers before dependent work; independent approved work may continue.
3. **Implement a vertical slice.** Assign one implementer the smallest complete API/UI/persistence/test slice. Derive meaningful failing acceptance checks before implementation where practical. Include callers, fixtures, exports, migrations, and docs affected by the change. Do not weaken a requirement or test to obtain a pass.
4. **Verify.** A separate verifier reads the specification and final diff, runs proportionate acceptance/authorization/integration/browser checks, and reports gaps. The security specialist reviews relevant final changes. Both report exact commands, results, reviewed revision/diff, and unavailable evidence.
5. **Fix and revalidate.** Keep stable finding IDs. The implementer fixes assigned findings. Dispatch a fresh verifier invocation with the requirement, original finding, final diff, and regression scope; it must not rely on the implementer's claim. Security findings also receive independent security revalidation. Preserve failed/interrupted attempts and their resource records.
6. **Close and hand over.** Record findings as verified fixed, unresolved, or explicitly accepted by the authorized human with rationale; unresolved security/requirement blockers prevent readiness. Reconcile traceability and guides with observed behavior, finish intervals after validation, generate the resource report, and link it in the prompt log. A teammate reviews non-trivial work before merge; agent review is not teammate sign-off. Commit, merge, or deployment require their applicable authorization; this procedure itself does not authorize them.

## Coordination and context

- Declare one writer per file, including logs. Parallelize read-only reviews or disjoint assignments; overlapping writes require sequencing or isolated worktrees and an assigned integrator. Do not have independent role workflows concurrently edit shared schema, contracts, auth, AI gateway, audit, or notifications.
- Coordinate proposals/revisions and criterion identity with the Reviewer owner; release attachment/reopening/withdrawal with the Maintainer owner. Consult [PLAN ownership](../PLAN.md#team-allocation) and [integration contracts](../specs/INTEGRATION-SPEC.md). Agreement must identify the interface, affected files, owner, and evidence/reference; an agent's assumption is not teammate agreement.
- Supply focused context: relevant instructions/spec sections, interfaces, assignment/write set, current diff, and prior findings. Retrieve more only when needed. Do not pass hidden reasoning, credentials, raw sensitive prompts, or broad historical logs.
- Use the run template for assignments, completion reports, findings, and fixes. Required handoff fields include next authorized action and actual resource references; unavailable telemetry stays unavailable. The coordinator writes shared logs for read-only agents and may record their boundaries as coordinator-observed.
- Record each main-agent stage and subagent attempt using [RESOURCES](../RESOURCES.md); do not double-count a shared record. State the dispatch task/time or tool budget, actual usage available, and any overrun. Do not invent model IDs, prices, usage, or results; follow session model-selection constraints.
- Stop dependent work for material ambiguity, expanded permissions, unsafe data exposure, unresolved contract conflicts, or insufficient verification budget. Preserve competing claims and use the smallest discriminating check where possible; ask the human only for the unresolved decision.

## Planned slice order

These are dependency-aware planning units, not delivered features or a replacement for acceptance criteria. Shared lifecycle/migration/audit support may require coordinated work before a slice can complete.

| Slice | Requirement coverage | Important dependencies and checks |
| --- | --- | --- |
| Private drafts | REQ-CON-001/002/007/009 and draft deletion policy | Own list/read/create/edit; private working content; required criteria default; stable identity; deletion confirmation and minimal audit tombstone |
| Submission | REQ-CON-004/007/009 | Shared revision model, sanitization/limits, required criterion, bounded summary, immutable snapshots, pool state and atomic audit/activity |
| Revision loop | REQ-CON-002/005/008/009 | Reviewer findings/assignment interfaces; finding responses cannot resolve findings; replacement/resubmission preserves history and follows current assignment; stale writes rejected |
| Lifecycle actions | REQ-CON-002/006 and shared reopening rules | Withdrawal confirmation/reason; assignment closure and required notifications; approved reopening; candidate attachment blocks; terminal states preserved |
| Spec Draft Assistant | REQ-CON-003 and AI security contracts | Coordinated server gateway; typed bounded suggestions; explicit selection before saving; manual editor retains content on failure |

Use applicable AC-CON scenarios and shared denial, version, transaction, accessibility, and AI cases for each slice. If another role's implementation is unavailable, identify the gap; mocks can validate a contract but cannot certify cross-role integration.

## Starting a run

Ask the coordinator to implement a bounded goal, for example: "Implement Contributor private drafts against REQ-CON-001/002/007/009 and the deletion policy, following workflow/contributor/README.md. Inspect current dependencies, coordinate shared changes, dispatch independent verification, and leave changes uncommitted."

Store run evidence under `logs/<prompter>/` using a task-specific filename derived from the template. No new workflow CLI or product implementation is introduced by this setup.
