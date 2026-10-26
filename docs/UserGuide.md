# SpecSentry User Guide

## Patch Risk Assistant

On a current assigned review in IN_REVIEW or CHANGES_REQUESTED, select one to five
acceptance criteria and request risk analysis. The panel identifies the analyzed
revision and selected criteria; all other criteria remain not analyzed by that
batch. Suggestions are advisory, confidence is model judgment, and rerunning may
produce different results. AI coverage never changes your manual assessments.

Choose Create finding on a current risk to open an editable human form. Review
the severity, description and optional criterion before explicitly saving. Cancel
creates nothing. A stale result cannot create a current finding; reconcile the
latest revision instead. Saved findings follow the normal authorization and
transaction rules.

Raw suggestions and unsaved AI-prefilled forms disappear when the page session
ends. They are not restored after reload or reopening. Live-provider verification
is still pending, so the ordinary application currently offers a safe unavailable
message. Manual coverage, findings and decisions remain usable while AI is
pending or unavailable. If the complete context exceeds the AI size limits, the
panel explains that limit; your manual entries remain available and the submitted
specification, diff and evidence are not truncated to fit.

See [AI integration and verification boundaries](AI-Integration.md). Independent
implementation review and the five resulting fixes have completed. Live operation
still awaits provider verification.

## Reviewing a replacement revision

Reviewer notices identify each newly submitted revision. Choose **Open notified
revision** to inspect it. Opening a revision acknowledges only that revision;
opening older history leaves newer notices unread. The workspace shows the latest
submitted revision separately from the revision currently viewed, plus a
new-revision badge when the latest notice is unread.

A Contributor resubmission retains the assigned Reviewer and starts fresh
criterion coverage. Earlier assessments and decisions remain in history.
Findings preserve original authorship and transitions; unresolved HIGH/CRITICAL
findings still block approval, and resolved findings do not reopen automatically.
A request for changes cannot be reversed without Contributor resubmission. The
Contributor API supports this cycle; the full Contributor drafting screen remains
future work. Original submission age does not reset on resubmission.

If another revision arrives or the assignment changes, the server rejects an old
form. The workspace freezes those forms and retains entered text while access
remains valid. Explicitly refresh/reconcile before assessing the new revision;
old edits are never silently moved to it. Explicit refresh discards unsaved edits.

Withdrawal ends the assignment and full-content access. A safe status notice stays
for the intended Reviewer with no content link. Protected client state is cleared
when access loss/withdrawal is observed. Owners and scoped Maintainers retain
submitted history. Reopening an unattached approval invalidates its effect while
preserving the decision; attached/released proposals cannot be reopened.
If its previous Reviewer was disabled, reopening returns the unfinished work to
the unassigned awaiting-revision queue so the owner can resubmit or withdraw.

Manual review remains usable without AI. Verification boundaries and current
evidence are in the [iteration 2 run](../logs/ngkhengyang/2026-10-26-reviewer-iteration2.md).

Status: authentication, manual review and revision cycles, 26 October 2026. No live application URL or
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
inspect and review seeded submissions, assess criteria, manage findings and record
human decisions, receive revision notices and review owner-API submissions.
The full Contributor editing UI, releases and Contributor/Maintainer AI assistants
remain pending. Reviewer AI has a bounded implementation with live operation
disabled pending provider verification.

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

## Manual review

The Reviewer workspace separates **Review pool** from **My assignments**. The pool
shows title, author, summary and submission ages. Full submitted content becomes
available after you claim a proposal. Filter by author ID and original submission
age; your assigned queue also supports state and unresolved-severity filtering. Original age starts at
the first submission; latest revision age is shown separately.

1. Select **Claim** on a pool item. If another Reviewer claimed it first, refresh
   the queue after the conflict message.
2. Inspect the submitted specification, criteria, diff and optional plain-text
   evidence. These are the immutable submitted revision, not a working draft.
3. Use **Submitted revision history** to inspect an older submitted revision.
   History and activity load in bounded pages. Opening a revision acknowledges only
   its own notice; a newer revision's notice remains unread.
4. Assess each criterion as covered, partially covered, not covered or not
   applicable. The last three require a rationale. Evidence links are optional,
   including for covered criteria; the same evidence may support several criteria.
   You cannot change whether a criterion is required.
5. Add findings with severity and description, optionally referencing a criterion
   or diff path and line. Resolve, reopen or change severity with an explanation.
   Append an amendment to correct a finding. Original authorship and description
   remain visible, with attributed history.
6. Inspect the approval blockers. Approval needs an assessment for every criterion,
   all required criteria covered, individually confirmed inherited assessments,
   and no unresolved HIGH or CRITICAL findings. LOW and MEDIUM findings alone
   do not prevent approval. Request changes with a finding or explanatory note;
   coverage may be incomplete. This ends the review round until resubmission.
7. Select **Drop assignment** to return the proposal to the pool. It returns to
   `SUBMITTED` from `IN_REVIEW`; `CHANGES_REQUESTED` stays **Awaiting revision**.
   Dropping ends your access to full content. Another Reviewer can then claim it.

An awaiting-revision item can be claimed, inspected and edited, but another
decision requires Contributor resubmission through the owner API. After takeover on the same revision, confirm or replace each preserved
assessment individually. Findings retain their original author and history;
unresolved findings remain actionable. A new revision needs fresh assessments.
Resolved findings stay historical until explicitly reopened. Approval freezes
ordinary review edits, as do release states. Historical revisions are read only.
Assignments do not expire automatically. Account disablement releases unfinished
assignments and preserves completed approvals.
Activity entries identify the affected proposal, revision and assignment where
applicable, together with actor, time and outcome.

After a conflict, explicitly refresh and reconcile the current state before trying
another action. An old form cannot be applied to a new revision or assignment.
After an uncertain decision response, use the offered retry with its original
request identity to recover the committed outcome. After session expiry or access loss, sign in or return to the queue as
prompted. Previously displayed information is not saved in browser storage.

Local demonstration submissions are supplied through the development fixture
command described in the [Developer Guide](DeveloperGuide.md#reviewer-intake-fixtures).
The authenticated owner API can create submissions; there is no public fixture endpoint.

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
