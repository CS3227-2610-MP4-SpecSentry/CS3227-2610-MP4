# Authentication and role access

The shared NestJS `IdentityModule` owns login, logout, session validation, CSRF,
login throttling, and security events. React renders a login form and a landing
page for the account's single role. Proposal, review, and release operations are
still separate future features.

## Setup and account provisioning

After installing dependencies and running `npm run db:generate`, configure
`DATABASE_URL`, `DIRECT_DATABASE_URL`, and a random `SESSION_SECRET` of at least
32 characters outside Git. Generate a secret with
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`.
Apply the reviewed migration with `npm run db:migrate:deploy` before starting
the application. Database readiness only checks connectivity, not schema readiness.

Provision accounts from a trusted development/administrative checkout:

```powershell
$env:ACCOUNT_USERNAME = 'alice'
$env:ACCOUNT_ROLE = 'CONTRIBUTOR'
# Supply ACCOUNT_PASSWORD through your secret manager or an interactive prompt.
$secret = Read-Host 'Initial password' -AsSecureString
$env:ACCOUNT_PASSWORD = [System.Net.NetworkCredential]::new('', $secret).Password
try { npm run account -- create } finally { Remove-Item Env:ACCOUNT_PASSWORD }
```

Roles are `CONTRIBUTOR`, `REVIEWER`, and `RELEASE_MAINTAINER`. Usernames are
case-insensitive, normalized to lowercase, and contain 1–80 ASCII letters,
digits, dots, underscores, or hyphens. New passwords must contain 12–256
characters; login accepts existing passwords up to 256 characters. Creation
rejects duplicate usernames and never silently resets an account. There is no
public registration, role picker, password-reset flow, or administrator web role.

With `ACCOUNT_USERNAME` set, `npm run account -- disable` disables the account
and increments its version. Existing sessions lose access on their next protected
request. Reviewer disablement also releases unfinished assignments transactionally:
`IN_REVIEW` returns to `SUBMITTED`, while `CHANGES_REQUESTED` remains awaiting
revision. Assignment history is retained, and completed frozen states are left
unchanged. Account/version changes, releases and their required events commit
together; an activity failure rolls back the whole operation. Administrative role/password changes
must increment the account version to invalidate old sessions.

Run `npm run account -- prune` periodically from the administrative checkout to
remove expired sessions, inactive throttle entries, and security events older
than 90 days. This command does not prune business history. Scheduling is an
operator responsibility; no background scheduler is introduced here.

## Demo accounts

After applying migrations, run `npm run db:seed` from the repository root to create
two development/demo accounts per role:

| Role | Usernames |
| --- | --- |
| Contributor | `contributor1`, `contributor2` |
| Reviewer | `reviewer1`, `reviewer2` |
| Release Maintainer | `release_maintainer1`, `release_maintainer2` |

All newly created demo accounts use password `Password123!`, stored as Argon2id
hashes. This fixed synthetic credential is an explicit demo-only exception to
normal administrative provisioning. The seed refuses `NODE_ENV=production`.
Reruns skip existing usernames without changing their passwords, roles, enabled
status or versions. Account creation and its security events commit together.
The seed uses `DATABASE_URL` from the root `.env`; migrations use
`DIRECT_DATABASE_URL`. No schema migration is needed for the seed itself.

## API contract

| Endpoint | Access and result |
| --- | --- |
| `GET /api/auth/csrf` | Public login bootstrap; creates a pre-login server session and returns `{csrfToken}` |
| `POST /api/auth/login` | Requires pre-login cookie and `x-csrf-token`; strict JSON `{username,password}`; returns `{account,csrfToken,expiresAt}` |
| `GET /api/auth/session` | Requires current valid session; returns `{account:{id,username,role},csrfToken,expiresAt}` |
| `POST /api/auth/logout` | Requires valid session and CSRF; destroys the server session, clears cookie, returns 204 |

The CSRF endpoint is part of the public login bootstrap exception. Health and
readiness remain public. Login rotates both the session ID and CSRF token. The
client sends cookies on same-origin requests and keeps account/session state only
in memory. `expiresAt` is a Unix timestamp in milliseconds for the current idle
deadline capped by the absolute deadline. Recheck session state after protected
API failures; a 401 must clear protected client content. The base UI also clears
its workspace at expiry and revalidates when the window regains focus.

Sessions use `express-session` and a Prisma/PostgreSQL store, with hashed session
IDs in storage. They expire after 30 minutes idle or eight hours absolute, even
if requests continue. Every protected request reloads the account and checks
enabled/version state. Production cookies use Secure, HttpOnly, SameSite=Lax,
and host-only scope. Production requires HTTPS. Set `TRUST_PROXY_HOPS` only to the
known reverse-proxy hop count with direct access constrained; it defaults to zero.
Local HTTP development uses non-Secure cookies. Use separate secrets/databases
for each environment; changing the secret invalidates existing signed cookies.

Five failed logins for an account in a rolling 15-minute window block it for 15
minutes. An additional IP limit blocks after 30 failures in that window. Counters
live in PostgreSQL and serialize with transaction advisory locks. Unknown and
disabled accounts receive generic errors. Throttled login returns 429 with a
conservative `Retry-After: 900`; invalid credentials return 401, invalid fields
422, and failed CSRF checks 403. Passwords, cookie values, and tokens are excluded
from security events and error responses.

## Adding protected operations

The global guard requires authentication by default. Use `@Roles('REVIEWER')`
from `src/server/src/identity/access.ts` on a controller or handler to restrict
roles. `@Public()` is reserved for explicit public exceptions. Protected writes
also require a valid `x-csrf-token`.

Role guards do not implement object permissions. Each domain service must check
project scope, ownership/current assignment, lifecycle, and expected version before
protected retrieval or mutation. Derive actors from `request.account`, never from
client-supplied owner/role fields. Private drafts and reviewer AI history must not
be included in broader role responses. Auth infrastructure alone does not satisfy
the full product authorization matrix.

## Verification

`npm test` covers HTTP protection, role checks, CSRF, rotation, logout replay,
disablement, absolute expiry, and the React login/session behavior. For actual
PostgreSQL checks, set `TEST_DATABASE_URL` to a disposable database, apply migrations
there using `DIRECT_DATABASE_URL`, then run `npm run test:integration`. Tests use
synthetic account fixtures and exercise rolling throttles, concurrent attempts,
idle expiry, and persisted session destruction. They must never target production.

With the same disposable `TEST_DATABASE_URL`, run `npm run build` and
`npm run test:e2e`. Chromium tests create synthetic role accounts, exercise real
login/restoration/logout, inspect production cookie flags behind a simulated TLS
proxy, and scan the login page with axe. This does not establish deployed HTTPS
or full product accessibility compliance.

Middleware integration follows the [Express session documentation](https://expressjs.com/en/resources/middleware/session/);
password verification uses [node-argon2](https://github.com/ranisalt/node-argon2).
