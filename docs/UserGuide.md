# SpecSentry User Guide

Status: base authentication, 25 October 2026. No live application URL or
peer-testing accounts have been verified. This guide describes current behavior;
the [product specification](../workflow/specs/PRODUCT-SPEC.md) describes planned work.

## Access and current features

For local access follow [Developer Guide setup](DeveloperGuide.md#install-and-run).
With `npm run dev`, open <http://localhost:5173>. With the production-style Compose
profile, open <http://localhost:3000>.

Open the app to sign in with an account provided by your administrator. Enter your
username and password; your account's Contributor, Reviewer, or Release Maintainer
workspace opens automatically. The role is assigned to your account. A different
role's workspace displays an access-denied message. Domain workflow features and
AI assistants remain pending.

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

## Troubleshooting

If sign-in is unavailable, confirm the backend is running and Vite proxies
`/api`. If readiness fails, check local PostgreSQL and server configuration using
the Developer Guide; ensure the authentication migration and accounts exist. See
[Authentication administration](Authentication.md). Do not share credentials or connection URLs in bug reports.
Include the action, observed result and safe correlation identifier when present.

## Release information to complete before peer testing

- Verified production application URL and release identifier: pending.
- Safe test-account distribution and sign-in instructions for each role: pending.
- Tested Contributor, Reviewer and Maintainer walkthroughs: pending implementation.
- AI success, limits, failure recovery and manual fallback walkthroughs: pending.
- Known release-specific limitations and supported browser evidence: pending.

Update this guide from observed release behavior before inviting peer testers.
Never publish real credentials, raw prompts or sensitive sample patches here.
