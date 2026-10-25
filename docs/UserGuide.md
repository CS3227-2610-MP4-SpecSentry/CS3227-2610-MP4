# SpecSentry User Guide

Status: infrastructure scaffold, 25 October 2026. No live application URL or
peer-testing accounts have been verified. This guide describes current behavior;
the [product specification](../workflow/specs/PRODUCT-SPEC.md) describes planned work.

## Access and current features

For local access follow [Developer Guide setup](DeveloperGuide.md#install-and-run).
With `npm run dev`, open <http://localhost:5173>. With the production-style Compose
profile, open <http://localhost:3000>.

The public setup page shows SpecSentry and checks service availability. A valid
health response shows “Service is online.” Network or invalid-response failures
show a safe unavailable message. This checks the backend process, not database
readiness. Sign-in, accounts, role screens and AI features are not available yet.

| Check | Action | Expected result |
| --- | --- | --- |
| Setup page | Open `/` | Product heading, setup notice and service status |
| Liveness | Open `/api/health` through the app origin | JSON with status `ok` and service `specsentry` |
| Database readiness | Open `/api/ready` | `ready` JSON when PostgreSQL responds; generic 503 otherwise |
| Unknown page | Open `/unknown-page` | Page-not-found message and return link |
| Unknown API | Open `/api/unknown` | Safe JSON 404 |

## Troubleshooting

If service status is unavailable, confirm the backend is running and Vite proxies
`/api`. If readiness fails, check local PostgreSQL and server configuration using
the Developer Guide. Do not share credentials or connection URLs in bug reports.
Include the action, observed result and safe correlation identifier when present.

## Release information to complete before peer testing

- Verified production application URL and release identifier: pending.
- Safe test-account distribution and sign-in instructions for each role: pending.
- Tested Contributor, Reviewer and Maintainer walkthroughs: pending implementation.
- AI success, limits, failure recovery and manual fallback walkthroughs: pending.
- Known release-specific limitations and supported browser evidence: pending.

Update this guide from observed release behavior before inviting peer testers.
Never publish real credentials, raw prompts or sensitive sample patches here.
