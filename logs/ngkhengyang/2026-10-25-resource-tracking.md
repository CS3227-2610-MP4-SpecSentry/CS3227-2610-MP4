# Repository change resource tracking

Prompter: ngkhengyang, explicit identity established in this conversation. Date: 25 October 2026, Asia/Singapore.

## Request and diagnosis

Ensure time and token tracking accompanies repository changes. Inspected the existing root instructions, logging skill, shared measurement policy and recent local change logs. Authentication/RBAC planning had no captured start or end; earlier source initialization also recorded retrospective gaps. The executable recorder was scoped to Reviewer runs while the shared policy relied on agents remembering to write a resource table at the end. Existing local logs supplied sufficient evidence; no other chat was opened or messaged.

## Changes

- Added workflow/tooling/resource-session.py, a shared standard-library measurement CLI independent of all multi-agent execution workflows. It records real start/end timestamps per interval, selected versus observed settings, attributable usage, and explicit unavailable reasons in logs/<name>/resources/<session>/<id>.json.
- Added workflow/tooling/RESOURCE-SESSION.md and six isolated temporary-directory tests. Counters reject negative/boolean values and wrong attribution; cache remains within input. Finished intervals cannot be overwritten; conflicting writers fail; output paths reject traversal and link/junction redirects.
- Changed AGENTS.md, workflow/RESOURCES.md, .agents/skills/log-change-session/SKILL.md and workflow/templates/PROMPT-LOG.md to start before the first edit, measure each participating agent-stage/attempt, finish after validation, report before responding, and use a real timestamp fallback if execution is blocked.
- Existing Reviewer-specific scripts remain scoped and unchanged. Their records may be linked instead of counted twice. Shared timing/usage recording is the previously agreed repository-wide exception; no additional skills, agents, or orchestration process were introduced.

## Validation and limitations

- Ran bundled Python with `-B -m unittest discover -s workflow/tooling -p test_resource_session.py -v`: six tests passed, final run 0.369 seconds.
- `git diff --check` passed with a command-local safe.directory override because the sandbox user differs from the checkout owner. No global Git configuration was changed.
- `python` was absent from PATH and the separate Python311 executable was denied by the sandbox. The available bundled runtime successfully recorded this session; documentation explains using an absolute available executable.
- This task bootstrapped the new recorder before starting its measured interval. Intake/bootstrap started before the measured boundary; the first actual clock checkpoint was 2026-10-25 13:14:42 +08:00. The recorded interval starts 13:16:22 +08:00. No full-turn duration is inferred from those checkpoints.
- Token/model execution metadata are not exposed as attributable counters in this session, so token counts and exact observed model/effort remain unavailable. Timing is measured despite those missing counters. Earlier logs are preserved; missing historical telemetry is not fabricated.
- No script can ensure calls occur for completely undeclared work. Required instruction boundaries now make omitted recording an explicit process failure; reports detect registered-but-unfinished intervals. This change does not install automatic runtime hooks or claim full hidden telemetry access.

## Resource evidence

Session: 2026-10-25-resource-tracking. Main agent, invocation tracking-fix, implementation/validation interval. No subagents used. Structured record and completed duration are linked below after finishing validation; final report rendering/response is outside the finished boundary.


| Agent / stage / attempt | Model / effort | Start / end (UTC) | Elapsed seconds | Input / output tokens | Status |
| --- | --- | --- | --- | --- | --- |
| main / implement / 1 | unavailable / unavailable | 2026\-10\-25T05:16:22.081202\+00:00 / 2026\-10\-25T05:18:43.415218\+00:00 | 141.334016 | unavailable / unavailable | succeeded |

Measured interval: 141.334016 seconds (2 minutes 21.33 seconds), excluding bootstrap and final rendering. All token/cache/tool/retry metrics unavailable with explicit reasons. [Structured record](resources/2026-10-25-resource-tracking/f4356f8d98c44843afd90fd3dc58053b.json).
