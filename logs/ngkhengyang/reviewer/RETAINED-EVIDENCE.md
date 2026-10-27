# Iteration 3 and 4 retained evidence

Retention updated 27 October 2026. These completed runs are retained for historical traceability. Their separate `snapshots/*.json` copies have been removed; their complete payloads, original artifact hashes, source scopes and Git identifiers remain in each original `state.json`. State records and their original artifact-path fields are unchanged historical records, not claims that those files still exist.

## Where to read the outcomes

- [Iteration 3 consolidated workflow report](../2026-10-26-reviewer-iteration3.md): requirements, implementation, independent findings and fixes, tests, resources and limitations. [Final independent fix review](2026-10-26-patch-risk-i3-implementation/reports/final-fix-review.md).
- [Iteration 4 consolidated workflow report](../2026-10-26-reviewer-iteration4.md): assignments, integration, independent findings and fixes, tests, resources and limitations. [Final validation](2026-10-27-reviewer-iteration4-review-fixes/reports/final-validation.json), [independent revalidation](2026-10-27-reviewer-iteration4-review-fixes/reports/revalidation.json) and [historical structural status](2026-10-27-reviewer-iteration4-review-fixes/reports/structural-status.json).
- [Requirements traceability](../../../workflow/TRACEABILITY.md), [User Guide](../../../docs/UserGuide.md) and [Developer Guide](../../../docs/DeveloperGuide.md) remain authoritative for their respective purposes.

## Retained provenance

| Historical run | Original state, including snapshot payloads | Removed duplicate files |
| --- | --- | ---: |
| Iteration 3 preparation | [state.json](2026-10-26-patch-risk-i3/state.json) | 2 |
| Iteration 3 implementation/review/fixes | [state.json](2026-10-26-patch-risk-i3-implementation/state.json) | 145 |
| Iteration 4 preparation | [state.json](2026-10-26-reviewer-iteration4/state.json) | 4 |
| Iteration 4 implementation/integration | [state.json](2026-10-27-reviewer-iteration4-implementation/state.json) | 89 |
| Iteration 4 independent review/fixes | [state.json](2026-10-27-reviewer-iteration4-review-fixes/state.json) | 21 |

In each state file, `snapshots[ID].snapshot` retains the complete manifest; `artifact_sha256` retains the removed file's original hash. Command, completion, handoff and finding references to snapshot IDs still resolve to those records. All original states, briefs, acceptance matrices, handoffs, review reports, recorded results, failure histories, resource records and original usage provenance are retained.

The [snapshot-removal manifest](../2026-10-27-iteration3-4-cleanup/snapshot-retirement.json) maps each removed path to its original size/hash and retained JSON pointer. Before deletion, all 261 file payloads and hashes matched state, and all 261 were reconstructed byte-for-byte with the existing canonical serialization: UTF-8 encoding of `json.dumps(snapshot, sort_keys=True, indent=2, ensure_ascii=True) + "\n"`. Reconstructing a manifest does not reconstruct old application source or make stale evidence current.

## Verification boundary

The existing CLI requires separate snapshot artifacts when verifying freshness. These historical runs are therefore **not directly replayable/verifiable in their compacted worktree form**. Recreating the manifests would restore those file prerequisites, but original source freshness and previously documented workflow gaps would still need separate assessment. The harness has not been relaxed, and old successful reports remain historical observations.

Iteration 3's original five invocation issues and Iteration 4's final 34 cross-run acceptance-evidence gaps remain recorded. This retention change neither closes those gaps nor invalidates the historical independent finding resolutions. Live AI, human approval and deployment limitations remain as documented. Current product acceptance requires current checks against current source.

The [cleanup log](../2026-10-27-iteration3-4-cleanup.md) records the user's requests, the superseded conservative assessment, actual removals, validation and resources. This notice applies only to the five runs listed above.
