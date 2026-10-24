"""Black-box workflow integration using an isolated Git repository."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

CLI = Path(__file__).resolve().parents[1] / "scripts" / "workflow.py"


class CLITests(unittest.TestCase):
    def test_complete_run_and_fresh_fix_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            repo = Path(directory).resolve()
            environment = dict(os.environ, PYTHONDONTWRITEBYTECODE="1")

            def git(*args):
                subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True)

            def cli(*args, code=0):
                result = subprocess.run([sys.executable, "-B", str(CLI), "--repo", str(repo), *args],
                                        cwd=repo, env=environment, capture_output=True, text=True)
                self.assertEqual(result.returncode, code, result.stderr + result.stdout)
                return json.loads(result.stdout) if result.stdout else None

            git("init")
            git("config", "user.name", "Workflow fixture")
            git("config", "user.email", "fixture@example.invalid")
            source = repo / "feature.txt"
            source.write_text("fixture\n", encoding="utf-8")
            git("add", "feature.txt")
            git("commit", "-m", "fixture")
            result = cli("init", "--scope", "reviewer", "--prompter", "tester",
                         "--run-id", "integration", "--requirement", "REQ-REV-002")
            run = result["run"]

            def command(*args, code=0):
                return cli("--run", run, *args, code=code)

            for stage in ("compile", "security", "dispatch", "implement", "integrate", "review", "close"):
                agent = "verifier" if stage == "review" else "security-verifier" if stage == "security" else "main"
                result = command("start", "--agent", agent, "--invocation", "one",
                                 "--stage", stage, "--model", "fixture-model", "--effort", "low")
                command("finish", "--id", result["record_id"], "--status", "succeeded",
                        "--outcome", "fixture stage", "--unavailable-reason", "synthetic fixture lacks telemetry")

            def evidence(number):
                command("snapshot", "--id", f"snapshot-{number}", "--path", "feature.txt")
                command("command", "--id", f"tests-{number}", "--snapshot", f"snapshot-{number}",
                        "--", sys.executable, "-B", "-c", "print('fixture check')")
                payload = {name: "Fixture context; not product evidence" for name in
                           ("identity", "requirements", "permissions", "state", "verification", "risks", "resources")}
                payload.update(references=["feature.txt"], snapshot_id=f"snapshot-{number}")
                input_path = repo / "input.json"
                input_path.write_text(json.dumps(payload), encoding="utf-8")
                command("handoff", "create", "--id", f"handoff-{number}", "--input", "input.json")
                command("handoff", "validate", "--id", f"handoff-{number}")

            evidence(1)
            report = command("completeness")
            self.assertTrue(report["ok"])
            self.assertTrue(report["warnings"])
            report = command("summary")
            self.assertEqual(report["records"], 7)
            self.assertEqual(report["measured_record_coverage"]["input_tokens"], 0)
            source.write_text("changed fixture\n", encoding="utf-8")
            self.assertFalse(command("completeness", code=1)["ok"])
            evidence(2)
            # New evidence alone cannot silently erase the stale initial result.
            self.assertFalse(command("completeness", code=1)["ok"])
            for kind, old, new in (("commands", "tests-1", "tests-2"),
                                   ("handoffs", "handoff-1", "handoff-2")):
                command("supersede", "--kind", kind, "--id", old, "--by", new,
                        "--reason", "fixture fix checked against fresh state")
            self.assertTrue(command("completeness")["ok"])
            state = json.loads((Path(run) / "state.json").read_text())
            self.assertIn("tests-1", state["commands"])
            self.assertEqual(state["commands"]["tests-1"]["superseded_by"], "tests-2")


if __name__ == "__main__":
    unittest.main()
