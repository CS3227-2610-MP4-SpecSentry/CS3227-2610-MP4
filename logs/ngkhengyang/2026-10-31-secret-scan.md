# Fix historical secret-scan false positives

## Context and request

- Prompter: ngkhengyang, inferred from Git user.name; 31 October 2026, Asia/Singapore.
- Request: fix the failed CI secret scan and commit the change. Commit authorization does not include push, merge, or history rewriting.
- Starting revision: 56ec47fd834d65b5a0ecd87b0a88e68682f4a685, reviewer-role; working tree initially clean.
- CI evidence: run 41205788477, secret-scan job 124550486198. Gitleaks 8.30.1 scanned 49 commits and found 16 matches. The ordinary application CI job was still running when inspected; no application-CI completion claim is made here.
- Human verification of this AI-generated summary: pending.

## Diagnosis and change

Reproduced the 16 findings with the official Gitleaks 8.30.1 Windows binary, verified against the official release checksums. Only redacted reports and safe metadata were displayed. Historical matching source lines were inspected without copying matched values into this log.

All findings are non-credentials:

- Two synthetic test-only SESSION_SECRET assignments in approval-revocation and notification integration tests.
- Ten generated stableKey UUIDs shown in expected/received test failure output.
- Four SHA-256 source-file integrity hashes in evidence manifests.

Added `.gitleaksignore` containing precisely these 16 scanner fingerprints, grouped by verified classification. Each exception includes the original commit, exact path, scanner rule, and line. No directory/rule-wide allowlist, baseline, scanner disabling, CI scope reduction, application change, or history rewrite. Future occurrences in different commits are not exempted. Full HEAD ancestry, default rules, redaction, and scanner exit semantics remain unchanged. Some historical files have already been retired; removing current text alone would not clear their ancestor findings.

## Verification and limitations

- Before: same scanner/version/full HEAD-history command reproduced 16 findings, exit 1, 49 commits.
- After: same command scanned 49 commits, no findings, exit 0.
- Repeated from a separate working directory with an absolute repository argument to check discovery of the repository ignore file under CI-like invocation: no findings, exit 0.
- Disposable Git regression with the real scanner: clean history passes; a newly generated nonfunctional token canary at the same source path/line as an exception is detected; deleting it from the working tree still leaves it detected in ancestry. Canary contents and repository remain outside the project. Initial illustrative sequential canary was not detected by default rules; replaced it with a random-format nonfunctional canary for the discriminating checks. This did not require weakening any rule or exception.
- Initial download was blocked by sandbox network restrictions; approved download succeeded and checksum matched. An initial scan using a backslash safe.directory value rejected repository ownership and scanned zero commits; it was not treated as valid evidence. A process-scoped forward-slash safe.directory value allowed the actual reproductions without changing global Git configuration.
- Patch whitespace checked. Application tests omitted: changes only review scanner findings and record evidence, without changing application behavior.
- Hosted CI is not rerun by a local commit. No claim that remote CI is green; push/publication is outside this request.

## Resource record

Shared session `2026-10-31-secret-scan`, main record `4ebd30d5bfb94d6eb1cf7f53e583f21a`, started before repository edits. No subagents. MP4 sessions collector files `2026-10-31-secret-scan-start.json` and `2026-10-31-secret-scan-end.json` live under `C:/Users/User/Documents/NUS/CS3227/MP4 sessions/local-resource-tracking`. Only the main-thread delta is attributable to this stage; old descendant totals are not imported. Missing model/effort/tool/retry metadata remains unavailable. Final measurements are appended after actual validation; final report rendering and Git commit lie outside the measured edit/check boundary.

### Finished measurements

| Agent / stage / attempt | Model / effort | Start / end (UTC) | Elapsed seconds | Input / output tokens | Status |
| --- | --- | --- | --- | --- | --- |
| main / diagnose\-fix\-verify / 1 | unavailable / unavailable | 2026\-10\-31T13:33:41.289657\+00:00 / 2026\-10\-31T13:38:13.042995\+00:00 | 271.753338 | 3400004 / 5581 | succeeded |

Record: [main interval](resources/2026-10-31-secret-scan/4ebd30d5bfb94d6eb1cf7f53e583f21a.json). The single interval is both calendar span and summed agent elapsed; active computation remains unavailable. Baseline and final cutoff exclude initial read-only diagnosis and final Git/reporting work.
