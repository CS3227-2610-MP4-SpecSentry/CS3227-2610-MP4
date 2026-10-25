# Codex GitHub PR review setup

## Context and requests

- Prompter: yooplo, inferred from `git config user.name`; no explicit session identity supplied.
- Date/timezone: 25 October 2026, Asia/Singapore (UTC+08:00).
- Request: set up a GitHub PR code review agent using Codex/ChatGPT for this repository.
- Initial steering: user reported the repository was missing from Codex code review settings. Activation was pending connection troubleshooting at that stage; subsequent confirmation is recorded below.
- Scope: developer tooling and repository guidance; separate from SpecSentry's planned in-app Reviewer and SoC gateway.
- Baseline: clean working tree on master at `f78b640`.

## Changes and evidence

- Added three repository-specific Code Review Rules to [AGENTS.md](../../AGENTS.md#code-review-rules), covering authorization, immutable revisions/audit transactions, and AI/secrets boundaries.
- Added native integration activation and verification instructions to [DeveloperGuide.md](../../docs/DeveloperGuide.md#github-pr-review-with-codex).
- Selected native Codex GitHub review; no custom Actions workflow, API secrets, dependencies, or application code added.
- Official source: [GitHub integration documentation](https://learn.chatgpt.com/docs/third-party/github), fetched during this session.
- GitHub connector metadata verified this repository is public, has master as default branch, and the connected account has admin/push permission. This does not establish Codex review activation.
- Accessible installation metadata listed the personal account and MP3 organization, with no SpecSentry organization entry. This supports checking installation scope; it is not proof of every installation in a separate Codex account/workspace.
- Asked the user to check the SpecSentry organization's installed GitHub Apps, grant the connector access to this repository, and then enable automatic review. Available tools cannot install the GitHub App or change Codex account review settings.
- Validation: `git diff --check` passed; inspected the final guidance diff and verified local Markdown target files exist using PowerShell `Test-Path`. No application changes.
- At initial handoff, pending: activation confirmation, publishing the local guidance, and a real PR review response. No commit, push, external comment, or remote configuration mutation performed by the agent.
- Application tests skipped: documentation/instructions only. No live review result or account usage telemetry is claimed.

## Subsequent activation confirmation

- User first confirmed the app was absent. Supplied the Codex Connector installation link and instructions to select the SpecSentry organization and this repository.
- User then supplied a screenshot of this repository's Installed GitHub Apps page showing ChatGPT Codex Connector. Installation for this repository is supported by that screenshot.
- After being directed to enable Automatic review for All PRs in Codex settings, the user replied "done". Record automatic review activation as user-confirmed; the agent cannot independently inspect that account setting.
- Remaining verification: a real PR review response. No live review was requested or observed by the agent. Local guidance remains uncommitted and unpublished as of this update.
- Follow-up validation: `git diff --check` passed after this log update. Application tests remain unnecessary for these documentation-only edits.

## Resource record

### Publication request

- User requested: push the changes and open a PR using a separate branch.
- Reviewed write set: `AGENTS.md`, `docs/DeveloperGuide.md`, and this log only. Branch planned: `codex/pr-review-setup`, targeting `master`.
- Reviewed the guidance diff and confirmed the untracked log directory contains only this session log. No application changes; application tests skipped.
- Initial `git ls-remote` failed because sandbox network access to github.com was unavailable. Publication will use authorized network access; outcome is recorded in the PR and final response.
- Publication resource metadata: Codex/GPT-6 family; exact model/effort, tokens, cache and aggregate tool counters unavailable. First captured publication timestamp: 2026-10-25T14:10:23.6809080+08:00; end and elapsed unavailable at commit preparation. No subagents.

### Earlier stages

| Stage / agent / invocation | Selected model / effort; observed if exposed | Start / end with timezone | Elapsed | Input / output tokens | Cache usage | Tool calls / retries | Outcome / telemetry source or unavailable reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Main: inspect repository and official integration docs | Codex, GPT-6 family per runtime; exact model/effort unavailable | Start unavailable / 2026-10-25T12:26:16+08:00 | Unavailable: no start timestamp captured | Unavailable: not exposed | Unavailable: not exposed | Unavailable: no aggregate counter; one Markdown fetch failed | Native setup chosen; repository metadata verified; shell timestamps and tool results |
| Main: guidance edit and initial whitespace verification | Same runtime; exact model/effort unavailable | 2026-10-25T12:26:16.0277040+08:00 / 2026-10-25T12:26:30.3892310+08:00 | 14.362 seconds | Unavailable: not exposed | Unavailable: not exposed | 4 nested tool calls, no retries | Patch tools and shell results; diff check passed |
| Main: missing-repository troubleshooting through initial final validation | Same runtime; exact model/effort unavailable | 2026-10-25T12:26:30.3892310+08:00 / 2026-10-25T12:27:34.0361264+08:00 | 63.647 seconds | Unavailable: not exposed | Unavailable: not exposed | Unavailable: no aggregate counter | Installation scope checked; user browser action pending; shell timestamp and tool results |
| Main: subsequent setup guidance and activation confirmation | Same runtime; exact model/effort unavailable | Earlier reply timestamps unavailable; final log-update start 2026-10-25T14:08:53.7455951+08:00; end unavailable | Unavailable: intervening user actions and reply timings not captured | Unavailable: not exposed | Unavailable: not exposed | Unavailable: no aggregate counter | User screenshot confirms installation; user reports review activation; live review unverified |

- End-to-end wall time: unavailable; initial start was not captured.
- Summed agent elapsed time: unavailable for the full session; no subagents invoked.
- Measurement coverage: edit/initial-check and troubleshooting intervals have measured wall time; subsequent documentation finalization and user wait are outside these intervals. Token, cache, account quota and exact model telemetry are unavailable. No estimates substituted.
