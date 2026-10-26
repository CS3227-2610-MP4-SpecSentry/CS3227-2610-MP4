"""Record completion once; derive handoff and final report from canonical state."""
import contextlib
import io

import core
import evidence
import recording
from checks import _contains, _input, _list, _path, check_run
from planning import completion_current, readiness_errors


def complete(args):
    run = core.open_run(args)
    key = core.identifier(args.id)
    value = _input(run, args.input)
    if set(value) != {"assignment", "record_id", "snapshot_id", "commands", "changed_paths",
                      "summary", "risks", "next_action", "references", "unavailable_reason"}:
        raise core.Error("Invalid completion fields")
    for field in ("summary", "risks", "next_action", "unavailable_reason"):
        value[field] = core.text(value[field])
    for field in ("assignment", "record_id", "snapshot_id"):
        core.identifier(value[field])
    paths = [_path(run.repo, path) for path in _list(value["changed_paths"], "changed_paths")]
    files = [core.repo_file(run.repo, path) for path in _list(value["references"], "references")]
    commands = [core.identifier(cid) for cid in _list(value["commands"], "commands")]
    if not commands or len(set(commands)) != len(commands):
        raise core.Error("Completion requires distinct verification command IDs")
    with run.edit() as state:
        completions = state.setdefault("completions", {})
        if key in completions or any(c["record_id"] == value["record_id"] for c in completions.values()):
            raise core.Error("Completion ID or resource record already completed")
        owner = state["assignments"].get(value["assignment"])
        record = state["records"].get(value["record_id"])
        if (not owner or not record or record["agent"] != owner["agent"]
                or record["stage"] not in ("implement", "fix")
                or (record.get("assignment") and record["assignment"] != value["assignment"])):
            raise core.Error("Completion must match the assignment's implementation/fix resource record")
        if not evidence.snapshot_matches(run, value["snapshot_id"]):
            raise core.Error("Completion requires a current snapshot")
        snapshot = state["snapshots"][value["snapshot_id"]]["snapshot"]
        if any(not any(_contains(root, path) for root in owner["paths"]) or path not in snapshot["files"] for path in paths):
            raise core.Error("Changed paths must be owned and covered by the completion snapshot")
        errors = readiness_errors(run, state, value["assignment"]) if state.get("workflow_version", 2) >= 3 else []
        if errors:
            raise core.Error("Completion prerequisites: " + "; ".join(errors))
        for cid in commands:
            command = state["commands"].get(cid, {})
            if (command.get("passed") is not True or command.get("superseded_by")
                    or not evidence.snapshot_matches(run, command.get("snapshot_id"))):
                raise core.Error("Completion requires current passing, non-superseded commands")
        checked_files = {path for cid in commands
                         for path in state["snapshots"][state["commands"][cid]["snapshot_id"]]["snapshot"]["files"]}
        if any(path not in checked_files for path in paths):
            raise core.Error("Completion commands must cover every declared changed path")
        recording.finish_record(state, value["record_id"], "succeeded", value["summary"], value["unavailable_reason"])
        completions[key] = {**value, "changed_paths": paths, "created_at": core.now()}
        sections = {
            "identity": f"{owner['agent']} completed {value['assignment']}: {value['summary']}",
            "requirements": ", ".join(state["requirements"]),
            "permissions": f"Owned paths: {owner['paths']}; dependencies: {owner['dependencies']}",
            "state": f"{value['summary']}; changed paths: {paths}; snapshot: {value['snapshot_id']}",
            "verification": f"Current passing commands: {commands}; consult canonical findings in state.json",
            "risks": f"{value['risks']}; next action: {value['next_action']}",
            "resources": f"Canonical resource record: {value['record_id']}; unavailable telemetry: {value['unavailable_reason']}",
        }
        stored = evidence.store_handoff(run, state, key, sections, files, value["snapshot_id"], value["record_id"])
        stored["completion_id"] = key
    core.emit({"completion": key, "handoff": stored["artifact"], "record_id": value["record_id"]})


def report(args):
    run = core.open_run(args)
    state = run.state()
    consistency = check_run(run)
    rows = ["# Reviewer run report", "", "Canonical source: state.json; this report is a derived view.", "",
            f"Run: {core.literal(state['run_id'])}; consistent: {consistency['ok']}.", "",
            "## Assignments and completion", "",
            "| Assignment | Agent | Latest completion | Current |", "| --- | --- | --- | --- |"]
    for aid, assignment in state["assignments"].items():
        completed = [(key, row) for key, row in state.get("completions", {}).items() if row["assignment"] == aid]
        key, row = completed[-1] if completed else ("unavailable", None)
        rows.append("| " + " | ".join(core.literal(v) for v in (aid, assignment["agent"], key,
                    bool(row and completion_current(run, state, row)))) + " |")
    rows += ["", "## Acceptance evidence", "", "| Case | Requirement | Kind | Owner | Check |",
             "| --- | --- | --- | --- | --- |"]
    plans = state.get("acceptance_matrices", [])
    for case in plans[-1]["cases"] if plans else []:
        rows.append("| " + " | ".join(core.literal(case[k]) for k in ("id", "requirement", "kind", "owner", "check")) + " |")
    rows += ["", "## Findings", ""]
    for fid, finding in state["findings"].items():
        rows.append(f"- {core.literal(fid)}: {core.literal(finding['status'])}; owner {core.literal(finding['owner'])}")
    if not state["findings"]:
        rows.append("No findings recorded; this does not certify review coverage.")
    rows += ["", "## Evidence and limitations", ""]
    for kind in ("commands", "handoffs"):
        for key, item in state[kind].items():
            rows.append(f"- {kind}: {core.literal(key)}; snapshot {core.literal(item.get('snapshot_id'))}; "
                        f"superseded by {core.literal(item.get('superseded_by'))}")
    rows += ["", *("- " + core.literal(error) for error in consistency["errors"]), "",
             "## Telemetry limitations", ""]
    reasons = {}
    for rid, record in state["records"].items():
        for field, reason in record.get("unavailable_reasons", {}).items():
            reasons.setdefault(reason, {}).setdefault(rid, []).append(field)
    for reason, affected in reasons.items():
        refs = "; ".join(f"{rid}: {', '.join(fields)}" for rid, fields in affected.items())
        rows.append("- " + core.literal(reason) + "; " + core.literal(refs))
    with contextlib.redirect_stdout(io.StringIO()) as capture:
        recording.summarize(type("Args", (), {"repo": run.repo, "run": run.path, "markdown": True})())
    print("\n".join(rows) + capture.getvalue())
    return int(not consistency["ok"])


def register(subparsers):
    parser = subparsers.add_parser("complete", help="finish a resource record and derive its completion handoff once")
    parser.add_argument("--id", required=True)
    parser.add_argument("--input", required=True)
    parser.set_defaults(func=complete)
    parser = subparsers.add_parser("report", help="derive one report from canonical records, findings and evidence")
    parser.set_defaults(func=report)
