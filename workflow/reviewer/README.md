# Reviewer workflow context

## Applicability and authority

This directory defines the agent roles and multi-agent implementation workflow for Reviewer functionality only, regardless of implementer. Use the [scope boundary](IMPLEMENTATION.md#scope) to decide which part of a task is covered. Standalone shared AI infrastructure work does not trigger this workflow by owner identity; supporting changes directly required by Reviewer behavior are included.

The [product specification](../specs/PRODUCT-SPEC.md) remains authoritative for product requirements. For covered implementation work, the execution procedure here specializes its pre-existing generic agent workflow: requirements interpretation and architecture are combined in the main agent, integration belongs to that agent, and the same independent reviewer may revalidate fixes. Other functionalities retain their applicable process. For mixed-functionality tasks, apply this procedure to the Reviewer portion and coordinate shared interfaces.

Shared invariants, resource measurements, and prompt logging in the root [context file](../../AGENTS.md) remain repository-wide. Detailed agent responsibilities and execution rules introduced for Reviewer work are defined only in this directory.

## Read by assignment

| Assignment within Reviewer functionality | Required guidance |
| --- | --- |
| Coordinate implementation of a task/feature | [Implementation workflow](IMPLEMENTATION.md), then [main agent](agents/MAIN.md) |
| Review architecture/security or a changed trust boundary | [Security reviewer](agents/SECURITY-REVIEWER.md) |
| Implement a bounded assignment or fix | [Implementer](agents/IMPLEMENTER.md) |
| Independently review or revalidate fixes | [Reviewer](agents/REVIEWER.md) |
| Record briefs, assignments, findings, or handoffs | Relevant section of [run template](templates/RUN.md) |
| Choose subagent models/effort or evaluate the harness | [Resource and harness guidance](RESOURCES.md) |

Load only the guidance needed for the current assignment and its linked requirement sections. Prompter-named logs are historical evidence, not an alternative source of workflow instructions.
