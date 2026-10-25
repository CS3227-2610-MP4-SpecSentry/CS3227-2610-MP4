# Shared product and quality requirements

Baseline: 25 October 2026. Normative design; implementation evidence is tracked in [traceability](../TRACEABILITY.md).

[Product index](PRODUCT-SPEC.md) | [Open decisions](OPEN-DECISIONS.md)

## Shared behavior

| **ID** | **Area** | **Acceptance criteria** |
| --- | --- | --- |
| REQ-SHR-001 | Authentication | All product pages and API routes except login and health checks require a valid server-side session. Passwords use an adaptive one-way hash and never appear in logs. The first release has one project and exactly one role per account. Seed accounts through a documented administrative command with credentials supplied outside Git. Sessions expire after 30 minutes idle or eight hours absolute, rotate on login and invalidate on logout or account disablement. |
| REQ-SHR-002 | Role enforcement | Every protected operation checks role, object scope, ownership or assignment, and applicable lifecycle constraints. Mutable operations additionally validate the expected record version. Hidden buttons are not treated as authorization. |
| REQ-SHR-003 | Concurrency | Mutable records use optimistic locking. A stale update returns a conflict message and does not overwrite newer data. |
| REQ-SHR-004 | Audit | State changes, decisions, AI requests, rejected security checks, and release publication create append-only events with actor, target, time, outcome, and safe metadata. |
| REQ-SHR-005 | Accessibility | All workflows support keyboard navigation, visible focus, programmatic labels, status text that does not rely on color, and a logical heading order. |
| REQ-SHR-006 | Failure behavior | An AI error never discards form content or blocks manual work. The user sees a safe retry message with a correlation identifier, not stack traces or model responses. |
| REQ-SHR-007 | Visible submission activity | Submission detail includes append-only chronological activity for submission creation, saved edits, submissions/resubmissions, claims, drops, automatic assignment releases, requests for changes, approvals, approval revocations and their reasons, reopening, withdrawal, findings and their transitions/amendments, criterion and coverage changes/confirmations, evidence changes/links, contributor responses, release attachment/removal/publication, notifications, and other submission-related actions. Each entry identifies actor or system, time, action, affected revision/entity, outcome, and a safe change summary or reason. Successful mutations and their activity records commit together. Viewer access is checked before activity retrieval; entries never disclose private draft contents, secrets, security diagnostics, or reviewer AI history/metadata. |

### Submission Activity and Private Audit

- The owner and currently assigned Reviewer see the activity history when viewing an authorized submission; the Maintainer sees it within their submitted-proposal scope. History does not grant content access to a former reviewer or an unassigned pool browser. Protected linked revisions, findings, or diffs are authorized again when opened.
- Log submission-related requests and actions in the server audit, including views and rejected actions. The submission timeline shows permitted human/system activity and safe outcomes; rejected security checks and internal diagnostics remain in the restricted audit rather than exposing another user's attempted access. Reviewer AI requests/outcomes/metadata remain in their separate private audit scope and do not appear in the shared timeline. This is the explicit exception to shared visibility for submission-related actions.
- Record saved working-draft changes, but show their contents only to the owner. Other authorized submission viewers may see a safe edit event without unsubmitted text. Submitted revisions and append-only change history preserve the reviewable content; activity summaries do not replace revision snapshots.

## Nonfunctional Requirements

| **ID** | **Quality** | **Target** |
| --- | --- | --- |
| NFR-PERF-001 | Performance | For seeded data, 95 percent of non-AI page requests complete within 800 ms at 20 concurrent users. AI calls time out after 20 seconds. |
| NFR-REL-001 | Reliability | A failed AI call leaves business records and user form content unchanged; safe AI audit and resource-accounting records may still be written. Database mutations use transactions, and release publication is atomic. |
| NFR-SEC-001 | Transport and session | Production uses HTTPS, Secure and HttpOnly cookies, SameSite=Lax or stricter, CSRF tokens, security headers, and a short idle timeout. Use the approved 30-minute idle and eight-hour absolute expiry; after five failed login attempts within 15 minutes throttle that account for 15 minutes. Apply an additional per-IP maximum of 30 failed login attempts per 15 minutes and return generic authentication errors. |
| NFR-PRV-001 | Data minimization | AI context contains only fields required for the current feature. Raw prompts and responses are not retained in production by default. |
| NFR-A11Y-001 | Accessibility | Critical flows meet WCAG 2.2 AA checks used by the team and pass keyboard-only smoke tests. |
| NFR-OBS-001 | Observability | Structured events include correlation ID, actor pseudonymous ID, template version, model status, token counts, latency, and safe error class. |
| NFR-PORT-001 | Portability | A documented Docker image starts from environment variables and a clean PostgreSQL database without local-machine assumptions. |
| NFR-RES-001 | Resource budget | Each AI feature has a configured input and output token cap. The dashboard reports daily calls, failure rate, cache use, and token consumption. |

Approved measurement, session and dashboard defaults appear below; targets are not evidence of deployed behavior.


## Shared UI and failure contract

All role screens support keyboard access, visible focus, programmatic labels and textual status/errors. Empty queues explain that no matching work is available. Validation errors retain entered content, identify invalid fields and provide a correction path. State-changing controls expose pending/success/conflict outcomes without silently overwriting newer data. Login/session expiry must not reveal protected content; after expiry require login and recover only previously server-saved private working content; never persist unsaved sensitive drafts in browser storage. AI failure leaves manual forms usable.

## Acceptance scenarios

These are planned verification cases against the approved defaults; they are not executed tests.

| Scenario | Requirement | Observable verification |
| --- | --- | --- |
| AC-SHR-001 | REQ-SHR-001 | Request product/API content without a valid session; protected content is withheld. Login/logout tests inspect session rotation and password/log handling. |
| AC-SHR-002 | REQ-SHR-002 | Exercise each role/owner/assignee and direct URL, including after reassignment/disablement; client-visible controls cannot grant access. |
| AC-SHR-003 | REQ-SHR-003 | Two clients save the same expected version; stale write returns conflict and newer content remains unchanged. |
| AC-SHR-004 | REQ-SHR-004 | Perform successful and rejected actions; actor/target/time/outcome events are append-only and contain safe metadata. |
| AC-SHR-005 | REQ-SHR-005 | Complete each critical role flow using only keyboard; focus, labels, heading order and status announcements are usable. |
| AC-SHR-006 | REQ-SHR-006 | Simulate timeout/malformed AI result; original form remains and retry message includes safe correlation ID without raw output. |
| AC-SHR-007 | REQ-SHR-007 | Verify each action family appears in authorized activity; force transaction failure to prevent partial business/activity success. Reassigned reviewers cannot see private draft or prior-reviewer AI metadata. |
| AC-NFR-PERF-001 | NFR-PERF-001 | Measure agreed seeded endpoints at 20 concurrent users: p95 under 800 ms; AI request deadline 20 seconds. Use the fixture and workload below. |
| AC-NFR-REL-001 | NFR-REL-001 | Inject database/AI failure; no partial business mutation or publication; safe audit accounting may remain. |
| AC-NFR-SEC-001 | NFR-SEC-001 | Inspect deployed HTTPS, cookie flags, security headers and CSRF rejection; expiry enforces the session policy above. |
| AC-NFR-PRV-001 | NFR-PRV-001 | Inspect outbound context/logs/storage for only allowed fields and no retained raw production prompts/responses. |
| AC-NFR-A11Y-001 | NFR-A11Y-001 | Run agreed WCAG 2.2 AA checks and keyboard-only critical flows; record each applicable criterion, page and result. |
| AC-NFR-OBS-001 | NFR-OBS-001 | Normal/error AI paths include safe correlation/template/status/latency/usage fields where supplied, without content leakage. |
| AC-NFR-PORT-001 | NFR-PORT-001 | Start tested image with environment configuration and clean PostgreSQL; migrations and health checks succeed without developer paths. |
| AC-NFR-RES-001 | NFR-RES-001 | Boundary-test configured budgets, quotas and queue; inspect dashboard calculations using approved audience/accounting definitions. |

## Approved activity, retention and quality defaults

### Submission timeline and safe event data

Show all successful submission-changing actions, their reasons/safe change summaries and notification creation in the authorized timeline. Routine views, rejected business/security attempts, notification read acknowledgments and operational diagnostics go to the restricted audit only. Reviewer AI requests, outputs and metadata remain excluded from the shared timeline. This resolves the earlier general wording about all actions without changing its privacy boundary.

Timeline fields are event ID, actor display identity/system, server timestamp, action, proposal/revision and permitted related entity IDs, outcome, authorized reason and bounded change summary. Do not serialize arbitrary request bodies, session IDs, IP addresses, credentials, raw prompts/responses, private working content or another reviewer's AI metadata. Whitelist projected fields server-side and escape text. Reasons/amendments obey the same safe rendering and field limits as other text.

Order timeline by server timestamp ascending then event ID ascending. Use cursor pages of 50 entries. Preserve append-only business events as long as their submission; restricted operational/security logs expire after 90 days. Retained business events must not disappear when operational logs expire. Draft tombstones contain only the minimum fields specified in the Contributor policy.

### Performance and accessibility protocol

Use reproducible fixtures with 1,000 proposals, 3,000 submitted revisions and 10,000 findings, synthetic role accounts, and a documented mix of lifecycle states/ownership. Run 20 authenticated concurrent users for five measured minutes after one minute warm-up; cycle evenly through pool, assigned queue, submission detail, revision history and activity requests. Aggregate and report per-endpoint timings, status/error rates and overall p95; required p95 is under 800 ms. AI calls and static assets are excluded. Authorization failures are tested separately, not used to make successful-page latency look faster.

Check login and each critical Contributor, Reviewer and Maintainer flow for keyboard operation, visible/unobscured focus, labels/instructions, heading order, color/contrast, zoom/reflow, error identification, and status announcements against applicable WCAG 2.2 AA criteria. Combine automated scans and manual keyboard/zoom tests; record applicable criteria and outcomes rather than claim full compliance from a scanner alone.

### Resource dashboard and accounting

Maintainers see project aggregates; Contributors and Reviewers see their own permitted usage. Aggregate usage does not expose another reviewer's AI run history/metadata. Display user requests separately from outbound attempts and retries; attempt failure rate is failed completed outbound attempts divided by all completed outbound attempts in the selected window (zero denominator is N/A). Failures include transport, HTTP, refusal and output-validation errors. Local preflight rejections are separate from outbound failures. Show provider-reported tokens/cache fields only if supplied, otherwise unknown. No application response cache is enabled initially; show it as disabled, not a measured provider cache hit rate.

Metric windows and user daily quota use Asia/Singapore; provider UTC spend resets remain separately labeled. A locally rejected or expired session never grants dashboard or timeline access.
