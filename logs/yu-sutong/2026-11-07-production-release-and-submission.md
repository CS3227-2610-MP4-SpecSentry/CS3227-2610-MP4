# Production release and submission prompt log

## Context and requests

- Prompter: `yu-sutong`, explicitly established by the user's earlier GitHub
  account instruction and continued deployment request.
- Date/timezone: 2026-11-07, Asia/Singapore.
- General context: continue PR #25 from the live but deliberately gated Render
  bootstrap to a verified production release, then reconcile the submission-facing
  access documentation and required product website.
- Explicit requests and steering:
  - invite teammates Kheng Yang (`ngkhengyang`) and Justin (`yooplo`) to the
    Render and Neon workspaces;
  - smoke-test the production website in the in-app browser;
  - rename the production Render service to the cleanest available `specsentry`
    hostname while keeping development and production distinct;
  - verify the MP4 requirements for publishing development/production links and
    a GitHub Pages website, and update the required artifacts where necessary;
  - fix the real production session failure by completing the protected production
    migration and creating demo accounts rather than hiding the frontend warning.
- Human summary verification: pending.

## Changes and evidence

- Work in progress. No production migration, account provisioning, service rename,
  invitation, documentation switch, or browser smoke result is claimed yet.
- Target production service: `srv-dbnfk7rrjlhs738m6ah0`; target Neon project:
  `delicate-dust-92580281`, branch `production`.
- The pre-existing diagnosis is that anonymous `GET /api/auth/session` returns
  HTTP 500 in production because the production schema is absent; development
  correctly returns HTTP 401. The intended correction is the guarded migration
  plus account provisioning.
- Added an idempotent `ensure` account-administration action. It creates and audits
  a missing account but fails closed when an existing identity is disabled or its
  role/password differs from the protected configuration.
- Added dedicated smoke-account provisioning immediately after migration postflight
  in both guarded environment jobs, before immutable-digest deployment and remote
  verification. Deployment workflow tests now freeze that ordering.
- Neon organization invitations were sent to both teammates as ordinary members
  using the verified addresses present in repository history. Render invitations
  remain pending the browser's access-change confirmation.
- Focused account-provisioning tests passed (3/3). Deployment workflow tests passed
  (28/28). Workspace typecheck, lint, production build and `git diff --check`
  passed; Vite retained its pre-existing non-failing chunk-size advisory.
- PR #25 was approved by Justin (`yooplo`) and merged as
  `f142004b851643c73eb9b33f85869d2cb0001189`. Exact-commit CI and the signed,
  scanned application-image build passed.
- The first guarded development release attempt (`42443430984`) verified the
  development database and found all ten reviewed migrations already applied,
  then failed before the Render deployment. The new `account -- ensure` command
  could not resolve the unbuilt internal `@specsentry/shared` package on a clean
  Actions checkout. The attempt did not change production.
- The corrective change makes the root account-administration command build its
  internal shared dependency first and adds a regression assertion that freezes
  this clean-checkout requirement. A clean install/generation reproduction reached
  the account command without the missing-module error; all 29 deployment tests,
  workspace typecheck, lint, production build and `git diff --check` passed. The
  existing non-failing Vite chunk-size advisory remains. Development release retry
  and all production actions remain pending review and merge of the corrective PR.

## Resource record

- Structured interval:
  `logs/yu-sutong/resources/2026-11-07-production-release-and-submission/4f45faae47b346c68629114c699a30ac.json`.
- Timing coverage: started before the first repository edit and before any provider
  mutation in this continuation.
- Final report and validation outcomes will be appended after verification.
- Corrective release interval:
  `logs/yu-sutong/resources/2026-11-08-development-release-fix/c8d88cf1699d4df0bf9f304a80a9729a.json`.
- Corrective interval report:

| Stage / agent / invocation | Selected model / effort | Start / end (UTC) | Elapsed | Input / output tokens | Cache usage | Tool calls / retries | Outcome / telemetry source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| diagnose-implement-validate / main / main-1 | gpt-5 / unavailable | 2026-11-08T03:41:04.932556+00:00 / 2026-11-08T03:43:20.162436+00:00 | 135.22988 s | unavailable / unavailable | unavailable | unavailable / unavailable | succeeded; structured resource record above; per-record usage telemetry is not exposed by the desktop runtime |

- Corrective interval wall time and summed agent time are both 135.22988 seconds;
  no concurrent agent intervals were used. Time coverage began before the first
  corrective edit. Token, cache, tool-call, retry, observed-model and
  observed-effort telemetry were unavailable from the desktop runtime.
- PR #26 was approved by Justin (`yooplo`) and merged as
  `49a16d228f120f60cad89a57adb4fdb3d251aaf1`. Its exact-commit CI, image build,
  provenance check, scan, database preflight, migration and postflight passed.
- The automatic development release (`42446637223`) then stopped at dedicated
  smoke-account creation before Render deployment. The shared-package build fix
  worked, exposing a second clean-runner defect: the account CLI loaded the full
  web-server configuration and therefore required the unrelated `SESSION_SECRET`,
  which the least-privilege migration job intentionally does not receive.
- The follow-up fix gives database tooling a database-only validated configuration
  path, preserves Neon TLS normalization, and adds regression coverage proving
  that application secrets are not required. All 193 server tests, 289 client
  tests and 29 deployment tests passed, together with typecheck, lint, the
  production build and `git diff --check`. Production remained disabled and
  unchanged throughout both failed development attempts.
- Follow-up corrective resource records:
  `logs/yu-sutong/resources/2026-11-08-account-database-config-fix/d8ce336eab474fc08f458c557eb55403.json`
  and
  `logs/yu-sutong/resources/2026-11-08-account-database-config-fix/fa0aff2191b742b8a97480e5f92598a5.json`.

| Stage / agent / invocation | Selected model / effort | Start / end (UTC) | Elapsed | Input / output tokens | Cache usage | Tool calls / retries | Outcome / telemetry source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| diagnose-implement-validate / main / main-1 | gpt-5 / unavailable | 2026-11-08T05:56:21.693697+00:00 / 2026-11-08T05:56:32.699781+00:00 | 11.006084 s | unavailable / unavailable | unavailable | unavailable / unavailable | interrupted before edits because recording began in the already-merged worktree; structured record above |
| implement-validate / main / main-2 | gpt-5 / unavailable | 2026-11-08T05:56:32.699624+00:00 / 2026-11-08T05:59:23.467302+00:00 | 170.767678 s | unavailable / unavailable | unavailable | unavailable / unavailable | succeeded; structured record above |

- Follow-up wall time was 181.773605 seconds and summed agent interval time was
  181.773762 seconds; the intervals overlapped by 0.000157 seconds while the
  corrected recorder was started. Time coverage began before the first code edit.
  Token, cache, tool-call, retry, observed-model and observed-effort telemetry were
  unavailable from the desktop runtime.
