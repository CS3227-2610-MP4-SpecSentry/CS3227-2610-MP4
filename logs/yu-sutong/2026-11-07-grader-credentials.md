# Grader access and role-credential prompt log

## Context and requests

- Prompter: `yu-sutong`, explicitly supplied earlier for repository and GitHub work.
- Date/timezone: 2026-11-07, Asia/Singapore.
- Context: PR #25 contains the reproducible Render bootstrap, deployment status
  documentation and deployment interaction evidence. The user asked what that PR
  was for and requested public testing credentials for every product role so peers
  and graders can enter the deployed application.
- Decision: publish only the existing synthetic seeded demo identities. Do not
  publish the private deployment smoke account, database URLs, registry credentials,
  provider tokens or any real personal account.
- Human summary verification: pending.

## Changes and evidence

- Explained that PR #25 records the verified immutable-image Render deployment and
  its evidence; it does not add a product feature.
- Verified deployed HTTPS login and logout for both seeded Contributor accounts,
  both seeded Reviewer accounts and both seeded Release Maintainer accounts against
  the development deployment. Each response returned the expected role.
- Added a prominent grader-access section to `README.md` and `docs/UserGuide.md`
  with the development URL, both synthetic account names for each role, their
  deliberately shared demo-only seed password, the free-tier cold-start warning and
  a warning not to enter real or sensitive data.
- Explicitly distinguished the verified development testing target from the online
  production service whose database remains unmigrated and unseeded behind protected
  release gates.
- Updated stale repository-map deployment descriptions and the User Guide row in
  `workflow/SUBMISSION.md`.
- Affected files: `README.md`, `docs/UserGuide.md`, `workflow/SUBMISSION.md`, this
  prompt log and its structured resource record.
- Validation: all six deployed account login/logout checks passed with their
  expected server-returned roles; source/test inspection confirmed the documented
  seeded names and demo credential; `git diff --check` and
  `npm run check:submission` passed.
- Remaining limitation: the published accounts are verified only on development.
  Production grader accounts must not be claimed until the protected production
  migration, account provisioning and end-to-end verification actually complete.

## Resource record

- Structured interval:
  `logs/yu-sutong/resources/2026-11-07-grader-credentials/4556be0ace474785a3f5c310432b0612.json`.
- Timing coverage: started before the first repository edit.

| Agent / stage / attempt | Model / effort | Start / end (UTC) | Elapsed seconds | Input / output tokens | Status |
| --- | --- | --- | --- | --- | --- |
| main / document-verify / 1 | gpt-5 / unavailable | 2026-11-07T10:38:16.152019+00:00 / 2026-11-07T10:40:24.432719+00:00 | 128.2807 | unavailable / unavailable | succeeded |

- The interval covers deployed account verification, documentation edits and local
  validation. Final measurement logging, commit publication and CI observation are
  outside that measured boundary.
- Per-record input, output, cache, tool-call, retry, observed-model and
  observed-effort telemetry were unavailable because the repository recorder cannot
  access those runtime counters.
