# Contributor completion: shared interface coordination request

Status: proposed, awaiting affected owners' agreement. Existing scoped foundation/deletion/criteria agreements do not cover these changes. No teammate agreement or final review is inferred. Coordinator: yooplo's agent, 1 November 2026. Baseline `03cbea9`.

## Superseding coordination outcome

The user answered **Yes** to all four explicit binary questions in this session:
ngkhengyang agrees to additive lifecycle discovery preserving the old API;
ngkhengyang and yu-sutong agree to the version-bound clone, append-only response
persistence/API/migration, and Contributor extension of shared gateway/contracts/
accounting with live AI disabled. This is the user's relay of named-owner agreement
to these interfaces, not independently authenticated messages, final patch review,
approval to deploy or human verification of AI summaries. No direct teammate
messages, individual timestamps or broader agreement evidence are invented.
The original pending proposal below remains the design history; these four gates
are resolved for implementation and independent verification.

The existing Contributor submitted-read, submission, withdrawal and reopening APIs can be consumed unchanged. The following dependencies require coordination under workflow/contributor/README.md before implementation. No message has been sent to teammates by this agent.

| Interface | Proposed smallest change | Affected files / owners |
| --- | --- | --- |
| Lifecycle discovery | Preserve existing GET /api/proposals DRAFT-only contract. Add a separate owner-only paginated lifecycle list, carrying proposal ID, owner-visible title, state, version and nullable latest submitted revision. Do not expose working content to other roles. Reuse existing scoped cursor and transactional successful-read audit. | New Contributor contract in src/shared/src/contracts/contributor.ts, Contributor controller/lifecycle service, tests; ngkhengyang proposal/review interface owner and yooplo integrator. |
| Explicit latest-content clone | Add version-bound owner command for eligible SUBMITTED/IN_REVIEW/CHANGES_REQUESTED, no release attachment. Copy latest submitted snapshot into private working content atomically with proposal version and activity. Preserve unchanged criterion stable keys through an explicit clone path; regenerate valid working evidence identities from submitted text. Never relax ordinary PATCH identity validation or mutate submitted records. Require explicit UI replacement confirmation for existing working content and reject stale/attached/terminal requests. | Contributor contract/controller/lifecycle/working-revisions and tests; ngkhengyang proposal/revision identity owner, yu-sutong attachment/audit integration owner, yooplo integrator. Exact title snapshot limitation must be resolved: ProposalRevision currently stores no title. |
| Finding responses | New append-only FindingResponse: opaque ID, finding/proposal scope, authenticated author, plain text <=2,000 code points, mutation version and timestamp. POST /api/findings/:id/responses owner-only in IN_REVIEW/CHANGES_REQUESTED, expected proposal version and explicit current submitted revision scope; finding must belong to proposal. Atomically append response, proposal version and RESPONSE_ADDED activity. No finding status/event transition. Authorized paginated reads expose attributed responses to existing submitted viewers; historical findings remain addressable. Add a new migration, retain all existing immutable-history constraints. | src/server/prisma/schema.prisma + new migration, shared Contributor response contracts, Contributor service/controller, authorized response read projection, tests. ngkhengyang findings/read contract owner, yu-sutong persistence/audit owner, yooplo integrator. |
| Spec Draft Assistant | Extend existing SoC gateway with Contributor context/result adapter rather than another transport/quota system. Owner/version/eligible-working-revision authorization before context, outbound attempt and response. Only approved draft fields, 6,000 characters and 4,000 total input tokens, 800 output; strict Contributor schema, safe text, explicit selection into unsaved editor only. Reuse deadline, queue, retry, secret detection, audit/accounting controls; make existing Reviewer-specific AI metadata scope fields support distinct Contributor scope without fake assignment IDs. Production remains disabled until OPEN-002 credentialed verification. | Server ai/contracts, ai.module, gateway/accounting, Prisma AI metadata schema + new migration, shared AI request/response contracts, Contributor controller/assistant/client and tests. ngkhengyang shared AI gateway owner, yu-sutong persistence owner, yooplo Contributor integrator. |

Please identify agreement or changes per row, affected owner and evidence/reference. This is interface/design coordination, not final patch sign-off, migration execution on a normal database, live provider enablement or deployment approval. Approved role behavior remains unchanged; material unresolved product ambiguity is escalated separately. Existing API consumers and independent tests can proceed while these gates are pending.
