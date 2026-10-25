# Implementation announcement and pause checkpoint

Status: design security gate passed; ownership and future handoffs prepared; NOT DISPATCHED. The user expressly requested pausing immediately before implementation. No implementation worker or independent implementation reviewer has started; no implementation-stage interval exists.

The settled plan is [the exclusive ownership/model plan](implementation-plan-draft.md), read together with [brief v1](brief-v1.md), [v2 refinements](brief-v2.md), and [independent v2 security pass](security-revalidation-v2.md). The immutable draft filename preserves the version assessed by the security reviewer; its split is now the announced plan. The assignment registry/ownership JSON files record the concrete paths; generated preparation handoffs pin all relevant document hashes.

| Planned subagent | Proposed model | Effort | Responsibility and reason |
| --- | --- | --- | --- |
| foundation | gpt-6.1-sol | high | Prisma schema/migration/active uniqueness, generated Prisma, shared Zod contracts and exports; foundation consistency before parallel work. |
| backend | gpt-6.1-sol | high | Claim/drop, scoped reads/activity, fixtures, account-disable integration and real PostgreSQL tests; all transaction participants have one owner. |
| frontend | gpt-6.1-sol | medium | Reviewer pool/assignments/detail/history UI, App.tsx generation fix, client/browser/keyboard checks; bounded UI against settled typed contracts. |
| implementation-reviewer | gpt-6-astra | high | Independent read-only assessment of integrated source and acceptance evidence, plus fix revalidation; authorization/race risks justify stronger reasoning. |

Security agent already used: gpt-6-astra/high, read-only, initial review and focused revalidation recorded separately. Selections are runtime-advertised model/effort values, not pricing claims or independently verified execution telemetry.

Sequence on resumption: start/record foundation → main settles the concrete foundation handoff → backend and frontend in parallel → main integrates/configures/checks and snapshots → independent implementation review → owner fixes/revalidation → documented completion. Four slots include main; do not overlap conflicting write sets. Main owns shared coordination, module/config/script wiring, docs, traceability and evidence. All workers are not alone in the workspace and must preserve others' changes.

Prepared assignments do not grant permission to execute before resumption. Recheck workspace/source hashes and refresh implementation-bound snapshots/handoffs at actual dispatch, especially for backend/frontend after foundation changes. No speculative implementation intervals or token usage have been recorded for unstarted workers.
