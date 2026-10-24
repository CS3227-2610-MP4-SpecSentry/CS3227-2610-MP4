# Prepare a Reviewer implementation brief

Use only for Reviewer functionality covered by [workflow scope](../IMPLEMENTATION.md#scope). The [workflow context](../README.md) defines execution authority. This procedure prepares a brief; invoking it alone does not dispatch workers or start implementation.

## Procedure

1. Identify the task's existing requirement IDs and exact source sections in the product spec and any current supporting specifications. Include relevant shared requirements. Separate unrelated functionality and exclusions.
2. Inspect the current architecture, interfaces, tests, decisions, and relevant prior failures. Record the base revision and current worktree state; distinguish existing components from proposed ones. Preserve unrelated work.
3. Compile acceptance criteria and boundary, failure, authorization, concurrency, and AI-unavailable behavior needed for the task. Trace each criterion to a source; label gaps rather than invent requirements.
4. Identify components to add/modify and coordination contracts: signatures or schemas, errors, ownership/assignment, state/version rules, transactions, dependencies, trust boundaries, and required checks where applicable.
5. Resolve questions from authoritative sources. For a material remaining ambiguity, give the main agent a question, recommendation, implications, and alternatives to clarify with the prompter. Keep independent work separable from the blocked portion.

## Output

Write or update the implementation-brief section of the run log at `logs/<name>/<log_name.md>`, or the coordinator's explicitly assigned brief artifact. Use [run fields](../templates/RUN.md#run-and-implementation-brief). Include goal, requirement/source state, criteria/exclusions, architecture changes, contracts, security considerations, open questions, context pointers, and verification expectations. Link sources instead of copying broad documents. Mark proposed choices and unresolved decisions explicitly.

**Completion:** all requested behavior has a source or an explicit gap; affected components and contracts are identified; no implementation-dependent ambiguity is silently assumed. A blocked brief is a valid output and cannot be represented as ready for dispatch. Return a concise summary with the artifact location.
