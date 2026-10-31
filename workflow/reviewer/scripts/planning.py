"""Executable acceptance plans and readiness checks; semantic review remains human/agent work."""
import core
from checks import _input, _list
from evidence import snapshot_matches

KINDS = ("normal", "authorization", "boundary", "lifecycle", "concurrency", "rollback")


def matrix(args):
    run = core.open_run(args)
    value = _input(run, args.input)
    with run.edit() as state:
        if set(value) != {"cases", "not_applicable"}:
            raise core.Error("Matrix requires cases and not_applicable")
        cases = _list(value["cases"], "cases")
        exceptions = value["not_applicable"]
        if not isinstance(exceptions, dict) or set(exceptions) - set(KINDS[1:]):
            raise core.Error("Only non-normal risk kinds can be marked not applicable")
        for reason in exceptions.values():
            core.text(reason)
        ids = set()
        for case in cases:
            if not isinstance(case, dict) or set(case) != {
                "id", "requirement", "kind", "owner", "check", "scenario", "preconditions", "expected", "events"
            }:
                raise core.Error("Invalid acceptance case fields")
            cid = core.identifier(case["id"])
            for field in ("requirement", "owner", "check"):
                core.identifier(case[field])
            if cid in ids:
                raise core.Error("Duplicate acceptance case ID")
            ids.add(cid)
            if case["requirement"] not in state["requirements"] or case["kind"] not in KINDS:
                raise core.Error("Case must use a run requirement and known risk kind")
            if case["owner"] not in state["assignments"] or case["check"] not in state.get("verification_checks", {}):
                raise core.Error("Case requires a registered assignment and executable check")
            for field in ("scenario", "preconditions", "expected"):
                core.text(case[field])
            events = _list(case["events"], "events")
            for event in events:
                core.text(event)
            if case["kind"] == "concurrency" and len(events) < 2:
                raise core.Error("Concurrency cases require at least two explicit competing events")
        for requirement in state["requirements"]:
            if not any(c["requirement"] == requirement and c["kind"] == "normal" for c in cases):
                raise core.Error("Every run requirement needs a normal acceptance case")
        for kind in KINDS[1:]:
            present = any(c["kind"] == kind for c in cases)
            if present == (kind in exceptions):
                raise core.Error("Each risk kind needs cases or one explicit not-applicable reason, exclusively")
        previous = state.get("acceptance_matrices", [])
        reason = core.text(args.reason) if previous else "Initial plan"
        previous.append({**value, "reason": reason, "created_at": core.now()})
        state["acceptance_matrices"] = previous
    core.emit({"matrix_version": len(previous), "cases": len(cases)})


def current_check(run, state, check_id):
    """Only terminal, passing evidence for the currently registered check counts."""
    from validation import View
    if isinstance(run, View) and state is run.data:
        if check_id not in run.checks:
            run.checks[check_id] = _current_check(run, state, check_id)
        return run.checks[check_id]
    return _current_check(run, state, check_id)


def _current_check(run, state, check_id):
    executions = state.get("verification_runs", {})
    candidates = [(key, value) for key, value in executions.items() if value["check"] == check_id]
    if not candidates:
        return False
    key, _ = candidates[-1]
    from verification import contract_hash
    if candidates[-1][1].get("contract_sha256") != contract_hash(state, check_id):
        return False
    command = state["commands"].get(key, {})
    return (command.get("passed") is True and not command.get("superseded_by")
            and snapshot_matches(run, command.get("snapshot_id")))


def readiness_errors(run, state, assignment=None, closing=False):
    errors = []
    plans = state.get("acceptance_matrices", [])
    if not plans:
        errors.append("acceptance matrix is missing")
    checks = state.get("verification_checks", {})
    prerequisites = [key for key, row in checks.items() if row["kind"] in ("preflight", "fixture")]
    if not prerequisites:
        errors.append("register and run at least one environment/fixture preflight check")
    if not any(row["kind"] == "preflight" for row in checks.values()):
        errors.append("environment preflight check is missing")
    if (any(row["database"] is not None for row in checks.values())
            and not any(row["kind"] == "fixture" for row in checks.values())):
        errors.append("database verification requires an executable fixture validation check")
    for key in prerequisites:
        if not current_check(run, state, key):
            errors.append(f"prerequisite {key}: no current passing verification")
    if assignment is not None:
        owner = state["assignments"].get(assignment)
        if not owner:
            errors.append("unknown dispatch assignment")
        else:
            for dep in owner["dependencies"]:
                completions = [row for row in state.get("completions", {}).values() if row["assignment"] == dep]
                if not completions or not completion_current(run, state, completions[-1]):
                    errors.append(f"dependency {dep}: no current successful completion")
    if closing and plans:
        for case in plans[-1]["cases"]:
            if not current_check(run, state, case["check"]):
                errors.append(f"case {case['id']}: executable check has no current passing evidence")
        for aid, assignment_row in state["assignments"].items():
            if assignment_row["role"] == "implementer":
                rows = [row for row in state.get("completions", {}).values() if row["assignment"] == aid]
                if not rows or not completion_current(run, state, rows[-1]):
                    errors.append(f"assignment {aid}: no current successful completion")
    return errors


def completion_current(run, state, row):
    record = state["records"].get(row["record_id"], {})
    newer_attempt = any(rid != row["record_id"] and other.get("assignment") == row["assignment"]
                        and other.get("stage") in ("implement", "fix")
                        and other.get("start", "") >= record.get("start", "")
                        for rid, other in state["records"].items())
    return (record.get("status") == "succeeded" and not newer_attempt
            and snapshot_matches(run, row["snapshot_id"])
            and all(state["commands"].get(key, {}).get("passed") is True
                    and not state["commands"][key].get("superseded_by")
                    and snapshot_matches(run, state["commands"][key]["snapshot_id"])
                    and (key not in state.get("verification_runs", {})
                         or current_check(run, state, state["verification_runs"][key]["check"]))
                    for key in row["commands"]))


def readiness(args):
    run = core.open_run(args)
    from validation import operation
    with operation(run) as view:
        errors = readiness_errors(view, view.state(), args.assignment)
    core.emit({"ok": not errors, "errors": errors,
               "scope": "Declared coverage and prerequisites; scenario quality still requires independent review."})
    return int(bool(errors))


def register(subparsers):
    parser = subparsers.add_parser("matrix", help="compile named acceptance/race cases before dispatch")
    parser.add_argument("--input", required=True)
    parser.add_argument("--reason", help="required for append-only plan revisions")
    parser.set_defaults(func=matrix)
    parser = subparsers.add_parser("readiness", help="check plan, preflight and assignment prerequisites")
    parser.add_argument("--assignment")
    parser.set_defaults(func=readiness)
