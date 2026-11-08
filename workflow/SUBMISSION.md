# Submission readiness

Assignment source: [page-referenced MP4 requirements](specs/ASSIGNMENT-SPEC.md), checked against the five-page PDF supplied on 26 October 2026.
Deadline: **13 November 2026, 14:00 Asia/Singapore**. Grading uses the latest
`master`; do not modify the submission after handover. This checklist is not a
completion certificate. Run `npm run check:submission` for local artifact presence.

| Deliverable / requirement | Location | Current evidence / remaining action |
| --- | --- | --- |
| Public team repository named CS3227-2610-MP4 | Git origin / GitHub | Required public organization repository verified; confirm final membership before submission |
| All production source | src/ | Implemented client, server, shared contracts and static product website |
| Agentic SE workflow | workflow/, logs/, workflow/evaluations/ | Contributor, Reviewer, Maintainer and deployment workflows have executed evidence; Reflections analyzes two measured coordinated runs and their limitations |
| Accurate User Guide | docs/UserGuide.md | Production is the primary grader URL; the isolated development URL and the same six synthetic role accounts are also published; final human walkthrough remains |
| Developer Guide and acknowledgements | docs/DeveloperGuide.md | Setup/design/process index present; keep synchronized with each release |
| GitHub Pages product website | src/website/, .github/workflows/pages.yml | Refreshed release site is live at https://cs3227-2610-mp4-specsentry.github.io/CS3227-2610-MP4/ |
| Reflections with experiments/results | docs/Reflections.md, workflow/evaluations/ | Final evidence synthesis analyzes measured Maintainer/deployment observations, context design and resource controls; missing matched baselines and telemetry are stated rather than invented |
| Prompt and interaction summary logs | logs/ | Per-prompter summaries; humans must verify accuracy and coverage |
| One role and AI feature per member | workflow/specs/PRODUCT-SPEC.md, PLAN.md | All three role workflows and assistants implemented; representative live contract and deployed development acceptance passed; final human sign-off remains |
| Spec-driven development | workflow/specs/, TRACEABILITY.md | Baseline exists; link actual tests and release evidence as implemented |
| Coordinated specialized agents | workflow/reviewer/, DEVELOPMENT.md | Final evidence must show triggering, context/resource sharing, handoffs, verification, conflicts, idle/blocked work and retry overhead; toolkit use does not replace team-managed agents |
| AI and development-process security | AI-SECURITY-SPEC.md, evaluations/, CI | Strict schemas, bounded context, secret screening, authorization rechecks, safe accounting and adversarial tests implemented; broader live model/policy evaluation remains |
| Context/resource engineering | RESOURCES.md, logs/, evaluations/, Reflections.md | Role-specific context packs, current-tree verification, application quotas and measured development intervals are analyzed; no matched context-size/model/cache comparison was executed |
| Online app with separated dev/prod | `.github/workflows/application-release.yml`, deployment tooling/tests, render.yaml, docs/Deployment.md | Separate Render/Neon environments, same-digest promotion, protected approval, migrations and authenticated release smoke verified; fresh public production root/health/readiness returned `200` and signed-out session returned expected `401` on 8 November 2026 |
| SoC LLM only; quotas and guardrails | workflow/specs/AI-SECURITY-SPEC.md | NUS SoC key/alias configured server-side on both Render services; representative all-role/live-development evidence passed and owner-authorized production activation is recorded, while quantitative key limits and retention/data-use review remain open |
| No prior-MP reuse or integrated build-and-host deployment | DeveloperGuide.md, Deployment.md | New scaffold; preserve acknowledgements and separately team-managed build/deployment evidence |
| Substantial role/shared contribution per member | workflow/PLAN.md, logs/, Reflections.md | Role and shared-work evidence exists; each member must confirm the final account matches their actual contribution |
| Organization registration | Canvas | Due 23 October 2026, 14:00 SGT; historical completion unverified, confirm with team |
| AI-use declaration and source acknowledgements | docs/DeveloperGuide.md, logs/ | AI assistance declared; each member verifies completeness, tools/uses and responsibility before submission |
| Complete interaction summaries | logs/ | Include advice/read-only interactions, edits, corrections and failed/interrupted work; human verification required |
| Canvas file-upload metadata | specs/ASSIGNMENT-SPEC.md | PDF lists ZIP upload but not its contents; confirm Canvas requirements; availability until 16 November is not a deadline extension |
| Individual presentation and peer evaluation | specs/ASSIGNMENT-SPEC.md, course announcements | Week 13 Tuesday/Wednesday presentations, sign-up at end of Week 11; confirm slot and later evaluation instructions |

## Remaining human-only sign-off

These actions cannot be completed or inferred by an AI-authored documentation PR.
Record the person/date/evidence when each box is completed:

- [ ] `yooplo`, `ngkhengyang` and `yu-sutong` each verify their prompt/interaction
  summaries, AI-use declaration and actual role/shared-work contribution.
- [ ] Teammates perform a peer walkthrough of Contributor, Reviewer and Release
  Maintainer using the published production accounts, including one successful AI
  interaction per role; development remains available for isolated team testing.
- [ ] Confirm with the submitting teammate that the organization-name Canvas quiz
  was submitted; the repository cannot prove this historical administrative action.
- [ ] Open the current Canvas submission page and confirm the required ZIP contents
  and upload state. The brief permits a ZIP but does not define its contents.
- [ ] Confirm every member's individual presentation signup/slot and the latest
  peer-evaluation instructions from course announcements.
- [ ] Immediately before submission, confirm public repository access, green CI,
  intended `master`, reachable production/development/Page URLs and safe demo-account
  access; then freeze the repository after the 13 November 2026 14:00 SGT deadline.

Do not commit passwords or live provider keys. The public demo password is an
intentional synthetic testing credential; deployment, database and AI credentials
remain private.
