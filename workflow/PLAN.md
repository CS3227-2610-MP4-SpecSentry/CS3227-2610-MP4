# Delivery and implementation plan

As of 25 October 2026. Imported dates are targets, not completion evidence. Historical administrative completion is unverified in this review. Behavior belongs in [the specification set](specs/PRODUCT-SPEC.md).

## Team Allocation

| **Member** | **Primary role focus** | **Shared area coordinated** | **Planned contribution** |
| --- | --- | --- | --- |
| yooplo | Contributor | Authentication, sessions, role routing, CSRF, and account access controls | Contributor spec, interface, service, tests, and User Guide flows |
| ngkhengyang | Reviewer | AI Gateway, typed output, rate limits, evaluation harness, and AI observability | Reviewer spec, interface, service, tests, and AI evaluation |
| yu-sutong | Release Maintainer | PostgreSQL migrations, audit model, CI/CD, deployment, and release evidence | Maintainer spec, interface, service, tests, and release operations |

These focuses organize work and do not create exclusive ownership. The contributor to a feature owns its interface, service behavior, persistence integration, authorization tests, documentation, traceability, session summary, and reflection evidence. At least one teammate reviews every non-trivial change. Each member must also complete a substantial share of team-level work.

## Delivery Schedule

| **Date** | **Work** | **Exit evidence** |
| --- | --- | --- |
| 22 October | Approve product name, scope, roles, AI boundaries, organization name, and this specification | Team decision recorded |
| 23 October by 2 PM | Create public organization and repository, add all members, submit organization name through Canvas | Administrative deadline met |
| 23 to 25 October | Create specification baseline, threat model, traceability, agent definitions, clean NestJS and React TypeScript workspace, database skeleton, and CI | Specification and walking-skeleton gates approved |
| 26 to 28 October | Implement authentication, role routing, migrations, audit foundation, SoC LLM spike, and both empty deployment environments | Authenticated deployment and AI contract proof |
| 29 October to 2 November | Implement one complete vertical slice per role with mocked and live AI paths | All role flows work on development |
| 3 to 5 November | Integrate lifecycle, run authorization and AI adversarial tests, fix findings, and exercise failure paths | Security and integration gates approved |
| 6 to 8 November | Run context, coordination, caching, model-choice, and resource experiments; analyze results | Reflection evidence reviewed |
| 9 to 10 November | Complete product site, User Guide, Developer Guide, Reflections, logs, traceability, and acknowledgements | Documentation matches development release |
| 11 November | Feature freeze and production release candidate | Only verified defect fixes after freeze |
| 12 November | Independent smoke test, accessibility check, production deployment, backup and rollback rehearsal | Release candidate accepted with one-day buffer |
| 13 November by 2 PM | Confirm public access, master branch, deployed app, product site, required structure, and no post-submission changes | Final submission complete |

## Repository and Submission Structure

| **Path** | **Required content** |
| --- | --- |
| src | All production source code and resources |
| workflow/specs | Living product, role, technical, integration, and AI security specifications |
| workflow/contributor/agents and workflow/reviewer/agents | Scoped agent definitions, permissions, inputs, outputs, and stop rules; generic responsibilities in DEVELOPMENT.md |
| workflow/evaluations | AI evaluation cases, rubrics, scripts, results, and resource measurements |
| workflow/decisions | Architecture, security, context, and model-choice decision records |
| workflow/PLAN.md | Dependencies, ownership, status, estimates, and actual outcomes |
| workflow/TRACEABILITY.md | Requirement links to code, tests, guides, evidence, and reflections |
| docs/UserGuide.md | Accurate deployed features, role accounts, access URL, limitations, and test instructions |
| docs/DeveloperGuide.md | Architecture, design, security, workflow, testing, deployment, resource use, and acknowledgements |
| docs/Reflections.md | Concrete Multi-Agent SE, Context Engineering, and Resource-aware Use experiments and analysis |
| docs product website | GitHub Pages site with product summary, screenshots, guides, deployment link, and team |
| logs | Human-verified summaries of prompts, interactions, decisions, corrections, evidence, and token/resource notes |
| .github | Pull request template and CI, security, Pages, development deployment, and production promotion workflows |

## Project Risks

| **Risk** | **Exposure** | **Mitigation** |
| --- | --- | --- |
| SoC LLM quota or instability | High | Mockable gateway, configured budgets, rate limits, manual fallback, early live spike, and evidence from 429 and timeout tests |
| Scope exceeds three weeks | High | No repository integration, code execution, uploads, chat, or external tools; freeze the lifecycle and three AI assistants first |
| AI security evidence is superficial | High | Versioned adversarial cases, typed schemas, data-isolation tests, logs inspection, and a fresh Security Reviewer |
| Multi-agent work creates conflicts | Medium | Explicit write sets, isolated worktrees, small handoffs, one integrator, and measured coordination overhead |
| Documentation drifts from release | Medium | Requirement traceability, Spec and Docs Verifier, screenshots and smoke tests against the deployed candidate |
| Environment separation is incomplete | Medium | Create both services and databases in week one, separate secrets, and promote the same immutable digest |
| Prior MP material is reused accidentally | Medium | Clean repository, no copied source or docs, acknowledgement review, and file-origin check before release |

## Definition of Done

- The public GitHub organization contains a public repository named CS3227-2610-MP4 with the required src, workflow, docs, logs, website, and automation content, and master is the current submission branch.
- Each role has a complete deterministic workflow, one working SoC LLM assistant, clear authorization boundaries, and a usable manual path when the LLM fails.
- Every protected operation rechecks authentication, role, object scope, ownership or assignment, state, CSRF token, and record version on the server.
- AI suggestions use minimum context, typed output, input and output limits, no tools, safe rendering, rate limits, timeouts, audit metadata, and no automatic business action.
- Specifications are current, acceptance criteria are testable, requirement IDs trace to implementation and evidence, and material behavior changes update specs and tests together.
- Security evidence covers prompt injection, data isolation, IDOR, XSS, CSRF, malformed output, secret-bearing input, approval bypass, resource exhaustion, and failure handling.
- Development and production use separate services, data, configuration, and secrets. Production deployment requires human approval and promotes a tested immutable image digest.
- The User Guide matches production, the Developer Guide explains the released design and process, Reflections uses reviewed experiment evidence, and all reused ideas or dependencies are acknowledged.
- A teammate who did not implement each major feature has reviewed its specification, security impact, test evidence, documentation, and released behavior.

## Sources and Open Confirmations

| **Source** | **Use** |
| --- | --- |
| MP4 assignment brief supplied on 22 October and pasted again on 24 October 2026 | Product constraints, team size, role and AI requirements, security, SDD, Multi-Agent SE, environment separation, resource use, repository structure, deadlines, grading focus, simple UI, and prohibition on AI build-and-host environments; no Java-specific stack requirement |
| SoC LLM start guide | The implementation team must confirm current authentication, model, rate, token, and data-handling rules before the live integration is accepted |
| Existing team repository metadata | GitHub usernames ngkhengyang, yooplo, and yu-sutong; used only for planning ownership and organization invitations |

- The team must confirm the SoC LLM's current rate limits and approved model before replacing the initial configurable budgets.
- The team must review role ownership, Render as the deployment platform, and the proposed schedule before treating this plan as approved.
- The GitHub organization name must be submitted through Canvas by 23 October 2026 at 2:00 PM SGT even if the same team worked together previously.

**Product decision.** Build SpecSentry as a new, narrowly scoped software engineering web application in the GitHub organization CS3227-2610-MP4-SpecSentry. Keep every AI capability advisory, typed, rate limited, reviewable, and separate from state-changing endpoints. Prioritize three complete role workflows, explicit security evidence, measurable context and resource experiments, and a reproducible two-environment release over optional integrations.

## Work packages and dependencies

Statuses below distinguish implemented infrastructure from pending product behavior and release verification. Owners are existing coordination contacts, not evidence of completed feature assignments.

| Task | Scope | Dependencies | Coordination | Status / exit evidence |
| --- | --- | --- | --- | --- |
| TASK-001 | Resolve validation, identity, API and AI blocking decisions | None | Relevant role owners | Policy baseline approved 25 October; actual live provider verification remains pending |
| TASK-002 | TypeScript workspace, PostgreSQL, scoped sessions/audit, CI | Applicable TASK-001 decisions | Shared team | Partial: base server/client/shared workspaces, connectivity, local Compose, Docker/CI templates and setup docs initialized 25 October; source/build/browser/PostgreSQL checks recorded in base-source log. Sessions, CSRF, domain migrations and audit remain pending; Docker/remote CI unexecuted locally |
| TASK-003 | Contributor draft/submission/revisions | TASK-002 | yooplo | Product implementation planned; Contributor workflow instructions and run template established 26 October in [contributor/README.md](contributor/README.md); REQ-CON acceptance evidence remains pending |
| TASK-004 | Pool, assignment, findings, coverage, decisions | TASK-003 and applicable decisions | ngkhengyang | Planned; normal/denial/race tests |
| TASK-005 | Bounded SoC gateway and three assistants | TASK-002; OPEN-001/002 | ngkhengyang with role owners | Schemas/budgets approved; live acceptance waits for key-specific OPEN-002 verification |
| TASK-006 | Candidate gates, publication, revocation notices | TASK-004 and approved release policies | yu-sutong | Planned; publication/revocation race evidence |
| TASK-007 | Security, browser, accessibility and performance verification | Applicable slices | Shared team with independent review | Planned; requirement-linked results |
| TASK-008 | Environments, guides, website and release evidence | TASK-007 and operational readiness | Shared team | Planned; verified dev/prod release |

Record actual commands, failures and outcomes rather than marking elapsed dates complete. Produce detailed task breakdown for each approved slice.
