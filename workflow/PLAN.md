# Delivery and implementation plan

As of 25 October 2026. Imported dates are targets, not completion evidence. Historical administrative completion is unverified in this review. Behavior belongs in [the specification set](specs/PRODUCT-SPEC.md).

## Team Allocation

| **Member** | **Primary role focus** | **Shared area coordinated** | **Planned contribution** |
| --- | --- | --- | --- |
| yooplo | Contributor | Authentication, sessions, role routing, CSRF, and account access controls | Contributor spec, interface, service, tests, and User Guide flows |
| ngkhengyang | Reviewer | AI Gateway, typed output, rate limits, evaluation harness, and AI observability | Reviewer spec, interface, service, tests, and AI evaluation |
| yu-sutong | Release Maintainer | PostgreSQL migrations, audit model, CI/CD, deployment, and release evidence | Maintainer spec, interface, service, tests, and release operations |

These focuses organize work and do not create exclusive ownership. The contributor to a feature owns its interface, service behavior, persistence integration, authorization tests, documentation, traceability, session summary, and reflection evidence. At least one teammate reviews every non-trivial change. Each member must complete the full feature set for their role and substantial team-level work; the assignment estimates individual workload at 1.5 times MP1. Record actual contributions rather than treating allocation as evidence. Team/role counts and assessment logistics are captured in [ASSIGNMENT-SPEC](specs/ASSIGNMENT-SPEC.md).

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
| MP4 brief previously supplied as text; five-page PDF checked 26 October 2026 | [ASSIGNMENT-SPEC](specs/ASSIGNMENT-SPEC.md) captures page-referenced constraints, academic integrity, restrictions, deliverables, deadlines, tentative grading and presentation/evaluation logistics; no prescribed Java stack |
| SoC LLM start guide | The implementation team must confirm current authentication, model, rate, token, and data-handling rules before the live integration is accepted |
| Existing team repository metadata | GitHub usernames ngkhengyang, yooplo, and yu-sutong; used only for planning ownership and organization invitations |

- The team must confirm the SoC LLM's current rate limits and approved model before replacing the initial configurable budgets.
- The team must review role ownership, Render as the deployment platform, and the proposed schedule before treating this plan as approved.
- The GitHub organization name must be submitted through Canvas by 23 October 2026 at 2:00 PM SGT even if the same team worked together previously.
- Confirm historical organization registration, Canvas ZIP-upload expectations, presentation sign-up/slot, and later peer-evaluation details; do not infer them from the PDF availability window. See [submission readiness](SUBMISSION.md).

**Product decision.** Build SpecSentry as a new, narrowly scoped software engineering web application in the GitHub organization CS3227-2610-MP4-SpecSentry. Keep every AI capability advisory, typed, rate limited, reviewable, and separate from state-changing endpoints. Prioritize three complete role workflows, explicit security evidence, measurable context and resource experiments, and a reproducible two-environment release over optional integrations.

## Work packages and dependencies

Statuses below distinguish implemented infrastructure from pending product behavior and release verification. Owners are existing coordination contacts, not evidence of completed feature assignments.

| Task | Scope | Dependencies | Coordination | Status / exit evidence |
| --- | --- | --- | --- | --- |
| TASK-001 | Resolve validation, identity, API and AI blocking decisions | None | Relevant role owners | Policy baseline approved 25 October; actual live provider verification remains pending |
| TASK-002 | TypeScript workspace, PostgreSQL, scoped sessions/audit, CI | Applicable TASK-001 decisions | Shared team | Partial: base server/client/shared workspaces, connectivity, local Compose, Docker/CI templates and setup docs initialized 25 October; source/build/browser/PostgreSQL checks recorded in base-source log. Sessions, CSRF, domain migrations and audit remain pending; Docker/remote CI unexecuted locally |
| TASK-003 | Contributor draft/submission/revisions | TASK-002 | yooplo | Increment 1 private create/list/detail locally implemented and independently acceptance-verified 27 October; [run evidence](../logs/yooplo/2026-10-27-contributor-increment-1-run.md). Editing/submission/revisions and deployed verification remain pending |
| TASK-004 | Pool, assignment, findings, coverage, decisions | TASK-003 and applicable decisions | ngkhengyang | Planned; normal/denial/race tests |
| TASK-005 | Bounded SoC gateway and three assistants | TASK-002; OPEN-001/002 | ngkhengyang with role owners | Schemas/budgets approved; live acceptance waits for key-specific OPEN-002 verification |
| TASK-006 | Candidate gates, publication, revocation notices | TASK-004 and approved release policies | yu-sutong | Planned; publication/revocation race evidence |
| TASK-007 | Security, browser, accessibility and performance verification | Applicable slices | Shared team with independent review | Planned; requirement-linked results |
| TASK-008 | Environments, guides, website and release evidence | TASK-007 and operational readiness | Shared team | Planned; verified dev/prod release |

Record actual commands, failures and outcomes rather than marking elapsed dates complete. Produce detailed task breakdown for each approved slice.

### Contributor Increment 1 dependency checkpoint — 27 October 2026

The initial foundation gate was resolved by two teammate agreements relayed by yooplo
to the [concrete proposal](../logs/yooplo/2026-10-27-contributor-foundation-proposal.md).
Increment 1 on `feature/contributor-private-drafts` reuses the pinned `0becf938` schema/
migration/service foundation and adds owner list, restricted successful-read audit and
create/list/detail UI. Review/notification storage is prerequisite support only; no later
Contributor/Reviewer/AI routes are imported. Independent security and acceptance results,
including remaining evidence gaps, are recorded in the
[run record](../logs/yooplo/2026-10-27-contributor-increment-1-run.md).
Independent acceptance revalidation passed 26 server/15 client unit, 22 PostgreSQL and
five Chromium tests, typecheck/lint/build and UTC/append-only checks. Security disposition
is recorded in the run log. No full role completion, deployed release or final teammate
patch approval is claimed. Increment 2 status follows below.

### Contributor Increment 2 — 28 October 2026

Own never-submitted DRAFT editing is implemented and independently verified on local
`feature/contributor-own-draft-editing`, based on unmerged Increment1 head
`bb485ff8ea555f3505195b449d13d7a7a3a166f9`. Increment1's branch is intact and final
teammate review remains pending. [Increment2 PR11](https://github.com/CS3227-2610-MP4-SpecSentry/CS3227-2610-MP4/pull/11)
targets `feature/contributor-private-drafts` while that foundation is unmerged. The subsequent
review-preparation request authorizes commit/push/PR publication, not merge or Increment3.

Reuse existing save DTO/PATCH route, root/session transaction checks, bounded versions,
working-content validation and atomic DRAFT_SAVED activity. Add accessible four-field
editing with retained input and explicit conflict/uncertain recovery; no new shared
schema/contracts introduced. Independent acceptance passed26server/43client unit,
28PostgreSQL and6Chromium tests plus typecheck/lint/build. Separate security checks
passed43client/17Contributor PostgreSQL and append-only/UTC assertions. Results and
INC2-VER-001 (one unreproduced existing App test failure, not claimed fixed) belong in
[the Increment2 log](../logs/yooplo/2026-10-28-contributor-increment-2.md).
No blocking finding in the tested slice; no deployed/teammate approval implied. Submission, deletion,
submitted editing, criteria management, responses, lifecycle/AI and Increment3 excluded.

### Contributor Increment 3 — local acceptance verified, 28 October 2026

Own never-submitted draft deletion is now authorized on
`feature/contributor-own-draft-deletion` from Increment2 head `1de749c`.
Fresh dependency checks show PR10/11 open and unmerged; any later Increment3 PR
targets Increment2's branch until its foundation merges. Yooplo explicitly reports
both affected teammates agreed to the [deletion brief](../logs/yooplo/2026-10-28-contributor-increment-3-brief.md).
This covers the narrow private cleanup/minimal tombstone design, not final patch approval.
One implementer supplied persistence/API/UI/tests. Independent acceptance passed27server/
55client unit,36PostgreSQL/four suites and7Chromium tests plus typecheck/lint/build;
both clean-five-migration and foundation-upgrade paths were exercised with UTC.
Final security probes/disposition and limitations belong in the
[current run](../logs/yooplo/2026-10-28-contributor-increment-3-run.md).
No deployment/teammate patch approval inferred. INC2-VER-001 cause remains unconfirmed.
Submission, withdrawal, criteria, review responses, AI and Increment4 remain excluded.
Subsequent review-preparation request authorized Increment3 commit/push; stacked
[PR12](https://github.com/CS3227-2610-MP4-SpecSentry/CS3227-2610-MP4/pull/12)
now targets Increment2's branch while unmerged. Final patch approval is pending;
merge and Increment4 remain excluded.

### Contributor Increment 4 — local acceptance verified, 28 October 2026

Subsequent explicit request authorizes private draft criteria management only on
`feature/contributor-draft-criteria`, based on unmerged Increment3 head `86dc8f2`.
PR10/11/12 remain open with final teammate patch approval pending; original branches
are preserved. Yooplo reports ngkhengyang agreed to explicit owner-asserted stable-key
semantics and chose to preserve nonempty persisted entries/current limits; zero/alloptional
draft saves remain valid. No new endpoint/schema/migration is planned.
Security design and independent test design completed. Implemented the existing PATCH
slice without DTO/schema/migration changes. Independent final acceptance passed30server/
71client units,38PostgreSQL/four suites,eightChromium cases and typecheck/lint/build.
Focus and incomplete-identity-read findings were fixed and independently revalidated.
Final security results/limits and exact manifest are in the
[brief, decisions and run](../logs/yooplo/2026-10-28-contributor-increment-4.md).
Only never-submitted portions of REQ-CON-007/009 covered; submitted history/findings,
deployment/full manual WCAG/performance deferred. INC2-VER-001 remains unresolved.
Subsequent review-preparation request authorized Increment4 commit/push; stacked
[PR13](https://github.com/CS3227-2610-MP4-SpecSentry/CS3227-2610-MP4/pull/13)
now targets Increment3's branch while unmerged. Final teammate approval remains pending;
merge and Increment5 remain excluded.
Earlier Increment3 exclusions describe that slice.

### Contributor Increment 5 — local acceptance verified, 30 October 2026

Verified PR10–13 merged into master; teammate review completion is reported by yooplo.
Fetched origin and created `feature/contributor-submission-preparation` from current
origin/master `c384d39`, preserving earlier branches and the initially clean tree.
Scope is draft-only Contributor summary, unified diff and optional plain-text evidence,
using existing PATCH/DTO/validation/persistence/audit/recovery. Security design and
independent test design found no blocker. Implemented editor/detail and four test files;
independent final acceptance passed31server/84client units,43PG/four suites,nineChromium,
typecheck/lint/build on final five-file manifest. Separate security disposition is in the run.
No actual submission/revisions/lifecycle/notifications/AI or new endpoint/schema/migration.
Subsequent review-preparation request authorized commit/push; [PR15](https://github.com/CS3227-2610-MP4-SpecSentry/CS3227-2610-MP4/pull/15)
now targets master. Final Increment5 teammate approval remains pending; merge and Increment6
remain excluded. Inherited INC2-VER-001 remains unresolved.
[Current brief and evidence](../logs/yooplo/2026-10-30-contributor-increment-5.md).
