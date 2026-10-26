# Development and specification maintenance

Status: process baseline, not executed review evidence. Reviewer implementation follows the specialized [Reviewer workflow](reviewer/README.md). Root AGENTS.md remains the instruction entry point.

## Specification Driven Development

The repository specifications under workflow/specs are the source of truth. Stable identifiers connect product intent, acceptance criteria, architecture decisions, implementation tasks, tests, pull requests, guides, evaluation evidence, and reflections. A material behavior change is incomplete until the specification, tests, traceability record, and user-facing documentation agree.

The [assignment specification](specs/ASSIGNMENT-SPEC.md) captures course constraints separately from team product choices. Each member owns a complete role feature set plus substantial shared work. If an SDD toolkit is used, record the team's own agent coordination and how it complements or compares with the toolkit; toolkit output alone is insufficient. Keep UI and shared components simple, with clear responsibilities and reused common behavior.

| **Artifact** | **Purpose** |
| --- | --- |
| workflow/specs/PRODUCT-SPEC.md | Product index, actors, lifecycle, boundaries and glossary; requirement definitions in linked role/shared specifications |
| workflow/specs/ASSIGNMENT-SPEC.md | Page-referenced MP4 constraints, deliverables, academic integrity, reflection prompts and assessment logistics |
| workflow/specs/ROLE-CONTRIBUTOR.md | Contributor flows, permissions, AI feature, edge cases, and acceptance criteria |
| workflow/specs/ROLE-REVIEWER.md | Reviewer flows, finding rules, AI feature, stale review behavior, and acceptance criteria |
| workflow/specs/ROLE-MAINTAINER.md | Release gates, publication rules, AI feature, audit access, and acceptance criteria |
| workflow/specs/AI-SECURITY-SPEC.md | Threat model, context policy, schemas, approval gates, limits, adversarial cases, and retention |
| workflow/specs/TECHNICAL-SPEC.md | Architecture, stack, environments and observability; logical contracts in INTEGRATION-SPEC.md |
| workflow/PLAN.md | Sequenced tasks, dependencies, owners, estimates, status, and actual outcomes |
| workflow/TRACEABILITY.md | Requirement to test, code, documentation, release, and reflection evidence |
| workflow/decisions | Architecture and security decisions with alternatives, consequences, and reviewers |
| workflow/evaluations | Versioned AI usefulness, security, latency, and resource evaluation cases and results |

### Specification Change Flow

1. Specify. The Requirements Agent drafts a change with stable IDs, examples, edge cases, failure paths, and exclusions. The role owner and one teammate review it.
1. Plan. The Architect maps approved requirements to data, interfaces, dependencies, migrations, tests, and small tasks in workflow/PLAN.md.
1. Secure. The Security Reviewer checks authentication, authorization, prompt injection, context exposure, rate limits, output handling, and audit effects before implementation.
1. Implement. A role implementer changes only the approved scope, adds requirement-linked tests, and records material assumptions.
1. Verify. A fresh Test Verifier derives normal, boundary, failure, authorization, and adversarial tests from the specification. Failed tests are evidence and are not weakened to fit the code.
1. Review and integrate. A Spec and Docs Verifier compares behavior with the source specification and guides. A human teammate approves the pull request after traceability and logs are updated.

## Multi Agent Software Engineering Workflow

| **Agent** | **Responsibility** | **Required input** | **Handoff** | **Permission** |
| --- | --- | --- | --- | --- |
| Orchestrator | Break an approved goal into bounded work, select agents, track dependencies and budget, reconcile handoffs | Goal, approved specs, plan, budget | Updated plan, decisions, blockers | Workflow files only |
| Requirements Agent | Draft and refine requirements and acceptance criteria | Stakeholder text, existing specs | Spec diff, assumptions, open questions | workflow/specs only |
| Architect | Design module boundaries, data model, interfaces, migrations, and deployment | Approved specs, current code | Plan tasks and decision records | workflow planning files |
| Security Reviewer | Threat model proposed changes and derive abuse cases | Specs, diff, data flow | Findings, tests, risk decision | Read only |
| Role Implementer | Implement one approved vertical slice | Requirement IDs, interfaces, plan | Code, tests, implementation notes | Assigned code and tests |
| Test Verifier | Derive and run acceptance, authorization, integration, and adversarial tests | Specs, diff, previous failures | Evidence and defect report | Tests only unless asked |
| Spec and Docs Verifier | Compare behavior, guides, and traceability with the release | Specs, code, tests, guides | Mismatch report and documentation edits | Docs and traceability |
| Release Verifier | Check repository structure, CI, image provenance, environments, smoke tests, and submission evidence | Release candidate and logs | Release checklist and blockers | Read only by default |

### Coordination Rules

- Use an orchestrator and bounded specialists for work with clear dependencies. Use one agent for small local edits where coordination cost would exceed the benefit.
- Do not allow concurrent writers on the same files. Parallel agents use separate worktrees or non-overlapping ownership and declare their write sets before work starts.
- Every handoff names the goal, requirement IDs, spec version, context sources, assumptions, changed files, commands or tools used, test evidence, remaining risks, budget used, and next authorized action.
- After an implementer fixes a failed test or security finding, a fresh verifier reruns the relevant checks. The implementer may not self-certify the fix.
- When agents disagree, preserve both claims, identify the conflicting requirement or evidence, run the smallest discriminating test, and obtain a human decision if the specification remains ambiguous.
- Stop and ask for human input when a requirement is materially ambiguous, a permission would expand, a secret may be exposed, a production change is requested, or the remaining budget cannot support reliable verification.

## Context Engineering and Resource Aware Use

Each agent receives a task-specific context pack instead of the entire repository history. The orchestrator records what was supplied, what the agent retrieved, and why. Repository instructions, current specification sections, relevant interfaces, the smallest useful diff, and prior failure evidence take priority over broad logs or unrelated documentation.

| **Task** | **Context supplied first** | **Context retrieved only if needed** | **Recorded measures** |
| --- | --- | --- | --- |
| Requirements work | Assignment constraints, relevant role spec, glossary, open decisions | Production code, old logs, unrelated role details | Context size, number of unresolved assumptions, reviewer corrections |
| Implementation | Approved requirement IDs, interfaces, target files, tests, decisions | Whole repository dumps and completed historical plans | Input tokens, cache hit rate, files retrieved, first-pass test success |
| Security review | Threat model, data flow, auth rules, AI contract, diff | Marketing copy and unrelated UI files | Findings by severity, false positives, adversarial cases added |
| Verification | Acceptance criteria, changed files, exact commands, prior failures | Implementer reasoning transcript | Independent failures found, reruns, test runtime |
| Documentation | Released behavior, UI evidence, specs, traceability | Draft claims without test or release evidence | Mismatch count, corrections, verified sections |



### Required Experiments for Reflections

These controlled comparisons are team-selected verification commitments, not individually prescribed experiments in the assignment. The PDF's [sample reflection questions](specs/ASSIGNMENT-SPEC.md#reflection-discussion-guide) guide analysis. Cover both application AI and development-agent behavior, keep their accounting separate, and record actual per-member contributions. Include triggering/context/resource sharing, idle or blocked time, repeated analysis/retries, conflicts, and quality versus coordination cost. Report unavailable reasoning/cache telemetry without collecting hidden reasoning or fabricating savings.

| **Experiment** | **Method** | **Evidence** |
| --- | --- | --- |
| Context size | Run the same bounded task with a focused context pack and a broad repository context | Compare tokens, latency, defects, retrievals, and reviewer corrections |
| Single agent versus coordinated agents | Implement comparable low-risk and high-risk tasks with one agent and generator-verifier coordination | Compare wall time, tool calls, defects found, rework, and handoff overhead |
| Prompt template / skill version | Evaluate baseline and revised prompts/skill instructions on the same cases; include relevant system instructions and context layout | Compare schema validity, instruction following, injection resistance, usefulness, and token use |
| Cache and persisted summaries | Repeat a task with and without a stable context summary or reusable prefix | Compare cache reads, input tokens, repeated retrievals, and correctness |
| Model choice | Use a lower-cost model for bounded extraction and a stronger model for one complex review set | Compare cost proxy, latency, agreement, and human corrections |

## Maintenance gates

1. Specify observable success, rejection, privacy and failure outcomes with stable IDs. Put unresolved material behavior in specs/OPEN-DECISIONS.md. Gate affected work on resolution; independent approved slices may proceed.
2. Validate consistency and obtain role-owner plus teammate review for material behavior changes; record actual evidence without inventing sign-off.
3. Plan dependencies separately. Derive meaningful failing acceptance tests before implementation where practical for behavior/security changes; include boundary, denial and race cases appropriate to risk.
4. Implement bounded tasks and verify against requirements. Record actual commands/results and independent review evidence in traceability.
5. Reconcile implementation feedback into specifications and guides. Test failures do not authorize weakening agreed criteria. Current requirements belong in specs, history in logs, execution progress in PLAN.md.

Product AI budgets are authoritative in [AI security](specs/AI-SECURITY-SPEC.md). Resource telemetry follows [recording rules](RESOURCES.md).


## Verification levels

| Level | Scope | Required evidence |
| --- | --- | --- |
| Unit | Validation, lifecycle rules, quotas, redaction, schemas and deterministic gates | Rule branches and relevant failure paths |
| Repository | Owner/assignment/state/project-scoped queries | No out-of-scope row or field returned |
| Application integration | Sessions, CSRF, authorization, migration, versions and transactions | Critical flows plus denied alternatives and concurrency |
| AI contract | Valid/malformed/oversized/refusal/timeout/429/5xx responses | Deterministic mocked tests |
| Adversarial AI | Injection, secret input, leakage, fabricated identifiers and unsafe rendering | No unauthorized disclosure or business mutation |
| Browser | Login and complete role flows, revision/history notifications | Keyboard, validation and error recovery evidence |
| Performance | Agreed workload and bounded AI concurrency | Measured quality targets and safe degradation |
| Release | Clean migration, tested image, smoke/backup/rollback rehearsal | Recorded evidence before production |

Scenario obligations reside with each authoritative role/shared requirement; AI evaluation thresholds reside in specs/AI-SECURITY-SPEC.md. These are verification requirements, not results.
