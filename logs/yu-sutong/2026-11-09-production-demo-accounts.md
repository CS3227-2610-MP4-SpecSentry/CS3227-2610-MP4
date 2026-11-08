# Production demo accounts and grader access

## Context and requests

- Prompter: `yu-sutong`, inferred from the repository Git identity `Yu Sutong`
  (`e0483972@u.nus.edu`).
- Date/timezone: 9 November 2026, Asia/Singapore.
- General context: the six published role accounts previously existed only in the
  isolated development database. Production already had the protected release and
  a private release-smoke identity, but graders could not use the README accounts
  there.
- Explicit change requests and steering:
  1. Make a small final pull request that gives production the same six public demo
     identities as development.
  2. Update the README so production is the primary grader test environment and
     development remains clearly separate.
  3. Check why the production image appeared to need a manual restart before the
     application would respond.
- Human summary verification: pending.

## Changes and evidence

### Production provisioning and verification

- Used the existing trusted, fail-closed `npm run account -- ensure` path against
  the intended production Neon database. Each account was checked for exact role,
  enabled state and the published synthetic password; a mismatch would have stopped
  provisioning rather than changing an existing identity.
- Provisioned `contributor1`, `contributor2`, `reviewer1`, `reviewer2`,
  `release_maintainer1` and `release_maintainer2` with their documented roles. No
  provider credential or database connection string was printed or stored.
- The first remote verification attempt failed because the free Render service did
  not wake within the bounded request window. Render still reported the existing
  immutable deployment as live.
- Confirmed the intended Render workspace and production service, then redeployed
  the same immutable image digest without changing source, configuration, database
  schema or compute plan. Deploy `dep-dboa9mbm8hqs738081o0` reached `live`.
- After recovery, `/`, `/api/health` and `/api/ready` returned HTTP `200`. Every
  published production identity passed CSRF bootstrap, login, exact username/role
  session retrieval, logout and post-logout `401` rejection on 9 November 2026.

### Render wake-up diagnosis

- The production service is on Render's Free compute plan and is not suspended.
  Render's current documentation states that a Free web service spins down after
  15 minutes without inbound traffic and should spin back up on the next request,
  usually in about one minute.
- The timed-out request produced no new instance metrics or startup log. Service
  events showed no crash, suspension, health-check failure or out-of-memory event.
  The prior instance stayed below its 512 MB memory limit. Render's status page
  reported Singapore Web Services and the Free Tier operational with no unresolved
  incident.
- The public root and `/api/health` do not query Neon; only `/api/ready` does. Once
  the image started, readiness and all authenticated database flows passed. The
  evidence therefore does not identify an application or Neon failure. It is
  consistent with an unreliable or unusually delayed Render Free auto-wake. A paid
  always-on Render instance is the reliable way to remove the intentional idle
  spin-down behavior; repeated redeployment is not an application fix.

### Repository changes

- `README.md`: makes production the primary grader link, publishes the six accounts
  for both isolated environments and records the production login verification.
- `docs/UserGuide.md`: aligns public role-testing instructions and environment
  separation with production access.
- `docs/Deployment.md`: records the independently provisioned production identities
  and the trusted provisioning path.
- `docs/Authentication.md`: keeps `db:seed` development-only and documents the
  fail-closed administrator `ensure` path used for production.
- `workflow/SUBMISSION.md`: points the remaining peer walkthrough at production
  while retaining development for isolated team testing.
- `src/website/index.html`: updates the product site so its demo-account guidance no
  longer contradicts the README.

### Validation

- `git diff --check` — passed.
- `npm run check:submission` — passed; all required artifact paths present. This is
  a presence check, not a completion certificate.
- `npm run lint` — passed.
- Changed-Markdown local-link and product-site URL syntax check — passed.
- Diff scan for provider, database, AI-key and session-secret patterns — passed.
- Production root/health/readiness and six-account login/session/logout check —
  passed after the same-image Render recovery.

## Unresolved items and next actions

- Human verification of this AI-produced interaction summary remains pending.
- Render Free intentionally sleeps after 15 idle minutes and is explicitly not
  recommended by Render for production applications. The repository warning cannot
  guarantee wake-up latency. Upgrade the production service compute plan if an
  always-on grader experience is required.
- Teammates still need to complete the human-only walkthrough and submission checks
  listed in `workflow/SUBMISSION.md`.

## Resource record

- Structured records:
  - `resources/2026-11-09-production-demo-accounts/d192bded6abf4711983c69038a23b7ae.json`
  - `resources/2026-11-09-production-demo-accounts/acc769d184f0411c9dd0e6338ebcf1ab.json`
- Timing coverage: both attempts were registered before their edits or external
  mutations. The first attempt ended as failed when remote verification timed out;
  the second records recovery, documentation, diagnosis and revalidation.

| Stage / agent / invocation | Selected model / effort; observed if exposed | Start / end with timezone | Elapsed | Input / output tokens | Cache usage | Tool calls / retries | Outcome / telemetry source or unavailable reason |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Main / provision-document-validate / attempt 1 | `gpt-5` / unavailable; observed unavailable | 2026-11-09 00:25:13.952 SGT / 00:29:57.786 SGT | 283.833946 s | unavailable / unavailable | unavailable | unavailable / unavailable | Failed after account provisioning because production wake verification timed out; desktop runtime exposes no per-record usage telemetry. |
| Main / production-recovery-and-reverification / attempt 2 | `gpt-5` / unavailable; observed unavailable | 2026-11-09 00:29:57.924 SGT / 00:42:11.201 SGT | 733.276799 s | unavailable / unavailable | unavailable | unavailable / unavailable | Succeeded; same-image recovery, all six production account flows, documentation and checks passed. Desktop runtime exposes no per-record usage telemetry. |

- End-to-end wall time: 1,017.248477 seconds from the first recorded start to the
  final recorded finish.
- Summed agent elapsed time: 1,017.110745 seconds; intervals did not overlap.
- Measurement coverage and unavailable reasons: elapsed time covers both registered
  attempts. Per-record input/output/cache tokens, tool calls, retries, observed
  model and observed effort were not exposed by the desktop runtime and were not
  estimated. Final log rendering and response generation occur outside the closed
  intervals.
