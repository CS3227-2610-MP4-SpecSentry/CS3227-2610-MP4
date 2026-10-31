# Independent implementation and security review

**Changes required: five open findings, one HIGH and four MEDIUM.** This review
assesses the unchanged integrated source at HEAD
`b8daea2dac771a0c372a01e4d0a23da4e44690e3`, identified by all 36 SHA-256 entries in
the [source manifest](source-manifest.json) and the `integrated-before-review`
snapshot. No application source, tests, configuration or specifications changed
during review. Review task completion is not implementation approval.

The independent implementation reviewer `/root/independent_reviewer` and code
security reviewer `/root/code_security` both used selected settings
**gpt-6.1-sol/high**. Neither implemented the assessed code. The implementation
reviewer independently reproduced and endorsed the three security findings;
duplicate observations share one canonical finding each.

## Findings and required corrections

| Canonical / reviewer ID | Severity | Finding and observed impact | Owner |
| --- | --- | --- | --- |
| F-001 / SEC-CODE-001 | HIGH, blocking | [Secret screening](C:/Users/User/Documents/NUS/CS3227/CS3227-2610-MP4/src/server/src/ai/gateway/index.ts:28) misses quoted JSON credential assignments, encrypted private-key markers and normalized token forms. Synthetic mocked gateway probes dispatched those forms; positive-control unquoted credentials were rejected. Reject high-confidence credentials before outbound attempts and screen/redact lower-confidence normalized forms consistently without changing grounding IDs. Add representative diff/narrative/criterion/evidence tests. | gateway |
| F-002 / SEC-CODE-002 | MEDIUM, blocking | [Advertised response-size rejection](C:/Users/User/Documents/NUS/CS3227/CS3227-2610-MP4/src/server/src/ai/gateway/transport.ts:41) throws before cancelling the body; finally clears the abort timer/listener without aborting. Both synthetic open-stream probes observed INVALID_OUTPUT with cancellation=false and transport abort=false. Cancel/abort every early rejection and verify actual overflow, advertised overflow, invalid UTF-8 and deadline-during-read cleanup. | gateway |
| F-003 / SEC-CODE-003 | MEDIUM, blocking | [Output decoding and usage accounting](C:/Users/User/Documents/NUS/CS3227/CS3227-2610-MP4/src/server/src/ai/gateway/index.ts:92) only transfers usage after content validates. Valid provider counts 321/123/444/cache12 persist for valid output but become four null values when only role JSON is malformed. Validate/retain safe usage independently of advisory acceptance, including refusal/truncation/schema errors; do not retain raw output or invent absent usage. | gateway |
| F-004 / REV-IR-001 | MEDIUM, blocking | [Size-limit feedback](C:/Users/User/Documents/NUS/CS3227/CS3227-2610-MP4/src/client/src/features/reviewer/PatchRiskAssistant.tsx:77) discards safe INPUT_LIMIT and displays generic unavailable/try-again-later guidance. An in-memory DOM probe reproduced it; manual controls remain enabled. Give explicit oversized-complete-context guidance for diff and token limits while retaining manual review and safe correlation references. | ui |
| F-005 / REV-IR-002 | MEDIUM, evidence blocker | [Six save/lifecycle test cases](C:/Users/User/Documents/NUS/CS3227/CS3227-2610-MP4/src/server/test/patch-risk.integration.ts:278) await the first transaction before initiating the second; save-first also refreshes competing coordinates. These are sequential cases rather than lock contention. Initiate both commands with original captured versions while a lock is held, prove the second waits, then assert allowed commits/conflicts and complete transactional outcomes. **No production race defect is claimed.** | reviewer-integration |

All five are open and assigned to `independent-review` for eventual independent
closure, with the original logical implementation owners retained. Authoritative
status lives in [state.json](../state.json), with
[origin mapping](checkpoints.json#/entries/review-finding-index.json) and
[detailed observations/probe controls](../inputs-summary.json#/entries/review-results.json).

## Requirement assessment

| Requirement | Independent assessment |
| --- | --- |
| REQ-REV-003 | Latest exact assignment/revision checks, complete submitted context and strict selected grounding supported; secret screening remains defective. |
| REQ-REV-012 | Persisted session/account/root and assignment-generation controls supported by inspection. Six suggestion-save/lifecycle contention obligations remain unresolved despite green test selectors. |
| REQ-REV-013 | Editable explicit save/cancel, transactional human finding/activity and transient page memory supported by inspection/component checks; actual browser BFCache restoration is not demonstrated. |
| REQ-REV-014 | Server caps and manual fallback supported; size-specific feedback and early transport cleanup fail. |
| REQ-REV-015 | Own scoped metadata and human/AI history separation supported; outbound secret handling and usage evidence need correction. |

No production authorization bypass or AI business mutation was established.
Passing matrix structure and prior tests do not close the findings. In particular,
the pre-review 47-case structural evidence remains historical; F-005 overrides any
interpretation that the six named save cases prove genuine concurrent behavior.

## Independent checks and limits

Both reviewers verified all 36 manifest hashes. The implementation reviewer ran
the existing PatchRiskAssistant Vitest file: **4 passed**. The security reviewer
ran the existing gateway/foundation tests: **11 passed**. Discriminating inline
Node/ts-node probes used synthetic mocked Prisma, transport, fetch and an open
ReadableStream; the UI probe transpiled the current TSX in memory with
JSDOM/testing-library. No test files, provider calls, database changes, browser
fixtures or build outputs were created by reviewers. Initial invalidated/no-result
probe attempts do not supply passes.

Prior coordinator passes of 61 server, 66 client, 130 PostgreSQL and 11 Chromium
tests remain source-bound implementation evidence, not newly executed independent
evidence. Existing tests pass while missing the reproduced credential, body
cleanup, usage and size-feedback variants. The save-race finding follows from
actual test ordering rather than a claimed production exploit.

Live provider/tokenizer/retention compatibility, usefulness and latency remain
unverified under OPEN-002; live operation is still disabled. Synthetic pagehide
and pageshow events followed by a real reload do not establish actual BFCache
navigation/restoration. Expired AI rows are hidden from audit and physically
deleted on a later request; no scheduled caller of accounting cleanup was found.
Whether 90-day expiry requires physical pruning at a fixed deadline is an explicit
interpretation/evidence gap, **not a sixth confirmed blocker**.

## Review boundary and next work

The [implementation-review handoff](../handoffs/09-independent-review-to-main.md)
and [security-code handoff](../handoffs/09-code-security-to-main.md) identify the
assessed state and limitations. Canonical review cycle 1 has outcome `failed`
(changes required). No fix or revalidation stage was started by this review
request. Source is preserved for bounded fixes and independent revalidation.

Review-only resources and measurement limitations are in
[independent-review-resources.md](independent-review-resources.md). The
[derived canonical report](checkpoints.json#/entries/after-review-report.md) retains unresolved findings,
past unsuccessful worker attempts and workflow incompleteness; it must not be
presented as approval or full delivery.
