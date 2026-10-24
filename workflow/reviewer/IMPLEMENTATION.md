# Implementation workflow

Enter through the [Reviewer workflow context](README.md) for task routing and its relationship to the pre-existing product-spec workflow.

## Scope

This procedure applies only to Reviewer functionality (REQ-REV-001 through REQ-REV-006), regardless of the implementer. It covers the review queue, evidence mapping, Patch Risk Assistant, findings, decisions, stale reviews, and supporting changes directly required by those behaviors. Standalone shared infrastructure work is outside this trigger even when assigned to the same person. For mixed-functionality tasks, apply this procedure to the Reviewer portion and coordinate shared interfaces. Shared invariants, resource recording, and prompt logging remain repository-wide.

## Trigger and roles

Use this workflow by default when implementing a task or feature against existing requirements. Requirements discovery for a new product and standalone research/documentation tasks are separate work. Small implementation tasks may use one implementer when decomposition adds more overhead than value; retain proportionate security and independent verification.

The main agent owns the brief, design, contracts, split, model/effort selection, integration, evidence, and final report. Security and implementation reviewers are independent of the code they assess. The same implementation reviewer may revalidate fixes. Human teammate review required by the product spec remains a separate release/PR responsibility.

Use [run sections](templates/RUN.md) as needed in `logs/<name>/<log_name.md>` (use the prompting person's name); a run ID is a date plus short task name. Link source requirements with a commit or recorded document state. Keep one coordinator-owned run record; workers return summaries for incorporation rather than concurrently editing it.

## 1. Compile requirements and design

Read [main-agent guidance](agents/MAIN.md). Extract existing requirement IDs, acceptance criteria, edge/failure cases, exclusions, and relevant decisions. Inspect the current architecture and identify components to add or modify. Describe contracts, dependencies, data flow, trust boundaries, and tentative ownership.

Use [prepare-change-brief](skills/prepare-change-brief.md) for the repeatable brief procedure. It does not itself start implementation.

Resolve questions using requirements, decisions, and code. Code provides implementation evidence, not authority to contradict requirements. For a material unresolved ambiguity, ask the prompter with a recommendation, implications, and alternatives. Aim to resolve these before implementation; pause only dependent work if a question emerges later.

**Exit:** the implementation brief accounts for all requested behavior, identifies its sources, and has no unresolved ambiguity blocking the proposed work.

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

Announce workers, scope, permitted files, shared-file owner, dependencies, model/effort with rationale, and expected checks. Proceed without a routine approval pause; keep the announcement visible for human intervention. Respect actual concurrency limits and dispatch ready work only.

Give each worker [implementer guidance](agents/IMPLEMENTER.md) and a focused assignment. Assign disjoint write sets, including tests, migrations, configuration, and generated files. Worktrees can isolate edits but do not resolve overlapping semantic ownership. Define cross-module contracts with names/signatures or schemas, errors, authorization, transaction/version semantics, and an owner where relevant.

At assignment, completion, review, and fix boundaries, use [reviewer-role-agent-handoff](skills/reviewer-role-agent-handoff.md) to create focused handoff documents with one writer per file. Link them from the run record; read-only subagents return content for the coordinator to persist.

Workers request contract changes through the main agent. Update affected assignments and obtain security re-review when warranted. Report urgent blockers immediately; batch routine completion evidence.

**Exit:** assigned work has completion reports, scoped checks, known limitations, and no uncoordinated contract changes.

## 4. Integrate

The main agent owns integration. In a shared directory, inspect the assembled work; with worktrees, bring the changes together first. Check interfaces, configuration, migrations, security assumptions, and the combined diff. Run the available build and relevant integration checks.

Fix small wiring issues directly and record them. Return substantive defects to the responsible worker. Wait for writers to finish before creating a stable review state. Record a commit, or base commit plus diff/content hashes and relevant untracked-file hashes, so evidence identifies the actual reviewed content. Do not commit solely to satisfy this step without task authorization.

**Exit:** integration checks pass, or an explicit environment limitation and alternative evidence are recorded. An unavailable critical check remains a blocker to claiming verified completion.

## 5. Independently review

Provide the [reviewer](agents/REVIEWER.md) the requirements, integrated state, relevant design/security decisions, changed files, and commands/results. The reviewer inspects sources and derives checks independently. Return one batch of actionable findings with stable IDs, severity, requirements, observed/expected behavior, reproduction, and evidence. Surface urgent security or integration blockers immediately.

**Exit:** every in-scope acceptance criterion has evidence or an explicit gap; findings have owners and dispositions. Agent review does not replace required teammate approval.

## 6. Fix, document, and revalidate

The main agent batches fixes by original owner and updates assignments when ownership must change. While workers fix defects, prepare documentation, traceability, and evidence within a disjoint write set. Mark unverified results provisional.

Integrate fixes before revalidation. The same independent reviewer checks finding closure, changed code, and affected regressions. Broaden checks for shared authorization, lifecycle, contracts, persistence, or other cross-cutting changes; report new defects even when they were absent from the initial batch. Revisit security review for changes to trust boundaries, access controls, AI context, external calls, persistence, or security contracts.

After two unsuccessful fix/review cycles, reassess the root cause and approach before another cycle. Ask the prompter with a recommendation if a material decision remains unresolved. Pause dependent work for permission expansion or insufficient verification resources; follow existing authorization rather than repeatedly requesting it.

**Exit:** findings are closed with evidence or explicitly reported unresolved; relevant regression checks pass and documentation matches the reviewed state. Unresolved blockers prevent a completion claim.

## 7. Close

Finalize the run summary and [resource record](RESOURCES.md), including main-agent stages. Reconcile changed requirements, guides, and traceability as applicable. Report delivered behavior, validation, limitations, and remaining decisions. Product deployment and release checks are invoked only when the task reaches that boundary, using the product-spec requirements and existing authorization.

**Exit:** the final report and evidence refer to the same implementation state, and any incomplete work is explicit.
