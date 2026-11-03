# Independent Contributor security review and fix revalidation

Date: 1 November 2026, Asia/Singapore. Reviewer: independent `security_final`
agent. Baseline HEAD `03cbea9f94c28011142c3a2a453ce7692df06053`; reviewed the
uncommitted combined Contributor patch and connected shared services. Both product
writers reported a source freeze before this final invocation. No product, test
or specification files were changed by this reviewer.

Applied the repository security-review skill and Contributor security assignment.
Authorities: ROLE-CONTRIBUTOR, SHARED-REQUIREMENTS, INTEGRATION-SPEC and
AI-SECURITY-SPEC. Affected-owner agreement is recorded by the coordinator as the
user's relay, not inferred by this review. Human teammate approval remains separate.

## Disposition

No unresolved blocking finding remains in this reviewed source snapshot. This is
a bounded local review, not a claim of complete security, live-provider operation,
deployment acceptance, full accessibility conformance or human teammate sign-off.

| Finding | Original issue | Final disposition and evidence |
| --- | --- | --- |
| CON-SEC-P001, medium | Refresh/history/deletion could discard mounted command, reason or uncertain recovery state | Earlier independent closure retained. Final action locks disable competing controls; focused lifecycle tests pass. |
| CON-SEC-P002, medium | Deferred JSON completion could invoke stale mutation callbacks after unmount | Earlier closure retained. Final command and reconciliation paths check liveness after body parsing; focused lifecycle tests pass. |
| CON-SEC-P003, medium | Assistant failure omitted REQ-SHR-006 safe correlation reference | Verified fixed: strict UUID-only reference extraction, safe missing/non-JSON fallback, no raw provider body, and post-error-body liveness/generation checks. Fresh assistant tests pass. |
| CON-SEC-P004, high | Authorization ran before the quota reservation lock wait; access could disappear during that wait but private context was still dispatched | Verified fixed: required authorization executes after admission waits on the same reservation transaction/connection, before attempt insertion. Commit releases all locks before transport. Real post-enqueue quota barriers, five concurrent calls with a five-connection pool, and timeout/accounting regressions pass. |
| CON-SEC-P005, medium | Late same-login HTTP401 after route unmount was ignored, retaining protected application state | Verified fixed: known401 handling precedes local component/generation guards; App's authentication-generation callback ignores an old login after replacement. Late401, late200 and replacement-login tests pass. |

P004 was independently reproduced before the fix with a bounded in-memory Prisma
harness: authorization was revoked during the second coordinator lock acquisition
(reservation, after enqueue), yet output showed one authorization check and one
outbound send. Rerunning that same admission-window scenario against the final
source produced:

```json
{"error":"ACCESS_LOST","revokedDuringReservation":true,"authorizationChecks":1,"outboundSends":0,"attempts":0}
```

The final PostgreSQL cases observe actual blocking through `pg_blocking_pids`,
change session/version while the reservation waits, then verify zero transport
calls, zero outbound-attempt records, cleared queue state and one preflight
rejection. They do not merely block enqueue before the original early check.
The timeout case returns503/DEADLINE while preserving the still-valid session
and manual content; unknown database errors are not mislabeled access loss.

## Inspected control coverage

| Boundary | Observed controls and evidence |
| --- | --- |
| Discovery, cloning and working content | Session/role/account checks, server-derived ownership, actor-scoped cursor and successful-read audit; current root/version/latest revision/attachment checks before explicit clone. Dedicated clone preserves submitted criterion identities without relaxing ordinary PATCH identity rules. Immutable submitted content and reviewer assignment remain unchanged. |
| Finding responses | Strict owner/current-version/current-revision checks in eligible states; same-proposal historical finding scope; server attribution; normalized bounded plain text; append-only storage and scoped foreign keys. Response, root version and activity share a transaction; no finding transition occurs. Independent response/withdrawal and account-disable SQL barriers pass. |
| AI context and output | Server selects only structured draft fields after authorization; no patch, evidence, scope/account IDs or stable keys go outbound. Raw and normalized context caps, framed token cap, strict duplicate-key/envelope/result validation, secret screening, escaped rendering and explicit local selection remain enforced. No AI result authorizes a business mutation. |
| Admission and resource controls | One shared quota coordinator/attempt table, same-transaction fresh authorization after admission waits, deadline-bounded operations and retry rules. No business locks survive into provider I/O. No-dispatch denials do not fabricate outbound attempts; usage distinguishes preflight rejection, unknown usage, zero denominators, SGT application windows and provider UTC spend. |
| Metadata/privacy | Exact feature-specific nullable-column SQL checks; Reviewer audit filters feature=REVIEWER. Safe actor-scoped usage exposes no prompts/results or other actors' details. No raw suggestion/browser-storage persistence introduced. Production gateway configuration remains disabled. |
| Client session/recovery | Pending/conflict/uncertain commands retain recovery identity and text; competing operations are locked. Explicit selection changes only unsaved editor content. Dirty/manual changes invalidate stale suggestions; page lifecycle/unmount clears transient suggestions. Known401 invalidates the bound login even after route leave; late success and replaced-login responses cannot overwrite current protected state. |

## Independent executed checks

Client runtime: default Node24.19.0 ARM64, no added environment variables.

```powershell
npm.cmd run test -w @specsentry/client -- src/features/contributor/SpecDraftAssistant.test.tsx src/features/contributor/ContributorLifecycle.test.tsx
```

Result: **2 files,59 tests passed**,4.53seconds,exit0.

Server runtime: existing portable Node24.19.0 x64 prepended to PATH,
NODE_PATH pointing to the existing native unrs modules, ELECTRON_RUN_AS_NODE unset.

```powershell
npm.cmd run test -w @specsentry/server -- --runTestsByPath test/ai-gateway.spec.ts test/contributor-ai-gateway.spec.ts test/ai-foundation.spec.ts
```

Result: **3 suites,33 tests passed**,6.859seconds,exit0.

PostgreSQL used only the explicitly disposable loopback database
`specsentry_contributor_completion_test` on port55447, with explicit
TEST_DATABASE_URL and DIRECT_DATABASE_URL. No normal database fixtures were run.
The backend released its reservation before this run; the acceptance verifier
received the reservation immediately after it completed.

```powershell
npm.cmd run test:integration -w @specsentry/server -- --runTestsByPath test/contributor-ai.integration.ts test/contributor-acceptance.integration.ts
```

Result: **2 suites,17 tests passed**,26.465seconds,exit0. Existing pg concurrent-query
deprecation warnings appeared; they did not fail these checks. The independent
synthetic admission-window harness also exited0 with zero sends/attempts.

## Reviewed final SHA-256 snapshot

| File | SHA-256 |
| --- | --- |
| server ai/gateway/index.ts | A3402061BF4833EF1A667DFE5F29889CA584CC4DF744439930733ABD81B9FE1B |
| server ai/gateway/accounting.ts | 156B67E680DB9D176E7CD1BC2EDDA96A881E879B8958E87253436332778B6A29 |
| server ai/contracts.ts | D6B5ED2E54AB67418564A400571A00894A9196D2E3A4183E679AC8FAE43CE592 |
| server ai/ai.module.ts | CCD35725179E54478584E704CB035EC16E239AB289A9582E1566343FD12976F9 |
| server ai/deadline.ts | 6FBC340FDA456AF78D496F0A5E008931443ADB2FDF80E0F4B1C24D2B9F9659A7 |
| server proposals/contributor-assistant.service.ts | BA32A249CDE2C43C807C5F1BD9CCB97DC25B8020C73E97370063B270BA0D9EAE |
| server proposals/contributor-assistant.controller.ts | F00B05966905EBD7FF52E7D50A8C0F83ED94B5E7AD521F5F91161A7EC77003A6 |
| server proposals/finding-responses.service.ts | 363AE0BAAE42295ECC2D7D5523B5D33E096A5E41059FF4EAF2F0FAFB606BA1C6 |
| server proposals/finding-responses.controller.ts | 979A62336C47B9174C2069C5EE5DCE6D2AC581256186996E0F043937BCDE931E |
| server proposals/proposal-lifecycle.service.ts | E7B80BBA6F0B0CC39A22456B13AF2279CD23031FB3863293F90CD31661CA96CE |
| server proposals/contributor-proposals.controller.ts | A9E4D17BE1E5DC288297FC4A2D434A70B74991FA78A9D40064557D6561B59AD5 |
| server proposals/proposals.module.ts | EC26E12750EBBAF03A02CEAB768C203CE3BEDEF6ECE2536110C4FEE0B9A03F9B |
| server reviews/patch-risk.service.ts | BAE9EC4A09056B8962C965559DECBB9A3D67DF9E51B10A8818986DFB60A68A4A |
| server prisma/schema.prisma | C4A266C0CBC9BDF6C36C3B5AFB6BAF62EC20FFF07BF917326B1783F190BF84FC |
| response migration | B263C4FC7FE3369F907042393EF50EE347FC3D14FF503FF4BEA1636B851046CD |
| Contributor AI migration | BFEC16CD2710EBA89942CA260AF116579B6BC7E1A00FC081380810B6C1C47DFF |
| shared contracts/ai.ts | B13C4C6CC7FED1C17EDED76D5845F8AE6F922A93BB43156109E54FF40678538B |
| shared contracts/contributor.ts | 725E8E177A4FF86807F35BF433022C25EF4BB185A91726282029C200A413AA52 |
| shared contracts/reviewer.ts | 890A64C6ABE735FA2D2F1337B9B516D38546B41D6BD2718584D9157CAF37D7C2 |
| client SpecDraftAssistant.tsx | 7AE12497A5CF3559B5FB381C8DB526CA803445A750D3C96D92209DD43B072141 |
| client SubmittedProposal.tsx | 8823E362FE1367034B89269EDCF289A433C202BE4C1ED66D29F8164FAF287632 |
| client ContributorWorkspace.tsx | 27B0E87A4EF82C762AB732D0D6DD12A860B284E50E81866285431860E27A86D8 |
| client App.tsx | CFDD9FEEE427FA6323C6897170514A45D17117BAA69635B22DB7F8F35969FCC5 |

Resource: final invocation
[263a8306c20c44749bf5b96fcb178438](../../resources/2026-11-01-contributor-completion/263a8306c20c44749bf5b96fcb178438.json).
Initial combined review e71e83edadd44583ab5b4e3797a1f98f separately records the
confirmed pre-fix findings and31client tests; it is not counted as final closure.

Skipped independent browser, performance, live-provider and deployed probes in
this invocation. The acceptance verifier owns the broader suite and workload.
Material source changes after these fingerprints require affected security
revalidation; production/live readiness is not established by synthetic tests.
