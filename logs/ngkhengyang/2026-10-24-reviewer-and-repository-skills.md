# Reviewer and repository skills

Prompter: ngkhengyang. Date: 24 October 2026, Asia/Singapore.

## Context and requests

The conversation first identified potential repeatable procedures without creating them, then distinguished repository-level capabilities from the Reviewer multi-agent process. The explicit creation request selected exactly six skills and their scopes:

- Reviewer workflow only: `prepare-change-brief`, `reviewer-role-agent-handoff`.
- Repository-wide: `review-changes-to-specs`, `review-security`, `log-change-session`, `analyze-resource-use`.
- Add no other skills. Base handoff documents on the agreed focused context, ownership, evidence, resource, and next-action requirements; explain the finished format.

## Changes

- Created exactly six discovery entries under `.agents/skills/`. The four repository-wide procedures are defined there and apply across product roles without imposing a particular orchestration process.
- The two Reviewer discovery entries link to substantive instructions under `workflow/reviewer/skills/`, preserving the boundary that Reviewer workflow definitions live in its own directory.
- Automatic invocation remains available for five skills; `analyze-resource-use` is explicitly invoked, consistent with the earlier classification. Other skills also support explicit invocation.
- Added `workflow/reviewer/templates/HANDOFF.md` as the canonical seven-section handoff format: identity/goal, requirements/context, permissions/dependencies, state/changes, verification/findings, risks/next action, and resources.
- Handoffs default to `logs/<prompter-name>/handoffs/<run-id>/<sequence>-<from>-to-<to>.md`, supplementing rather than replacing session logs. Read-only agents return content for the authorized coordinator to persist; invocation grants no new permissions.
- Updated root context with shared skill pointers, and updated Reviewer routing, main-agent guidance, workflow boundaries, and run-template links. Replaced duplicated handoff fields in the run template with a pointer to the canonical format.
- Existing global skills and product requirements were not changed. No application implementation was performed.

## Validation

- Ran the bundled skill-creator `quick_validate.py` against all six skill folders: passed.
- Parsed the resource-analysis invocation policy and confirmed `allow_implicit_invocation: false`.
- Checked 66 local Markdown links/anchors, exact six-skill inventory, scope separation, and whitespace. Confirmed the product specification was unchanged.
- The Python validator initially lacked PyYAML. Installed PyYAML in an external temporary validation directory; no project dependency files were changed. The first sandboxed download failed DNS resolution; the approved network retry succeeded.
- Independently exercised the handoff skill using a synthetic read-only review fixture with missing fix evidence. Passed: returned all seven sections, preserved the read-only boundary, identified synthetic identifiers as unverified, retained F-002 as open, marked fix verification blocked, and specified the evidence needed next. No fixture document was saved into actual run evidence. This is one bounded behavioral exercise, not exhaustive validation.

## Resources and limitations

- Main agent model/effort, token/cache counts, total tool calls, and full-turn elapsed time are unavailable from exposed per-stage telemetry.
- Validation subagent: `handoff_forward_check`, selected `gpt-6.1-sol` / `low` for bounded instruction execution against a synthetic fixture. Observed execution metadata, token/cache usage, and exact invocation elapsed time are unavailable; selected settings are not claimed as observed.
- A timestamp was captured during work at 2026-10-24 19:46:09 +08:00; it is not the full-stage start. Command-duration outputs measure individual calls and cannot establish full task time or summed agent effort.
- Skill frontmatter/link checks establish structural validity, not proof of automatic discovery in an already-running session or future behavioral correctness. Review future real usage for trigger quality and omissions.
