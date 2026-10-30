# SpecSentry User Guide

Status: locally verified authentication and Contributor private drafts/editing/deletion/criteria, 28 October 2026. No live application URL or
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
DRAFT proposals. An empty list offers **Create a draft**. Use **Next page** and
**First page** when the list spans pages.

Select **Create a draft**, enter a title, problem and expected behavior, and optionally
enter constraints. Title is limited to 200 Unicode characters; each narrative field
to 10,000. Select **Create private draft** to save and open its private detail.
Select a title in the list to open an existing draft, or **Back to your drafts** to return.
Only the owner can read this working content. Submission,
responses, lifecycle actions and the drafting assistant are not included yet.

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
