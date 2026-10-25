# AI contracts and security specification

Baseline: 25 October 2026. Normative design; implementation evidence is tracked in [traceability](../TRACEABILITY.md).

[Product index](PRODUCT-SPEC.md) | [Open decisions](OPEN-DECISIONS.md)

## AI Contracts and Decision Boundaries

| **AI feature** | **Allowed context** | **Typed output** | **Forbidden effects** |
| --- | --- | --- | --- |
| Contributor Spec Draft | Problem, constraints, current structured draft; maximum 6,000 input characters | objective, acceptanceCriteria[], edgeCases[], ambiguities[], testIdeas[] | Submit, assign reviewer, change lifecycle, or persist text without user selection |
| Reviewer Patch Risk | Immutable submitted spec, sanitized diff up to 20,000 characters, optional plain-text evidence and grounding identifiers from the same assigned revision; reject rather than silently truncate oversized context | coverage[] for 1-5 explicitly selected criteria, risks[], questions[], suggestedTests[], confidence | Approve, resolve findings, execute code, fetch repository data, alter evidence, or persist suggestions without human action |
| Maintainer Release Gate | Approved item summaries, deterministic gate statuses, dependencies, rollback notes | blockers[], dependencies[], releaseNotes[], rollbackConsiderations[], readinessRecommendation, confidence | Mark gates passed, publish, deploy, or override a deterministic blocker |

## AI Security Model

The SoC LLM is an untrusted advisory dependency. The application authenticates the user, authorizes access, selects the minimum context, normalizes and delimits untrusted text, calls the model without tools, validates typed output, applies deterministic policy checks, and returns a suggestion. The AI endpoint and every state-changing endpoint remain separate.

| **Threat** | **Abuse case** | **Required controls** |
| --- | --- | --- |
| Direct prompt injection | Issue text or a diff asks the model to ignore rules, reveal prompts, or approve work | Delimit untrusted text, version prompts, omit secrets, validate schemas, and test representative payloads |
| Indirect injection | Submitted comments or test evidence contain instructions aimed at the model | Treat every retrieved field as data, preserve provenance, use no tools, and never feed unrelated records |
| Cross-user or cross-role leak | A crafted identifier requests another user's proposal or an unassigned review | Authorize before retrieval, query by scoped identifiers, minimize fields, and run IDOR and role matrix tests |
| Secret exposure | A diff contains credentials or private keys | Run secret-pattern detection before the AI call, redact matches, reject high-confidence secrets, and avoid raw prompt logging |
| Malformed or unsafe output | The model invents IDs, severities, approvals, or markup that breaks the interface | Strict typed JSON, enum allowlists, length caps, escaped rendering, unknown-field rejection, and safe fallback |
| Approval bypass | A client copies AI text into a mutation request or calls publication directly | Separate endpoints, CSRF protection, fresh server-side role and state checks, optimistic locking, and deterministic release gates |
| Resource exhaustion | Repeated large requests consume SoC LLM quota or block the service | Per-user and global limits, one bounded retry only for transient errors, timeout, token budget, queue cap, and Retry-After handling |
| Sensitive observability | Prompts, diffs, credentials, or model output leak through logs | Record hashes, template version, token counts, latency, outcome, and error class; exclude raw content by default |

### Security Test Minimum

- Direct, obfuscated, Unicode, delimiter-breaking, and indirect prompt-injection cases for all three assistants.
- Horizontal and vertical authorization tests across owners, non-owners, assigned and unassigned Reviewers, Contributors, and Release Maintainers.
- CSRF, stored and reflected XSS, SQL injection, oversized input, mass assignment, stale version, forced browsing, and session-fixation tests.
- Malformed JSON, unknown fields, invalid enums, hallucinated identifiers, excessive output, markdown links, unsafe HTML, and refusal responses.
- Secret-bearing diffs, high-entropy tokens, raw authorization headers, error pages, and logs inspected for disclosure.
- Timeout, HTTP 429, HTTP 5xx, partial response, invalid response, concurrent requests, exhausted budget, and disabled-AI behavior.

## Resource budgets

| **Resource** | **Budget** | **Control** |
| --- | --- | --- |
| Product AI request | Input capped by feature; output at most 800 tokens | Reject oversized input before the call; no automatic retry for validation errors |
| Transient SoC LLM error | One retry with jitter when the remaining request deadline permits | Respect Retry-After; then return manual fallback |
| Per-user product limit | Initial value 10 outbound attempts per rolling 10 minutes and 60 per SGT calendar day | Configuration may be lowered after the SoC quota spike; never raise without evidence |
| Global product limit | Initial value 30 outbound attempts per rolling minute with a bounded queue of 10 | Shed excess work with 429 and a retry time |
| Development agent task | Record model, reasoning setting, input and output tokens, cache reads, tool calls, wall time, and retries | Stop or re-scope repeated exploration with no new evidence |
| Persisted context | Store decisions, specs, compact handoffs, test evidence, and verified summaries | Do not persist hidden reasoning, secrets, raw credentials, or unnecessary personal data |

## AI Evaluation Gates

| **Measure** | **Cases** | **Release target** |
| --- | --- | --- |
| Schema validity | All three features | 100 percent across the versioned normal and adversarial set after gateway validation |
| Unauthorized disclosure | Cross-user and cross-role cases | Zero unrelated record fields disclosed in all test cases |
| Forbidden action language | Injection and approval-bypass cases | No output is interpreted as authorization and no application state changes |
| Usefulness | Human rating against feature rubric | At least 80 percent of normal cases rated useful without a material unsafe correction |
| Grounding | IDs, criteria, findings, and gates | All referenced identifiers exist in the supplied context or the response is rejected |
| Latency | Development environment | Median under 8 seconds and 95th percentile under 18 seconds for the evaluation set |
| Resource use | Per successful request | Recorded input and output tokens remain within the configured feature budget |

## Typed output schemas

These field contracts are normative and will be expressed as strict runtime schemas in the new TypeScript gateway. Reject unknown fields, duplicate JSON keys, wrong types, excessive nesting, out-of-range bounds, duplicate/unknown grounding IDs, prose/code fences around JSON, non-finite values, refusal and truncated output. Do not repair malformed JSON or retry validation errors. Strings are non-empty plain text unless an empty list is expressly allowed; maximum lengths count Unicode code points. Output is limited to one complete JSON object and 800 generated tokens. Schema limits do not guarantee every worst-case combination fits 800 tokens; length-truncated output fails safely and no field is silently omitted.

| Feature | Exact required fields and bounds |
| --- | --- |
| Contributor | objective: string <=200; acceptanceCriteria: 1-5 strings <=160 each; edgeCases, ambiguities, testIdeas: arrays of 0-3 strings <=120 each. No model-generated persisted criterion IDs. Human selection creates/updates working content only. |
| Reviewer | coverage: exactly one entry per selected criterion, 1-5 entries, each {criterionId, status, rationale}; status COVERED/PARTIALLY_COVERED/NOT_COVERED/NOT_APPLICABLE; rationale string <=120. risks: 0-3 entries {criterionIds, severity, description}, criterionIds 0-5 unique selected IDs, severity LOW/MEDIUM/HIGH/CRITICAL, description <=160. questions and suggestedTests: 0-3 strings <=100 each. confidence: LOW/MEDIUM/HIGH. |
| Maintainer | blockers: 0-3 entries {itemIds, description}, itemIds is an array of 0-50 unique IDs that refer only to supplied candidate items, description <=160; dependencies, releaseNotes, rollbackConsiderations: 0-3 strings <=120 each; readinessRecommendation: READY/NOT_READY/NEEDS_REVIEW; confidence: LOW/MEDIUM/HIGH. Empty itemIds indicates a candidate-wide blocker; otherwise all IDs must be supplied items. |

Provider catalog IDs and application IDs use their supplied exact strings. Reviewer risk order is CRITICAL, HIGH, MEDIUM, LOW, preserving model order within severity. Confidence is model judgment, not probability or a gate. Empty issue/risk lists are valid; a wholly empty result or missing required field is not. Maintainer recommendation never changes deterministic readiness.

Reviewer selects one to five current criterion IDs per request. The context contains the immutable submitted specification, complete sanitized diff and all optional plain-text evidence, with an explicit list of criteria to assess in this batch. Context must fit its full input budget; batching does not silently slice the diff/evidence or omit specification text. The result must contain exactly the selected coverage IDs and no others. Display analyzed criterion IDs/count and indicate remaining criteria were not analyzed by this batch. No batch result writes manual coverage. Later batches are separately authorized/quota-counted requests; raw outputs are not persisted or automatically combined into a complete-review claim.

REQ-REV-012 through REQ-REV-015 govern Reviewer retention and access. Their stricter transient page-session/privacy rules override any general optional retention language. Escape all suggestion text. Failed/rejected calls may update only safe audit/resource records, never proposal, finding, coverage, approval or release state.

## Approved feature budgets and accounting

| Feature | Total input token cap, including system template, identifiers and all submitted context | Additional character cap |
| --- | --- | --- |
| Contributor | 4,000 | Existing 6,000-character feature input cap |
| Reviewer | 10,000 | Complete diff at most 20,000 characters; other text also counts toward total input |
| Maintainer | 6,000 | All supplied summaries/notes must fit input cap; no silent dropping of candidate items or gate data |

Every feature reserves at most 800 generated tokens and enforces the selected model's usable context (input plus output plus provider framing). Use a verified tokenizer/counting method for the selected alias; unsupported model/token accounting disables that live AI configuration until verified. Application submission limits are deliberately larger than AI limits. Reject oversized AI context before outbound calls; do not truncate or silently omit evidence. Model-specific lower limits override application maxima; raising budgets requires evaluation evidence and updated configuration/specification.

Keep the application limits of 10 outbound attempts per user per rolling 10 minutes, 60 per user per SGT calendar day, 30 globally per rolling minute, queue cap 10, and a 20-second total request deadline including queue/retry. Preflight local rejections are not outbound attempts. Each retry reserves/counts an attempt against local/global/provider-facing budgets before dispatch; requests unable to obtain budget return safe retry/fallback. One bounded retry for transient transport/5xx or rate-limit 429 is permitted only within deadline and Retry-After. A budget-exhaustion 429 is not blindly retried; ambiguous 429 falls back safely. Never retry 400/401/403, refusal or schema validation errors automatically.

Daily application limits reset at Asia/Singapore midnight. Provider daily/monthly spend windows reset on UTC boundaries; display them separately. Provider usage is charged to the API key, shared across all environments/users using that key. Deployment accounting must consider all such usage, not treat local limits as the provider's allowance. Live policy may require lowering local limits.

Application response caching is disabled initially. Record every user request, outbound attempt and retry distinctly; report token/cache usage only when provided and valid, otherwise unknown. No reconstructed token estimate is labeled provider-reported usage. A failed attempt with no returned usage is still an attempt. Provider usage counters are resource evidence, never business authorization.

## SoCLaaS transport contract

Documented API base: https://soclaas-api.comp.nus.edu.sg/v1. Configure base URL, API key and model alias server-side; allow only the approved HTTPS host/base path and do not follow redirects carrying authorization. Never accept endpoints or model overrides from the browser. GET /models returns the catalog visible to the key; select a permitted chat model ID returned there, not a hardcoded example or provider-internal response model name. No real API key or secret was accessed in this review.

Use non-streaming POST /chat/completions with Authorization: Bearer from secret configuration, application/json, model, system/user messages, stream:false, max_tokens:800 and reasoning_effort:none after confirming these parameters for the selected alias. Use a fixed versioned system template and delimited submitted user data; no tools, function calls, web calls, embeddings, audio or provider-side conversation state. Do not rely on Responses compatibility-shim state. No response_format/schema mode is assumed supported; local strict JSON validation remains mandatory even if provider JSON mode is later enabled.

Require one completion choice, assistant message content as a non-empty string, and finish_reason stop; reject length/refusal/content-filter/tool/function-call results and incomplete transport/JSON. Parse message.content as the role JSON schema separately from the transport envelope. Accept documented optional envelope metadata without feeding it to the model or displaying/logging raw fields. Ignore reasoning metadata for display and business decisions; do not persist reasoning. Reject malformed essential fields. Optional usage prompt_tokens/completion_tokens/total_tokens and supported cached-token subfields must be nonnegative integers when present; missing values remain unknown. Catalog context fields may appear as context_length, context_window, max_context_tokens or max_model_len; require valid positive counts and use the smallest valid advertised limit, subject to live compatibility checks.

Bound response bodies to 64 KiB and cancel transport on the overall 20-second deadline. Map provider 400 to configuration/request failure, 401/403 to unavailable AI configuration/access, 429 to rate/quota handling and 5xx/transport failures to bounded transient handling. Users receive safe correlation messages and manual fallback, never raw provider responses. Malformed/absent optional metadata must not be mistaken for a successful content result or zero measured usage.

## Provider evidence and live verification gate

Provider documentation confirms Bearer API keys, the chat-completions endpoint, key-scoped model catalog, rate-or-budget 429 responses and UTC spend windows. The available reference snapshots do not establish the current key's allowed models, quantitative quotas, tokenizer, actual parameter support or provider retention policy. Obtain these during the credentialed integration spike; they remain verification dependencies under OPEN-002. All three role schema evaluations must pass before accepting live behavior.

Primary provider references: [API](https://dochub.comp.nus.edu.sg/cf/guides/soclaas/api), [quick start](https://dochub.comp.nus.edu.sg/cf/guides/soclaas/quickstart), [access](https://dochub.comp.nus.edu.sg/cf/guides/soclaas/access). Local documentation snapshots were inspected; the web pages were not available through the browsing tool. Example model aliases in those documents are examples, not the selected live configuration.

The user-requested MP3 compatibility inspection used public gateway sources at revision 90410f95f0b6365ea8fa8824b4885a3dfdb7a986: [transport adapter](https://github.com/CS3227-2610-MP3-FacilityFlowAI/CS3227-2610-MP3/blob/90410f95f0b6365ea8fa8824b4885a3dfdb7a986/src/main/java/sg/edu/nus/facilityflow/ai/provider/SocLlmHttpsProviderAdapter.java) and [envelope decoder](https://github.com/CS3227-2610-MP3-FacilityFlowAI/CS3227-2610-MP3/blob/90410f95f0b6365ea8fa8824b4885a3dfdb7a986/src/main/java/sg/edu/nus/facilityflow/ai/provider/ProviderEnvelopeDecoder.java). This informed protocol compatibility only; no source, prompts, schemas or prior documentation were imported. SpecSentry role schemas above are new product contracts.
