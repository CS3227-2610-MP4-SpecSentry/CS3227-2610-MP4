# Demo account seed

## Context and request

- Prompter: ngkhengyang, inferred from Git user.name; date/timezone: 25 October 2026, Asia/Singapore.
- Request: create a database seed with two accounts for each role, using role-name-plus-number usernames and the explicitly supplied shared synthetic demo password. Password text is excluded from this log.
- Scope: single-agent implementation using the change-session logging skill; security review applied to demo provisioning. Normal administrative provisioning remains unchanged.

## Changes and evidence

- Added `src/server/src/identity/seed-demo.ts`: six explicit role-derived usernames, unique Argon2id hashes using the existing identity helper, one database transaction for missing account creation and security events. Existing usernames are skipped without resetting roles, credentials, disablement or versions. No startup auto-seeding. Production environment is rejected.
- Added root/server `db:seed` commands and Prisma seed configuration. Root command builds shared contracts before running the seed. No dependencies or schema migrations added.
- Added `src/server/test/demo-seed.integration.ts` for actual PostgreSQL verification of accounts/passwords/audit, preservation on reruns, and production rejection.
- Updated `docs/Authentication.md` with command, usernames and demo-only credential behavior. The user's explicit synthetic-demo requirement is the scoped exception to normal external-secret administrative provisioning.
- Affected files: root/server package.json, server prisma.config.ts, identity/seed-demo.ts, test/demo-seed.integration.ts, docs/Authentication.md, this log and measured resource JSON.

### Validation

| Check | Result |
| --- | --- |
| Server typecheck, lint, server build | Passed after correcting an initially inferred empty-array type |
| PostgreSQL integration suites | 11 tests passed (three new seed tests plus eight existing integration checks) against an isolated PostgreSQL 16 cluster |
| Complete root seed command | Passed against isolated database: six created, zero skipped |
| Second seed invocation | Passed: zero created, six skipped |
| Whitespace check | Passed |
| Configured development database population | Attempted; PostgreSQL rejected configured credentials with code 28P01. No accounts were created there. DATABASE_URL needs working credentials before rerunning npm run db:seed |

### Security and requirement review

Reviewed the seed against REQ-SHR-001 (single-role accounts/adaptive hashes), REQ-SHR-004 (creation evidence), and the user's explicit demo-credential override. Concrete controls: production rejection before writes; hashes rather than plaintext storage; skip-existing behavior preserves disabled or modified accounts; account/event writes share one transaction; failure output and this log exclude credentials. No open blocking implementation finding identified for this demo-only scope. Population of the configured database remains blocked by database authentication, not by the seed implementation.

Initial compilation and sandbox subprocess failures were corrected/retried. Bundling and the Prisma seed subprocess required escalation; no automatic approval rejection remains unresolved. The isolated database was used for tests without changing the configured database or its credentials.

## Resource record

[Measured interval](resources/2026-10-25-demo-accounts/6b9aa13c8c3e48be8c9126129d9ed047.json); shared resource report completed successfully.

| Stage / agent | Model / effort | Start / end UTC | Elapsed seconds | Input / output tokens | Cache / tool / retry counters |
| --- | --- | --- | --- | --- | --- |
| implement-and-validate / main | unavailable / unavailable | 2026-10-25T06:17:57.498634+00:00 / 2026-10-25T06:24:03.843822+00:00 | 366.345188 | unavailable / unavailable | unavailable: attributable runtime telemetry not exposed |

Singapore interval: 14:17:57.498634–14:24:03.843822. Measured end-to-end implementation interval and summed agent elapsed are both 366.345188 seconds; no subagents. Initial inspection and final response generation are outside the interval. No estimates substituted for missing telemetry.

Temporary test cluster stopped and its data removed after checking the exact resolved workspace path and absent PID file. Existing user database configuration was preserved.
