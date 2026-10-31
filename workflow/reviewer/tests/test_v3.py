"""Version 3 dispatch, completion and verification contracts in disposable Git checkouts."""
import contextlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import core
import evidence
import verification
import workflow
import checks
import planning


class WorkflowV3Tests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name).resolve()
        for path, content in {"src/code.txt": "source", "shared/api.txt": "contract", "other/code.txt": "other",
                              "workflow/specs/ROLE-REVIEWER.md": "REQ-REV-001 REQ-REV-008"}.items():
            target = self.repo / path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
        for args in (("init", "--quiet"), ("config", "user.name", "Workflow fixture"),
                     ("config", "user.email", "fixture@example.invalid"), ("add", "."),
                     ("commit", "--quiet", "-m", "fixture")):
            subprocess.run(["git", *args], cwd=self.repo, capture_output=True, check=True)
        initialized = self.cli("init", "--scope", "reviewer", "--prompter", "tester", "--run-id", "v3",
                               "--requirement", "REQ-REV-008", use_run=False)
        self.run = core.Run(self.repo, initialized["run"])

    def cli(self, *args, code=0, use_run=True, raw=False):
        prefix = ["--repo", str(self.repo)]
        if use_run:
            prefix += ["--run", str(self.run.path)]
        with contextlib.redirect_stdout(io.StringIO()) as out, contextlib.redirect_stderr(io.StringIO()) as err:
            result = workflow.main(prefix + list(args))
        self.assertEqual(result, code, err.getvalue() + out.getvalue())
        return out.getvalue() if raw else json.loads(out.getvalue()) if out.getvalue() else err.getvalue()

    def payload(self, name, value):
        path = self.repo / (name + ".json")
        path.write_text(json.dumps(value), encoding="utf-8")
        return str(path)

    def owner(self, key="feature", agent="worker", paths=None, dependencies=None):
        self.cli("assignment", "--input", self.payload(key, {"id": key, "agent": agent, "role": "implementer",
            "paths": paths or ["src"], "dependencies": dependencies or []}))

    def check(self, key="tests", kind="unit", paths=None, depends=None, resources=None, database=None, code="print('ok')"):
        value = {"id": key, "kind": kind, "argv": [sys.executable, "-B", "-c", code],
                 "paths": paths or ["src"], "depends_on": depends or [], "resources": resources or [],
                 "environment": [database["environment"]] if database else [], "database": database, "timeout": 20}
        self.cli("check-register", "--input", self.payload(key, value))
        return value

    def plan(self):
        return {"cases": [{"id": "case-" + kind, "requirement": "REQ-REV-008", "kind": kind, "owner": "feature",
                           "check": "tests", "scenario": "Fixture " + kind, "preconditions": "Fixture revision 1 is open",
                           "expected": "Fixture assertions pass; failing assertions fail the gate",
                           "events": ["open old revision", "receive newer notice"] if kind == "concurrency" else []}
                          for kind in ("normal", "authorization", "boundary", "lifecycle", "concurrency", "rollback")],
                "not_applicable": {}}

    def ready(self):
        self.owner()
        self.check("environment", "preflight", ["shared"])
        self.check()
        self.cli("matrix", "--input", self.payload("matrix", self.plan()))
        self.cli("verify", "--check", "tests")

    def test_report_bundle_shares_one_validation_with_markdown(self):
        self.ready()
        record = self.start()["record_id"]
        self.complete(record)
        with patch.object(evidence, "_snapshot", wraps=evidence._snapshot) as rebuilt, \
                patch.object(planning, "_current_check", wraps=planning._current_check) as checked:
            bundle = self.cli("report", "--format", "bundle", code=1)
        self.assertIn("# Reviewer run report", bundle["markdown"])
        self.assertIn("consistent: False", bundle["markdown"])
        self.assertFalse(bundle["consistency"]["ok"])
        # environment(shared), tests(src+shared), completion(src), twice each
        self.assertEqual(rebuilt.call_count, 6)
        self.assertEqual(checked.call_count, 2)  # Six matrix cases share one test check.
        self.assertEqual(bundle["consistency"], checks.check_run(self.run))

    def test_completion_refresh_preserves_interval_and_rejects_changed_content(self):
        self.ready()
        record = self.start()["record_id"]
        self.complete(record)
        before = self.run.state()["records"]
        # Force represents an external reset; refresh points at replacement checks.
        result = self.cli("verify", "--check", "tests", "--force")
        commands = [row["command"] for row in result["checks"]]
        old_commands = self.run.state()["completions"]["finished"]["commands"]
        state = self.run.state()
        for old in old_commands:
            check_id = state["verification_runs"][old]["check"]
            new = next(cid for cid in commands if state["verification_runs"][cid]["check"] == check_id)
            self.cli("supersede", "--kind", "commands", "--id", old, "--by", new, "--reason", "External reset")
        argv = ["completion-refresh", "--id", "refreshed", "--from", "finished", "--snapshot", "finished",
                "--reason", "Rechecked external state"]
        for cid in commands:
            argv += ["--command", cid]
        self.cli(*argv)
        state = self.run.state()
        self.assertEqual(before, state["records"])
        self.assertEqual(state["completions"]["refreshed"]["record_id"], record)
        self.assertTrue(self.cli(*argv)["unchanged"])
        self.assertEqual(state, self.run.state())
        (self.repo / "src/code.txt").write_text("changed implementation", encoding="utf-8")
        self.cli("snapshot", "--id", "changed", "--path", "src")
        argv[2], argv[6] = "changed-refresh", "changed"
        self.assertIn("identical current selected content", self.cli(*argv, code=2))
        self.assertNotIn("changed-refresh", self.run.state()["completions"])

    def test_completion_refresh_cannot_bypass_newer_attempt_or_missing_coverage(self):
        self.ready()
        record = self.start()["record_id"]
        self.complete(record)
        state = self.run.state()
        env = next(cid for cid, row in state["verification_runs"].items() if row["check"] == "environment")
        argv = ["completion-refresh", "--id", "refresh", "--from", "finished", "--snapshot", "finished",
                "--reason", "Rechecked", "--command", env]
        self.assertIn("cover every declared changed path", self.cli(*argv, code=2))
        self.start(stage="fix")
        test = next(cid for cid, row in state["verification_runs"].items() if row["check"] == "tests")
        argv += ["--command", test]
        self.assertIn("no newer implementation/fix attempt", self.cli(*argv, code=2))
        self.assertNotIn("refresh", self.run.state()["completions"])

    def start(self, stage="implement", agent="worker", attempt=1, code=0):
        args = ["start", "--agent", agent, "--invocation", "one", "--stage", stage,
                "--attempt", str(attempt), "--model", "fixture-model", "--effort", "low"]
        if stage in ("implement", "fix"):
            args += ["--assignment", "feature"]
        return self.cli(*args, code=code)

    def complete(self, record, key="finished", code=0, **changes):
        self.cli("snapshot", "--id", key, "--path", "src")
        command_ids = [key for key, row in self.run.state()["commands"].items() if row.get("passed")]
        value = {"assignment": "feature", "record_id": record, "snapshot_id": key, "commands": command_ids,
                 "changed_paths": ["src/code.txt"], "summary": "Fixture implementation complete", "risks": "Synthetic checks only",
                 "next_action": "Independent review", "references": ["src/code.txt"], "unavailable_reason": "Fixture has no usage telemetry"}
        value.update(changes)
        return self.cli("complete", "--id", key, "--input", self.payload(key, value), code=code)

    def test_v3_default_accepts_current_spec_ids_and_blocks_unplanned_dispatch(self):
        self.assertEqual(self.run.state()["workflow_version"], 3)
        self.owner()
        result = self.cli("readiness", code=1)
        self.assertIn("acceptance matrix is missing", result["errors"])
        self.start(code=2)
        self.assertFalse(self.run.state()["records"])
        self.cli("init", "--scope", "reviewer", "--prompter", "tester", "--run-id", "invalid",
                 "--requirement", "REQ-REV-999", code=2, use_run=False)

    def test_matrix_rejects_missing_risks_unknown_owners_and_unnamed_races(self):
        self.owner()
        self.check()
        for change in ("missing-risk", "unknown-owner", "unnamed-race", "duplicate"):
            value = self.plan()
            if change == "missing-risk":
                value["cases"].pop()
            elif change == "unknown-owner":
                value["cases"][0]["owner"] = "missing"
            elif change == "unnamed-race":
                value["cases"][4]["events"] = ["one event"]
            else:
                value["cases"].append(value["cases"][0])
            self.cli("matrix", "--input", self.payload("bad-plan", value), code=2)
        value = self.plan()
        value["cases"].pop()
        value["not_applicable"] = {"rollback": "Read-only fixture task has no transactional mutation"}
        self.cli("matrix", "--input", self.payload("plan", value))
        self.cli("matrix", "--input", self.payload("plan", value), code=2)
        self.cli("matrix", "--input", self.payload("plan", value), "--reason", "Refined scenario")
        self.assertEqual(len(self.run.state()["acceptance_matrices"]), 2)

    def test_dependency_selection_and_scoped_reuse(self):
        self.check("environment", "preflight", ["workflow/specs"])
        self.check("contract", "static", ["shared"])
        self.check("feature", paths=["src"], depends=["contract"])
        self.check("unrelated", paths=["other"])
        result = self.cli("verify", "--changed", "shared/api.txt", "--select-only")
        self.assertEqual(result["selected"], ["environment", "contract", "feature"])
        self.cli("verify", "--check", "feature")
        reused = self.cli("verify", "--check", "feature")
        self.assertTrue(all(row["reused"] for row in reused["checks"]))
        (self.repo / "other/code.txt").write_text("unrelated change", encoding="utf-8")
        self.assertTrue(all(row["reused"] for row in self.cli("verify", "--check", "feature")["checks"]))
        (self.repo / "shared/api.txt").write_text("new contract", encoding="utf-8")
        result = self.cli("verify", "--check", "feature")
        self.assertEqual([row["reused"] for row in result["checks"]], [True, False, False])

    def test_failed_prerequisite_stops_dependent_execution(self):
        self.check("environment", "preflight", ["shared"], code="raise SystemExit(1)")
        self.check()
        result = self.cli("verify", "--check", "tests", code=1)
        self.assertEqual([row["check"] for row in result["checks"]], ["environment"])
        self.assertFalse(any(row["check"] == "tests" for row in self.run.state()["verification_runs"].values()))

    def test_new_fixture_contract_and_changed_fixture_invalidate_downstream_evidence(self):
        self.check("environment", "preflight", ["workflow/specs"])
        self.check()
        self.cli("verify", "--check", "tests")
        self.check("fixture", "fixture", ["shared"])
        result = self.cli("verify", "--check", "tests")
        self.assertEqual([row["check"] for row in result["checks"]], ["environment", "fixture", "tests"])
        self.assertFalse(result["checks"][-1]["reused"])
        (self.repo / "shared/api.txt").write_text("changed fixture contract", encoding="utf-8")
        result = self.cli("verify", "--check", "tests")
        self.assertEqual([row["reused"] for row in result["checks"]], [True, False, False])

    def test_interrupted_command_remains_visible_and_cannot_reuse_id(self):
        self.cli("snapshot", "--id", "source", "--path", "src")
        with patch.object(evidence, "_execute", side_effect=KeyboardInterrupt), self.assertRaises(KeyboardInterrupt):
            self.cli("command", "--id", "abandoned", "--snapshot", "source", "--", sys.executable, "-B", "-c", "pass")
        self.assertEqual(self.run.state()["commands"]["abandoned"]["status"], "running")
        self.assertFalse(self.run.state()["commands"]["abandoned"]["passed"])
        self.cli("command", "--id", "abandoned", "--snapshot", "source", "--", sys.executable, "-B", "-c", "pass", code=2)
        self.assertFalse(self.cli("completeness", code=1)["ok"])

    def test_database_target_and_required_fixture_are_checked_without_exposing_url(self):
        self.check("environment", "preflight", ["shared"])
        db = {"environment": "WORKFLOW_FIXTURE_DB", "name": "workflow_test"}
        self.check("database", "integration", database=db)
        self.assertTrue(any("fixture" in error for error in self.cli("readiness", code=1)["errors"]))
        self.assertIn("fixture", self.cli("verify", "--check", "database", code=2))
        self.assertFalse(self.run.state().get("verification_runs"))
        self.check("fixtures", "fixture", ["shared"])
        secret = "postgresql://user:secret@localhost/production"
        with patch.dict(os.environ, {"WORKFLOW_FIXTURE_DB": secret}):
            output = self.cli("verify", "--check", "database", code=2)
        self.assertNotIn(secret, output)
        self.assertNotIn("secret", output)
        self.assertIn("Database URL", output)
        with patch.dict(os.environ, {"WORKFLOW_FIXTURE_DB": "postgresql://fixture@localhost/workflow_test"}):
            self.assertTrue(self.cli("verify", "--check", "database")["ok"])
        value = self.run.state()["verification_checks"]["database"]
        self.assertIn("database", value["resources"])

    def test_resource_leases_conflict_across_runs_and_release_on_failure(self):
        self.check("build", "build", ["src"])
        row = self.run.state()["verification_checks"]["build"]
        other = core.create_run(self.repo, "tester", "second", ["REQ-REV-008"])
        with verification.leases(other, row):
            self.cli("verify", "--check", "build", code=2)
        self.cli("verify", "--check", "build")
        self.assertFalse(list((self.repo / "logs/.reviewer-verification-locks").glob("*.lock")))
        with self.assertRaises(RuntimeError):
            with verification.leases(other, row):
                raise RuntimeError("fixture cancellation")
        self.assertFalse(list((self.repo / "logs/.reviewer-verification-locks").glob("*.lock")))

    def test_command_execution_does_not_block_another_recorder(self):
        self.cli("snapshot", "--id", "source", "--path", "src")
        child = [sys.executable, "-B", str(Path(workflow.__file__).resolve()), "--repo", str(self.repo),
                 "--run", str(self.run.path), "expect", "--agent", "parallel", "--invocation", "one", "--stage", "review"]
        code = f"import subprocess; raise SystemExit(subprocess.run({child!r}, capture_output=True).returncode)"
        self.cli("command", "--id", "parallel-check", "--snapshot", "source", "--", sys.executable, "-B", "-c", code)
        self.assertIn("parallel|one|review|1", self.run.state()["expected"])
        self.assertTrue(self.run.state()["commands"]["parallel-check"]["passed"])

    def test_completion_is_atomic_owned_and_derives_handoff_and_report(self):
        self.ready()
        record = self.start()["record_id"]
        self.complete(record, key="bad", changed_paths=["shared/api.txt"], code=2)
        self.assertEqual(self.run.state()["records"][record]["status"], "running")
        self.assertFalse(self.run.state().get("completions"))
        self.complete(record)
        self.assertEqual(self.run.state()["records"][record]["status"], "succeeded")
        self.cli("handoff", "validate", "--id", "finished")
        self.complete(record, key="duplicate", code=2)
        report = self.cli("report", code=1, raw=True)
        self.assertIn("finished", report)
        self.assertIn(core.literal("case-concurrency"), report)
        self.assertIn("unavailable", report)
        for stage in ("compile", "security", "dispatch", "integrate", "review", "close"):
            agent = "verifier" if stage in ("security", "review") else "main"
            result = self.start(stage=stage, agent=agent)
            self.cli("finish", "--id", result["record_id"], "--status", "succeeded", "--outcome", "Fixture stage",
                     "--unavailable-reason", "No fixture telemetry")
        self.assertTrue(self.cli("completeness")["ok"])
        self.cli("report", raw=True)
        (self.repo / "src/code.txt").write_text("changed", encoding="utf-8")
        self.assertFalse(self.cli("completeness", code=1)["ok"])

    def test_dependency_dispatch_waits_for_current_completion(self):
        self.ready()
        self.owner("dependent", "second-worker", ["other"], ["feature"])
        self.assertFalse(self.cli("readiness", "--assignment", "dependent", code=1)["ok"])
        self.complete(self.start()["record_id"])
        self.assertTrue(self.cli("readiness", "--assignment", "dependent")["ok"])
        (self.repo / "src/code.txt").write_text("foundation changed", encoding="utf-8")
        self.assertFalse(self.cli("readiness", "--assignment", "dependent", code=1)["ok"])

    def test_started_fix_invalidates_previous_foundation_completion(self):
        self.ready()
        self.complete(self.start()["record_id"])
        self.owner("dependent", "second-worker", ["other"], ["feature"])
        self.assertTrue(self.cli("readiness", "--assignment", "dependent")["ok"])
        self.start(stage="fix")
        self.assertFalse(self.cli("readiness", "--assignment", "dependent", code=1)["ok"])

    def test_generated_dependencies_do_not_invalidate_source_snapshots(self):
        self.cli("snapshot", "--id", "source", "--path", "src")
        generated = self.repo / "src/node_modules/fixture"
        generated.mkdir(parents=True)
        (generated / "artifact.js").write_text("generated", encoding="utf-8")
        self.cli("command", "--id", "source-check", "--snapshot", "source", "--", sys.executable, "-B", "-c", "pass")


if __name__ == "__main__":
    unittest.main()
