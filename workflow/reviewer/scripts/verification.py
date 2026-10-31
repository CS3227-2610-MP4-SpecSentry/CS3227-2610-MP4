"""Repeatable trusted checks with declared dependencies and checkout-wide resource leases."""
import argparse
import contextlib
import io
import os
import re
import uuid
from urllib.parse import unquote, urlparse

import core
import evidence
from checks import _contains, _input, _list, _path
from planning import current_check

KINDS = ("preflight", "fixture", "unit", "integration", "browser", "build", "static")


def register_check(args):
    run = core.open_run(args)
    value = _input(run, args.input)
    if set(value) != {"id", "kind", "argv", "paths", "depends_on", "resources", "environment", "database", "timeout"}:
        raise core.Error("Invalid verification check fields")
    key = core.identifier(value["id"])
    if value["kind"] not in KINDS:
        raise core.Error("Unknown verification check kind")
    argv = _list(value["argv"], "argv")
    if not argv or any(not isinstance(a, str) or "\x00" in a for a in argv) or not argv[0]:
        raise core.Error("Check requires a trusted explicit argument vector")
    value["paths"] = [_path(run.repo, p) for p in _list(value["paths"], "paths")]
    if not value["paths"]:
        raise core.Error("Declare source/configuration/fixture paths relevant to the check")
    for field in ("depends_on", "resources"):
        value[field] = list(dict.fromkeys(core.identifier(item) for item in _list(value[field], field)))
    for name in _list(value["environment"], "environment"):
        if not isinstance(name, str) or not re.fullmatch(r"[A-Za-z_][A-Za-z_0-9]*", name):
            raise core.Error("Environment prerequisites contain names only")
    timeout = value["timeout"]
    if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or not 0 < timeout <= 3600:
        raise core.Error("Check timeout must be greater than zero and at most 3600")
    db = value["database"]
    if db is not None:
        if (not isinstance(db, dict) or set(db) != {"environment", "name"}
                or db["environment"] not in value["environment"]
                or not re.fullmatch(r"[A-Za-z0-9_]+_test", core.text(db["name"]))):
            raise core.Error("Database checks require an environment variable and explicit *_test database name")
        value["resources"] = sorted(set(value["resources"]) | {"database"})
    if value["kind"] in ("build", "browser"):
        value["resources"] = sorted(set(value["resources"]) | {"build"})
    with run.edit() as state:
        checks = state.setdefault("verification_checks", {})
        if key in checks:
            raise core.Error("Check IDs are immutable; register a new ID for a revised contract")
        if any(dep not in checks for dep in value["depends_on"]):
            raise core.Error("Check dependencies must already be registered")
        allowed = ("preflight",) if value["kind"] == "preflight" else ("preflight", "fixture")
        if value["kind"] in ("preflight", "fixture") and any(checks[d]["kind"] not in allowed for d in value["depends_on"]):
            raise core.Error("Prerequisites cannot depend on downstream verification checks")
        checks[key] = value
    core.emit({"check": key})


def dependencies(state, key):
    checks = state.get("verification_checks", {})
    row = checks[key]
    implicit = []
    if row["kind"] != "preflight":
        kinds = ("preflight",) if row["kind"] == "fixture" else ("preflight", "fixture")
        implicit = [cid for cid, check in checks.items() if check["kind"] in kinds and cid != key]
    return list(dict.fromkeys(row["depends_on"] + implicit))


def contract_hash(state, key):
    checks = state.get("verification_checks", {})
    contracts = {}

    def visit(cid):
        if cid not in contracts:
            contracts[cid] = checks[cid]
            for dep in dependencies(state, cid):
                visit(dep)

    visit(key)
    return evidence._hash(evidence._json(contracts).encode())


def selected_checks(run, state, selected, changed):
    checks = state.get("verification_checks", {})
    requested = set(selected)
    paths = [_path(run.repo, path) for path in changed]
    scope_cache = {}

    def scopes(key):
        if key not in scope_cache:
            row = checks[key]
            scope_cache[key] = row["paths"] + [path for dep in dependencies(state, key) for path in scopes(dep)]
        return scope_cache[key]

    if paths:
        requested.update(key for key in checks if any(
            _contains(root, path) or _contains(path, root) for root in scopes(key) for path in paths))
    if not requested or requested - checks.keys():
        raise core.Error("No registered checks selected; declare check scopes or name explicit checks")
    requested.update(key for key, row in checks.items() if row["kind"] in ("preflight", "fixture"))
    ordered = []

    def visit(key):
        if key not in ordered:
            for dep in dependencies(state, key):
                visit(dep)
            ordered.append(key)

    for key in checks:
        if key in requested:
            visit(key)
    return ordered, {key: sorted(set(scopes(key))) for key in ordered}


def environment_ready(row):
    for name in row["environment"]:
        if not os.environ.get(name):
            raise core.Error(f"Missing required environment variable: {name}")
    db = row["database"]
    if db:
        try:
            url = urlparse(os.environ[db["environment"]])
            if url.scheme not in ("postgres", "postgresql") or not url.hostname or unquote(url.path) != "/" + db["name"]:
                raise ValueError()
        except ValueError:
            raise core.Error("Database URL does not match the explicitly declared disposable test database") from None


@contextlib.contextmanager
def leases(run, row):
    """One checkout-wide build/database writer across runs, without holding a run lock."""
    root = core.contained(run.repo, "logs/.reviewer-verification-locks")
    root.mkdir(parents=True, exist_ok=True)
    acquired = []
    try:
        for resource in sorted(row["resources"]):
            path = core.contained(root, core.identifier(resource) + ".lock")
            try:
                fd = os.open(path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
            except FileExistsError:
                raise core.Error(f"Verification resource busy: {resource}; retry after its owner finishes") from None
            acquired.append(path)
            with os.fdopen(fd, "w", encoding="utf-8") as stream:
                stream.write(evidence._json({"run": run.path.relative_to(run.repo).as_posix(),
                    "check": row["id"], "pid": os.getpid(), "started_at": core.now()}))
        yield
    finally:
        for path in reversed(acquired):
            core.contained(root, path).unlink(missing_ok=True)


def verify(args):
    run = core.open_run(args)
    state = run.state()
    ordered, scopes = selected_checks(run, state, args.check or [], args.changed or [])
    contracts = {key: contract_hash(state, key) for key in ordered}
    if args.select_only:
        core.emit({"selected": ordered, "source_scopes": scopes})
        return 0
    if (any(state["verification_checks"][key]["database"] is not None for key in ordered)
            and not any(state["verification_checks"][key]["kind"] == "fixture" for key in ordered)):
        raise core.Error("Database verification requires a registered executable fixture validation check")
    outcomes = []
    for key in ordered:
        state = run.state()
        if contracts[key] != contract_hash(state, key):
            raise core.Error("Verification prerequisites changed during execution; repeat selection before continuing")
        row = state["verification_checks"][key]
        # Validate environment even when source evidence can be reused.
        environment_ready(row)
        if not args.force and current_check(run, state, key):
            outcomes.append({"check": key, "reused": True, "passed": True})
            continue
        with leases(run, row):
            token = "verify-" + uuid.uuid4().hex[:16]
            with contextlib.redirect_stdout(io.StringIO()):
                evidence.snapshot(argparse.Namespace(repo=run.repo, run=run.path, id=token, path=scopes[key], base="HEAD"))
            with run.edit() as data:
                data.setdefault("verification_runs", {})[token] = {"check": key, "created_at": core.now(),
                    "contract_sha256": contracts[key]}
            with contextlib.redirect_stdout(io.StringIO()):
                result = evidence.command(argparse.Namespace(repo=run.repo, run=run.path, id=token,
                    snapshot=token, argv=row["argv"], timeout=row["timeout"], save_output=False))
            outcomes.append({"check": key, "command": token, "reused": False, "passed": result == 0})
            if result:
                core.emit({"ok": False, "checks": outcomes})
                return 1
    core.emit({"ok": True, "checks": outcomes})
    return 0


def register(subparsers):
    parser = subparsers.add_parser("check-register", help="register one immutable trusted check contract")
    parser.add_argument("--input", required=True)
    parser.set_defaults(func=register_check)
    parser = subparsers.add_parser("verify", help="run/reuse checks in dependency order with shared resource leases")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--check", action="append")
    group.add_argument("--changed", action="append", help="explicit changed source/dependency path")
    parser.add_argument("--select-only", action="store_true")
    parser.add_argument("--force", action="store_true", help="rerun even when recorded source evidence is current")
    parser.set_defaults(func=verify)
