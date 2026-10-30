# SpecSentry User Guide

Status: authentication and Contributor private drafts/editing/deletion/criteria/submission-preparation
locally verified, 30 October 2026. No live application URL or
peer-testing accounts have been verified. This guide describes current behavior;
the [product specification](../workflow/specs/PRODUCT-SPEC.md) describes planned work.

## Access and current features

For local access follow [Developer Guide setup](DeveloperGuide.md#install-and-run).
With `npm run dev`, open <http://localhost:5173>. With the production-style Compose
profile, open <http://localhost:3000>.

Open the app to sign in with an account provided by your administrator. Enter your
username and password; your account's Contributor, Reviewer, or Release Maintainer
workspace opens automatically. The role is assigned to your account. A different
role's workspace displays an access-denied message. Contributors can create, list
and open/edit/delete their own never-submitted private drafts. Other role workflows and AI assistants remain pending.

### Contributor private drafts

After signing in as a Contributor, your workspace lists your own never-submitted
DRAFT proposals. Select **Create New Draft**, or **Create your first draft** in the
empty state. The summary counts drafts on the loaded page, not all account drafts.
Use **Next page** and
**First page** when the list spans pages.

Select **Create New Draft**, enter a title, problem and expected behavior, and optionally
enter constraints. Title is limited to 200 Unicode characters; each narrative field
to 10,000. Select **Create private draft** to save and open its private detail.
Select a draft row to open its saved detail, or **Back to your drafts** to return.
The row is a normal link and supports opening in another tab.
Only the owner can read this working content. Submission,
responses, lifecycle actions and the drafting assistant are not included yet.

The application sidebar shows your account's workspace and **Sign out**. Use
**Collapse navigation** or **Expand navigation** in the top bar to switch between
full navigation and a compact icon rail. Icon controls retain accessible names and
hover titles. The desktop sidebar and top bar remain visible while the workspace
scrolls; overflowing navigation scrolls separately from the workspace.
On mobile, select **Open navigation** to open the drawer and **Close navigation**
or press Escape to return to the workspace. Keyboard focus stays within the open
drawer, and the background workspace stops scrolling. Toggling navigation keeps
your current form open. A **Skip to main content** link is available when navigating
by keyboard. Reviewer and Release Maintainer accounts retain their availability
message until their workflows are implemented.

Contributor pages show the current task as the primary heading, with breadcrumbs
back to the workspace/draft list and the saved draft where applicable. Long draft
titles remain available on the breadcrumb link even when the displayed text is
shortened. Breadcrumb exits use the same unsaved-change confirmation as sidebar
navigation. On narrow screens the top bar keeps the task visible; full account
information remains available in navigation.

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

The editor keeps **Save private draft** and its textual save status together in a
compact action area while you scroll. Saving disables repeat submissions. A saved
confirmation appears only after the current committed version has been read back;
failed, conflicting or uncertain results keep your input and explain recovery.
When recovery is needed, the compact Save area provides **Recovery details** to
focus the full explanation and next steps in the workspace. Opening those details
does not discard edits, create a browser-history entry or enable a paused save.

Use **Draft sections** to move between **Overview**, **Acceptance criteria**,
**Patch** and **Evidence**. These links focus the relevant section inside the
workspace without discarding edits or adding browser-history entries. Narrative
fields use a narrower reading width; patch content retains more room. Labels,
field descriptions and character limits stay with their controls.

Leaving entered draft content through workspace navigation, branding, the workspace
breadcrumb, Back or browser history asks for confirmation when changes need
protection. Cancel keeps the current form; confirming leaves it. Clean content,
exactly reverted edits and successfully reconciled saves do not prompt during
normal operation; paused conflict/uncertain results remain protected. A pending-request
warning explains that leaving does not cancel a save already sent. Refresh, closing
and external navigation use the browser's own warning where browser policy permits;
its wording is controlled by the browser. Session expiry clears protected content
and requires sign-in without a discard decision. Unsaved content is never stored
in localStorage or sessionStorage.

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

Private detail includes **Saved acceptance criteria** in their stored order, each
marked **Required** or **Optional**, or an empty-state message when none are saved.
Statements are displayed as plain text. This is saved private working content,
not an immutable submitted snapshot or reviewer coverage assessment.

### Prepare summary, diff and evidence

In **Edit private draft**, the **Patch**
section offers **Contributor summary** (500 Unicode characters) and **Unified diff**
(100,000). Both are optional while drafting; incomplete patch text may be saved.
In **Evidence**, select **Add evidence** for optional plain-text items. Each added item must contain text
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

## Troubleshooting

If sign-in is unavailable, confirm the backend is running and Vite proxies
`/api`. If readiness fails, check local PostgreSQL and server configuration using
the Developer Guide; ensure the authentication migration and accounts exist. See
[Authentication administration](Authentication.md). Do not share credentials or connection URLs in bug reports.
Include the action, observed result and safe correlation identifier when present.

## Release information to complete before peer testing

- Verified production application URL and release identifier: pending.
- Safe test-account distribution and sign-in instructions for each role: pending.
- Deployed Contributor walkthroughs and remaining Reviewer/Maintainer role flows: pending.
- AI success, limits, failure recovery and manual fallback walkthroughs: pending.
- Known release-specific limitations and supported browser evidence: pending.

Update this guide from observed release behavior before inviting peer testers.
Never publish real credentials, raw prompts or sensitive sample patches here.

## Visual refinement and existing safeguards

See the [implemented UI/UX specification](../workflow/specs/UI-UX-SPEC.md) for
current screen behavior and the precise boundary between verified browser checks
and unimplemented product workflows.

The Contributor list presents its loaded-page count beside the draft list, with a
concise privacy explanation. The count describes this page, not all your drafts;
loading or an unavailable result is distinct from zero. The empty state offers the
existing Create action. Reviewer and Release Maintainer landings continue to show
their current availability message; visual refinement does not add workflow features.

Long editors retain section navigation, independent workspace scrolling, sticky
Save/status, field validation and explicit protection before discarding unsaved
edits. Required/optional acceptance criteria remain visible in saved detail.
Control feedback respects reduced-motion preferences. Before/after screenshots,
tested viewport sizes and verification limits are recorded in the
[Phase3 run](../logs/yooplo/2026-10-31-visual-phase3.md); production access and full
manual accessibility certification remain pending.
