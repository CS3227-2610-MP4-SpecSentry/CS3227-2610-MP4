# Submission readiness

Assignment source: [page-referenced MP4 requirements](specs/ASSIGNMENT-SPEC.md), checked against the five-page PDF supplied on 26 October 2026.
Deadline: **13 November 2026, 14:00 Asia/Singapore**. Grading uses the latest
`master`; do not modify the submission after handover. This checklist is not a
completion certificate. Run `npm run check:submission` for local artifact presence.

| Deliverable / requirement | Location | Current evidence / remaining action |
| --- | --- | --- |
| Public team repository named CS3227-2610-MP4 | Git origin / GitHub | Required public organization repository verified; confirm final membership before submission |
| All production source | src/ | Implemented client, server, shared contracts and static product website |
| Agentic SE workflow | workflow/ | Generic process, Reviewer instructions and tooling exist; Contributor setup is on its separate branch; link actual executed runs for final grading |
| Accurate User Guide | docs/UserGuide.md | Production URL and release evidence plus verified development URL and six synthetic role accounts published; final human walkthrough remains |
| Developer Guide and acknowledgements | docs/DeveloperGuide.md | Setup/design/process index present; keep synchronized with each release |
| GitHub Pages product website | src/website/, .github/workflows/pages.yml | Live at https://cs3227-2610-mp4-specsentry.github.io/CS3227-2610-MP4/; refreshed release copy awaits this PR merge |
| Reflections with experiments/results | docs/Reflections.md, workflow/evaluations/ | Structure initialized; measured comparisons and analysis pending |
| Prompt and interaction summary logs | logs/ | Per-prompter summaries; humans must verify accuracy and coverage |
| One role and AI feature per member | workflow/specs/PRODUCT-SPEC.md, PLAN.md | All three role workflows and assistants implemented; representative live contract and deployed development acceptance passed; final human sign-off remains |
| Spec-driven development | workflow/specs/, TRACEABILITY.md | Baseline exists; link actual tests and release evidence as implemented |
| Coordinated specialized agents | workflow/reviewer/, DEVELOPMENT.md | Final evidence must show triggering, context/resource sharing, handoffs, verification, conflicts, idle/blocked work and retry overhead; toolkit use does not replace team-managed agents |
| AI and development-process security | AI-SECURITY-SPEC.md, evaluations/, CI | Strict schemas, bounded context, secret screening, authorization rechecks, safe accounting and adversarial tests implemented; broader live model/policy evaluation remains |
| Context/resource engineering | RESOURCES.md, logs/, evaluations/, Reflections.md | Recording rules/template initialized; actual controlled comparisons pending |
| Online app with separated dev/prod | `.github/workflows/application-release.yml`, deployment tooling/tests, render.yaml, docs/Deployment.md | Separate Render/Neon environments, same-digest promotion, protected approval, migrations and authenticated production smoke verified 8 November 2026 |
| SoC LLM only; quotas and guardrails | workflow/specs/AI-SECURITY-SPEC.md | NUS SoC key/alias configured server-side for synthetic development; representative all-role/live-development evidence passed, while production stays fail-closed pending quantitative key limits and retention/data-use review |
| No prior-MP reuse or integrated build-and-host deployment | DeveloperGuide.md, Deployment.md | New scaffold; preserve acknowledgements and separately team-managed build/deployment evidence |
| Substantial role/shared contribution per member | workflow/PLAN.md, logs/, Reflections.md | Allocation exists; attach actual contributions and review evidence |
| Organization registration | Canvas | Due 23 October 2026, 14:00 SGT; historical completion unverified, confirm with team |
| AI-use declaration and source acknowledgements | docs/DeveloperGuide.md, logs/ | AI assistance declared; each member verifies completeness, tools/uses and responsibility before submission |
| Complete interaction summaries | logs/ | Include advice/read-only interactions, edits, corrections and failed/interrupted work; human verification required |
| Canvas file-upload metadata | specs/ASSIGNMENT-SPEC.md | PDF lists ZIP upload but not its contents; confirm Canvas requirements; availability until 16 November is not a deadline extension |
| Individual presentation and peer evaluation | specs/ASSIGNMENT-SPEC.md, course announcements | Week 13 Tuesday/Wednesday presentations, sign-up at end of Week 11; confirm slot and later evaluation instructions |

Before submission, confirm public repo access, green CI, `master` containing the
intended final commit, reachable app/site URLs, safe peer-testing account access,
guide accuracy, completed acceptance/security checks, experiment analysis and
human-verified logs. Do not commit passwords or live provider keys.
