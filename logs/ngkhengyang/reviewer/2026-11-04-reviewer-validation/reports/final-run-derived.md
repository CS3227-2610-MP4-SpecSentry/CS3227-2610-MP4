# Reviewer run report

Canonical source: state.json; this report is a derived view.

Run: 2026\-11\-04\-reviewer\-validation; consistent: False.

## Assignments and completion

| Assignment | Agent | Latest completion | Current |
| --- | --- | --- | --- |
| dashboard | dashboard | dashboard\-evidence\-resume3 | False |
| evaluation | evaluation | evaluation\-f001\-resume3\-complete | True |
| gateway\-tests | gateway\-tests | gateway\-tests\-complete1 | False |

## Acceptance evidence

| Case | Requirement | Kind | Owner | Check |
| --- | --- | --- | --- | --- |
| usage\-own\-only | REQ\-REV\-015 | normal | dashboard | dashboard\-postgres |
| usage\-role\-session | REQ\-REV\-015 | authorization | dashboard | dashboard\-postgres |
| usage\-day\-retry | REQ\-REV\-015 | boundary | dashboard | dashboard\-postgres |
| usage\-outcomes | REQ\-REV\-015 | boundary | dashboard | dashboard\-postgres |
| usage\-unknown | REQ\-REV\-015 | boundary | dashboard | dashboard\-postgres |
| usage\-former\-assignment | REQ\-REV\-015 | lifecycle | dashboard | dashboard\-postgres |
| usage\-late\-read | REQ\-REV\-012 | normal | dashboard | dashboard\-ui |
| usage\-auth\-races | REQ\-REV\-012 | concurrency | dashboard | dashboard\-ui |
| usage\-view\-rollback | REQ\-REV\-015 | rollback | dashboard | dashboard\-postgres |
| eval\-batches | REQ\-REV\-003 | normal | evaluation | evaluation\-unit |
| eval\-transient\-human | REQ\-REV\-013 | normal | evaluation | evaluation\-browser |
| eval\-limits | REQ\-REV\-014 | normal | evaluation | evaluation\-unit |
| eval\-adversarial | REQ\-REV\-003 | authorization | evaluation | evaluation\-unit |
| reviewer\-stale\-result | REQ\-REV\-012 | concurrency | evaluation | evaluation\-browser |
| reviewer\-overcap\-manual | REQ\-REV\-014 | boundary | evaluation | evaluation\-browser |
| reviewer\-real\-history | REQ\-REV\-013 | lifecycle | evaluation | evaluation\-browser |
| reviewer\-a11y | REQ\-REV\-013 | normal | evaluation | evaluation\-browser |
| usage\-browser\-own | REQ\-REV\-015 | normal | dashboard | dashboard\-browser |

## Findings

- F\-001: closed; owner evaluation

## Evidence and limitations

- commands: verify\-2406b0b53d6f458e; snapshot verify\-2406b0b53d6f458e; superseded by None
- commands: verify\-8e54329dc59b4658; snapshot verify\-8e54329dc59b4658; superseded by None
- commands: verify\-195de82e67dc4a60; snapshot verify\-195de82e67dc4a60; superseded by verify\-ddbc08e78e5b48d3
- commands: shared\-contract\-prebuild; snapshot shared\-contract\-prebuild; superseded by None
- commands: verify\-61fef9c132164e5b; snapshot verify\-61fef9c132164e5b; superseded by None
- commands: verify\-1aeb11f4e2f54636; snapshot verify\-1aeb11f4e2f54636; superseded by None
- commands: verify\-7b287ee376cf4954; snapshot verify\-7b287ee376cf4954; superseded by verify\-ddbc08e78e5b48d3
- commands: prisma\-client\-refresh; snapshot prisma\-client\-refresh; superseded by None
- commands: verify\-9d8c3ab8712248ac; snapshot verify\-9d8c3ab8712248ac; superseded by None
- commands: verify\-da4590ee52f34809; snapshot verify\-da4590ee52f34809; superseded by None
- commands: verify\-ddbc08e78e5b48d3; snapshot verify\-ddbc08e78e5b48d3; superseded by verify\-bd5ecd9abb9047ff
- commands: verify\-d8ec58be3a1246f1; snapshot verify\-d8ec58be3a1246f1; superseded by verify\-386ab45b3bf4470c
- commands: verify\-90bcfd4d0597483d; snapshot verify\-90bcfd4d0597483d; superseded by verify\-05d8559f5ffc4d97
- commands: verify\-05d8559f5ffc4d97; snapshot verify\-05d8559f5ffc4d97; superseded by verify\-b07077dab92b40c5
- commands: verify\-edc6c3428b8c4803; snapshot verify\-edc6c3428b8c4803; superseded by verify\-1fba61bde4994e20
- commands: verify\-807ca70a6ed34158; snapshot verify\-807ca70a6ed34158; superseded by verify\-03c9c70551ba4d4f
- commands: verify\-f9ae492a88ba469e; snapshot verify\-f9ae492a88ba469e; superseded by verify\-b07077dab92b40c5
- commands: verify\-1fba61bde4994e20; snapshot verify\-1fba61bde4994e20; superseded by verify\-8cd235342d634f24
- commands: verify\-8d1969444b7143f9; snapshot verify\-8d1969444b7143f9; superseded by verify\-814e4d0fcf7741e0
- commands: verify\-0f8bc5b02fdd434f; snapshot verify\-0f8bc5b02fdd434f; superseded by verify\-428c09d68e064ec8
- commands: verify\-bc19e278604342f5; snapshot verify\-bc19e278604342f5; superseded by verify\-8881299a08ee4095
- commands: verify\-0851dd34642e4335; snapshot verify\-0851dd34642e4335; superseded by verify\-814e4d0fcf7741e0
- commands: verify\-c376b1c7a4164eaf; snapshot verify\-c376b1c7a4164eaf; superseded by verify\-8881299a08ee4095
- commands: verify\-2cff3c1c19564274; snapshot verify\-2cff3c1c19564274; superseded by verify\-814e4d0fcf7741e0
- commands: verify\-8881299a08ee4095; snapshot verify\-8881299a08ee4095; superseded by verify\-fea9ec5476954bab
- commands: verify\-5a10c066b1034a58; snapshot verify\-5a10c066b1034a58; superseded by verify\-187c2a4586a845a3
- commands: verify\-09b1cf14ba6642c5; snapshot verify\-09b1cf14ba6642c5; superseded by verify\-e39c5616a98540cb
- commands: verify\-0fcc21fd57f34367; snapshot verify\-0fcc21fd57f34367; superseded by verify\-bd5ecd9abb9047ff
- commands: verify\-1b1beb5049554697; snapshot verify\-1b1beb5049554697; superseded by verify\-386ab45b3bf4470c
- commands: verify\-aeaf5a82a204420c; snapshot verify\-aeaf5a82a204420c; superseded by verify\-187c2a4586a845a3
- commands: verify\-4ccf9182908444db; snapshot verify\-4ccf9182908444db; superseded by verify\-713c0bbe17754389
- commands: verify\-97e02d78d6474d89; snapshot verify\-97e02d78d6474d89; superseded by verify\-f0a56059409e464a
- commands: verify\-fef6c7cd4b8c4500; snapshot verify\-fef6c7cd4b8c4500; superseded by verify\-ef8a5ff2abed4c0e
- commands: verify\-170c89a6d6fd457e; snapshot verify\-170c89a6d6fd457e; superseded by verify\-bd5ecd9abb9047ff
- commands: verify\-106c4287f8c34fbd; snapshot verify\-106c4287f8c34fbd; superseded by verify\-03c9c70551ba4d4f
- commands: verify\-781be1f6aacf451a; snapshot verify\-781be1f6aacf451a; superseded by verify\-386ab45b3bf4470c
- commands: verify\-42275ec6d9e84a50; snapshot verify\-42275ec6d9e84a50; superseded by verify\-187c2a4586a845a3
- commands: verify\-e39c5616a98540cb; snapshot verify\-e39c5616a98540cb; superseded by verify\-713c0bbe17754389
- commands: verify\-694ec4cb7e5b42eb; snapshot verify\-694ec4cb7e5b42eb; superseded by verify\-f0a56059409e464a
- commands: verify\-ef8a5ff2abed4c0e; snapshot verify\-ef8a5ff2abed4c0e; superseded by verify\-8063305c45004393
- commands: verify\-d3df9f91528c4b05; snapshot verify\-d3df9f91528c4b05; superseded by verify\-8cd235342d634f24
- commands: verify\-93d4cfaacc824bc1; snapshot verify\-93d4cfaacc824bc1; superseded by verify\-7baa9d2464294cbb
- commands: verify\-bba6a344f50f4898; snapshot verify\-bba6a344f50f4898; superseded by verify\-2b3fd571fc924a30
- commands: verify\-6acb951c9e0f497b; snapshot verify\-6acb951c9e0f497b; superseded by None
- commands: verify\-aab7169e7ea84e0d; snapshot verify\-aab7169e7ea84e0d; superseded by None
- commands: verify\-a4bbb226ca274527; snapshot verify\-a4bbb226ca274527; superseded by None
- commands: verify\-386ab45b3bf4470c; snapshot verify\-386ab45b3bf4470c; superseded by None
- commands: verify\-187c2a4586a845a3; snapshot verify\-187c2a4586a845a3; superseded by None
- commands: verify\-713c0bbe17754389; snapshot verify\-713c0bbe17754389; superseded by None
- commands: verify\-f0a56059409e464a; snapshot verify\-f0a56059409e464a; superseded by None
- commands: verify\-65340750b746431e; snapshot verify\-65340750b746431e; superseded by verify\-dfb1b64d4d794e1d
- commands: verify\-03c9c70551ba4d4f; snapshot verify\-03c9c70551ba4d4f; superseded by None
- commands: verify\-61f7346110074483; snapshot verify\-61f7346110074483; superseded by None
- commands: verify\-aa86e1c72c8743fb; snapshot verify\-aa86e1c72c8743fb; superseded by None
- commands: verify\-802f344bd96d4110; snapshot verify\-802f344bd96d4110; superseded by None
- commands: verify\-dfb1b64d4d794e1d; snapshot verify\-dfb1b64d4d794e1d; superseded by verify\-8063305c45004393
- commands: verify\-c199d9e40a58408f; snapshot verify\-c199d9e40a58408f; superseded by verify\-b07077dab92b40c5
- commands: verify\-4f91af1cb5a84827; snapshot verify\-4f91af1cb5a84827; superseded by verify\-8cd235342d634f24
- commands: verify\-b07077dab92b40c5; snapshot verify\-b07077dab92b40c5; superseded by None
- commands: verify\-8cd235342d634f24; snapshot verify\-8cd235342d634f24; superseded by None
- commands: verify\-8063305c45004393; snapshot verify\-8063305c45004393; superseded by None
- commands: verify\-814e4d0fcf7741e0; snapshot verify\-814e4d0fcf7741e0; superseded by None
- commands: verify\-fea9ec5476954bab; snapshot verify\-fea9ec5476954bab; superseded by None
- commands: verify\-7baa9d2464294cbb; snapshot verify\-7baa9d2464294cbb; superseded by None
- commands: verify\-2b3fd571fc924a30; snapshot verify\-2b3fd571fc924a30; superseded by None
- commands: verify\-2e0f936b9a4b49e7; snapshot verify\-2e0f936b9a4b49e7; superseded by None
- commands: verify\-aea98d7d63184f3b; snapshot verify\-aea98d7d63184f3b; superseded by None
- commands: verify\-428c09d68e064ec8; snapshot verify\-428c09d68e064ec8; superseded by None
- commands: verify\-033401e2938345be; snapshot verify\-033401e2938345be; superseded by None
- commands: verify\-3d50f06850ae4ee0; snapshot verify\-3d50f06850ae4ee0; superseded by None
- commands: verify\-1c84c08971fa4a54; snapshot verify\-1c84c08971fa4a54; superseded by None
- commands: verify\-b6004b2cc4924049; snapshot verify\-b6004b2cc4924049; superseded by None
- commands: verify\-50d045ec166a41ed; snapshot verify\-50d045ec166a41ed; superseded by None
- commands: verify\-5c177e32c7ce43e1; snapshot verify\-5c177e32c7ce43e1; superseded by None
- commands: verify\-bd5ecd9abb9047ff; snapshot verify\-bd5ecd9abb9047ff; superseded by None
- commands: verify\-0472d0fb588f4f5e; snapshot verify\-0472d0fb588f4f5e; superseded by None
- commands: verify\-6f8dd6b54bee49a7; snapshot verify\-6f8dd6b54bee49a7; superseded by None
- commands: verify\-ceeed0f44c0a4ada; snapshot verify\-ceeed0f44c0a4ada; superseded by None
- commands: verify\-d2f4f930e83043b7; snapshot verify\-d2f4f930e83043b7; superseded by None
- commands: verify\-2985827343384cac; snapshot verify\-2985827343384cac; superseded by None
- commands: verify\-c3507cf7961b42fa; snapshot verify\-c3507cf7961b42fa; superseded by None
- commands: verify\-76178797b6da4621; snapshot verify\-76178797b6da4621; superseded by None
- commands: verify\-daa541e560694680; snapshot verify\-daa541e560694680; superseded by None
- commands: verify\-1089e4e499844452; snapshot verify\-1089e4e499844452; superseded by None
- commands: verify\-51044d0cf7a04564; snapshot verify\-51044d0cf7a04564; superseded by None
- commands: verify\-5aca4eed377f4ffa; snapshot verify\-5aca4eed377f4ffa; superseded by None
- commands: verify\-e485f49a16cf44bc; snapshot verify\-e485f49a16cf44bc; superseded by None
- commands: verify\-fc18e8a1971b46d9; snapshot verify\-fc18e8a1971b46d9; superseded by None
- commands: verify\-5990e30001474a1b; snapshot verify\-5990e30001474a1b; superseded by None
- commands: verify\-11661957a5624d01; snapshot verify\-11661957a5624d01; superseded by None
- commands: verify\-087a6200413e4756; snapshot verify\-087a6200413e4756; superseded by None
- commands: verify\-3055e1ffc7894f4e; snapshot verify\-3055e1ffc7894f4e; superseded by None
- commands: verify\-9d2d3875f4e241aa; snapshot verify\-9d2d3875f4e241aa; superseded by None
- commands: verify\-296d4fffd62143d4; snapshot verify\-296d4fffd62143d4; superseded by None
- commands: verify\-e513c5061552460f; snapshot verify\-e513c5061552460f; superseded by None
- commands: verifier\-f001\-resume3\-probe; snapshot verifier\-f001\-resume3\-final; superseded by None
- handoffs: evaluation\-complete\-2; snapshot evaluation\-settled\-2; superseded by evaluation\-complete\-resume2
- handoffs: dashboard\-complete\-2; snapshot dashboard\-settled\-2; superseded by dashboard\-complete\-resume2
- handoffs: dashboard\-complete\-resume2; snapshot dashboard\-settled\-resume2; superseded by dashboard\-evidence\-resume3
- handoffs: evaluation\-complete\-resume2; snapshot evaluation\-settled\-resume2; superseded by None
- handoffs: dashboard\-evidence\-resume3; snapshot dashboard\-settled\-resume2; superseded by None
- handoffs: gateway\-tests\-complete1; snapshot gateway\-tests\-settled1; superseded by None
- handoffs: integration\-blocked\-resume4; snapshot integration\-source\-resume3; superseded by None
- handoffs: main\-to\-latency\-revalidator; snapshot evaluation\-f001\-resume3\-settled; superseded by None
- handoffs: evaluation\-f001\-resume3\-complete; snapshot evaluation\-f001\-resume3\-settled; superseded by None

- record rec\-ec676c674ad04133: latest stage attempt remains unresolved
- record rec\-1987b796d6174ef5: latest stage attempt remains unresolved
- record rec\-56a8d16a20b74693: latest stage attempt remains unresolved
- record rec\-bfd3c739599340a5: latest stage attempt remains unresolved
- record rec\-903ec9e3cf714ab4: latest stage attempt remains unresolved
- record rec\-1f08a79ebb7d441b: latest stage attempt remains unresolved
- record rec\-1e4dcce8616a4010: latest stage attempt remains unresolved
- required stage integrate: no successful resource record
- latest fix/review cycle failed
- commands verify\-a4bbb226ca274527: missing or stale snapshot evidence
- commands verify\-386ab45b3bf4470c: missing or stale snapshot evidence
- commands verify\-187c2a4586a845a3: missing or stale snapshot evidence
- commands verify\-713c0bbe17754389: missing or stale snapshot evidence
- commands verify\-f0a56059409e464a: missing or stale snapshot evidence
- commands verify\-03c9c70551ba4d4f: missing or stale snapshot evidence
- commands verify\-802f344bd96d4110: missing or stale snapshot evidence
- commands verify\-b07077dab92b40c5: missing or stale snapshot evidence
- commands verify\-8cd235342d634f24: missing or stale snapshot evidence
- commands verify\-8063305c45004393: missing or stale snapshot evidence
- commands verify\-814e4d0fcf7741e0: missing or stale snapshot evidence
- commands verify\-fea9ec5476954bab: missing or stale snapshot evidence
- commands verify\-7baa9d2464294cbb: missing or stale snapshot evidence
- commands verify\-2b3fd571fc924a30: missing or stale snapshot evidence
- commands verify\-2e0f936b9a4b49e7: missing or stale snapshot evidence
- commands verify\-aea98d7d63184f3b: missing or stale snapshot evidence
- command verify\-aea98d7d63184f3b: failed, timed out, truncated, or incomplete evidence
- commands verify\-428c09d68e064ec8: missing or stale snapshot evidence
- commands verify\-033401e2938345be: missing or stale snapshot evidence
- commands verify\-3d50f06850ae4ee0: missing or stale snapshot evidence
- commands verify\-1c84c08971fa4a54: missing or stale snapshot evidence
- commands verify\-b6004b2cc4924049: missing or stale snapshot evidence
- command verify\-b6004b2cc4924049: failed, timed out, truncated, or incomplete evidence
- commands verify\-bd5ecd9abb9047ff: missing or stale snapshot evidence
- commands verify\-0472d0fb588f4f5e: missing or stale snapshot evidence
- commands verify\-6f8dd6b54bee49a7: missing or stale snapshot evidence
- commands verify\-ceeed0f44c0a4ada: missing or stale snapshot evidence
- commands verify\-d2f4f930e83043b7: missing or stale snapshot evidence
- commands verify\-2985827343384cac: missing or stale snapshot evidence
- command verify\-2985827343384cac: failed, timed out, truncated, or incomplete evidence
- handoffs evaluation\-complete\-resume2: invalid artifact, references, resource record, or snapshot
- handoffs evaluation\-complete\-resume2: missing or stale snapshot evidence
- handoffs integration\-blocked\-resume4: invalid artifact, references, resource record, or snapshot
- handoffs integration\-blocked\-resume4: missing or stale snapshot evidence
- case usage\-own\-only: executable check has no current passing evidence
- case usage\-role\-session: executable check has no current passing evidence
- case usage\-day\-retry: executable check has no current passing evidence
- case usage\-outcomes: executable check has no current passing evidence
- case usage\-unknown: executable check has no current passing evidence
- case usage\-former\-assignment: executable check has no current passing evidence
- case usage\-late\-read: executable check has no current passing evidence
- case usage\-auth\-races: executable check has no current passing evidence
- case usage\-view\-rollback: executable check has no current passing evidence
- case eval\-transient\-human: executable check has no current passing evidence
- case reviewer\-stale\-result: executable check has no current passing evidence
- case reviewer\-overcap\-manual: executable check has no current passing evidence
- case reviewer\-real\-history: executable check has no current passing evidence
- case reviewer\-a11y: executable check has no current passing evidence
- case usage\-browser\-own: executable check has no current passing evidence
- assignment dashboard: no current successful completion
- assignment gateway\-tests: no current successful completion

## Telemetry limitations

- Own\-thread delta outside Git; unexposed settings/tool/retry counts; rec\-378a679e3dcb456d: usage\_source, observed\_model, observed\_effort
- not exposed by collector; rec\-378a679e3dcb456d: tool\_calls, retries; rec\-fee7b56af87d4cc7: tool\_calls, retries; rec\-4ca9c50bbf28494a: tool\_calls, retries; rec\-974b303721164956: tool\_calls, retries; rec\-e8ebfe6de0464986: tool\_calls, retries
- Tool/retry counts and observed runtime model settings not exposed; end sample excludes unflushed completion/final tail.; rec\-678d7c8324ef4cc1: tool\_calls, retries, observed\_model, observed\_effort
- Aligned own\-stage runtime token delta imported. Observed settings/tool\-call/retry counters unavailable; sampling lag and final rendering excluded.; rec\-95237763f2b44d96: tool\_calls, retries, observed\_model, observed\_effort
- Sampled own\-thread delta outside Git; settings/tool/retry counters unavailable; rec\-fee7b56af87d4cc7: usage\_source, observed\_model, observed\_effort
- Own sampled thread delta outside Git; settings/tool/retry counters unavailable; rec\-4ca9c50bbf28494a: usage\_source, observed\_model, observed\_effort
- Pause closure was blocked by automatic approval review usage\-limit failure; historical stage\-aligned cutoff unavailable, do not attribute idle totals; rec\-ec676c674ad04133: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort
- Own aligned token delta imported; observed settings/tool/retry counters unavailable; lagging tail and final rendering excluded.; rec\-1987b796d6174ef5: tool\_calls, retries, observed\_model, observed\_effort
- Own stage delta outside Git; exact settings/tool/retry counters unavailable; rec\-324eb55e3cf04795: usage\_source, observed\_model, observed\_effort
- not exposed; rec\-324eb55e3cf04795: tool\_calls, retries; rec\-1f08a79ebb7d441b: tool\_calls, retries; rec\-1e4dcce8616a4010: tool\_calls, retries; rec\-59ba54302cf54b59: tool\_calls, retries
- Not exposed by collector; late/unflushed samples and completion rendering excluded. Baseline precedes readiness/start and includes preparatory operations.; rec\-c44874be8cc44fb6: tool\_calls, retries, observed\_model, observed\_effort
- Aligned own token delta import follows; tool/retry/settings counters and unflushed final tail unavailable.; rec\-56a8d16a20b74693: usage\_source, observed\_model, observed\_effort
- Not exposed by collector; unflushed final tail and record close excluded.; rec\-56a8d16a20b74693: tool\_calls, retries; rec\-bfd3c739599340a5: tool\_calls, retries; rec\-0367f271b90341e7: tool\_calls, retries; rec\-903ec9e3cf714ab4: tool\_calls, retries
- Tool/retry counts and observed runtime model settings not exposed; aligned own\-thread delta ends before unflushed final tail and completion rendering.; rec\-5961c35aae354a6a: tool\_calls, retries, observed\_model, observed\_effort
- Aligned own\-thread token delta follows; unflushed final tail/record closure and tool/retry/settings counters unavailable.; rec\-bfd3c739599340a5: usage\_source, observed\_model, observed\_effort
- Own aligned delta import follows; unflushed final tail/settings/tools/retries not exposed.; rec\-0367f271b90341e7: usage\_source, observed\_model, observed\_effort
- Per\-thread delta imported; initial retrieval before baseline and final rendering outside measured token window; full console timing output absent; tools/retries/observed settings unavailable; rec\-4b3d18a909e24a2b: tool\_calls, retries, observed\_model, observed\_effort
- Aligned own\-thread delta follows; unflushed final tail, record closure, observed settings/tools/retries unavailable.; rec\-903ec9e3cf714ab4: usage\_source, observed\_model, observed\_effort
- Fresh own\-thread pause sample outside Git; final unflushed/rendering tail and settings/tool/retry metrics unavailable; rec\-1f08a79ebb7d441b: usage\_source, observed\_model, observed\_effort
- Own thread token delta imported; tools/retries/observed settings and unflushed tail unavailable. Closure flag correction after start of review creates brief administrative interval overlap, not additional computation.; rec\-7c87a59d95a94a8e: tool\_calls, retries, observed\_model, observed\_effort
- Own\-thread token delta imported, cutoff excludes lagging report/pause\-finalization tail; tool calls/retries/observed settings unavailable. Initial security finish flag error recovered at actual checkpoint with brief administrative overlap disclosed.; rec\-95eda3dc3b404ace: tool\_calls, retries, observed\_model, observed\_effort
- Aligned own\-thread pause telemetry saved outside Git; sample excludes unflushed tail and close rendering; tool/retry and observed settings unavailable; rec\-1e4dcce8616a4010: usage\_source, observed\_model, observed\_effort
- Own sampled delta outside Git; runtime settings/tool/retry counters unavailable; rec\-974b303721164956: usage\_source, observed\_model, observed\_effort
- Own thread delta imported; initial retrieval and unflushed/final completion tail excluded, tool/retry counters and observed runtime settings unavailable. No human verification of prompt summaries claimed.; rec\-410a44abf6014abb: tool\_calls, retries, observed\_model, observed\_effort
- Own\-thread delta outside Git; observed settings/tool/retry counts unavailable; rec\-e8ebfe6de0464986: usage\_source, observed\_model, observed\_effort
- Own\-thread delta separately imported; initial retrieval and unflushed/evidence/closure/final rendering tail excluded; tools/retries/observed settings unavailable; rec\-59390f005e08461b: usage\_source, observed\_model, observed\_effort
- Collector does not expose tool counters; rec\-59390f005e08461b: tool\_calls
- Collector does not expose retry counters; rec\-59390f005e08461b: retries
- Own\-thread final sampled delta outside Git; bootstrap/unflushed/final\-rendering tails and tool/retry/settings unavailable; rec\-59ba54302cf54b59: usage\_source, observed\_model, observed\_effort# Reviewer resource summary

Records: 24; finished: 24.

| Agent / invocation / stage / attempt | Selected model / effort | Status | Elapsed seconds | Input / output / cache |
| --- | --- | --- | --- | --- |
| main / main\-validation\-recovery\-1 / dispatch / 1 | unavailable / unavailable | succeeded | 430.028142 | 4282353 / 11978 / 4268032 |
| evaluation / evaluation\-implement\-2 / implement / 2 | gpt\-6.1\-sol / medium | succeeded | 339.050349 | 2868740 / 5214 / 2858752 |
| dashboard / dashboard\-implement\-2 / implement / 2 | gpt\-6.1\-sol / high | succeeded | 1033.610593 | 6427181 / 8703 / 6403456 |
| main / main\-document\-1 / document / 1 | unavailable / unavailable | succeeded | 180.020896 | 1314814 / 5370 / 1307008 |
| main / main\-requirements\-recheck\-1 / compile / 1 | unavailable / unavailable | succeeded | 131.723307 | 908079 / 5672 / 903552 |
| main / main\-monitor\-1 / dispatch / 1 | unavailable / unavailable | interrupted | 1066.169526 | unavailable / unavailable / unavailable |
| dashboard / dashboard\-integrate\-1 / integrate / 1 | gpt\-6.1\-sol / high | interrupted | 201.735652 | 2662527 / 5018 / 2647808 |
| main / main\-resume2\-1 / dispatch / 1 | unavailable / unavailable | succeeded | 2103.991562 | 24740810 / 17061 / 24704000 |
| dashboard / dashboard\-fix\-resume2 / fix / 1 | gpt\-6.1\-sol / high | succeeded | 276.324507 | 1387640 / 4557 / 1354624 |
| dashboard / dashboard\-integrate\-resume2 / integrate / 1 | gpt\-6.1\-sol / high | failed | 84.214103 | 622897 / 1844 / 615936 |
| evaluation / evaluation\-fix\-resume2 / fix / 1 | gpt\-6.1\-sol / medium | succeeded | 136.664271 | 597253 / 1595 / 580608 |
| dashboard / dashboard\-integrate\-resume3 / integrate / 1 | gpt\-6.1\-sol / high | failed | 618.185842 | 4041325 / 7604 / 4013952 |
| dashboard / dashboard\-admin\-resume3 / document / 1 | gpt\-6.1\-sol / high | succeeded | 58.936441 | 504341 / 1127 / 502528 |
| gateway\-tests / gateway\-tests\-diagnose1 / implement / 1 | gpt\-6.1\-sol / high | succeeded | 475.73289 | 2418746 / 9119 / 2392832 |
| dashboard / dashboard\-integrate\-resume4 / integrate / 1 | gpt\-6.1\-sol / high | failed | 195.777924 | 1464140 / 3402 / 1458944 |
| main / main\-consolidation\-resume2 / close / 1 | unavailable / unavailable | interrupted | 365.235103 | 5675231 / 6118 / 5665152 |
| verifier / verifier\-security1 / security / 1 | gpt\-6.1\-sol / high | succeeded | 200.300208 | 827805 / 2716 / 729984 |
| verifier / verifier\-review1 / review / 1 | gpt\-6.1\-sol / high | succeeded | 211.374956 | 1175299 / 4235 / 1166080 |
| evaluation / evaluation\-f001 / fix / 1 | gpt\-6.1\-sol / medium | interrupted | 12.932119 | 76591 / 318 / 76032 |
| main / main\-f001\-resume3 / dispatch / 1 | unavailable / unavailable | succeeded | 348.829667 | 3516718 / 8607 / 3510272 |
| evaluation / evaluation\-f001\-resume3 / fix / 1 | gpt\-6.1\-sol / medium | succeeded | 333.90679 | 1521691 / 5582 / 1505280 |
| main / main\-f001\-docs / document / 1 | unavailable / unavailable | succeeded | 139.653258 | 2897807 / 5784 / 2893056 |
| verifier / verifier\-f001\-resume3 / revalidate / 1 | gpt\-6.1\-sol / medium | succeeded | 194.780489 | 515722 / 3085 / 496640 |
| main / main\-final\-consolidation3 / close / 1 | unavailable / unavailable | succeeded | 574.898526 | 4475003 / 17836 / 4468480 |

\{&quot;expected&quot;: 24, &quot;finished&quot;: 24, &quot;measured\_record\_coverage&quot;: \{&quot;cache\_read\_tokens&quot;: 23, &quot;input\_tokens&quot;: 23, &quot;output\_tokens&quot;: 23, &quot;retries&quot;: 0, &quot;tool\_calls&quot;: 0\}, &quot;measured\_totals\_only&quot;: \{&quot;cache\_read\_tokens&quot;: 74523008, &quot;input\_tokens&quot;: 74922713, &quot;output\_tokens&quot;: 142545, &quot;retries&quot;: 0, &quot;tool\_calls&quot;: 0\}, &quot;note&quot;: &quot;Span covers recorded boundaries only, not unrecorded full\-run time. Missing usage is not zero. Cache reads are included in input; reasoning is not added again.&quot;, &quot;observed\_record\_span\_seconds&quot;: 27750.846233, &quot;records&quot;: 24, &quot;summed\_agent\_elapsed\_seconds&quot;: 9714.077121\}

