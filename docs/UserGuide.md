# SpecSentry User Guide

## Revoke an approval before release

The assigned Reviewer can revoke an effective approval from the current submitted
proposal. Enter a reason and review the impact explanation before submitting.
The original approval stays in decision history; the revocation and its reason
appear in activity. Released records show history without a revoke action.

For an unattached approved proposal, revocation enters `CHANGES_REQUESTED` and
retains its Reviewer. The Contributor must revise and resubmit before another
decision. For a proposal already in an open release candidate, revocation keeps
it attached in `IN_RELEASE`, blocks publication and creates a durable notice for
the responsible Maintainer. Ordinary review edits and Contributor revision stay
blocked until that Maintainer explicitly removes the item. Reading a notice does
not restore approval or remove the blocker.

Recoverable errors keep the entered reason. After a conflict, refresh and reconcile
the displayed state before another submission. An offered uncertain-response retry
uses the original request identity. Session expiry or lost access clears protected
page content. General release management and Maintainer notice viewing are currently
available through the API; a broader Maintainer workspace is outside this increment.

This is the local iteration-4 implementation. Its verification, independent review
and fix status are recorded in the [iteration log](../logs/ngkhengyang/2026-10-26-reviewer-iteration4.md).
Deployment and teammate approval remain separate.

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
Contributor API supports this cycle; the private drafting screen is implemented,
while its submission and submitted-editing controls remain future work. Original submission age does not reset on resubmission.

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

Status: locally implemented Reviewer workflows and Contributor private drafts/editing/deletion/criteria/submission-preparation,
combined 31 October 2026. Per-increment verification is linked below; combined merge verification
is recorded separately. No live application URL or
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
Full Contributor submitted-editing/submission UI, broader release workspace and
Contributor/Maintainer AI assistants remain pending. Approval revocation and the supporting release API are described above.
Reviewer AI has a bounded implementation with live operation
disabled pending provider verification.
Contributors can create, list and open/edit/delete their own never-submitted private
drafts and manage acceptance criteria as described below.

### Contributor private drafts

After signing in as a Contributor, your workspace lists your own never-submitted
DRAFT proposals. Select **Create New Draft**, or **Create your first draft** in the
empty state. The summary counts drafts on the loaded page, not all account drafts.
Use **Next page** and
**First page** when the list spans pages.

Select **Create New Draft**, enter a title, problem and expected behavior, and optionally
enter constraints. Title is limited to 200 Unicode characters; each narrative field
to 10,000. Select **Create private draft** to save and open its private detail.
Select a title in the list to open an existing draft, or **Back to your drafts** to return.
Only the owner can read this working content. Submission, responses and lifecycle actions are not exposed in this private-draft
workspace; the drafting assistant remains pending.

The application sidebar shows your account's workspace and **Sign out**. Use
**Collapse navigation** or **Expand navigation** in the top bar to switch between
full navigation and a compact icon rail. Icon controls retain accessible names and
hover titles. The desktop sidebar and top bar remain visible while the workspace
scrolls; overflowing navigation scrolls separately from the workspace.
On mobile, select **Open navigation** to open the drawer and **Close navigation**
or press Escape to return to the workspace. Keyboard focus stays within the open
drawer, and the background workspace stops scrolling. Toggling navigation keeps
your current form open. A **Skip to main content** link is available when navigating
by keyboard. Reviewer accounts open their implemented review workspace; Release
Maintainer accounts retain an availability message while their broader workspace
remains pending.

### Delete a never-submitted draft

From saved private draft detail,
select **Delete private draft**. The confirmation identifies the draft and explains that
deletion cannot be undone. **Cancel deletion** keeps it; **Permanently delete draft**
removes its saved working content. Only the owner of a never-submitted DRAFT can do this.
An editable working copy of a submitted proposal does not permit deleting its history.
No deletion reason is required. A minimal non-content audit tombstone is retained.

While deletion is pending, repeat requests are disabled. Success returns to your draft
list. If the draft changed or the outcome is uncertain, deletion pauses. Select
**Check current draft** before trying again; a successful check loads the current saved
version and requires a fresh confirmation. If it is no longer available, return to your
draft list; that alone does not prove which request removed it. A failed check keeps
deletion paused. Session expiry requires signing in again.

### Edit a never-submitted draft

Open your private draft detail and select **Edit private draft**. Change title, problem,
constraints or expected behavior, then select **Save private draft**. A successful save
shows the new version; you can keep editing or select **Back to draft detail**. Hidden
fields from the existing draft are preserved. Criteria controls are described below;
there are no submission controls. The server rejects editing if the draft is no longer eligible.

### Manage draft acceptance criteria

In the private editor,
select **Add criterion**, enter its statement and set its **required** checkbox. New criteria
default to required. You may save zero criteria or all-optional criteria; submission readiness
is a separate, currently unavailable action. Each saved statement must be nonblank and at most
2,000 Unicode characters; the collection limit is 50. A blank or invalid row keeps your input
and shows an error rather than being silently removed. **Remove criterion** removes the row
from your working draft when you save.

When changing a saved statement, choose its **meaning**: **Same meaning / wording correction**
retains its identity; **Materially changed meaning / replace criterion** gives it a new identity.
The application uses your declaration; it does not infer meaning. Classification-only changes
keep identity. Removed then re-added criteria receive new identities.

After saving, the editor reads the committed draft to obtain its assigned identities. If this
check fails or finds a different version, your entered text and choices remain and saving pauses.
Follow the explicit reload/discard confirmation to recover; do not assume another save is safe.
These controls apply only to never-submitted drafts, not submitted history or findings.

### Prepare summary, diff and evidence

In **Edit private draft**, the **Submission preparation**
section offers **Contributor summary** (500 Unicode characters) and **Unified diff**
(100,000). Both are optional while drafting; incomplete patch text may be saved.
Select **Add evidence** for optional plain-text items. Each added item must contain text
or be removed before saving, with 50,000 characters total across all evidence. Editing
these fields preserves your other draft content and criterion identities.

**Save private draft** saves preparation text with the rest of the draft. Line endings are
normalized; text is not silently truncated. The whole JSON request also has a 1 MiB byte
limit: if it is too large, reduce the text and save again. Errors retain your input;
conflict or uncertain outcomes use the confirmed reload/recovery flow below. Saved text
appears in private detail and can be reopened for editing.

Summary, patch and evidence are displayed as plain text. HTML, Markdown, commands and
patches are not executed or fetched. This prepares a private draft; it does not submit it,
create immutable revisions, assign a reviewer or send notifications.

Validation and failed saves retain your entered text. If the draft changed elsewhere,
is no longer editable, or the save response is uncertain, saving pauses so an old form
cannot overwrite newer work. Select **Reload latest draft and discard changes** only
when ready to replace your unsaved input with the latest saved version. Confirm the
discard prompt; cancel keeps your text. A failed reload also keeps your text and needs
another explicit retry. Reapply any desired edits after reviewing the reloaded version.
Returning to detail with unsaved changes also asks for confirmation.

Unsaved editor input is held only in the signed-in page's memory. Refreshing, leaving
the editor, signing out or losing the session can clear it; no browser storage is used.
Only never-submitted DRAFT editing is available; submitted-revision editing is deferred.

Validation messages identify fields to correct and preserve entered text. Network/server
failures show a safe message and a reference identifier when available. If a create
response is interrupted, the draft may already exist: return to the draft list and
check before creating again. The create button remains disabled until the list loads
successfully. Unsaved text stays only in the current signed-in workspace memory;
refreshing, signing out or session expiry clears it. It is not saved in browser storage.

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
- Deployed Contributor walkthroughs and broader Maintainer workspace: pending.
- AI success, limits, failure recovery and manual fallback walkthroughs: pending.
- Known release-specific limitations and supported browser evidence: pending.

Update this guide from observed release behavior before inviting peer testers.
Never publish real credentials, raw prompts or sensitive sample patches here.
