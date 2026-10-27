# Developer Guide

## Approval revocation and supporting release API

Iteration 4 adds `POST /api/proposals/:id/revoke-approval` for the current assigned
Reviewer. Use the shared strict revocation request/response schemas. The request
binds proposal, revision, assignment and immutable approval mutation versions,
plus explicit null or current candidate context. Reasons are nonblank and at most
2,000 normalized Unicode code points. Session/CSRF, current object access and
versions are checked server-side; idempotency is actor/operation/target scoped.

`ApprovalInvalidation` appends REVOKED provenance without changing the original
decision; existing owner reopening records retain REOPENED provenance. Unattached
revocation enters CHANGES_REQUESTED. Attached revocation stays IN_RELEASE and
increments the candidate's general version, preserving membership/contentVersion,
while invalidating approval and appending activity plus its responsible Maintainer's
notice in one transaction. Candidate context returned to a Reviewer contains only
their member blocker, never aggregate readiness or other members. Replay rechecks
current access, including candidate scope after removal.

The supporting creator-scoped release API implements candidate create/read/edit,
member add/remove, smoke tests and publication under `/api/release-candidates`.
It uses server-owned single-project scope, plain major.minor.patch labels, current
approval/coverage/finding gates, rollback notes and a PASS smoke record for current
content. Publication snapshots immutable evidence atomically. Membership changes
advance contentVersion; explicit removal of a revoked item enters CHANGES_REQUESTED.
New API contracts are in `src/shared/src/contracts/release.ts` and `revocation.ts`.

Lock order is sorted relevant accounts, actor session, candidates, then sorted
proposals before approval/membership writes. Resolve opaque pointers before locking
and revalidate under locks; never acquire a candidate after a proposal lock.
Removal always locks the affected Reviewer account before deciding unavailable
assignment recovery. Revocation and publication use the same roots, so only one
can win against the same approval. Reading candidate detail is side-effect-free;
notification acknowledgement is a recipient/candidate-scoped CSRF-protected POST.

The migration under `20261026160000_approval_revocation` supports a guarded forward
retry of its failed partial development application while preserving prior history.
Normal deployments still apply it once through Prisma. Use only an explicitly
authorized disposable `*_test` database for fixture cleanup; do not reset a runtime
database or bypass Prisma's reset safeguard. Resource/check details and first review
results are in the [iteration-4 log](../logs/ngkhengyang/2026-10-26-reviewer-iteration4.md).
Local checks do not establish deployment, live AI compatibility or teammate approval.

## Reviewer Patch Risk Assistant

The [AI integration guide](AI-Integration.md) describes exact request/result
contracts, authorization and assignment generations, transient UI retention,
safe metadata, strict output validation, quotas and manual fallback. The default
configured gateway remains disabled pending OPEN-002 live verification. Tests
inject deterministic providers in-process; there is no browser-controlled model
or production mock switch. Independent implementation/security review and
revalidation closed all five findings. Use the [iteration 3 log](../logs/ngkhengyang/2026-10-26-reviewer-iteration3.md)
for actual test results and source evidence.

## Reviewer revision cycles

The owner API now supplies the minimal Contributor integration for real review cycles:
`POST /api/proposals` creates private working content, `GET/PATCH /api/proposals/:id/draft`
reads/saves it, and `POST /api/proposals/:id/submit` publishes an immutable revision.
Save uses `{expectedVersion, content}`; submit uses `{expectedVersion, workingRevisionId}`
and `Idempotency-Key`. Content includes title, summary, problem, constraints,
expectedBehavior, criteria (statement/required, optional server-issued stableKey),
diffText (valid unified diff), and optional plain-text evidence. Get the current
draft/committed version before saving; use the original key/body after an uncertain
submit response. GET never creates a working revision. Seeded submissions without
working content need an explicit owner save before submit. The full Contributor
drafting interface remains future work.

`POST /api/proposals/:id/withdraw` requires expectedVersion, confirmed=true and a
reason. `POST /api/proposals/:id/reopen` requires expectedVersion and an unattached
APPROVED proposal. Reopening preserves the decision and appends an approval
invalidation; another decision requires resubmission. The server-owned
releaseAttachmentRef is maintained with real candidate membership by the release
API. Legacy synthetic attachment markers remain fixture guards and are never
promoted automatically into membership or accepted as proof of publication.

If a completed approval's Reviewer has since been disabled, reopening releases
that now-unfinished assignment atomically while preserving its history. The owner
can resubmit to the pool or withdraw; the proposal does not remain assigned to an
account that cannot act. Reopening and disablement use the same account/root order.

Submission closes the old revision-specific assignment and creates a new one for
the retained reviewer. Findings keep their original identity and provenance;
coverage starts fresh per revision. The revision/assignment/version coordinates
captured by old forms cannot mutate the new review round. Original submission
age remains fixed. Working content/title remain private until submission.

`GET /api/notifications` returns recipient-scoped bounded cursor pages.
`POST /api/notifications/:id/acknowledge` requires CSRF and an exact NEW_REVISION
revision/current-assignment context, or the separate WITHDRAWN payload. Reading
does not acknowledge. Only opening a current rendered view triggers the UI's
explicit acknowledgement. Withdrawal notices expose only status/opaque IDs and
times; they never grant access to withdrawn content. Owners and scoped Maintainers
retain submitted/human history; only owners can read working content.

All business reads/writes use sorted account locks, persisted-session validation,
then sorted proposal roots. Contributor handover pre-reads only opaque reviewer
pointers, then rechecks the lock set under the root. Session expiry is rechecked
before transaction return; logout serializes on the persisted session row.
Rolling session touch also locks that row before evaluating current idle/absolute
expiry and calculating renewal, so a lock wait cannot revive an expired session.
Dependent activity, notice, assignment and idempotency writes share one transaction.
Notifications and approval invalidations have database provenance/append-only
constraints; read acknowledgements use restricted operational audit only.

Real PostgreSQL suites include proposal-lifecycle, notifications, business-context
and submitted-access integration. They and browser fixtures share an explicitly
disposable TEST_DATABASE_URL and must run serially. New tables participate in test
cleanup; never run these truncating suites on development/production data.
Current evidence and independent review are recorded in the
[iteration 2 run](../logs/ngkhengyang/2026-10-26-reviewer-iteration2.md).

## Current state

The base scaffold implements NestJS/Express, React/Vite, browser-safe Zod health
contracts and Prisma PostgreSQL connectivity, plus account provisioning, login,
PostgreSQL sessions, CSRF, role guards and restricted security events. The first
Reviewer increment adds pool/assigned queues, claim/drop, immutable submitted
detail/history, business activity and transactional assignment release on account
disablement. Manual review adds criterion assessments and individual takeover
confirmation, append-only findings/transitions/amendments, human decisions,
approval gates, decision idempotency and authorized history. Revision cycles add
the minimal Contributor API, durable notifications and withdrawal/reopening.
Full Contributor UI, broader release UI and Contributor/Maintainer AI remain pending.
The bounded revocation/release API is described above; consult its current review status.
Reviewer AI is integrated with live operation disabled pending provider verification.
See [Authentication](Authentication.md).
The detailed specifications describe planned product behavior, not delivered features.

See the root [directory map](../README.md#directory-map) for frontend/backend
ownership and important files. Production uses one same-origin Docker service;
local development runs Vite on 5173 and NestJS on 3000. `src/shared` builds first,
then both consumers. `npm run dev` watches all three workspaces.

## Install and run

Use Node.js 24 LTS, at least 24.15, and npm 11/12. Exact dependencies are pinned;
`package-lock.json` records transitive resolution. `packageManager` records the
npm version used to generate the lockfile. TypeScript 5.9 is deliberately pinned
within the supported range of ESLint/Jest integrations; Prisma CLI/client/adapter
all use stable 7.10.1, rather than the registry's Prisma 8 release candidate.

Use `npm ci --ignore-scripts`, then `npm run db:generate`. Install lifecycle hooks
are disabled; Prisma generation is explicit, and platform binaries arrive as
optional dependencies. NestJS 11.2.8 is pinned for the CommonJS/Jest scaffold;
the root `multer` override selects patched 2.5.0 for Nest's transitive dependency.
No upload API is exposed. Re-run generation after schema changes. Copy the root
`.env.example` to `.env`, start `docker compose up -d db`, then `npm run dev`.
Set a random `SESSION_SECRET` of at least 32 characters. Run
`npm run db:migrate:deploy` and provision accounts as documented in
[Authentication](Authentication.md) before signing in. Readiness checks connectivity only.

Database schema source lives in `src/server/prisma/schema.prisma`; generated code
under `src/server/src/generated/` is ignored. For a feature schema, create and
review SQL with `npm run db:migrate:dev -w @specsentry/server -- --name <change>`,
then apply reviewed migrations with `npm run db:migrate:deploy`. Never use `db push`
for deployment. Develop migrations against a disposable database. Runtime uses
the pooled `DATABASE_URL`; migrations use the direct `DIRECT_DATABASE_URL` with
TLS verification enabled. Keep connection strings out of Git and logs.

`npm run build` writes ignored `dist/` folders in each workspace. To serve the
built client and backend locally, set `NODE_ENV=production` and run `npm start`.
Production startup requires the built client. Container startup uses environment
variables directly, runs as the nonroot `node` user and needs no `.env` file.

## Verification commands

Root commands: `npm run db:validate`, `npm run typecheck`, `npm run lint`,
`npm test`, and `npm run build`. Unit/HTTP tests use isolated mocks for session/role/CSRF behavior;
client tests cover login, logout, role routing and session expiry.
HTTP tests verify generic readiness failure, security headers and API/asset 404
behavior in the presence of frontend fallback.

For real PostgreSQL integration, use a disposable test database and set
`TEST_DATABASE_URL` explicitly. In PowerShell:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://test_user:test_password@localhost:5433/specsentry_test'
$env:DIRECT_DATABASE_URL = $env:TEST_DATABASE_URL
npm run db:migrate:deploy
npm run test:integration
```

Auth integration tests create and remove synthetic fixtures in the migrated test
database. Never substitute production URLs.

Reviewer integration tests require the intake migration as well as identity.
Submitted snapshots, activity and historical assignments reject row updates or
deletions. Test cleanup can truncate fixture tables only in an explicitly
disposable test database; it must not weaken those production constraints.

## Reviewer intake fixtures

After configuring a development database and applying migrations, run
`npm run db:seed` to provision the existing synthetic demo accounts, followed by
`npm run db:seed:reviewer` to add synthetic submitted revisions for the Reviewer
walkthrough. The latter requires the demo Contributor and Reviewer accounts to
exist. Both commands refuse production configuration. Reruns preserve existing
accounts and existing proposal snapshots; they do not reset edited credentials,
disablement or review state. Never use these fixture commands against production.

The intake API provides `GET /api/review-pool`, `GET /api/reviews/assignments`,
`POST /api/proposals/:id/claim`, `POST /api/proposals/:id/drop`, and assigned-only
detail, `/revisions` and `/activity` reads. Wire schemas live in
`src/shared/src/contracts/reviewer.ts`. Every protected read reauthorizes its
scope; cursor contents never grant access. Review commands carry root versions,
and drop additionally carries revision/assignment identities and assignment version.
Claim/drop use version checks rather than idempotency keys. Read current state
before retrying after an uncertain response.

The database migration adds partial uniqueness and deferred pointer-consistency
triggers beyond Prisma's schema syntax. Do not replace it with `db push` or omit
its SQL constraints. Account disablement, assignment release, lifecycle changes
and required activity commit in the same transaction. No code/diff is executed.

## Manual Reviewer contracts

The shared reviewer schemas define all request and response fields. Review writes
carry `expectedVersion`, `revisionId`, `assignmentId` and
`expectedAssignmentVersion`. Each transaction locks and rechecks the enabled
reviewer account, then the proposal root and current assignment. Proposal version
advances with each write; stale forms receive 409. Validation uses 422, access
denial 403 and missing/expired sessions 401 through the safe error envelope.

| Route | Purpose |
| --- | --- |
| `GET /api/proposals/:id/review` | Selected-revision effective coverage and complete approval blockers |
| `GET /api/proposals/:id/findings` | Paginated proposal findings and current severity/status |
| `GET /api/proposals/:id/coverage-history` | Paginated assessment and confirmation records |
| `GET /api/proposals/:id/decisions` | Paginated immutable human decisions |
| `GET /api/proposals/:proposalId/findings/:id/history` | Paginated attributed finding events |
| `PUT /api/proposals/:id/coverage/:criterionId` | Assess or explicitly confirm the effective preserved assessment |
| `POST /api/proposals/:id/findings` | Create a human finding |
| `POST /api/findings/:id/transitions` | Resolve, reopen or change severity with a reason |
| `POST /api/findings/:id/amendments` | Append a correction and reason |
| `POST /api/proposals/:id/decision` | Approve or request changes; requires `Idempotency-Key` |

Narratives use normalized Unicode code-point limits of 2,000 characters. Mutation
schemas reject unknown fields. Criterion/evidence references must belong to the
current submitted revision. Findings retain origin revision/assignment/author and
description; later events identify the acting assignment and revision. Coverage
is append-only and ordered by proposal mutation version, not timestamp. Confirmation
loads its effective source on the server. Approval blockers examine all findings
and current coverage independently of pagination. History is visible only to the
current assignee; it contains no private drafts or AI metadata.

Decision keys are scoped to actor, operation and proposal and bound to a canonical
validated request hash for 24 hours. The transaction persists the decision,
lifecycle/version changes, activity and replay record together. Identical retries
return the original outcome; changed payloads conflict. Account and current object
access are reauthorized before replay. A key never grants access after drop or
disablement. Ordinary edits remain frozen after approval and in release states.

Contributor resubmission now appends a fresh immutable revision and revision-specific
assignment while retaining the reviewer and advancing versions. Coverage starts
empty; proposal findings retain history/status. The owner API, notifications and
acknowledgements are described above. Reviewer approval revocation and real release
operations are implemented in iteration 4 with separate independent review status.
Do not add another decision to CHANGES_REQUESTED to emulate resubmission.

## Browser verification

For the built-client browser/accessibility smoke test:

```sh
npm run build
npx playwright install chromium
npm run test:e2e
```

Port 3000 must be free; Playwright starts its own production-mode server. This
suite uses the disposable `TEST_DATABASE_URL` to test all three account roles and
scans the login page. It does not establish full product WCAG conformance.

CI runs the checks with PostgreSQL, Chromium, dependency audit, secret scanning,
Docker Compose and an HTTP smoke test. Local checks are not proof that remote CI
has executed. CI publication/signing and live environment promotion are later
release work, documented in [Deployment](Deployment.md).

## GitHub PR review with Codex

Use the native Codex GitHub integration for this repository. Review guidance lives
in the root [Code Review Rules](../AGENTS.md#code-review-rules); no API key or
additional GitHub Actions workflow is required for this setup.

Activation is an account setting, not a setting committed in this repository:

1. Open [Codex code review settings](https://chatgpt.com/settings/code-review)
   and connect `CS3227-2610-MP4-SpecSentry/CS3227-2610-MP4`. If missing,
   check the GitHub connection's repository access and organization approval.
2. Select the repository, enable **Automatic review** under **Review code**,
   and choose **All PRs** for team coverage. Configuring this requires GitHub
   push or admin permission. With personal preferences, each author enables
   automatic review and selects a trigger.
3. Push the guidance and open a representative PR. Verify that Codex responds;
   comment `@codex review` to request a manual review.

If no response appears, check repository access, review settings and the trigger.
GitHub connection alone does not prove automatic reviews are enabled.
For a missing repository, check the organization's [installed GitHub Apps](https://github.com/organizations/CS3227-2610-MP4-SpecSentry/settings/installations).
Configure the Codex connector to include this repository. If absent, install it
through Codex's GitHub connection flow and choose the SpecSentry organization.

Keep CI and human approvals as merge gates. This developer tool is separate from
the product's Reviewer role and SoC gateway.

See the [official setup and troubleshooting guide](https://learn.chatgpt.com/docs/third-party/github).

## Security boundaries

The frontend shell and login bootstrap are public; protected API content requires
an active session. Global authentication, CSRF and optional role guards run before
protected handlers. Domain services must still enforce object scope and lifecycle
constraints. Unknown API routes and missing assets stay JSON 404 responses.
Proxy trust defaults to zero and must match the controlled deployment topology.
See [Authentication](Authentication.md) for the session and administration contract.

Health responses expose only status. Database query and connection timeouts are
bounded; connection failures produce generic 503 errors with generated correlation
IDs. Configuration errors never print supplied values. Helmet supplies baseline
headers. Keep server/client/shared imports separated; ESLint prohibits server
imports from frontend/shared TypeScript. Do not log request bodies or URLs that
may contain credentials. TLS verification must remain enabled for Neon.

## Architecture and module ownership

See [Architecture](Architecture.md) for responsibilities, the diagram and transaction
seams. `AppModule` registers Identity, Proposals, Reviews, Releases, Activity,
Notifications and AI modules. Identity, Proposals, Reviews, Activity and Notifications
implement the documented bounded workflows. The AI module now provides the
Reviewer gateway through dependency injection; Releases remains a registration.
`DatabaseModule` encapsulates the configured Prisma provider. Add frontend role
folders as their features are implemented; `shared/src/contracts` holds wire
schemas while retaining the existing package exports.

Each business module owns its rules and scoped persistence access. Cross-module
submission, revocation and publication use cases must coordinate one transaction
with activity and required notifications. Never grant access based on client routes.

## Development process and grading artifacts

The [workflow directory guide](../workflow/README.md) describes the specifications,
agent definitions, procedures, templates, scripts and tests. Start at
[Development](../workflow/DEVELOPMENT.md) for spec-driven development and coordinated
agent responsibilities. Reviewer-specific execution starts at
[its entry point](../workflow/reviewer/README.md). Workflow-tool tests do not prove
product acceptance. Root `AGENTS.md` and `.agents/skills` stay at natural discovery
locations; workflow content is otherwise consolidated under `workflow/`.

The [AI security specification](../workflow/specs/AI-SECURITY-SPEC.md) defines planned
context restrictions, validation, quotas, timeouts and adversarial tests. Implement
and test them before exposing role AI endpoints. Session, CSRF, IDOR, concurrency,
injection and malformed-output verification must be linked in traceability as real
evidence, not inferred from module names or configuration.

Record prompt/change summaries under `logs/<prompter>/` using
[the prompt log template](../workflow/templates/PROMPT-LOG.md), with measurements
following [RESOURCES](../workflow/RESOURCES.md). Humans must verify summaries.
Controlled context, coordination, model and cache experiments use
[EXPERIMENT](../workflow/templates/EXPERIMENT.md); store safe results under
`workflow/evaluations/` (create it with the first result) and analyze them in
[Reflections](Reflections.md). Each result should identify source revision,
conditions, case IDs, commands, outcomes and measurement sources. Use synthetic
inputs and safe metadata; planned cases are not executed evidence. Mark
unexposed telemetry unavailable; never log hidden reasoning or credentials.

Run `npm run check:submission` to check local artifact presence. It does not certify
implementation, public accessibility or grading completion. See
[Submission readiness](../workflow/SUBMISSION.md) for outstanding checks.
The [User Guide](UserGuide.md) describes only current features.

## Product website

`src/website/index.html` is a dependency-free static product site. Preview it with
any local static server. `.github/workflows/pages.yml` publishes only that directory
from `master`, including manual dispatch. In repository Settings → Pages, select
**GitHub Actions**; after merging, inspect the workflow's deployment URL. Environment
protection still applies. Documentation links target `master` and reflect changes
after merge. Add screenshots and the application link only after release verification.
Application hosting remains separate and team-managed; see [Deployment](Deployment.md).
Neither live deployment is claimed here.

## Acknowledgements

The scaffold is new source, with no prior-MP code reused. It uses the APIs described
in [NestJS](https://docs.nestjs.com/), [Vite](https://vite.dev/guide/),
[Prisma 7](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7),
[React](https://react.dev/), [Zod](https://zod.dev/), and their test tooling.
CI uses the maintained [checkout](https://github.com/actions/checkout) and
[setup-node](https://github.com/actions/setup-node) Node24 actions, plus the
[Gitleaks CLI](https://github.com/gitleaks/gitleaks) container for secret scanning.
The runtime and PostgreSQL container digests were resolved from Docker Hub during
scaffolding. Update them deliberately alongside compatibility and security checks.

The user-supplied CS3227 MP4 assignment description informed the submission checklist
and required guide/reflection/site structure. Codex assisted with the architecture,
module scaffold and documentation; prompt summaries record scope and checks. No
prior-MP source or documentation was imported by this initialization. The AI
specification separately cites earlier public protocol compatibility references;
those are references, not imported application code. Record future adapted ideas,
code, text or assets here with source, license and affected files.
