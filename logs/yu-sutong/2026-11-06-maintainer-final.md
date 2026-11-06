# Final Release Maintainer completion

Date: 6 November 2026
Prompter: `yu-sutong`
Branch/base: `feature/release-maintainer-membership` / `18cfd7d`
Scope: REQ-REL-001–008 and project aggregate NFR-RES-001

## Context and requests

The user first asked to prepare the next Maintainer pull request, then explicitly
made this the last Maintainer-role PR and asked to implement everything still left.
The earlier membership-only preparation was therefore stopped before source edits
and replaced by one complete Maintainer-role scope. Prior instructions require the
deployment-agent workflow and presentation-ready interaction evidence. Any eventual
GitHub publication must use `yu-sutong`, never `yust-planner`.

Authorized work in this run was local source, migration, contracts, tests,
specification, guides, workflow evidence and safe validation. The request did not
authorize a commit, push, pull request, merge, remote database migration, cloud
provisioning, deployment, production promotion/rollback or live-provider request.
No credential values were requested or recorded.

## Deployment-agent workflow interactions

1. A read-only Maintainer Architect inventoried every remaining REQ-REL-001–008
   gap and produced the endpoint/model/UI/test plan. It preserved creator ownership,
   server-authoritative gates, explicit publication and append-only corrections.
2. A Security Reviewer pre-reviewed membership, publication, notification,
   correction, audit and AI boundaries. Its controls required authorization before
   pointer reads, exact optimistic coordinates, common lock order, bounded minimal
   projections, rendered-notice acknowledgement, no audit/prompt leakage and
   reauthorization around every AI attempt.
3. The Maintainer backend implementer owned Prisma, migration, release persistence
   and restricted audit. The coordinator owned shared/client/docs integration. A
   separate deployment architect implemented the Maintainer gateway/service and
   project aggregate usage path. These write sets were disjoint before integration.
4. The backend interval reported Prisma validation/generation, server type/build,
   all 184 unit tests at that implementation checkpoint, a fresh PostgreSQL 14 deployment of all ten migrations,
   migration trigger/constraint probes and 33 focused integration cases. This is
   that implementation interval's evidence; the coordinator later independently
   repeated the complete migration and integration suite as described below.
5. The coordinator integrated exact-version membership, notification acknowledgement,
   publication recovery, annotation/audit/AI components and documentation. A known
   TypeScript failure caused by a local `candidate` variable shadowing the test
   helper was corrected without behavior changes.
6. The first complete lint gate found a render-read publication retry ref and a
   synchronous assistant effect reset. Publication intent became reactive state;
   candidate-scope remounting and explicit abort/parent-lock cleanup replaced the
   effect reset. An identical-body/idempotency-key recovery regression and an
   unmount cleanup regression were added.
7. The first independent Release Verifier returned `REL-VER-001` and
   `REL-VER-002`: RELEASED detail recomputed an `EMPTY` OPEN blocker, and an
   oldest-first 1,000-record smoke window could hide the latest authoritative result.
   RELEASED detail is now terminal with no OPEN blockers. The intermediate correction
   retrieved 1,001 newest-first rows and returned the newest 1,000; a later security
   review replaced that large projection with the final byte-bounded design described
   below. The first corrected client test failed only because text crossed a nested
   `<strong>` element; its DOM-aware assertion then passed.
8. The first Security Reviewer returned PASS with no stable finding. It verified
   session/role/CSRF, creator ownership, common lock order, recipient notice scope,
   annotation triggers, audit projection, AI minimization/grounding/deadlines and
   plain-text React rendering. A first full-client timing failure was not reproducible;
   the affected complete App test file and the coordinator's later full suite passed.
9. The first Spec/Docs Verifier correctly held completion for the missing final log,
   stale test count, unfinished resources and the same smoke-window issue. The log,
   counts, evidence boundary and current architecture/guides were reconciled.
10. The second Release Verifier identified `REL-VER-003`: a deferred assistant `401`
    could call the session-loss handler after the component had unmounted. Status
    handling now follows the active-generation guard, and a deferred-401 regression
    verifies that unmount aborts the request, releases the parent lock and ignores the
    late result.
11. The second Security Reviewer identified `SEC-REL-RESOURCE-001` and
    `SEC-AI-RESOURCE-001`. Candidate detail now returns only the authoritative latest
    smoke record; history moved to candidate-bound newest-first cursor pages with a
    default of five, maximum of twenty and a 256 KiB UTF-8 content budget. Project AI
    usage now uses database counts/aggregation, `AiRequest(requestedAt)` is indexed,
    and serialized request-record admission limits preflight-only floods to 120 per
    actor/rolling ten minutes, 1,000 per actor/SGT day and 300 project-wide/rolling
    minute without inserting a rejected excess request. The integration boundary
    creates 1,001 records and separately exercises maximum-size Unicode rows.
12. After those corrections the coordinator passed 186 server and 289 client tests,
    type-check, production build, Prisma validation, lint, the 16-case deployment
    workflow harness, submission presence and `git diff --check` before the final
    database-driven correction.
13. A final isolated PostgreSQL 14 run exposed a real annotation defect hidden by
    unit tests: direct business-layer CRLF text reached the database before the
    contract's newline normalization and violated the normalized-text constraint.
    `ReleasesService.annotate` now applies the shared normalizer before insert while
    the contract and database keep their length, ownership, exact-snapshot/version
    and append-only controls. Two earlier database attempts were environment-only
    failures: the first inherited `Asia/Singapore` instead of required UTC, and the
    second used a disposable name other than the legacy fixture's exact
    `specsentry_test`. With UTC and that safety name, all ten migrations and the
    complete 21-suite/269-test integration run passed. The temporary server and all
    three temporary databases were then stopped and removed.
14. Fresh read-only Release and Security reviews passed the corrected frozen tree;
    the final Spec/Docs review reproduced the 186/289/16 counts, confirmed the
    21-suite/269-test and ten-migration inventory, resolved every relative link and
    matched all 61 non-log candidate files to the SHA-256 manifest. No verifier
    changed source or external state.

## Changes and evidence

- Strict bounded eligible-proposal discovery exposes only exact proposal, revision,
  assignment and optimistic versions. A completed approval remains effective after
  its Reviewer is disabled unless explicitly invalidated.
- Creator-only OPEN candidate add/remove uses exact candidate/content/proposal/
  assignment coordinates. All successful, stale, uncertain or malformed responses
  require authoritative detail and eligibility reconciliation before another change.
- Candidate detail returns safe member/publication metadata and bounded recipient-only
  unread revocation notices. The browser acknowledges only exact rendered IDs through
  the existing CSRF-protected command; reading never restores approval.
- Publication requires explicit human confirmation. The server atomically rechecks
  gates and serializes against revocation. Uncertain recovery preserves one body and
  idempotency key; a changed candidate invalidates the intent.
- All Maintainers can read released corrections; only the responsible creator can
  append against the exact RELEASED candidate version and snapshot. Database foreign
  keys/triggers reject scope mismatch and all update/delete attempts.
- The restricted audit AND-combines actor/proposal/release/action/outcome/date filters
  across allowlisted business, security, safe AI and annotation metadata. It does not
  select raw prompts/responses, credentials, request bodies, private drafts,
  annotation text or publication evidence.
- The creator-only OPEN Release Gate Assistant receives structured summaries and
  deterministic gate statuses, uses the shared 6,000-unit/800-token bounded gateway,
  rejects secrets and ungrounded/unsafe output, returns CURRENT or STALE, and performs
  no business mutation. Project usage is aggregate only, without per-user run data;
  aggregate queries stay in PostgreSQL and serialized request-record admission also
  bounds locally rejected and disabled calls.
- RELEASED detail is terminal. Candidate detail returns only the newest authoritative
  smoke record; optional history uses candidate-bound newest-first cursor pages of at
  most twenty records and 256 KiB of UTF-8 procedure/result text.

## Validation and failures

The final coordinator gate after all implementation and review corrections passed 186 server unit
tests, 289 client tests, 16 deployment-workflow harness tests, workspace type-check,
production build, Prisma validation, root lint, submission-presence and
`git diff --check`. The production build retains the existing non-failing large-chunk
warning. Focused Maintainer client verification passed 26 tests before the complete
suite. A fresh local PostgreSQL 14 instance applied all ten migrations and passed all
269 integration tests, including the 1,001-record/maximum-Unicode smoke boundary,
database immutability/capacity probes and publication/revocation races. No browser
E2E, live provider or deployed environment is claimed.

## Resource record

Structured intervals are under
`logs/yu-sutong/resources/2026-11-06-maintainer-final/`. The earlier superseded
membership preparation remains honestly recorded under
`logs/yu-sutong/resources/2026-11-06-maintainer-membership/`, including its
interrupted main interval. Per-record model, token, cache, tool-call and retry
telemetry are unavailable and remain null with reasons; elapsed times can overlap.
The 17 records contain 13 succeeded and four failed-then-corrected intervals,
18,899.021755 summed overlapping seconds and 7,385.697 seconds end to end. The
generated final resource report is
[2026-11-06-maintainer-final-resources.md](2026-11-06-maintainer-final-resources.md).

## Remaining human and external gates

Teammate patch review, configured browser CI, live-provider policy and
usefulness acceptance, commit/push/PR authorization, merge, remote migration and
deployment remain external. Before any later GitHub publication, verify both GitHub
CLI and Git transport use `yu-sutong`. Human verification of this AI-assisted summary
and the submitted work remains required.
