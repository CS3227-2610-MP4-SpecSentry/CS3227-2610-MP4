# Authentication and RBAC planning

## Context and requests

- Prompter: ngkhengyang, inferred from `git config user.name`; date: 25 October 2026, Asia/Singapore.
- Request: implement authentication and RBAC for each account; explain the implementation approach first.
- This turn provides a repository-grounded plan. Implementation remains pending; no application or specification changes were made.
- Authorities: [product authorization matrix](../../workflow/specs/PRODUCT-SPEC.md), [shared requirements](../../workflow/specs/SHARED-REQUIREMENTS.md), [technical specification](../../workflow/specs/TECHNICAL-SPEC.md), and [integration contracts](../../workflow/specs/INTEGRATION-SPEC.md).

## Changes and evidence

- Inspected scaffold, package manifests, Prisma schema, HTTP setup, configuration, shared contracts, and authentication/authorization requirements.
- Proposed: administratively provisioned single-role accounts, Argon2id passwords, PostgreSQL-backed express-session sessions, synchronizer CSRF protection, login throttling, default-deny NestJS guards, current-account checks, object-level service policies, role-aware React navigation, safe security audit, and requirement-based tests.
- Session defaults: 30-minute idle/eight-hour absolute expiry; rotate at login; invalidate on logout/disablement. Account throttle: five failures within 15 minutes followed by a 15-minute throttle; additional IP limit: 30 failures per 15 minutes.
- Resource-specific authorization remains a requirement for each future domain service; generic role guards alone cannot complete the product authorization matrix.
- Validation: read-only inspection; repository status clean before this log. No application tests run because no application implementation changed.
- Initial Git status encountered ownership protection; command-scoped safe.directory allowed read-only status without changing global Git settings.
- Affected file: this log only. Authentication endpoint names in the response are proposals, not existing contracts.

## Resource record

| Stage / agent / invocation | Selected model / effort; observed if exposed | Start / end with timezone | Elapsed | Input / output tokens | Cache usage | Tool calls / retries | Outcome / telemetry source or unavailable reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Main agent: repository inspection and plan | GPT-6 family per runtime instruction; exact model and effort unavailable | Start unavailable; checkpoint 2026-10-25 13:11:21 Asia/Singapore; end unavailable | unavailable: no start/end instrumentation | unavailable: no per-stage token telemetry | unavailable: not exposed | Four inspection orchestration calls and one log-write call; no subagents; one command-scoped Git recovery | Plan grounded in local specifications and source; clock checkpoint from clock tool |

- End-to-end wall time and summed agent elapsed time: unavailable; no duration estimate represented as measurement.
- No credentials, raw sensitive prompts, or hidden reasoning recorded.

## Implementation request and outcome

- Steering: implement the base auth workflow in the existing architecture, keep it simple, and do not use the multi-agent workflow. Completed by one main agent; no subagents or Reviewer workflow used.
- Added `IdentityModule.register(config)` with explicit database/config imports. Other business modules remain untouched registrations; no generic service/repository layers introduced.
- Implemented administrative single-role account creation/disablement, Argon2id password hashes, PostgreSQL-backed express-session storage, hashed stored session identifiers, idle/absolute expiry, rotation, current account/version checks, and logout invalidation.
- Added strict browser-safe identity contracts and login/session/logout/CSRF routes, default-protected global auth guard and reusable `@Roles` metadata. Login uses a pre-login synchronizer token; successful login rotates it.
- Added transactional rolling-window account/IP failure counters using PostgreSQL advisory locks, generic errors and Retry-After. Security event payloads exclude credentials, cookie values and tokens. Operational pruning is an explicit admin command.
- Added React login, role landing pages, session restoration, expiry clearing and sign-out. Session refresh results cannot restore a workspace after a newer login/logout/expiry transition.
- Added reviewed SQL migration, configuration/environment/Compose/Render/CI changes and setup/architecture/user documentation. Documented authentication endpoint/input contracts and the login CSRF bootstrap exception.
- Affected areas: `src/server/src/identity/`, `src/server/prisma/`, server composition/config/HTTP/database service, `src/shared/src/contracts/identity.ts` and index, client App/styles/tests, backend HTTP/integration tests, browser tests, root/server manifests and lockfile, `.env.example`, Compose/Render/Playwright/CI configuration, README, `docs/{Authentication,Architecture,DeveloperGuide,UserGuide,Deployment}.md`, shared/integration specs, traceability, and this log/resources.

### Verification

| Check | Outcome |
| --- | --- |
| Prisma validate / generate / migrate deploy | Passed against a new isolated PostgreSQL 16 cluster on localhost port 55435; migration written explicitly after Prisma diff returned no output/file |
| Typecheck / lint / build | Passed; bundler required escalation because sandbox could not read required ancestor directories |
| Backend HTTP tests | 23 passed; default protection, role matrix, strict login fields, CSRF, rotation, safe errors/429, logout replay, account disablement/version invalidation, absolute expiry |
| Client tests | Eight passed; login/logout, all role restoration, unauthorized role route, safe failure and timed content clearing |
| PostgreSQL integration | Eight passed, including connectivity; actual Argon2id, sessions, account/IP rolling limits, rolling boundary, concurrent login failures, disablement, idle expiry and no touch resurrection |
| Chromium and axe | Four passed against the built app and isolated DB: all roles login/restore/logout; production cookie flags behind simulated TLS proxy; login page axe zero violations |
| Administrative smoke | Actual create, disable and prune commands passed; disabled account/version confirmed; smoke account removed |
| Production dependency audit | Zero reported vulnerabilities |
| Git diff whitespace | Passed before final documentation recording; rechecked at closure |
| Docker / deployed HTTPS / remote CI | Unavailable/not executed; no cloud deployment claimed |

### Security and specification review

Main-agent read-only review used the shared security and spec-conformance skills against the uncommitted auth change, including new files. No open blocking finding identified within base auth scope. This is not a certification of unimplemented domain workflows.

| Criterion | Control/evidence | Explicit gap |
| --- | --- | --- |
| REQ-SHR-001 | Account provisioning, hashed passwords, database sessions, rotation/logout/expiry/disabled-account checks; HTTP, integration and admin evidence above | Disabled-reviewer assignment release awaits assignment models |
| REQ-SHR-002 | Server-sourced account, default protection and three-role direct HTTP tests; no role input accepted at login | Future domain services must authorize ownership/assignment/lifecycle/version before data access; role guard alone is insufficient |
| NFR-SEC-001 | Secure cookies, CSRF on login/logout/writes, generic errors and serialized rolling account/IP limits | Production HTTPS/proxy configuration and Linux container execution unverified locally |
| REQ-SHR-004 (auth subset) | Safe restricted auth security events, transactional account administration, 90-day pruning command | Business timeline and scheduled pruning are not implemented |

Corrections during validation: used repository-local npm CLI after npm was absent from PATH; registry access required escalation; adapted to current shared-contract folder structure; corrected test typing; corrected a client effect lint warning; replaced initial fixed-window counters with rolling timestamps. No rejected auto-review action remained blocked. No passwords or connection credentials retained in this log.

### Implementation resource record and cleanup

[Measured interval JSON](resources/2026-10-25-authentication-rbac/e3afebac693844cfb875773d46cc70c8.json) was started before the first implementation edit and finished after validation and isolated database cleanup. The shared resource CLI report completed successfully.

| Agent / stage / attempt | Model / effort | Start / end (UTC) | Elapsed seconds | Input / output tokens | Status |
| --- | --- | --- | --- | --- | --- |
| main / implement-and-validate / 1 | unavailable / unavailable | 2026-10-25T05:32:04.522143+00:00 / 2026-10-25T05:53:45.432272+00:00 | 1300.910129 | unavailable / unavailable | succeeded |

- Singapore interval: 13:32:04.522143–13:53:45.432272 on 25 October 2026.
- End-to-end measured implementation interval and summed agent elapsed: 1300.910129 seconds each; one agent, no concurrent agent intervals. Pre-recording inspection and final response generation are outside this interval.
- Exact model/effort and token/cache/tool/retry counters are unavailable because attributable runtime telemetry was not exposed; see JSON reasons. No estimates substituted.
- Submission artifact presence check passed. Final whitespace check passed.
- Task-created PostgreSQL cluster stopped and its data removed after verifying the resolved exact workspace path and absent server PID file. No existing database was altered. Ignored dependency tools/test logs remain local.
