# Submission readiness

Assignment source: [page-referenced MP4 requirements](specs/ASSIGNMENT-SPEC.md), checked against the five-page PDF supplied on 26 October 2026.
Deadline: **13 November 2026, 14:00 Asia/Singapore**. Grading uses the latest
`master`; do not modify the submission after handover. This checklist is not a
completion certificate. Run `npm run check:submission` for local artifact presence.

| Deliverable / requirement | Location | Current evidence / remaining action |
| --- | --- | --- |
| Public team repository named CS3227-2610-MP4 | Git origin / GitHub | Origin has the required name; public accessibility and membership not verified |
| All production source | src/ | Infrastructure/module scaffold and static product website only |
| Agentic SE workflow | workflow/ | Generic process, Reviewer instructions and tooling exist; Contributor setup is on its separate branch; link actual executed runs for final grading |
| Accurate User Guide | docs/UserGuide.md | Current scaffold documented; deployed URL, role accounts and walkthroughs pending |
| Developer Guide and acknowledgements | docs/DeveloperGuide.md | Setup/design/process index present; keep synchronized with each release |
| GitHub Pages product website | src/website/, .github/workflows/pages.yml | Source/workflow initialized; enable Pages using GitHub Actions and verify live deployment |
| Reflections with experiments/results | docs/Reflections.md, workflow/evaluations/ | Structure initialized; measured comparisons and analysis pending |
| Prompt and interaction summary logs | logs/ | Per-prompter summaries; humans must verify accuracy and coverage |
| One role and AI feature per member | workflow/specs/PRODUCT-SPEC.md, PLAN.md | Three roles defined; product implementation and acceptance pending |
| Spec-driven development | workflow/specs/, TRACEABILITY.md | Baseline exists; link actual tests and release evidence as implemented |
| Coordinated specialized agents | workflow/reviewer/, DEVELOPMENT.md | Final evidence must show triggering, context/resource sharing, handoffs, verification, conflicts, idle/blocked work and retry overhead; toolkit use does not replace team-managed agents |
| AI and development-process security | AI-SECURITY-SPEC.md, evaluations/, CI | Planned controls and scaffold checks; explicit AI/adversarial/authorization test evidence pending |
| Context/resource engineering | RESOURCES.md, logs/, evaluations/, Reflections.md | Recording rules/template initialized; actual controlled comparisons pending |
| Online app with separated dev/prod | render.yaml, docs/Deployment.md | Topology template only; provision and verify separate team-managed environments |
| SoC LLM only; quotas and guardrails | workflow/specs/AI-SECURITY-SPEC.md | No live integration or provider compatibility claimed |
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
