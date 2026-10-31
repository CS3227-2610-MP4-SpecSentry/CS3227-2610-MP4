"""Local workflow evidence. Commands execute trusted local tools, without a sandbox."""
import hashlib
import json
import math
import os
from pathlib import Path
import subprocess
import threading
import time
from urllib.parse import quote

import core

OUTPUT_LIMIT = 65536
SECTIONS = (
    ("identity", "1. Identity and goal"),
    ("requirements", "2. Requirements and focused context"),
    ("permissions", "3. Scope, permissions, and dependencies"),
    ("state", "4. Current state and changes"),
    ("verification", "5. Verification and findings"),
    ("risks", "6. Risks, questions, and next action"),
    ("resources", "7. Resource record"),
)


def _json(value):
    return json.dumps(value, sort_keys=True, indent=2, ensure_ascii=True) + "\n"


def _hash(data):
    return hashlib.sha256(data).hexdigest()


def _file_hash(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _git(repo, *argv, digest=False):
    """Never expose git stderr or patch content through exceptions/records."""
    try:
        with subprocess.Popen(
            ["git", "--no-optional-locks", "--literal-pathspecs", *argv], cwd=repo,
            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        ) as proc:
            if digest:
                value = hashlib.sha256()
                for chunk in iter(lambda: proc.stdout.read(65536), b""):
                    value.update(chunk)
                result = value.hexdigest()
            else:
                result = proc.stdout.read().decode("utf-8", "surrogateescape")
            if proc.wait() != 0:
                raise core.Error("Git evidence operation failed")
            return result
    except OSError:
        raise core.Error("Git evidence operation unavailable") from None


def _excluded(run, relative):
    parts = Path(relative).parts
    lower = [part.lower() for part in parts]
    name = lower[-1] if lower else ""
    if any(part in {".git", "logs", "secrets", ".secrets", ".aws", ".ssh",
                   "node_modules", "__pycache__", ".venv", ".next", ".pytest_cache",
                   "playwright-report", "test-results"} for part in lower):
        return True
    if name == ".env" or name.startswith(".env.") or name.endswith((".pem", ".key", ".p12", ".pfx", ".keystore")):
        return True
    if name in {"id_rsa", "id_ed25519", "credentials", "credentials.json", "service-account.json"}:
        return True
    candidate = run.repo / relative
    try:
        candidate.relative_to(run.path)
        return True
    except ValueError:
        return False


def _selected_path(run, value):
    if not isinstance(value, str) or not value or "\x00" in value:
        raise core.Error("Snapshot path must be a repository-relative path")
    path = Path(value)
    if path.is_absolute() or path.drive or ".." in path.parts:
        raise core.Error("Snapshot path must stay inside the repository")
    relative = path.as_posix()
    if _excluded(run, relative):
        raise core.Error("Snapshot path is excluded from evidence")
    # Missing tracked files are legitimate deletion evidence. Validate every
    # existing ancestor through the same redirection checks as regular files.
    candidate = run.repo / path
    ancestor = candidate
    while not ancestor.exists() and not ancestor.is_symlink():
        ancestor = ancestor.parent
    core.contained(run.repo, ancestor)
    return relative


def _snapshot(run, paths, base):
    if not isinstance(base, str) or not base or base.startswith("-") or "\x00" in base:
        raise core.Error("Invalid snapshot base revision")
    paths = sorted(set(_selected_path(run, p) for p in paths))
    if not paths:
        raise core.Error("At least one snapshot path is required")
    head = _git(run.repo, "rev-parse", "--verify", "HEAD^{commit}").strip()
    base_hash = _git(run.repo, "rev-parse", "--verify", "--end-of-options", base + "^{commit}").strip()
    tracked = set(_git(run.repo, "ls-files", "-z", "--", *paths).split("\x00"))
    # Include committed paths removed from the index: ls-files alone loses
    # staged deletions, while both trees preserve their deletion markers.
    for revision in {base_hash, head}:
        tracked.update(_git(run.repo, "ls-tree", "--full-tree", "-r", "--name-only", "-z",
                            revision, "--", *paths).split("\x00"))
    for relative in paths:
        if not (run.repo / relative).exists() and not any(
                entry == relative or entry.startswith(relative + "/") for entry in tracked if entry):
            raise core.Error("Snapshot path does not exist and has no tracked deletion")
    files = {p for p in tracked if p and not _excluded(run, p)}
    for relative in paths:
        start = run.repo / relative
        if start.is_dir():
            for root, directories, names in os.walk(start, followlinks=False):
                kept = []
                for name in directories:
                    child = Path(root) / name
                    rel = child.relative_to(run.repo).as_posix()
                    if not _excluded(run, rel):
                        core.contained(run.repo, child)
                        kept.append(name)
                directories[:] = kept
                for name in names:
                    rel = (Path(root) / name).relative_to(run.repo).as_posix()
                    if not _excluded(run, rel):
                        files.add(rel)
        elif start.exists() or start.is_symlink():
            files.add(relative)
    content = {}
    for relative in sorted(files):
        candidate = run.repo / relative
        if not candidate.exists() and not candidate.is_symlink():
            content[relative] = {"deleted": True}
        else:
            candidate = core.repo_file(run.repo, candidate)
            if not candidate.is_file():
                raise core.Error("Snapshot entries must be regular files")
            content[relative] = {"sha256": _file_hash(candidate), "bytes": candidate.stat().st_size}
    # Only non-secret, selected tracked paths enter git's binary diff stream.
    diff_paths = sorted(p for p in tracked if p and not _excluded(run, p))
    diff_hash = _git(run.repo, "diff", "--no-ext-diff", "--no-textconv", "--binary", base_hash, "--", *diff_paths, digest=True) if diff_paths else _hash(b"")
    return {"paths": paths, "base": base, "head": head, "base_commit": base_hash,
            "diff_sha256": diff_hash, "files": content}


def snapshot_matches(run, snapshot_id):
    """Return false for missing, changed, or no-longer-readable evidence."""
    try:
        record = run.state()["snapshots"].get(snapshot_id)
        if not record:
            return False
        artifact = core.repo_file(run.repo, record["artifact"])
        from validation import View
        digest = run.file_hash(artifact) if isinstance(run, View) else _file_hash(artifact)
        if digest != record["artifact_sha256"]:
            return False
        current = (run.snapshot(record["paths"], record["base"]) if isinstance(run, View)
                   else _snapshot(run, record["paths"], record["base"]))
        return current == record["snapshot"]
    except (core.Error, OSError, KeyError, ValueError):
        return False


def snapshot(args):
    run = core.open_run(args)
    key = core.identifier(args.id)
    with run.edit() as state:
        if key in state["snapshots"]:
            raise core.Error("Snapshot ID already exists")
        value = _snapshot(run, args.path, args.base)
        data = _json(value)
        path = run.artifact("snapshots/" + key + ".json", data)
        state["snapshots"][key] = {"created_at": core.now(), "paths": value["paths"],
            "base": value["base"], "snapshot": value, "artifact": path.relative_to(run.repo).as_posix(),
            "artifact_sha256": _hash(data.encode())}
    print(_json({"snapshot": key, "artifact": path.relative_to(run.repo).as_posix()}), end="")
    return 0


def _execute(repo, argv, timeout, save_output):
    streams = {name: {"digest": hashlib.sha256(), "bytes": 0, "capture": bytearray(), "complete": False}
               for name in ("stdout", "stderr")}
    lock = threading.Lock()

    def drain(name, pipe):
        try:
            for chunk in iter(lambda: pipe.read(8192), b""):
                with lock:
                    item = streams[name]
                    item["digest"].update(chunk)
                    item["bytes"] += len(chunk)
                    if save_output:
                        item["capture"].extend(chunk[:max(0, OUTPUT_LIMIT - len(item["capture"]))])
            with lock:
                streams[name]["complete"] = True
        except OSError:
            pass
        finally:
            pipe.close()

    try:
        proc = subprocess.Popen(argv, cwd=repo, shell=False, stdin=subprocess.DEVNULL,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except (OSError, ValueError):
        return {"exit_code": None, "launch_failed": True, "timed_out": False,
                "incomplete": True, "truncated": False, "streams": {}}, {}
    threads = [threading.Thread(target=drain, args=(name, getattr(proc, name)), daemon=True)
               for name in streams]
    for thread in threads:
        thread.start()
    timed_out = False
    try:
        proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        timed_out = True
        proc.terminate()
        try:
            proc.wait(timeout=1)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
    except BaseException:
        proc.terminate()
        try:
            proc.wait(timeout=1)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.wait()
        raise
    deadline = time.monotonic() + 1
    for thread in threads:
        thread.join(max(0, deadline - time.monotonic()))
    with lock:
        incomplete = any(thread.is_alive() for thread in threads) or not all(item["complete"] for item in streams.values())
        metadata = {name: {"sha256": item["digest"].hexdigest(), "bytes": item["bytes"]}
                    for name, item in streams.items()}
        captures = {name: bytes(item["capture"]) for name, item in streams.items()} if save_output else {}
    return {"exit_code": proc.returncode, "launch_failed": False, "timed_out": timed_out,
            "incomplete": incomplete, "truncated": any(item["bytes"] > OUTPUT_LIMIT for item in metadata.values()),
            "streams": metadata}, captures


def command(args):
    run = core.open_run(args)
    key, snapshot_id = core.identifier(args.id), core.identifier(args.snapshot)
    argv = list(args.argv)
    if argv and argv[0] == "--":
        argv.pop(0)
    if not argv or any(not isinstance(a, str) or "\x00" in a for a in argv) or not argv[0]:
        raise core.Error("Command requires an explicit argument vector")
    if not math.isfinite(args.timeout) or not 0 < args.timeout <= 3600:
        raise core.Error("Command timeout must be greater than zero and at most 3600 seconds")
    with run.edit() as state:
        if key in state["commands"]:
            raise core.Error("Command ID already exists")
        if not snapshot_matches(run, snapshot_id):
            raise core.Error("Command requires a current snapshot")
        started = core.now()
        reservation = {"status": "running", "passed": False, "snapshot_id": snapshot_id,
                       "started_at": started, "exit_code": None}
        state["commands"][key] = reservation
    # Long checks must not hold the run writer lock. A crash leaves visible unfinished evidence.
    result, captures = _execute(run.repo, argv, args.timeout, args.save_output)
    result.update({"status": "finished", "snapshot_id": snapshot_id, "started_at": started, "ended_at": core.now(),
            "executable": Path(argv[0].replace("\\", "/")).name,
            "argv_sha256": _hash(_json(argv).encode()), "timeout_seconds": args.timeout,
            "stale": not snapshot_matches(run, snapshot_id), "output_artifacts": {}})
    with run.edit(wait_seconds=5) as state:
        if state["commands"].get(key) != reservation:
            raise core.Error("Command reservation changed; refusing stale completion")
        for name, data in captures.items():
            # JSON strings preserve arbitrary bytes without emitting terminal controls.
            path = run.artifact("commands/" + key + "-" + name + ".json", _json({"base64": __import__("base64").b64encode(data).decode("ascii")}))
            result["output_artifacts"][name] = path.relative_to(run.repo).as_posix()
        result["passed"] = result["exit_code"] == 0 and not any(result[flag] for flag in ("launch_failed", "timed_out", "incomplete", "truncated", "stale"))
        state["commands"][key] = result
    print(_json({"command": key, "passed": result["passed"], "exit_code": result["exit_code"]}), end="")
    return 0 if result["passed"] else 1


def handoff(args):
    run = core.open_run(args)
    key = core.identifier(args.id)
    source = core.repo_file(run.repo, core.text(args.input))
    value = core.read_json(source)
    if not isinstance(value, dict) or set(value) - ({name for name, _ in SECTIONS} | {"references", "snapshot_id", "resource_record"}):
        raise core.Error("Invalid handoff fields")
    for name, _ in SECTIONS:
        core.text(value.get(name))
    references = value.get("references")
    if not isinstance(references, list) or any(not isinstance(item, str) for item in references):
        raise core.Error("Handoff references must be a list of local files")
    files = [core.repo_file(run.repo, item) for item in references]
    if any(not item.is_file() for item in files):
        raise core.Error("Handoff references must be files")
    snapshot_id = value.get("snapshot_id")
    if snapshot_id is None and not value["state"].strip().lower().startswith("design:"):
        raise core.Error("Code handoffs require a snapshot; design-only state must begin design:")
    if snapshot_id is not None:
        core.identifier(snapshot_id)
        if not snapshot_matches(run, snapshot_id):
            raise core.Error("Handoff snapshot is stale or missing")
    resource = value.get("resource_record")
    if resource is not None:
        core.text(resource)
    with run.edit() as state:
        if key in state["handoffs"]:
            raise core.Error("Handoff ID already exists")
        if resource is not None and resource not in state["records"]:
            raise core.Error("Handoff resource record is missing")
        stored = store_handoff(run, state, key, value, files, snapshot_id, resource)
        stored["input_sha256"] = _file_hash(source)
    print(_json({"handoff": key, "artifact": stored["artifact"]}), end="")
    return 0


def store_handoff(run, state, key, value, files, snapshot_id, resource):
    """Render a derivative from canonical data while the caller owns the state transaction."""
    if key in state["handoffs"]:
        raise core.Error("Handoff ID already exists")
    output = "# Agent handoff\n\n"
    for name, title in SECTIONS:
        output += "## " + title + "\n\n" + core.literal(value[name]) + "\n\n"
        if name == "requirements" and files:
            output += "Referenced repository files:\n\n"
            for path in files:
                rel = path.relative_to(run.repo).as_posix()
                output += "- [" + core.literal(rel) + "](" + quote(path.as_posix(), safe="/:") + ")\n"
            output += "\n"
    path = run.artifact("handoffs/" + key + ".md", output)
    stored = {"artifact": path.relative_to(run.repo).as_posix(), "artifact_sha256": _hash(output.encode()),
        "snapshot_id": snapshot_id, "references": [p.relative_to(run.repo).as_posix() for p in files],
        "resource_record": resource, "created_at": core.now()}
    state["handoffs"][key] = stored
    return stored


def validate_handoff(run, key):
    """Validate persisted evidence without rendering it or inferring permission."""
    core.identifier(key)
    record = run.state()["handoffs"].get(key)
    if not record:
        raise core.Error("Handoff ID does not exist")
    artifact = core.repo_file(run.repo, record["artifact"])
    from validation import View
    digest = run.file_hash(artifact) if isinstance(run, View) else _file_hash(artifact)
    if digest != record["artifact_sha256"]:
        raise core.Error("Handoff artifact changed")
    for reference in record["references"]:
        if not core.repo_file(run.repo, reference).is_file():
            raise core.Error("Handoff reference is no longer a file")
    if record["snapshot_id"] and not snapshot_matches(run, record["snapshot_id"]):
        raise core.Error("Handoff snapshot is stale")
    if record["resource_record"] and record["resource_record"] not in run.state()["records"]:
        raise core.Error("Handoff resource record is missing")
    return record


def handoff_is_valid(run, key):
    try:
        validate_handoff(run, key)
        return True
    except (core.Error, OSError, KeyError, TypeError, ValueError):
        return False


def handoff_validate(args):
    run = core.open_run(args)
    key = core.identifier(args.id)
    validate_handoff(run, key)
    print(_json({"handoff": key, "valid": True}), end="")
    return 0


def supersede(args):
    run = core.open_run(args)
    old, new = core.identifier(args.id), core.identifier(args.by)
    reason = core.text(args.reason)
    if old == new:
        raise core.Error("Evidence cannot supersede itself")
    with run.edit() as state:
        records = state[args.kind]
        if old not in records or new not in records:
            raise core.Error("Both evidence IDs must exist in the same collection")
        if records[old].get("superseded_by"):
            raise core.Error("Evidence already has a successor")
        seen = {old}
        current = new
        while current:
            if current in seen or current not in records:
                raise core.Error("Evidence successor chain is cyclic or missing")
            seen.add(current)
            current = records[current].get("superseded_by")
        successor = records[new]
        if successor.get("superseded_by"):
            raise core.Error("Select the current evidence successor")
        if args.kind == "commands":
            if (not successor.get("passed") or successor.get("exit_code") != 0 or
                    any(successor.get(flag) for flag in ("stale", "incomplete", "timed_out", "truncated", "launch_failed")) or
                    not snapshot_matches(run, successor.get("snapshot_id"))):
                raise core.Error("Successor command must be successful and current")
        else:
            validate_handoff(run, new)
        records[old].update({"superseded_by": new, "superseded_reason": reason,
                             "superseded_at": core.now()})
    print(_json({"kind": args.kind, "id": old, "superseded_by": new}), end="")
    return 0


def register(subparsers):
    parser = subparsers.add_parser("snapshot", help="Hash selected repository state")
    parser.add_argument("--id", required=True)
    parser.add_argument("--base", default="HEAD")
    parser.add_argument("--path", action="append", required=True)
    parser.set_defaults(func=snapshot)
    parser = subparsers.add_parser("command", help="Record bounded evidence from a local argv command")
    parser.add_argument("--id", required=True)
    parser.add_argument("--snapshot", required=True)
    parser.add_argument("--timeout", type=float, default=120)
    parser.add_argument("--save-output", action="store_true")
    parser.add_argument("argv", nargs="...")
    parser.set_defaults(func=command)
    parser = subparsers.add_parser("handoff", help="Render or validate a literal seven-section handoff")
    parser.add_argument("--id")
    parser.add_argument("--input")
    parser.set_defaults(func=handoff)
    actions = parser.add_subparsers(dest="handoff_action")
    validate = actions.add_parser("validate")
    validate.add_argument("--id", required=True)
    validate.set_defaults(func=handoff_validate)
    # Named creation is accepted too, while the short form is handoff --id ... .
    create = actions.add_parser("create")
    create.add_argument("--id", required=True)
    create.add_argument("--input", required=True)
    create.set_defaults(func=handoff)
    parser = subparsers.add_parser("supersede", help="Link historical evidence to a verified current successor")
    parser.add_argument("--kind", choices=("commands", "handoffs"), required=True)
    parser.add_argument("--id", required=True)
    parser.add_argument("--by", required=True)
    parser.add_argument("--reason", required=True)
    parser.set_defaults(func=supersede)
