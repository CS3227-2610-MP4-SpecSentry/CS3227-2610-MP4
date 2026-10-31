# Reviewer run report

Canonical source: state.json; this report is a derived view.

Run: 2026\-10\-27\-reviewer\-iteration4\-implementation; consistent: False.

## Assignments and completion

| Assignment | Agent | Latest completion | Current |
| --- | --- | --- | --- |
| foundation | foundation | 09\-foundation\-order\-fix\-complete | True |
| reviewer | reviewer | 09\-reviewer\-integration\-evidence | False |
| release | release | 10\-release\-lint\-complete | False |
| ui | ui | 06\-ui\-complete | False |

## Acceptance evidence

| Case | Requirement | Kind | Owner | Check |
| --- | --- | --- | --- | --- |
| revoke\-unattached | REQ\-REV\-016 | normal | reviewer | reviewer\-revocation\-captured |
| revoke\-attached\-freeze | REQ\-REV\-004 | normal | release | release\-normal\-all |
| revoke\-decision\-round | REQ\-REV\-005 | normal | reviewer | reviewer\-revocation\-captured |
| revoke\-history | REQ\-REV\-006 | normal | reviewer | reviewer\-revocation\-captured |
| revoke\-access | REQ\-REV\-016 | authorization | reviewer | reviewer\-revocation\-captured |
| revoke\-session | REQ\-REV\-016 | authorization | reviewer | reviewer\-revocation\-captured |
| revoke\-stale | REQ\-REV\-016 | lifecycle | reviewer | reviewer\-revocation\-captured |
| revoke\-released | REQ\-REV\-016 | lifecycle | reviewer | reviewer\-revocation\-captured |
| revoke\-invalid | REQ\-REV\-016 | lifecycle | reviewer | reviewer\-revocation\-captured |
| revoke\-idempotency | REQ\-REV\-016 | boundary | reviewer | reviewer\-revocation\-captured |
| revoke\-replay\-access | REQ\-REV\-016 | authorization | reviewer | reviewer\-revocation\-captured |
| revoke\-rollback | REQ\-REV\-016 | rollback | reviewer | reviewer\-revocation\-captured |
| revoke\-reason\-empty | REQ\-REV\-016 | boundary | foundation | foundation\-contracts\-all |
| revoke\-reason\-limit | REQ\-REV\-016 | boundary | foundation | foundation\-contracts\-all |
| revoke\-strict\-body | REQ\-REV\-016 | boundary | foundation | foundation\-contracts\-all |
| revoke\-foundation\-provenance | REQ\-REV\-016 | normal | foundation | foundation\-data\-captured |
| revoke\-foundation\-fixture | REQ\-REV\-016 | normal | foundation | foundation\-data\-captured |
| revoke\-attached | REQ\-REV\-016 | normal | release | release\-normal\-all |
| revoke\-readiness | REQ\-REV\-016 | normal | release | release\-normal\-all |
| revoke\-notice\-ack | REQ\-REV\-016 | normal | release | release\-normal\-all |
| revoke\-notice\-scope | REQ\-REV\-016 | authorization | release | release\-normal\-all |
| revoke\-remove | REQ\-REV\-016 | lifecycle | release | release\-normal\-all |
| release\-ownership | REQ\-REV\-016 | authorization | release | release\-normal\-all |
| release\-gates | REQ\-REV\-016 | boundary | release | release\-normal\-all |
| release\-rollback | REQ\-REV\-016 | rollback | release | release\-normal\-all |
| revoke\-publish\-revoke\-first | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-publish\-publish\-first | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-remove\-revoke\-first | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-remove\-remove\-first | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-reopen\-revoke\-first | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-reopen\-reopen\-first | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-duplicate\-same\-key | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-duplicate\-different\-keys | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-disable\-disable\-first | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-disable\-revoke\-first | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-session\-invalidate\-first | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-session\-revoke\-first | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-attach\-attach\-first | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-attach\-revoke\-first | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-ui | REQ\-REV\-016 | normal | ui | revocation\-browser |
| revoke\-ui\-recovery | REQ\-REV\-016 | normal | ui | revocation\-browser |
| revoke\-ui\-accessibility | REQ\-REV\-016 | normal | ui | revocation\-browser |
| revoke\-remove\-disable\-first | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-remove\-removal\-first | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-same\-key\-changed\-body | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-notice\-get | REQ\-REV\-016 | authorization | release | release\-normal\-all |
| revoke\-notice\-csrf | REQ\-REV\-016 | authorization | release | release\-normal\-all |
| revoke\-notice\-newer | REQ\-REV\-016 | concurrency | release | release\-races\-all |
| revoke\-candidate\-privacy | REQ\-REV\-016 | authorization | release | release\-normal\-all |

## Findings

No findings recorded; this does not certify review coverage.

## Evidence and limitations

- commands: verify\-5f7f0517627d4a33; snapshot verify\-5f7f0517627d4a33; superseded by None
- commands: verify\-b9aabcb010d3483d; snapshot verify\-b9aabcb010d3483d; superseded by verify\-37b8330328f64c35
- commands: verify\-5c5b9ae12cc546eb; snapshot verify\-5c5b9ae12cc546eb; superseded by None
- commands: verify\-37b8330328f64c35; snapshot verify\-37b8330328f64c35; superseded by None
- commands: verify\-37cfffe287504705; snapshot verify\-37cfffe287504705; superseded by None
- commands: verify\-4174667eb4014af0; snapshot verify\-4174667eb4014af0; superseded by None
- commands: verify\-d2391f1745aa4fc8; snapshot verify\-d2391f1745aa4fc8; superseded by None
- commands: verify\-9fd712811ada4ef5; snapshot verify\-9fd712811ada4ef5; superseded by verify\-5db63fee7f66491c
- commands: verify\-2d467e71a9ab45ea; snapshot verify\-2d467e71a9ab45ea; superseded by None
- commands: verify\-5db63fee7f66491c; snapshot verify\-5db63fee7f66491c; superseded by None
- commands: verify\-efa77382d25f43de; snapshot verify\-efa77382d25f43de; superseded by None
- commands: verify\-8941e221a5724996; snapshot verify\-8941e221a5724996; superseded by None
- commands: verify\-9d64b619e6634c0a; snapshot verify\-9d64b619e6634c0a; superseded by None
- commands: verify\-b3d53d2900ec4e32; snapshot verify\-b3d53d2900ec4e32; superseded by None
- commands: verify\-a1d5ca190fd7498e; snapshot verify\-a1d5ca190fd7498e; superseded by None
- commands: verify\-c61bce53b8344a82; snapshot verify\-c61bce53b8344a82; superseded by verify\-f1c3938859164c10
- commands: verify\-43ffd9d53dc84cd8; snapshot verify\-43ffd9d53dc84cd8; superseded by verify\-f1c3938859164c10
- commands: verify\-7ddd2b9c3dfa49fc; snapshot verify\-7ddd2b9c3dfa49fc; superseded by None
- commands: verify\-ff0b45d8da4e4371; snapshot verify\-ff0b45d8da4e4371; superseded by None
- commands: verify\-5b3d2c0b65e2434b; snapshot verify\-5b3d2c0b65e2434b; superseded by verify\-f1c3938859164c10
- commands: verify\-305c4f696fdd4acf; snapshot verify\-305c4f696fdd4acf; superseded by None
- commands: verify\-629251bc47ab4191; snapshot verify\-629251bc47ab4191; superseded by None
- commands: verify\-f1c3938859164c10; snapshot verify\-f1c3938859164c10; superseded by None
- commands: verify\-9665884e16544e88; snapshot verify\-9665884e16544e88; superseded by None
- commands: verify\-8c2f19a46b6d457a; snapshot verify\-8c2f19a46b6d457a; superseded by None
- commands: verify\-f11aa17e37134262; snapshot verify\-f11aa17e37134262; superseded by None
- commands: verify\-1ab94773fe0e4b45; snapshot verify\-1ab94773fe0e4b45; superseded by None
- commands: verify\-2bf3ace2413946d5; snapshot verify\-2bf3ace2413946d5; superseded by None
- commands: verify\-5ead5dfa31494421; snapshot verify\-5ead5dfa31494421; superseded by verify\-9d3faeae1e17459b
- commands: verify\-428df2a792f64c97; snapshot verify\-428df2a792f64c97; superseded by verify\-9d3faeae1e17459b
- commands: verify\-9d3faeae1e17459b; snapshot verify\-9d3faeae1e17459b; superseded by None
- commands: verify\-ddb58387c4b948ec; snapshot verify\-ddb58387c4b948ec; superseded by verify\-2c7a1e42548045d1
- commands: verify\-8fd37b14be45406b; snapshot verify\-8fd37b14be45406b; superseded by verify\-2c7a1e42548045d1
- commands: verify\-b25c3be07f994465; snapshot verify\-b25c3be07f994465; superseded by None
- commands: verify\-a8a5826a0f66448e; snapshot verify\-a8a5826a0f66448e; superseded by None
- commands: verify\-2c7a1e42548045d1; snapshot verify\-2c7a1e42548045d1; superseded by None
- commands: verify\-8015ab7229334bef; snapshot verify\-8015ab7229334bef; superseded by verify\-1c47a293b2234391
- commands: verify\-a125ef12630d49cc; snapshot verify\-a125ef12630d49cc; superseded by None
- commands: verify\-1c47a293b2234391; snapshot verify\-1c47a293b2234391; superseded by None
- commands: verify\-2490b4e25dc04765; snapshot verify\-2490b4e25dc04765; superseded by None
- commands: verify\-e7f212822aee415d; snapshot verify\-e7f212822aee415d; superseded by None
- commands: verify\-96d6238f037643e6; snapshot verify\-96d6238f037643e6; superseded by None
- commands: verify\-c85ad1e3d4c04dd9; snapshot verify\-c85ad1e3d4c04dd9; superseded by None
- commands: verify\-c8a7318e6c94458d; snapshot verify\-c8a7318e6c94458d; superseded by None
- commands: verify\-014d1d31783d4c17; snapshot verify\-014d1d31783d4c17; superseded by None
- commands: verify\-a66061800fec4b45; snapshot verify\-a66061800fec4b45; superseded by None
- commands: verify\-84da8ef98dd841a8; snapshot verify\-84da8ef98dd841a8; superseded by None
- commands: verify\-f045f09094424b27; snapshot verify\-f045f09094424b27; superseded by None
- commands: verify\-aab100753aa542c7; snapshot verify\-aab100753aa542c7; superseded by None
- commands: verify\-da6151ff999c4998; snapshot verify\-da6151ff999c4998; superseded by None
- commands: verify\-02c2fb1ddfeb40df; snapshot verify\-02c2fb1ddfeb40df; superseded by None
- commands: verify\-a2ff25ffd97a4226; snapshot verify\-a2ff25ffd97a4226; superseded by None
- commands: verify\-ac9ae78192d74651; snapshot verify\-ac9ae78192d74651; superseded by None
- commands: verify\-a3f32302bee64a81; snapshot verify\-a3f32302bee64a81; superseded by None
- commands: verify\-4822414f98ee4612; snapshot verify\-4822414f98ee4612; superseded by None
- commands: verify\-c974c79a62934edb; snapshot verify\-c974c79a62934edb; superseded by None
- commands: verify\-4645d336fb5b4689; snapshot verify\-4645d336fb5b4689; superseded by None
- commands: verify\-3e7d80c207194461; snapshot verify\-3e7d80c207194461; superseded by None
- commands: verify\-3437b88b222d4fa0; snapshot verify\-3437b88b222d4fa0; superseded by None
- commands: verify\-0e71e72156f2486e; snapshot verify\-0e71e72156f2486e; superseded by None
- commands: verify\-87957dde026d4987; snapshot verify\-87957dde026d4987; superseded by None
- commands: verify\-b86c3e46fa354147; snapshot verify\-b86c3e46fa354147; superseded by None
- commands: verify\-eabce479231f47f2; snapshot verify\-eabce479231f47f2; superseded by None
- commands: verify\-a74d807e21e64d18; snapshot verify\-a74d807e21e64d18; superseded by None
- commands: verify\-30f9fcdaad52461d; snapshot verify\-30f9fcdaad52461d; superseded by None
- commands: verify\-ea4025b7daa34523; snapshot verify\-ea4025b7daa34523; superseded by None
- commands: verify\-a640f8e17bcb4a81; snapshot verify\-a640f8e17bcb4a81; superseded by None
- commands: verify\-566312eeb095481b; snapshot verify\-566312eeb095481b; superseded by None
- commands: verify\-7c32aa0e3d014be6; snapshot verify\-7c32aa0e3d014be6; superseded by None
- commands: verify\-0fff06cce4b043f7; snapshot verify\-0fff06cce4b043f7; superseded by None
- commands: verify\-38da33136cdd4c87; snapshot verify\-38da33136cdd4c87; superseded by None
- commands: verify\-7b05839ce8eb4e49; snapshot verify\-7b05839ce8eb4e49; superseded by None
- commands: verify\-f411f9aab2f54ceb; snapshot verify\-f411f9aab2f54ceb; superseded by None
- commands: verify\-76bb760447fa4071; snapshot verify\-76bb760447fa4071; superseded by None
- commands: verify\-cf5a5c73fd574797; snapshot verify\-cf5a5c73fd574797; superseded by None
- commands: verify\-2a48ea6fbf8b492d; snapshot verify\-2a48ea6fbf8b492d; superseded by None
- commands: verify\-4dda8e24059f4de8; snapshot verify\-4dda8e24059f4de8; superseded by None
- commands: verify\-0f2965b7acef4cdd; snapshot verify\-0f2965b7acef4cdd; superseded by None
- commands: verify\-5e1e50ccea0346dd; snapshot verify\-5e1e50ccea0346dd; superseded by None
- commands: verify\-a8243df3ecbd42f0; snapshot verify\-a8243df3ecbd42f0; superseded by None
- commands: verify\-319cd30d9a774245; snapshot verify\-319cd30d9a774245; superseded by None
- commands: verify\-b0e002a9bfa2414d; snapshot verify\-b0e002a9bfa2414d; superseded by None
- commands: verify\-bf956a056ee14c36; snapshot verify\-bf956a056ee14c36; superseded by None
- handoffs: 01\-main\-to\-foundation; snapshot None; superseded by None
- handoffs: 02\-foundation\-complete; snapshot foundation\-settled\-1; superseded by None
- handoffs: 03\-main\-to\-reviewer; snapshot None; superseded by None
- handoffs: 03\-main\-to\-release; snapshot None; superseded by None
- handoffs: 04\-reviewer\-complete; snapshot reviewer\-settled\-1; superseded by None
- handoffs: 04\-release\-complete; snapshot release\-settled\-1; superseded by None
- handoffs: 05\-main\-to\-ui; snapshot None; superseded by None
- handoffs: 06\-ui\-complete; snapshot ui\-settled\-1; superseded by None
- handoffs: 07\-main\-to\-integrator; snapshot None; superseded by None
- handoffs: 08\-main\-to\-foundation\-fix; snapshot None; superseded by None
- handoffs: 08\-main\-to\-ui\-fix; snapshot None; superseded by None
- handoffs: 08\-main\-to\-release\-fix; snapshot None; superseded by None
- handoffs: 09\-foundation\-order\-fix\-complete; snapshot foundation\-order\-fix\-source; superseded by None
- handoffs: 09\-reviewer\-integration\-evidence; snapshot reviewer\-settled\-1; superseded by None
- handoffs: 09\-release\-integration\-evidence; snapshot release\-settled\-1; superseded by None
- handoffs: 10\-release\-lint\-complete; snapshot release\-lint\-fixed\-final; superseded by None

- expected implementation\-reviewer\|main\-review\-round1\|review\|1: requires exactly one resource record, found 0
- expected security\-reviewer\|code\-security\-round1\|security\|1: requires exactly one resource record, found 0
- record rec\-1e9933d140d24775: latest stage attempt remains unresolved
- record rec\-b49b9dd78e4c4719: latest stage attempt remains unresolved
- record rec\-7167a31828de45f6: latest stage attempt remains unresolved
- record rec\-4a0f2db8c4454932: latest stage attempt remains unresolved
- record rec\-76ff59eb82bb4be8: latest stage attempt remains unresolved
- record rec\-dbb25d498d86448a: latest stage attempt remains unresolved
- required stage security: no successful resource record
- required stage integrate: no successful resource record
- required stage review: no successful resource record
- required stage close: no successful resource record
- independent review: no successful reviewer distinct from implementation/fix agents
- independent security review: no successful security agent distinct from implementation/fix agents
- commands verify\-5f7f0517627d4a33: missing or stale snapshot evidence
- commands verify\-5c5b9ae12cc546eb: missing or stale snapshot evidence
- commands verify\-37b8330328f64c35: missing or stale snapshot evidence
- commands verify\-37cfffe287504705: missing or stale snapshot evidence
- commands verify\-4174667eb4014af0: missing or stale snapshot evidence
- commands verify\-d2391f1745aa4fc8: missing or stale snapshot evidence
- commands verify\-efa77382d25f43de: missing or stale snapshot evidence
- commands verify\-8941e221a5724996: missing or stale snapshot evidence
- commands verify\-9d64b619e6634c0a: missing or stale snapshot evidence
- commands verify\-b3d53d2900ec4e32: missing or stale snapshot evidence
- commands verify\-a1d5ca190fd7498e: missing or stale snapshot evidence
- commands verify\-7ddd2b9c3dfa49fc: missing or stale snapshot evidence
- commands verify\-ff0b45d8da4e4371: missing or stale snapshot evidence
- commands verify\-305c4f696fdd4acf: missing or stale snapshot evidence
- commands verify\-629251bc47ab4191: missing or stale snapshot evidence
- commands verify\-f1c3938859164c10: missing or stale snapshot evidence
- commands verify\-9665884e16544e88: missing or stale snapshot evidence
- commands verify\-1ab94773fe0e4b45: missing or stale snapshot evidence
- commands verify\-2bf3ace2413946d5: missing or stale snapshot evidence
- commands verify\-9d3faeae1e17459b: missing or stale snapshot evidence
- commands verify\-b25c3be07f994465: missing or stale snapshot evidence
- commands verify\-a8a5826a0f66448e: missing or stale snapshot evidence
- command verify\-a8a5826a0f66448e: failed, timed out, truncated, or incomplete evidence
- commands verify\-2c7a1e42548045d1: missing or stale snapshot evidence
- commands verify\-a125ef12630d49cc: missing or stale snapshot evidence
- command verify\-a125ef12630d49cc: failed, timed out, truncated, or incomplete evidence
- commands verify\-1c47a293b2234391: missing or stale snapshot evidence
- commands verify\-2490b4e25dc04765: missing or stale snapshot evidence
- commands verify\-e7f212822aee415d: missing or stale snapshot evidence
- commands verify\-96d6238f037643e6: missing or stale snapshot evidence
- command verify\-c8a7318e6c94458d: failed, timed out, truncated, or incomplete evidence
- commands verify\-f045f09094424b27: missing or stale snapshot evidence
- commands verify\-aab100753aa542c7: missing or stale snapshot evidence
- commands verify\-da6151ff999c4998: missing or stale snapshot evidence
- command verify\-da6151ff999c4998: failed, timed out, truncated, or incomplete evidence
- commands verify\-02c2fb1ddfeb40df: missing or stale snapshot evidence
- command verify\-02c2fb1ddfeb40df: failed, timed out, truncated, or incomplete evidence
- commands verify\-a2ff25ffd97a4226: missing or stale snapshot evidence
- commands verify\-ac9ae78192d74651: missing or stale snapshot evidence
- commands verify\-a3f32302bee64a81: missing or stale snapshot evidence
- command verify\-a3f32302bee64a81: failed, timed out, truncated, or incomplete evidence
- commands verify\-4822414f98ee4612: missing or stale snapshot evidence
- commands verify\-c974c79a62934edb: missing or stale snapshot evidence
- command verify\-c974c79a62934edb: failed, timed out, truncated, or incomplete evidence
- commands verify\-4645d336fb5b4689: missing or stale snapshot evidence
- command verify\-4645d336fb5b4689: failed, timed out, truncated, or incomplete evidence
- commands verify\-0e71e72156f2486e: missing or stale snapshot evidence
- commands verify\-566312eeb095481b: missing or stale snapshot evidence
- commands verify\-7c32aa0e3d014be6: missing or stale snapshot evidence
- commands verify\-0fff06cce4b043f7: missing or stale snapshot evidence
- commands verify\-38da33136cdd4c87: missing or stale snapshot evidence
- commands verify\-7b05839ce8eb4e49: missing or stale snapshot evidence
- commands verify\-f411f9aab2f54ceb: missing or stale snapshot evidence
- command verify\-f411f9aab2f54ceb: failed, timed out, truncated, or incomplete evidence
- commands verify\-76bb760447fa4071: missing or stale snapshot evidence
- commands verify\-cf5a5c73fd574797: missing or stale snapshot evidence
- command verify\-cf5a5c73fd574797: failed, timed out, truncated, or incomplete evidence
- commands verify\-b0e002a9bfa2414d: missing or stale snapshot evidence
- commands verify\-bf956a056ee14c36: missing or stale snapshot evidence
- command verify\-bf956a056ee14c36: failed, timed out, truncated, or incomplete evidence
- handoffs 02\-foundation\-complete: invalid artifact, references, resource record, or snapshot
- handoffs 02\-foundation\-complete: missing or stale snapshot evidence
- handoffs 04\-release\-complete: invalid artifact, references, resource record, or snapshot
- handoffs 04\-release\-complete: missing or stale snapshot evidence
- handoffs 06\-ui\-complete: invalid artifact, references, resource record, or snapshot
- handoffs 06\-ui\-complete: missing or stale snapshot evidence
- handoffs 09\-release\-integration\-evidence: invalid artifact, references, resource record, or snapshot
- handoffs 09\-release\-integration\-evidence: missing or stale snapshot evidence
- handoffs 10\-release\-lint\-complete: invalid artifact, references, resource record, or snapshot
- handoffs 10\-release\-lint\-complete: missing or stale snapshot evidence
- case revoke\-unattached: executable check has no current passing evidence
- case revoke\-attached\-freeze: executable check has no current passing evidence
- case revoke\-decision\-round: executable check has no current passing evidence
- case revoke\-history: executable check has no current passing evidence
- case revoke\-access: executable check has no current passing evidence
- case revoke\-session: executable check has no current passing evidence
- case revoke\-stale: executable check has no current passing evidence
- case revoke\-released: executable check has no current passing evidence
- case revoke\-invalid: executable check has no current passing evidence
- case revoke\-idempotency: executable check has no current passing evidence
- case revoke\-replay\-access: executable check has no current passing evidence
- case revoke\-rollback: executable check has no current passing evidence
- case revoke\-reason\-empty: executable check has no current passing evidence
- case revoke\-reason\-limit: executable check has no current passing evidence
- case revoke\-strict\-body: executable check has no current passing evidence
- case revoke\-foundation\-provenance: executable check has no current passing evidence
- case revoke\-foundation\-fixture: executable check has no current passing evidence
- case revoke\-attached: executable check has no current passing evidence
- case revoke\-readiness: executable check has no current passing evidence
- case revoke\-notice\-ack: executable check has no current passing evidence
- case revoke\-notice\-scope: executable check has no current passing evidence
- case revoke\-remove: executable check has no current passing evidence
- case release\-ownership: executable check has no current passing evidence
- case release\-gates: executable check has no current passing evidence
- case release\-rollback: executable check has no current passing evidence
- case revoke\-publish\-revoke\-first: executable check has no current passing evidence
- case revoke\-publish\-publish\-first: executable check has no current passing evidence
- case revoke\-remove\-revoke\-first: executable check has no current passing evidence
- case revoke\-remove\-remove\-first: executable check has no current passing evidence
- case revoke\-reopen\-revoke\-first: executable check has no current passing evidence
- case revoke\-reopen\-reopen\-first: executable check has no current passing evidence
- case revoke\-duplicate\-same\-key: executable check has no current passing evidence
- case revoke\-duplicate\-different\-keys: executable check has no current passing evidence
- case revoke\-disable\-disable\-first: executable check has no current passing evidence
- case revoke\-disable\-revoke\-first: executable check has no current passing evidence
- case revoke\-session\-invalidate\-first: executable check has no current passing evidence
- case revoke\-session\-revoke\-first: executable check has no current passing evidence
- case revoke\-attach\-attach\-first: executable check has no current passing evidence
- case revoke\-attach\-revoke\-first: executable check has no current passing evidence
- case revoke\-ui: executable check has no current passing evidence
- case revoke\-ui\-recovery: executable check has no current passing evidence
- case revoke\-ui\-accessibility: executable check has no current passing evidence
- case revoke\-remove\-disable\-first: executable check has no current passing evidence
- case revoke\-remove\-removal\-first: executable check has no current passing evidence
- case revoke\-same\-key\-changed\-body: executable check has no current passing evidence
- case revoke\-notice\-get: executable check has no current passing evidence
- case revoke\-notice\-csrf: executable check has no current passing evidence
- case revoke\-notice\-newer: executable check has no current passing evidence
- case revoke\-candidate\-privacy: executable check has no current passing evidence
- assignment reviewer: no current successful completion
- assignment release: no current successful completion
- assignment ui: no current successful completion

## Telemetry limitations

- Selected main settings and exact stage\-aligned telemetry unavailable; external sampled windows retained; rec\-ed778f88f45b4377: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort
- Pause stop\-time recording was delayed; exact idle gap and stage\-aligned token/model/tool counters unavailable; original boundaries preserved; rec\-1e9933d140d24775: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort; rec\-b49b9dd78e4c4719: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort; rec\-7167a31828de45f6: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort
- Exact stage\-aligned runtime tokens/model/tool/retry counters unavailable; coordinator\-observed interval and sampled per\-thread collector evidence retained; rec\-e68edb5dfbec4794: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort
- Exact stage\-aligned usage/model/tool/retry telemetry unavailable; sampled thread windows retained with cutoffs; rec\-89ba37939535404a: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort
- Exact record\-aligned runtime tokens/cache/settings/tool/retry counters unavailable; coordinator\-observed elapsed and sampled thread windows retained separately; rec\-d6a3224531e44b31: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort; rec\-7df874d0e6a24905: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort; rec\-dd9d79ed13584a5a: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort
- Exact aligned token/cache/model/tool/retry telemetry unavailable; separate external sampled windows/cutoffs retained; rec\-74b3e338a2324d17: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort
- Exact aligned main settings/token/tool/retry metrics unavailable; external sampled window retained; rec\-9908d8a392fc45d1: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort
- Stage\-aligned counters unavailable; cumulative integrator thread sample retained; rec\-4a0f2db8c4454932: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort
- Exact aligned model/token/tool/retry telemetry unavailable; separate sampled documentation window retained; rec\-08fea657c3a7462f: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort
- Stage\-aligned tokens unavailable; cumulative thread counters retained separately; rec\-76ff59eb82bb4be8: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort
- Exact aligned token/model/tool metrics unavailable; coordinator\-observed fix and sampled thread evidence retained; rec\-9eb0b58e15c74559: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort
- Stage\-aligned counters unavailable; rec\-dbb25d498d86448a: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort
- Stage\-aligned counters unavailable; retrospective per\-thread sample retained; rec\-53bde17cc3824a0a: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort
- Exact stage token/settings unavailable; cumulative thread sample retained; rec\-1576005e4746463e: usage\_source, input\_tokens, output\_tokens, cache\_read\_tokens, tool\_calls, retries, observed\_model, observed\_effort# Reviewer resource summary

Records: 18; finished: 18.

| Agent / invocation / stage / attempt | Selected model / effort | Status | Elapsed seconds | Input / output / cache |
| --- | --- | --- | --- | --- |
| main / main\-execution\-compile / compile / 1 | unavailable / unavailable | succeeded | 310.744467 | unavailable / unavailable / unavailable |
| main / main\-implementation\-coordination / dispatch / 1 | unavailable / unavailable | interrupted | 2785.540556 | unavailable / unavailable / unavailable |
| foundation / foundation\-implement\-1 / implement / 1 | gpt\-6\-sol / high | succeeded | 1823.343268 | unavailable / unavailable / unavailable |
| reviewer / reviewer\-implement\-1 / implement / 1 | gpt\-6\-sol / high | interrupted | 847.211993 | unavailable / unavailable / unavailable |
| release / release\-implement\-1 / implement / 1 | gpt\-6\-sol / high | interrupted | 784.825754 | unavailable / unavailable / unavailable |
| main / main\-resume2\-coordination / dispatch / 1 | unavailable / unavailable | succeeded | 1280.168204 | unavailable / unavailable / unavailable |
| reviewer / reviewer\-implement\-resume / implement / 1 | gpt\-6\-sol / high | succeeded | 756.857636 | unavailable / unavailable / unavailable |
| release / release\-implement\-resume / implement / 1 | gpt\-6\-sol / high | succeeded | 760.017257 | unavailable / unavailable / unavailable |
| ui / ui\-implement\-1 / implement / 1 | gpt\-6\-sol / medium | succeeded | 380.775248 | unavailable / unavailable / unavailable |
| main / main\-preintegration\-consolidation / document / 1 | unavailable / unavailable | succeeded | 147.91829 | unavailable / unavailable / unavailable |
| main / main\-integration\-review\-coordination / dispatch / 1 | unavailable / unavailable | succeeded | 721.90887 | unavailable / unavailable / unavailable |
| integrator / integrate\-1 / integrate / 1 | gpt\-6\-sol / high | failed | 27739.232998 | unavailable / unavailable / unavailable |
| main / main\-guides\-before\-review / document / 1 | unavailable / unavailable | succeeded | 253.844181 | unavailable / unavailable / unavailable |
| main / main\-first\-review\-preparation / dispatch / 1 | unavailable / unavailable | interrupted | 26488.520112 | unavailable / unavailable / unavailable |
| foundation / foundation\-integration\-fix1 / fix / 1 | gpt\-6\-sol / high | succeeded | 266.010702 | unavailable / unavailable / unavailable |
| ui / ui\-integration\-fix1 / fix / 1 | gpt\-6\-sol / medium | failed | 26263.177836 | unavailable / unavailable / unavailable |
| release / release\-integration\-fix1 / fix / 1 | gpt\-6\-sol / high | succeeded | 26367.213487 | unavailable / unavailable / unavailable |
| main / main\-resume\-review\-fixer / dispatch / 1 | unavailable / unavailable | succeeded | 633.26114 | unavailable / unavailable / unavailable |

\{&quot;expected&quot;: 20, &quot;finished&quot;: 18, &quot;measured\_record\_coverage&quot;: \{&quot;cache\_read\_tokens&quot;: 0, &quot;input\_tokens&quot;: 0, &quot;output\_tokens&quot;: 0, &quot;retries&quot;: 0, &quot;tool\_calls&quot;: 0\}, &quot;measured\_totals\_only&quot;: \{&quot;cache\_read\_tokens&quot;: 0, &quot;input\_tokens&quot;: 0, &quot;output\_tokens&quot;: 0, &quot;retries&quot;: 0, &quot;tool\_calls&quot;: 0\}, &quot;note&quot;: &quot;Span covers recorded boundaries only, not unrecorded full\-run time. Missing usage is not zero. Cache reads are included in input; reasoning is not added again.&quot;, &quot;observed\_record\_span\_seconds&quot;: 42362.25228, &quot;records&quot;: 18, &quot;summed\_agent\_elapsed\_seconds&quot;: 118610.57199899999\}

