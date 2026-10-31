"""Requirement-derived ownership, disposition and evidence-completeness checks."""
import argparse
import contextlib
import copy
import hashlib
import io
import json
from pathlib import Path
import sys
import subprocess
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import checks
import core


class ChecksTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.repo = Path(self.temporary.name)
        subprocess.run(["git", "init", "-q", str(self.repo)], check=True, capture_output=True)
        self.run = core.create_run(self.repo, "human", "run", ["REQ-REV-004"])
        (self.repo / "proof.txt").write_text("independent check", encoding="utf-8")
        self.stdout = contextlib.redirect_stdout(io.StringIO())
        self.stdout.__enter__()
        self.addCleanup(self.stdout.__exit__, None, None, None)
        # Snapshot generation/git hashing is covered by the evidence suite;
        # this suite exercises the gate's response to current/stale evidence.
        snapshots = patch("evidence.snapshot_matches", return_value=True)
        snapshots.start()
        self.addCleanup(snapshots.stop)

    def args(self, **values):
        return argparse.Namespace(repo=self.repo, run=self.run.path, **values)

    def data(self, value):
        path = self.repo / "input.json"
        path.write_text(json.dumps(value), encoding="utf-8")
        return str(path)

    def assign(self, aid="A", paths=None, **values):
        return checks.assignment(self.args(input=self.data(dict(
            id=aid, agent="worker", paths=paths or ["src/one.py"], **values))))

    def finding(self, **values):
        data = dict(requirement="REQ-REV-004", severity="HIGH", blocks=True,
                    owner="worker", reviewer="reviewer", description="Fix lifecycle", evidence=["proof.txt"])
        data.update(values)
        checks.finding_add(self.args(input=self.data(data)))

    def transition(self, status, **values):
        args = dict(id="F-001", status=status, reviewer="reviewer", evidence=[], reason=None,
                    record="reviewer-review-1", snapshot="current")
        args.update(values)
        return checks.finding_update(self.args(**args))

    def test_batch_closure_is_atomic_and_idempotent(self):
        self.finding()
        self.finding(description="Second finding")
        self.record("review", "reviewer")
        self.snapshot()
        value = {"reviewer": "reviewer", "record_id": "reviewer-review-1", "snapshot_id": "current",
                 "findings": [{"id": "F-001", "evidence": ["proof.txt"]},
                              {"id": "F-002", "evidence": []}]}
        before = (self.run.path / "state.json").read_bytes()
        with self.assertRaisesRegex(core.Error, "existing evidence"):
            checks.finding_close_batch(self.args(input=self.data(value)))
        self.assertEqual(before, (self.run.path / "state.json").read_bytes())
        value["findings"][1]["evidence"] = ["proof.txt"]
        checks.finding_close_batch(self.args(input=self.data(value)))
        closed = self.run.state()
        self.assertEqual([f["status"] for f in closed["findings"].values()], ["closed", "closed"])
        checks.finding_close_batch(self.args(input=self.data(value)))
        self.assertEqual(closed, self.run.state())
        self.transition("open")
        # Original review predates reopening: a batch must retain the timing guard.
        with self.assertRaisesRegex(core.Error, "must start after"):
            checks.finding_close_batch(self.args(input=self.data(value)))
        self.assertEqual(self.run.state()["findings"]["F-001"]["status"], "open")

    def test_batch_closure_rejects_duplicate_ids_and_nonindependent_reviewer(self):
        self.finding()
        self.record("review", "reviewer")
        self.snapshot()
        entry = {"id": "F-001", "evidence": ["proof.txt"]}
        value = {"reviewer": "reviewer", "record_id": "reviewer-review-1", "snapshot_id": "current",
                 "findings": [entry, entry]}
        with self.assertRaisesRegex(core.Error, "Duplicate"):
            checks.finding_close_batch(self.args(input=self.data(value)))
        value.update(reviewer="worker", findings=[entry])
        with self.assertRaisesRegex(core.Error, "independent reviewer"):
            checks.finding_close_batch(self.args(input=self.data(value)))
        self.assertEqual(self.run.state()["findings"]["F-001"]["status"], "open")

    def record(self, stage, agent="main", attempt=1, status="succeeded", unavailable=False):
        rid = f"{agent}-{stage}-{attempt}"
        stamp = core.now()
        row = dict(agent=agent, invocation="one", stage=stage, attempt=attempt,
                   status=status, start=stamp, end=stamp,
                   elapsed_seconds=0, selected_model="selected", selected_effort="high",
                   observed_model=None, observed_effort=None, usage_source="direct record",
                   usage=dict(input_tokens=1, output_tokens=2, cache_read_tokens=0),
                   tool_calls=0, retries=0, unavailable_reasons={})
        if unavailable:
            row["usage"] = dict.fromkeys(row["usage"])
            row["unavailable_reasons"] = {k: "not exposed" for k in row["usage"]}
        key = core.record_key(agent, "one", stage, attempt)
        with self.run.edit() as state:
            state["records"][rid] = row
            state["expected"][key] = dict(agent=agent, invocation="one", stage=stage, attempt=attempt, record_id=rid)
        return rid

    def snapshot(self, sid="current"):
        with self.run.edit() as state:
            state["snapshots"][sid] = {"created_at": core.now()}

    def complete(self, unavailable=False):
        for stage in checks.REQUIRED_STAGES:
            agent = "reviewer" if stage == "review" else "worker" if stage == "implement" else "main"
            self.record(stage, agent, unavailable=unavailable)
        self.snapshot()
        artifact = self.run.artifact("handoffs/review.md", "Independent review evidence\n")
        with self.run.edit() as state:
            state["commands"]["tests"] = dict(snapshot_id="current", exit_code=0, timed_out=False, truncated=False)
            state["handoffs"]["review"] = dict(snapshot_id="current",
                artifact=artifact.relative_to(self.repo).as_posix(),
                artifact_sha256=hashlib.sha256(artifact.read_bytes()).hexdigest(),
                references=["proof.txt"], resource_record="reviewer-review-1")

    def test_assignment_accepts_nonexistent_files_and_directory_ownership(self):
        self.assign(paths=["src/new", "tests/new.py"])
        self.assertEqual(0, checks.ownership(self.args(assignment="A", path=["src/new/deeper/file.py", "tests/new.py"])))
        self.assertEqual(1, checks.ownership(self.args(assignment="A", path=["src/newer/file.py"])))

    def test_integrator_cannot_independently_review_its_wiring(self):
        self.complete()
        rid = self.record("integrate", "reviewer")
        with self.run.edit() as state:
            state["records"][rid]["changes_code"] = True
        self.assertIn("independent review: no successful reviewer distinct from implementation/fix agents",
                      checks.check_run(self.run)["errors"])
        self.finding(owner="worker")
        self.record("review", "reviewer", attempt=2)
        self.snapshot()
        with self.assertRaisesRegex(core.Error, "independent reviewer"):
            self.transition("closed", evidence=["proof.txt"], record="reviewer-review-2")

    def test_later_owner_wiring_invalidates_finding_closure(self):
        self.finding()
        self.record("review", "reviewer")
        self.snapshot()
        self.transition("closed", evidence=["proof.txt"])
        rid = self.record("integrate", "worker")
        with self.run.edit() as state:
            state["records"][rid]["changes_code"] = True
        errors = checks.check_run(self.run)["errors"]
        self.assertTrue(any("finding F-001: invalid closure" in error for error in errors))

    def test_assignment_refuses_traversal_absolute_git_globs_and_windows_aliases(self):
        for value in ("../other", "/absolute", "C:\\outside", "src/../../out", "src/*", ".GIT/config", "src/./a", "src./a", "src /a", "src//a"):
            with self.subTest(value=value), self.assertRaises(core.Error):
                self.assign(paths=[value])
        self.assertEqual({}, self.run.state()["assignments"])

    def test_overlap_is_case_insensitive_and_detects_subtrees_both_directions(self):
        self.assign(paths=["Src/Module"])
        for path in ("src/module/file.py", "SRC", "SRC/MODULE"):
            with self.subTest(path=path), self.assertRaises(core.Error):
                self.assign("B", [path])
        self.assign("C", ["src/module2"])

    def test_duplicate_id_and_self_or_unknown_dependencies_are_rejected(self):
        self.assign()
        for aid, deps in (("A", []), ("B", ["B"]), ("C", ["missing"])):
            with self.subTest(aid=aid), self.assertRaises(core.Error):
                self.assign(aid, ["other/file"], dependencies=deps)
        self.assign("B", ["other"], dependencies=["A"])

    def test_explicit_ownership_check_does_not_infer_actor(self):
        self.assign()
        before = self.run.state()
        self.assertEqual(1, checks.ownership(self.args(assignment="A", path=["other.py"])))
        self.assertEqual(before, self.run.state())
        with self.assertRaises(core.Error):
            checks.ownership(self.args(assignment="missing", path=["src/one.py"]))

    def test_finding_closure_requires_registered_independent_assigned_reviewer_and_existing_evidence(self):
        self.finding()
        for values in (dict(reviewer="worker", evidence=["proof.txt"]),
                       dict(reviewer="someone", evidence=["proof.txt"]),
                       dict(evidence=[]), dict(evidence=["missing.txt"]),
                       dict(evidence=["../proof.txt"]), dict(evidence=["proof.txt"])):
            with self.subTest(values=values), self.assertRaises(core.Error):
                self.transition("closed", **values)
        self.record("review", "reviewer")
        self.snapshot()
        self.assertEqual(0, self.transition("closed", evidence=["proof.txt"]))

    def test_same_owner_reviewer_is_rejected(self):
        with self.assertRaises(core.Error):
            self.finding(reviewer="worker")

    def test_reopen_preserves_closure_history_and_stable_ids(self):
        self.finding()
        self.record("review", "reviewer")
        self.snapshot()
        self.transition("closed", evidence=["proof.txt"])
        old = copy.deepcopy(self.run.state()["findings"]["F-001"]["history"])
        with self.assertRaises(core.Error):
            self.transition("fixing")
        self.transition("open", reason="regression reproduced")
        finding = self.run.state()["findings"]["F-001"]
        self.assertEqual(old, finding["history"][:-1])
        self.assertEqual("open", finding["status"])
        self.finding()
        self.assertIn("F-002", self.run.state()["findings"])

    def test_deferred_blocker_cannot_pass_gate(self):
        self.complete()
        self.finding()
        with self.assertRaises(core.Error):
            self.transition("deferred")
        self.transition("deferred", reason="await dependency")
        self.assertIn("finding F-001: unresolved blocker (deferred)", checks.check_run(self.run)["errors"])

    def test_two_failed_cycles_require_reassessment_before_next_cycle(self):
        def cycle(outcome="failed", reassessment=None):
            return checks.cycle(self.args(reviewer="reviewer", outcome=outcome,
                                         evidence="proof.txt", reassessment=reassessment))
        cycle()
        cycle()
        with self.assertRaises(core.Error):
            cycle("passed")
        self.assertEqual(2, len(self.run.state()["cycles"]))
        cycle("passed", "Root cause identified; change the transaction boundary")
        self.assertEqual(3, len(self.run.state()["cycles"]))

    def test_complete_run_and_explicitly_unavailable_tokens_pass_with_coverage_warnings(self):
        self.complete(unavailable=True)
        report = checks.check_run(self.run)
        self.assertTrue(report["ok"], report)
        self.assertEqual(21, report["coverage"]["unavailable_token_metrics"])
        self.assertEqual(21, len(report["warnings"]))

    def test_missing_stage_and_expected_row_fail(self):
        self.complete()
        with self.run.edit() as state:
            del state["records"]["reviewer-review-1"]
        report = checks.check_run(self.run)
        self.assertFalse(report["ok"])
        self.assertTrue(any("expected reviewer|one|review|1" in error for error in report["errors"]))
        self.assertIn("required stage review: no successful resource record", report["errors"])

    def test_unfinished_records_and_missing_telemetry_reasons_fail(self):
        self.complete()
        with self.run.edit() as state:
            row = state["records"]["main-close-1"]
            row.update(status="running", end=None, elapsed_seconds=None)
            row["usage"]["input_tokens"] = None
        errors = checks.check_run(self.run)["errors"]
        self.assertTrue(any("unfinished" in error for error in errors))
        self.assertTrue(any("timing" in error for error in errors))
        self.assertTrue(any("input_tokens needs a reason" in error for error in errors))

    def test_interrupted_attempt_is_accounted_and_superseded_by_successful_retry(self):
        self.complete()
        self.record("fix", "worker", status="interrupted", unavailable=True)
        self.assertTrue(any("latest stage attempt remains unresolved" in e for e in checks.check_run(self.run)["errors"]))
        self.record("fix", "worker", attempt=2)
        report = checks.check_run(self.run)
        self.assertTrue(report["ok"], report)

    def test_review_by_implementer_does_not_establish_independence(self):
        self.complete()
        with self.run.edit() as state:
            row = state["records"].pop("reviewer-review-1")
            del state["expected"]["reviewer|one|review|1"]
            state["handoffs"]["review"]["resource_record"] = None
        self.record("review", "worker")
        self.assertTrue(any("independent review" in e for e in checks.check_run(self.run)["errors"]))

    def test_stale_snapshot_and_truncated_command_fail(self):
        self.complete()
        with self.run.edit() as state:
            state["commands"]["test"] = dict(snapshot_id="snapshot", exit_code=0, timed_out=False, truncated=True)
            state["handoffs"]["review"] = dict(snapshot_id="snapshot")
        with patch("evidence.snapshot_matches", return_value=False):
            report = checks.check_run(self.run)
        self.assertTrue(any("stale snapshot" in error for error in report["errors"]))
        self.assertTrue(any("truncated" in error for error in report["errors"]))

    def test_design_handoff_does_not_require_code_snapshot(self):
        self.complete()
        with self.run.edit() as state:
            design = copy.deepcopy(state["handoffs"]["review"])
            design["snapshot_id"] = None
            state["handoffs"]["design"] = design
        self.assertTrue(checks.check_run(self.run)["ok"])

    def test_design_only_handoff_cannot_complete_implementation_run(self):
        self.complete()
        with self.run.edit() as state:
            state["handoffs"]["review"]["snapshot_id"] = None
        errors = checks.check_run(self.run)["errors"]
        self.assertIn("handoffs: no current snapshot-bound implementation handoff recorded", errors)
        self.assertFalse(any("invalid artifact" in error for error in errors))

    def test_no_command_or_handoff_evidence_prevents_completion(self):
        self.complete()
        with self.run.edit() as state:
            state["commands"].clear()
            state["handoffs"].clear()
        errors = checks.check_run(self.run)["errors"]
        self.assertIn("commands: no current evidence recorded", errors)
        self.assertIn("handoffs: no current evidence recorded", errors)

    def test_explicit_supersession_preserves_failed_evidence_and_uses_current_successor(self):
        self.complete()
        with self.run.edit() as state:
            state["commands"]["old"] = dict(snapshot_id="old", exit_code=1, truncated=True,
                superseded_by="tests", superseded_reason="Fixed failure and reran tests")
            state["handoffs"]["old"] = dict(snapshot_id="old", artifact="missing.md",
                superseded_by="review", superseded_reason="Revalidated after fix")
        report = checks.check_run(self.run)
        self.assertTrue(report["ok"], report)
        self.assertEqual(1, self.run.state()["commands"]["old"]["exit_code"])

    def test_invalid_or_cyclic_supersession_fails(self):
        self.complete()
        with self.run.edit() as state:
            state["commands"]["old"] = dict(superseded_by="tests", superseded_reason="retry")
            state["commands"]["tests"].update(superseded_by="old", superseded_reason="cycle")
            state["handoffs"]["old"] = dict(superseded_by="missing", superseded_reason="typo")
        errors = checks.check_run(self.run)["errors"]
        self.assertEqual(3, sum("supersession" in error for error in errors))

    def test_design_handoff_artifact_tampering_is_detected(self):
        self.complete()
        with self.run.edit() as state:
            state["handoffs"]["review"]["snapshot_id"] = None
        (self.run.path / "handoffs/review.md").write_text("tampered", encoding="utf-8")
        self.assertTrue(any("invalid artifact" in error for error in checks.check_run(self.run)["errors"]))

    def test_json_input_must_be_object(self):
        with self.assertRaises(core.Error):
            checks.assignment(self.args(input=self.data([])))

    def test_security_review_by_implementer_does_not_pass_independence_gate(self):
        self.complete()
        with self.run.edit() as state:
            del state["records"]["main-security-1"]
            del state["expected"]["main|one|security|1"]
        self.record("security", "worker")
        errors = checks.check_run(self.run)["errors"]
        self.assertTrue(any("independent security review" in error for error in errors))
        self.record("security", "security-reviewer")
        self.assertTrue(checks.check_run(self.run)["ok"])

    def test_closure_rejects_historical_review_before_finding(self):
        self.record("review", "reviewer")
        self.snapshot()
        self.finding()
        with self.assertRaisesRegex(core.Error, "must start after"):
            self.transition("closed", evidence=["proof.txt"])

    def test_closure_rejects_failed_review_and_missing_record_or_snapshot_binding(self):
        self.finding()
        self.record("review", "reviewer", status="failed")
        self.snapshot()
        for values in (dict(record=None), dict(snapshot=None), dict(record="missing"), {}):
            with self.subTest(values=values), self.assertRaises(core.Error):
                self.transition("closed", evidence=["proof.txt"], **values)

    def test_fresh_post_fix_review_closes_but_later_fix_invalidates_closure(self):
        self.complete()
        self.finding()
        self.record("fix", "worker")
        self.transition("awaiting-revalidation")
        with self.assertRaisesRegex(core.Error, "must start after"):
            self.transition("closed", evidence=["proof.txt"])
        review = self.record("revalidate", "reviewer")
        self.snapshot("post-fix")
        self.transition("closed", evidence=["proof.txt"], record=review, snapshot="post-fix")
        event = self.run.state()["findings"]["F-001"]["history"][-1]
        self.assertEqual(review, event["record_id"])
        self.assertEqual("post-fix", event["snapshot_id"])
        self.assertTrue(checks.check_run(self.run)["ok"])
        self.record("fix", "worker", attempt=2)
        errors = checks.check_run(self.run)["errors"]
        self.assertTrue(any("finding F-001: invalid closure" in error for error in errors))

    def test_snapshot_must_be_current_and_recorded_after_completed_fix(self):
        self.complete()
        self.finding()
        self.record("fix", "worker")
        review = self.record("revalidate", "reviewer")
        with self.assertRaisesRegex(core.Error, "snapshot must be recorded after"):
            self.transition("closed", evidence=["proof.txt"], record=review)
        self.snapshot("post-fix")
        with patch("evidence.snapshot_matches", return_value=False):
            with self.assertRaisesRegex(core.Error, "current recorded snapshot"):
                self.transition("closed", evidence=["proof.txt"], record=review, snapshot="post-fix")

    def test_current_closure_snapshot_is_rechecked_by_completeness(self):
        self.complete()
        self.finding()
        review = self.record("revalidate", "reviewer")
        self.snapshot("closure")
        self.transition("closed", evidence=["proof.txt"], record=review, snapshot="closure")
        with patch("evidence.snapshot_matches", side_effect=lambda run, sid: sid != "closure"):
            errors = checks.check_run(self.run)["errors"]
        self.assertTrue(any("finding F-001: invalid closure" in error for error in errors))

    def test_reopened_finding_requires_new_review_after_reopen(self):
        self.finding()
        self.record("review", "reviewer")
        self.snapshot()
        self.transition("closed", evidence=["proof.txt"])
        self.transition("open", reason="regression")
        with self.assertRaisesRegex(core.Error, "must start after"):
            self.transition("closed", evidence=["proof.txt"])


if __name__ == "__main__":
    unittest.main()

