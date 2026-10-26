# Reviewer workflow context

## Applicability and authority

This directory defines the agent roles and multi-agent implementation workflow for Reviewer functionality only, regardless of implementer. Use the [scope boundary](IMPLEMENTATION.md#scope) to decide which part of a task is covered. Standalone shared AI infrastructure work does not trigger this workflow by owner identity; supporting changes directly required by Reviewer behavior are included.

The [product specification](../specs/PRODUCT-SPEC.md) remains authoritative for product requirements. For covered implementation work, requirements interpretation and architecture are combined in the main agent, which remains accountable for integration and may delegate its execution to a focused integrator. The same independent reviewer may revalidate fixes. Other functionalities retain their applicable process. For mixed-functionality tasks, apply this procedure to the Reviewer portion and coordinate shared interfaces.

Shared invariants, resource measurements, and prompt logging in the root [context file](../../AGENTS.md) remain repository-wide. Detailed agent responsibilities and execution rules introduced for Reviewer work are defined only in this directory.

## Read by assignment

| Assignment within Reviewer functionality | Required guidance |
| --- | --- |
| Coordinate implementation of a task/feature | [Implementation workflow](IMPLEMENTATION.md), then [main agent](agents/MAIN.md) |
| Review architecture/security or a changed trust boundary | [Security reviewer](agents/SECURITY-REVIEWER.md) |
| Implement a bounded assignment or fix | [Implementer](agents/IMPLEMENTER.md) |
| Execute delegated integration | [Integrator](agents/INTEGRATOR.md) |
| Independently review or revalidate fixes | [Reviewer](agents/REVIEWER.md) |
| Record briefs, assignments, or findings | Relevant section of [run template](templates/RUN.md) |
| Create assignment, completion, review, or fix handoff documents | [Handoff procedure](skills/reviewer-role-agent-handoff.md) and its linked template |
| Choose subagent models/effort or evaluate the harness | [Resource and harness guidance](RESOURCES.md) |
| Record stages, collect evidence, generate handoffs, or check run consistency | [Reviewer automation CLI](scripts/README.md) |
| Start a new run, compile acceptance cases, dispatch ready work, verify or complete assignments | [Version 3 run procedure](scripts/V3.md) |

Load only the guidance needed for the current assignment and its linked requirement sections. Prompter-named logs are historical evidence, not an alternative source of workflow instructions.

Workflow revisions are tracked in the implementation specification's final [changelog](IMPLEMENTATION.md#changelog), with links to the corresponding change logs. Current model/effort selection and the Astra exception are defined only in [resource guidance](RESOURCES.md#dispatch-policy).

## Skills

| Skill | Scope and invocation |
| --- | --- |
| [prepare-change-brief](../../.agents/skills/prepare-change-brief/SKILL.md) | Reviewer workflow only; automatic or explicit; [procedure](skills/prepare-change-brief.md) |
| [reviewer-role-agent-handoff](../../.agents/skills/reviewer-role-agent-handoff/SKILL.md) | Reviewer workflow only; automatic or explicit; [procedure](skills/reviewer-role-agent-handoff.md) |

The discovery entries in `.agents/skills/` are pointers; substantive instructions and the handoff format remain in this directory. Repository-wide skills are routed from root AGENTS.md. Use specification/security review capabilities inside this workflow while retaining its ownership, independence, and finding-disposition rules.
