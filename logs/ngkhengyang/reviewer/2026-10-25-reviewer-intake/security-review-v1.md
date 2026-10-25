# Independent design security assessment v1

Source: read-only security/security-1 return to main; selected `gpt-6-astra/high`. Assessed brief-v1 SHA256 `f615c3401a7afc71efdfcc1ebfaade4b0a7bb08435776665e4ea7bf0a8cc781a`, independently verified. Result: conditional design pass; resolve DS-001/002 before contract freeze. No application implementation certification.

Reviewed focused product/Reviewer/shared/integration specifications and existing identity/session/HTTP/schema/fixture/client sources. No files changed, DB operations performed, application tests run or implementation agents spawned.

| Finding | Severity and design gate | Observation and required control |
| --- | --- | --- |
| DS-001 / registry F-001 | MEDIUM; blocks INT-10 until design control frozen | App.tsx lines 64/69 clear session without advancing generation, while line 67 can accept an older 200. Concurrent session 401/error then old 200 could remount Reviewer workspace after observed loss. Existing scaffold has no Reviewer payload; future integration risk, not demonstrated current submitted-data leak. Frontend must centralize access-generation invalidation, include App.tsx in ownership, and test old auth/content responses after 401/error/drop/navigation/identity switch. |
| DS-002 / registry F-002 | LOW; blocks bounded contract freeze | V1 detail embedded an unbounded submitted-revision index. Future growth could load/serialize history while authorization locks are held. Main/foundation must define same-proposal paginated summaries (20 default/100 max), detail one revision; backend/frontend implement scoped pagination. Test >100 revisions, ordering boundaries, foreign selectors/cursors and access loss between pages. |

Other proposed controls assessed adequate at design level: field allowlists; current-assignment scope before relation access; actor-account-before-sorted-proposal locks and transactional disable/release/activity; assignment ID/version and active uniqueness against ABA/concurrent claims; safe timeline projection/retention; production-refusing immutable fixture reruns; bounded waits and no blind mutation retry. All require future implementation evidence. Mock tests cannot prove PostgreSQL serialization/rollback.

Ownership recommendation accepted in the proposed plan: schema/contracts foundation first; one backend worker owns all transaction participants including disablement; frontend owns App.tsx/access invalidation; main owns shared wiring without separately committing participants.

Recommended bounds: opaque IDs 1–128 ASCII characters without trimming; cursor 1–2,048 ASCII characters and bounded/versioned decoding; queue/history page 1–100/default20; timeline50; nonnegative versions bounded to actual DB type. Cursor scope/filter checks precede anchor retrieval. Unsigned cursors do not guarantee modification detection; safe arbitrary ordering positions remain acceptable if independently scoped.

Self-observed inspection: 2026-10-25T06:46:59.5950722Z–06:48:21.7913564Z, approximately 82.196 seconds; subsequent handoff composition excluded from that self-observed window. Self-reported six bounded read-only shell invocations, zero command retries; these are inspection counts, not full-runtime token/tool counters. Token/cache counters and observed execution settings unavailable. Coordinator interval `rec-1f49d87dc9734359` includes dispatch/wait/handoff and is the accounting source; do not add the inspection window again.

Next action: pin v2 and ask the same independent reviewer to revalidate DS-001/002, exact bounds and ownership. Implementation remains paused.
