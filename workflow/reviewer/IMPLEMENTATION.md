# Implementation workflow

Enter through the [Reviewer workflow context](README.md) for task routing and its relationship to the pre-existing product-spec workflow.

## Scope

This procedure applies only to Reviewer functionality defined by the current [Reviewer requirements](../specs/ROLE-REVIEWER.md), regardless of the implementer. It covers the review queue, evidence mapping, Patch Risk Assistant, findings, decisions, stale reviews, and supporting changes directly required by those behaviors. Standalone shared infrastructure work is outside this trigger even when assigned to the same person. For mixed-functionality tasks, apply this procedure to the Reviewer portion and coordinate shared interfaces. Shared invariants, resource recording, and prompt logging remain repository-wide.

## Trigger and roles

Use this workflow by default when implementing a task or feature against existing requirements. Requirements discovery for a new product and standalone research/documentation tasks are separate work. Small implementation tasks may use one implementer when decomposition adds more overhead than value; retain proportionate security and independent verification.

The main agent owns the initial brief, design, contracts, split, model/effort selection, exceptional decisions, integration accountability, and consolidated final report. After dispatch it primarily monitors compact status and intervenes on evidence-backed exceptions; assigned agents execute integration, checks and routine fix handoffs. Security and implementation reviewers are independent of the code they assess. The same implementation reviewer may revalidate fixes. Human teammate review required by the product spec remains a separate release/PR responsibility.

Use [run sections](templates/RUN.md) as needed in `logs/<name>/<log_name.md>` (use the prompting person's name); a run ID is a date plus short task name. Link source requirements with a commit or recorded document state. Keep one canonical CLI state and a main-owned narrative log. Explicitly authorize agents to record their own boundaries, evidence and handoffs through the locking CLI and uniquely owned artifact paths; product read-only permissions need not prohibit run-evidence writes. Agents do not concurrently edit the narrative log or raw state JSON. For evidence-read-only assignments, name an authorized recorder and use the compact fallback in [handoffs](skills/reviewer-role-agent-handoff.md#storage-and-ownership).

Use the [Reviewer automation CLI](scripts/README.md) to register expected work and record one boundary pair per agent, invocation, stage, and attempt. Include reused agents, fix/revalidation cycles, failures, and interruptions. Start/finish recording at execution boundaries; import directly attributable telemetry when exposed and record reasons otherwise. These commands require agent invocation; they are not automatic runtime instrumentation.

New runs follow the [version 3 procedure](scripts/V3.md). Its canonical state generates completion handoffs and the final report; disposable inputs and derived reports are separate from interval records. Version 2 runs retain their existing compatibility rules.

## 1. Compile requirements and design

Read [main-agent guidance](agents/MAIN.md). Extract existing requirement IDs, acceptance criteria, edge/failure cases, exclusions, and relevant decisions. Inspect the current architecture and identify components to add or modify. Describe contracts, dependencies, data flow, trust boundaries, and tentative ownership.

Use [prepare-change-brief](skills/prepare-change-brief.md) for the repeatable brief procedure. It does not itself start implementation.

Classify the task as localized, separable, or foundation-dependent. Record the smallest useful increment and a short decomposition rationale in the brief: expected parallel benefit, shared contracts and likely coordination cost. Reuse established foundations; a new foundation stage is needed only when dependent workers require changed contracts or infrastructure. Retain acceptance criteria and proportionate independent security/implementation review for every classification.

Perform a read-only environment preflight before dependent dispatch: discover repository commands, available runtimes, test database isolation, migrations and browser prerequisites as applicable. Record ready/missing status once; provision only within authorization. Separate cold setup from repeat-run measurements. An environment blocker pauses dependent checks rather than triggering speculative code changes.

Resolve questions using requirements, decisions, and code. Code provides implementation evidence, not authority to contradict requirements. For a material unresolved ambiguity, ask the prompter with a recommendation, implications, and alternatives. Aim to resolve these before implementation; pause only dependent work if a question emerges later.

**Exit:** the implementation brief accounts for all requested behavior, identifies its sources, and has no unresolved ambiguity blocking the proposed work.

Draft named acceptance cases during compilation: requirement, scenario, preconditions, expected outcome, risk kind and competing events where applicable. Bind each to an assignment owner and an executable named test/check after contracts settle. Cover authorization, boundaries, lifecycle, concurrency and rollback or record reviewed applicability reasons; transactional expectations include audit and notifications.

## 2. Review security and settle contracts

Send a focused brief and relevant source pointers to a [security reviewer](agents/SECURITY-REVIEWER.md). Include existing code when the design depends on it. The reviewer returns threats, abuse cases, concrete controls, validation expectations, and blocking findings. The main agent updates design/contracts and records each finding's disposition. Recheck materially revised security decisions with the reviewer.

**Exit:** blocking design findings are resolved, required controls have implementation owners and checks, and contracts are sufficiently stable for the proposed parallel work. This gate does not certify future code.

## 3. Announce and dispatch implementation

The main agent chooses the split; the security reviewer challenges unsafe boundaries or ownership. Use the following basis:

| Situation | Split |
| --- | --- |
| Independent features, stable shared infrastructure | Feature or vertical slice |
| One feature, separable modules, clear interfaces | Component ownership |
| Tightly coupled files or unsettled interfaces | One implementer or smaller parallel portion |
| Shared foundation required by several workers | Foundation first, then parallel work |

Announce workers, scope, permitted files, shared-file owner, dependencies, model/effort with rationale under the [selection policy](RESOURCES.md#dispatch-policy), and expected checks. Proceed without a routine approval pause; keep the announcement visible for human intervention. Respect actual concurrency limits and dispatch ready work only.

Register check contracts, assignment ownership and the acceptance matrix; run environment/fixture prerequisites and `readiness --assignment` before dispatch. Version 3 implementation/fix starts enforce that gate. Dependents wait for a current successful foundation completion. Use the verification runner's resource leases for shared builds, database and browser checks.

Decide both optional roles before dispatch and record the rationale, whether included or omitted:

| Optional agent | Include when | Otherwise |
| --- | --- | --- |
| [Integrator](agents/INTEGRATOR.md) | Multiple settled assignments need substantial interface, configuration or migration assembly and combined verification | Name an implementer as integration executor; retain the recorded integration stage |
| [Test agent](agents/TESTER.md) | A substantial suite has a disjoint test/fixture write set, stable contracts, and enough independent work to offset setup and coordination | Implementers own tests and scoped verification within their assignments |

Account for actual concurrency capacity, shared database/browser/build resources and handoff cost. A test agent supplies implementation evidence, not independent acceptance. Register test-writing work as an implementer assignment with its own agent ID; no new CLI role or stage is implied. Assign shared fixtures/contracts to one owner. Testing that needs foundation code waits for its current completion; test planning against settled contracts may proceed earlier.

Give each worker [implementer guidance](agents/IMPLEMENTER.md) and a focused assignment. Assign disjoint write sets, including tests, migrations, configuration, and generated files. Worktrees can isolate edits but do not resolve overlapping semantic ownership. Define cross-module contracts with names/signatures or schemas, errors, authorization, transaction/version semantics, and an owner where relevant.

At assignment, completion, review, and fix boundaries, use [reviewer-role-agent-handoff](skills/reviewer-role-agent-handoff.md). Keep a concise task packet with authoritative references; subsequent packets emphasize changed contracts, findings and evidence. Use one authoritative handoff per actual boundary rather than extra copies for status updates. Record a routing table naming sender/recipient agent IDs, permitted transitions, artifact writers, fix owners and recording fallback. Agents hand off directly within that plan; recipients acknowledge the packet and act only after its prerequisites pass. Use runtime messaging for active recipients and a supported wake/resume operation for idle recipients. If unavailable, main performs only the dispatch operation, without relaying the full packet. Silent delivery is not a successful handoff.

Workers request contract, ownership or acceptance changes through the main agent. Update affected assignments and obtain security re-review when warranted. Routine handoffs proceed directly to their assigned recipient. Main receives only stage transitions, blocker/decision requests and final status: run/assignment ID, status, artifact/evidence and resource references, and next owner/action. Keep command output and detailed finding bodies in artifacts; batch related transitions where practical. Main retrieves detail only to answer the prompter, settle an exception or consolidate the run. Avoid repeated unchanged polling; keep unavoidable runtime completion messages compact too.

**Exit:** assigned work has completion reports, scoped checks, known limitations, and no uncoordinated contract changes.

For each successful implementation/fix boundary, use `complete` to finish its resource record and derive its seven-section handoff once. The authorized worker or named recorder persists the completion payload; send the resulting reference to the next assigned agent. Preserve failed/interrupted attempts with ordinary recording commands.

## 4. Integrate

The main agent remains accountable for integration and assigns one executor for inspection, wiring and verification: a focused [integrator](agents/INTEGRATOR.md) for substantial assembly, otherwise a named implementer. Record the choice in the assignment and use fresh focused context for a separate integrator when supported. Main handles contract decisions, ownership changes and escalations, and consumes the result without mirroring the executor's tool sequence. Main implements or executes integration only under the intervention rule below.

Use the existing handoff format for a compact packet containing contracts and acceptance IDs, settled worker completions, changed paths/owners, permitted wiring edits, current check/evidence IDs and environment state, remaining issues, escalation conditions and a stop criterion. Link authoritative detail rather than passing full history. Wait for relevant writers; in a shared directory inspect assembled work, or bring worktree changes together first. Check interfaces, configuration, migrations, security assumptions and the combined diff, then run the available build and relevant integration checks.

Snapshot settled files at verification boundaries, following [evidence efficiency and retention](scripts/README.md#7-evidence-efficiency-and-retention). Use explicit source scopes, relevant untracked files and command evidence. Reuse a fresh snapshot when selected content is unchanged; worker completion or user resumption alone does not require another snapshot. After fixes, retain prior failures and explicitly supersede stale evidence.

Use `verify --changed` with all affected source/dependency paths to select declared checks, inspect selection when needed, and reuse current scoped evidence. Batch explicit checks in one `verify --check ID --check ID` invocation so prerequisites run/reuse once. Force checks once after a relevant external database/server/browser state change and record why; separate forced invocations repeat shared prerequisites. A missing scope or test mapping remains an independent-review concern; hashing cannot establish unchanged external state.

The assigned executor fixes permitted wiring issues and records them. Route substantive defects or unfinished implementation directly to the preassigned owner within unchanged scope; escalate unavailable owners or required reassignment to main before further edits. Treat substantive work as implementation/fix, separately from integration. Wait for all implementation, test and integration writers to finish before creating a stable review state. Record a commit, or base commit plus diff/content hashes and relevant untracked-file hashes, so evidence identifies the actual reviewed content. Do not commit solely to satisfy this step without task authorization.

Return one compact integration result with edits, source identity, checks, blockers/owners and resources. The main agent repeats checks only for an identified evidence gap or changed state. Evaluate combined main/integrator tokens and elapsed time from settled workers to review readiness, including setup, escalation and duplicate checks; lower main-agent usage alone does not establish a saving.

**Exit:** integration checks pass, or an explicit environment limitation and alternative evidence are recorded. An unavailable critical check remains a blocker to claiming verified completion.

## 5. Independently review

Provide the [reviewer](agents/REVIEWER.md) the requirements, integrated state, relevant design/security decisions, changed files, and commands/results. The reviewer inspects sources and derives checks independently. Return one batch of actionable findings with stable IDs, severity, requirements, observed/expected behavior, reproduction, and evidence. Surface urgent security or integration blockers immediately.

Start this implementation review only after all assigned implementation/testing and integration are settled. The reviewer registers findings and partitions each review batch by assigned fix owner. Send each owner only its findings, affected acceptance cases and necessary shared context; link the canonical batch instead of broadcasting it or relaying it through main. Send main counts/status and references, not all finding bodies. For cross-owner defects, use the lead owner and dependencies established at dispatch; escalate an absent owner or conflicting contract rather than choosing new ownership. Urgent blockers go immediately to the affected owner and main; pause dependent work while independent work may continue.

**Exit:** every in-scope acceptance criterion has evidence or an explicit gap; findings have owners and dispositions. Agent review does not replace required teammate approval.

## 6. Fix, document, and revalidate

The independent reviewer sends owner-specific fix batches directly under the dispatch plan. Owners acknowledge receipt, record fix attempts, and return one completion/evidence batch to the reviewer (through the assigned integration executor when assembly is needed). Main handles only exceptions such as ownership/contract changes. Assign documentation, traceability and evidence work explicitly within disjoint write sets; mark unverified results provisional.

Integrate fixes before revalidation. The same independent reviewer checks finding closure, changed code, and affected regressions. Broaden checks for shared authorization, lifecycle, contracts, persistence, or other cross-cutting changes; report new defects even when they were absent from the initial batch. Revisit security review for changes to trust boundaries, access controls, AI context, external calls, persistence, or security contracts.

Supply the fix diff, stable finding IDs, affected acceptance criteria and new check results. Preserve the initial acceptance matrix and reuse unaffected evidence only when its selected source hashes and relevant contracts remain valid. Run focused regressions first; rerun broader checks when affected dependencies or unresolved concerns justify them. Documentation-only changes still need conformance review but do not alone require application test reruns. Reviewers independently inspect fixes; owner summaries are navigation aids, not closure evidence.

Plan application, requirement/contract and documentation snapshots separately, including all dependencies relevant to each check. A prose-only change must not invalidate unrelated application evidence; a changed requirement or contract still requires impact review. Record administrative evidence work under `document`/`close`, not as a code fix. For identical selected content with refreshed checks, use `completion-refresh`; actual changed content requires implementation/fix and independent revalidation. Close one reviewer's findings using `finding close-batch` after all closures preflight successfully; a rejected batch leaves every finding unchanged. Retain single-finding updates for deliberate individual transitions and explicit reopening.

After two unsuccessful fix/review cycles, reassess the root cause and approach before another cycle. Ask the prompter with a recommendation if a material decision remains unresolved. Pause dependent work for permission expansion or insufficient verification resources; follow existing authorization rather than repeatedly requesting it.

The reviewer independently reports each batch as closed, partially resolved or blocked, with stable finding IDs, current state and revalidation evidence. Use canonical supported statuses for individual findings; an owner's claim of a fix does not close it. Send owners their remaining findings and main only the batch status, unresolved blocker/decision requests and evidence/resource references.

### Main-agent intervention

Intervene for concrete security/safety concerns, incompatible contracts, ownership gaps, unavailable agents, invalid/stale evidence, failed dispatch/handoff, or a fix loop that needs reassessment. Before intervening, record the triggering evidence, why direct owner resolution is insufficient, bounded action/owner, and expected exit criterion; urgent containment may be recorded immediately after acting. Product edits by main are exceptional: record why reassignment is inadequate, register the permitted ownership and resource interval before editing, and retain independent review of main's changes. Existing ownership cannot be silently overwritten; use a coordinated assignment/run plan supported by the harness. Record the outcome and return execution to assigned agents. Monitoring and prompter status responses alone do not justify taking over implementation.

**Exit:** findings are closed with evidence or explicitly reported unresolved; relevant regression checks pass and documentation matches the reviewed state. Unresolved blockers prevent a completion claim.

## 7. Close

Main uses [consolidate-multi-agent-run](../../.agents/skills/consolidate-multi-agent-run/SKILL.md) to finalize one authoritative narrative and [resource record](RESOURCES.md), including every main/subagent stage and attempt, interventions and rejected/failed/interrupted work. Use canonical records and focused evidence retrieval rather than loading full agent conversations. Reconcile changed requirements, guides, and traceability as applicable. Report delivered behavior, validation, limitations, and remaining decisions. Product deployment and release checks are invoked only when the task reaches that boundary, using the product-spec requirements and existing authorization.

Run the CLI's completeness check and address missing declared records, unresolved blockers, stale current evidence, and independent-review gaps. Coverage warnings identify unavailable telemetry; structural success does not establish semantic correctness or replace human approvals. Keep the prompter-named Markdown session log alongside the structured run artifacts.

Produce one final evidence index and resource summary referencing canonical records. Follow the retention policy before any compaction; preserve requests, findings, failed/interrupted attempts and final review/test provenance. Distinguish validated active runs from historical closed-run archives. Evaluate useful outcomes and resource limitations using [resource guidance](RESOURCES.md#evaluation), not artifact counts or token consumption as success measures.

Generate the final view using `report --format bundle`: its JSON consistency result and Markdown share one validation of canonical state. This incorporates `completeness`; run the standalone command only when a separate earlier checkpoint is needed. Link the result from the prompter-named log; retain independent review and unresolved semantic gaps explicitly. Repeating an unchanged finalization request should reuse existing boundary IDs, not create new fix/review cycles.

The generated bundle is the structural evidence view; the consolidation skill supplies the evidence-backed narrative, not a second competing run report. Record consolidation under its own main-agent interval and identify its cutoff separately from implementation. Per-step MP4 sessions baselines/deltas and missing telemetry follow [resource guidance](RESOURCES.md#measurements); completeness cannot discover omitted agents or authenticate resource attribution. This policy does not add automated agent messaging, wakeups, routing enforcement or token capture to the CLI.

**Exit:** the final report and evidence refer to the same implementation state, and any incomplete work is explicit.

## Changelog

For each future workflow specification revision, append a dated entry here linking its prompter-named change log and relevant section. Record the concrete behavior changed and validation in that log; retain previous entries. Changes to linked policy, role, handoff or template documents belong to the same revision entry when part of one request.

| Date | Revision | Corresponding change log |
| --- | --- | --- |
| 2026-10-25 | Efficiency revision: conditional decomposition/preflight, concise context, snapshot/evidence reuse and retention, focused revalidation, task-proportionate effort with Astra by exception, honest timing and tooling capability boundaries. | [Changes and validation](../../logs/ngkhengyang/2026-10-25-reviewer-intake.md#workflow-improvements-made) |
| 2026-10-26 | Version 3 tooling: canonical completion and generated reports, executable acceptance/race matrices and dispatch gates, dependency-aware verification with environment/fixture prerequisites and checkout-wide resource leases; short command writer locks and current requirement-ID discovery. | [Changes and validation](../../logs/ngkhengyang/2026-10-26-reviewer-workflow-v3.md) |
| 2026-10-26 | Focused integration execution, operation-local validation reuse and bundled reports, scoped evidence refresh and atomic finding closure. | [Changes and validation](../../logs/ngkhengyang/2026-10-26-workflow-efficiency.md) |
| 2026-11-04 | Main monitors after settled dispatch; optional test/integration agents, direct owner-scoped review/fix batches, recorded exceptional intervention and skill-based consolidation with per-stage MP4 sessions telemetry. Procedural change; existing version 3 CLI/schema retained. | [Changes and validation](../../logs/ngkhengyang/2026-11-04-reviewer-monitor.md) |
