# SpecSentry User Guide

Status: authentication and the first Reviewer intake increment, 25 October 2026. No live application URL or
peer-testing accounts have been verified. This guide describes current behavior;
the [product specification](../workflow/specs/PRODUCT-SPEC.md) describes planned work.

## Access and current features

For local access follow [Developer Guide setup](DeveloperGuide.md#install-and-run).
With `npm run dev`, open <http://localhost:5173>. With the production-style Compose
profile, open <http://localhost:3000>.

Open the app to sign in with an account provided by your administrator. Enter your
username and password; your account's Contributor, Reviewer, or Release Maintainer
workspace opens automatically. The role is assigned to your account. A different
role's workspace displays an access-denied message. Reviewers can browse, claim,
inspect and drop seeded submissions. Contributor editing, findings, coverage,
review decisions, revision notifications, releases and AI assistants remain pending.

Use **Sign out** to end your session. Sessions expire after 30 minutes idle or
eight hours total; sign in again when prompted. Your browser does not retain
unsaved sensitive drafts. After repeated failed sign-in attempts, wait 15 minutes
before retrying. There is no self-registration or password-reset screen; contact
your administrator for account changes. Local HTTP sign-in uses `npm run dev`;
production-style containers require HTTPS for authentication cookies.

| Check | Action | Expected result |
| --- | --- | --- |
| Login | Open `/` while signed out | Labeled username/password form |
| Role workspace | Sign in | Landing page for your assigned role |
| Logout | Select Sign out | Login form; old session no longer grants access |
| Liveness | Open `/api/health` | JSON status `ok` and service `specsentry` |
| Database readiness | Open `/api/ready` | `ready` JSON when PostgreSQL responds; generic 503 otherwise |
| Unknown page | Open `/unknown-page` while signed in | Page-not-found message and return link |
| Unknown API | Open `/api/unknown` | Safe JSON 404 |

## Reviewer intake

The Reviewer workspace separates **Review pool** from **My assignments**. The pool
shows title, author, summary and submission ages. Full submitted content becomes
available after you claim a proposal. Filter by author ID and original submission
age; your assigned queue also supports state filtering. Original age starts at
the first submission; latest revision age is shown separately.

1. Select **Claim** on a pool item. If another Reviewer claimed it first, refresh
   the queue after the conflict message.
2. Inspect the submitted specification, criteria, diff and optional plain-text
   evidence. These are the immutable submitted revision, not a working draft.
3. Use **Submitted revision history** to inspect an older submitted revision.
   History and activity load in bounded pages. Opening history does not acknowledge
   revision notifications; notifications are outside this increment.
4. Select **Drop assignment** to return the proposal to the pool. It returns to
   `SUBMITTED` from `IN_REVIEW`; `CHANGES_REQUESTED` stays **Awaiting revision**.
   Dropping ends your access to full content. Another Reviewer can then claim it.

An awaiting-revision item can be claimed, inspected and dropped; this increment
does not provide approval or request-changes controls. Assignment history and
claim/drop activity are retained. Assignments do not expire automatically.
Activity entries identify the affected proposal, revision and assignment where
applicable, together with actor, time and outcome.

After a lost response or conflict, refresh the current state before trying another
action. After session expiry or access loss, sign in or return to the queue as
prompted. Previously displayed information is not saved in browser storage.

Local demonstration submissions are supplied through the development fixture
command described in the [Developer Guide](DeveloperGuide.md#reviewer-intake-fixtures).
There is no public submission-creation or fixture endpoint.

## Troubleshooting

If sign-in is unavailable, confirm the backend is running and Vite proxies
`/api`. If readiness fails, check local PostgreSQL and server configuration using
the Developer Guide; ensure the authentication migration and accounts exist. See
[Authentication administration](Authentication.md). Do not share credentials or connection URLs in bug reports.
Include the action, observed result and safe correlation identifier when present.

## Release information to complete before peer testing

- Verified production application URL and release identifier: pending.
- Safe test-account distribution and sign-in instructions for each role: pending.
- Local Reviewer intake walkthrough: verified in Chromium; deployed peer testing
  and full Contributor/Reviewer/Maintainer workflows remain pending.
- AI success, limits, failure recovery and manual fallback walkthroughs: pending.
- Known release-specific limitations and supported browser evidence: pending.

Update this guide from observed release behavior before inviting peer testers.
Never publish real credentials, raw prompts or sensitive sample patches here.
