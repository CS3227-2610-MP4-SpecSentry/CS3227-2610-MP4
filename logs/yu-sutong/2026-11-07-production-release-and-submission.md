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

## Resource record

- Structured interval:
  `logs/yu-sutong/resources/2026-11-07-production-release-and-submission/4f45faae47b346c68629114c699a30ac.json`.
- Timing coverage: started before the first repository edit and before any provider
  mutation in this continuation.
- Final report and validation outcomes will be appended after verification.
