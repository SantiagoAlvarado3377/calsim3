"""Tests for backend/service.py and backend/database.py (SCRUM-219).

Standard library only (unittest + sqlite3 + subprocess).

Run from the REPO ROOT:
    python -m unittest discover backend/tests -v
(Use `py` on Windows or `python3` on Mac/Linux if `python` isn't found.)

Two kinds of tests:
  - Most call handle_request() / handle_line() directly with a Context around
    a temporary database. Fast, and no process or pipes involved.
  - TestRealProcess starts service.py exactly like Electron will and talks to
    it over stdin/stdout. That's the only way to prove stdout carries nothing
    but JSON and that closing stdin really stops the process.
"""

import json
import os
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import database  # noqa: E402
import service  # noqa: E402


class ServiceTestCase(unittest.TestCase):
    """Fresh data folder + database for every test, deleted afterwards."""

    def setUp(self):
        # A real file on disk (not ":memory:") so the test matches what the app
        # does: create the folder's calsim.db, then reopen it.
        self.data_dir = Path(tempfile.mkdtemp(prefix="calsim-test-"))
        self.db_path = self.data_dir / database.DB_FILE_NAME
        self.connection = database.connect(self.db_path)
        self.ctx = service.Context(self.connection, self.db_path)

    def tearDown(self):
        self.connection.close()
        shutil.rmtree(self.data_dir, ignore_errors=True)

    def call(self, command, args=None, request_id=1):
        """Send one request through handle_request and return the reply."""
        request = {"id": request_id, "command": command}
        if args is not None:
            request["args"] = args
        return service.handle_request(request, self.ctx)

    def insert_run(self, run_id="run-1794268800000", name="Baseline 2025",
                   imported_at="2026-11-10T00:00:00.000Z", status="ready"):
        self.connection.execute(
            """INSERT INTO runs (id, name, description, source_file_name, file_path,
                                 imported_at, status, dss_version)
               VALUES (?, ?, 'Notes', 'baseline.dss', 'runs/x/baseline.dss', ?, ?, 7)""",
            (run_id, name, imported_at, status),
        )

    def insert_series(self, run_id, part_b, start, end):
        self.connection.execute(
            """INSERT INTO series (run_id, pathname, part_a, part_b, part_c, part_e, part_f,
                                   units, data_type, start_date, end_date, value_count)
               VALUES (?, ?, 'CALSIM', ?, 'STORAGE', '1Month', 'L2020A', 'TAF', 'PER-AVER', ?, ?, 360)""",
            (run_id, f"/CALSIM/{part_b}/STORAGE//1Month/L2020A/", part_b, start, end),
        )


class TestPing(ServiceTestCase):
    def test_ping_returns_version_and_db_path(self):
        reply = self.call("ping")
        self.assertEqual(reply, {
            "id": 1,
            "ok": True,
            "result": {"version": service.VERSION, "dbPath": str(self.db_path)},
        })

    def test_args_can_be_omitted_or_null(self):
        # Electron may send no args (or null) for commands that take none.
        self.assertTrue(self.call("ping")["ok"])
        self.assertTrue(service.handle_request({"id": 2, "command": "ping", "args": None}, self.ctx)["ok"])


class TestDatabaseSetup(ServiceTestCase):
    def test_database_file_has_tables_and_view(self):
        # Open the file with a SEPARATE connection: proves the tables were
        # actually written to calsim.db, not just visible to our connection.
        other = sqlite3.connect(str(self.db_path))
        try:
            names = {row[0] for row in other.execute(
                "SELECT name FROM sqlite_master WHERE type IN ('table', 'view')")}
        finally:
            other.close()
        self.assertTrue({"runs", "series", "run_summary"} <= names)

    def test_schema_applied_twice_is_harmless_and_keeps_data(self):
        # The app runs schema.sql on every launch. Reopening must not fail or
        # wipe anything (that's the CREATE ... IF NOT EXISTS promise).
        self.insert_run()
        self.connection.commit()
        second = database.connect(self.db_path)
        try:
            count = second.execute("SELECT COUNT(*) FROM runs").fetchone()[0]
        finally:
            second.close()
        self.assertEqual(count, 1)

    def test_foreign_keys_are_on(self):
        self.assertTrue(database.foreign_keys_enabled(self.connection))
        # And they actually bite: a series for a run that doesn't exist is refused.
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_series("run-does-not-exist", "S_SHSTA", "1921-11-01", "1951-10-01")


class TestListRuns(ServiceTestCase):
    def test_empty_database_returns_empty_list(self):
        self.assertEqual(self.call("list_runs"), {"id": 1, "ok": True, "result": []})

    def test_one_run_in_camel_case_with_catalog_summary(self):
        self.insert_run()
        self.insert_series("run-1794268800000", "S_SHSTA", "1921-11-01", "1951-10-01")
        self.insert_series("run-1794268800000", "S_OROVL", "1920-10-01", "1950-09-01")

        runs = self.call("list_runs")["result"]

        self.assertEqual(runs, [{
            "id": "run-1794268800000",
            "name": "Baseline 2025",
            "description": "Notes",
            "source": "baseline.dss",
            "filePath": "runs/x/baseline.dss",
            "importedAt": "2026-11-10T00:00:00.000Z",
            "status": "ready",
            "catalogSummary": {
                "seriesCount": 2,
                "variableCount": 2,
                "startDate": "1920-10-01",  # earliest start across series
                "endDate": "1951-10-01",    # latest end across series
            },
            "errorMessage": None,
            "dssVersion": 7,
        }])

    def test_newest_run_first(self):
        self.insert_run("run-old", "Older", "2026-11-01T00:00:00.000Z")
        self.insert_run("run-new", "Newer", "2026-11-15T00:00:00.000Z")
        ids = [run["id"] for run in self.call("list_runs")["result"]]
        self.assertEqual(ids, ["run-new", "run-old"])

    def test_catalog_summary_is_none_until_run_is_ready(self):
        # None = "catalog not read yet", same meaning as in createRun().
        self.insert_run(status="processing")
        self.assertIsNone(self.call("list_runs")["result"][0]["catalogSummary"])


class TestBadRequests(ServiceTestCase):
    def test_invalid_json(self):
        with self.assertLogs("calsim.service", level="WARNING"):  # logged, not printed
            reply = service.handle_line("{not json", self.ctx)
        self.assertEqual(reply["id"], None)
        self.assertFalse(reply["ok"])
        self.assertEqual(reply["error"]["code"], "invalid_request")

    def test_request_that_is_not_an_object(self):
        self.assertEqual(service.handle_line("[1, 2]", self.ctx)["error"]["code"], "invalid_request")

    def test_missing_command_keeps_the_id(self):
        reply = service.handle_request({"id": 7}, self.ctx)
        self.assertEqual((reply["id"], reply["error"]["code"]), (7, "invalid_request"))

    def test_args_must_be_an_object(self):
        reply = service.handle_request({"id": 3, "command": "ping", "args": [1]}, self.ctx)
        self.assertEqual(reply["error"]["code"], "invalid_request")

    def test_unknown_command(self):
        reply = self.call("drop_everything", request_id=5)
        self.assertEqual(reply["id"], 5)
        self.assertFalse(reply["ok"])
        self.assertEqual(reply["error"]["code"], "unknown_command")

    def test_handler_crash_becomes_internal_error(self):
        # Register a temporary command that blows up, then remove it again.
        @service.command("explode_for_test")
        def explode(args, ctx):
            raise RuntimeError("boom")

        try:
            # assertLogs also stops the traceback cluttering the test output.
            with self.assertLogs("calsim.service", level="ERROR"):
                reply = self.call("explode_for_test")
        finally:
            del service.COMMANDS["explode_for_test"]
        self.assertEqual(reply["error"]["code"], "internal_error")
        self.assertNotIn("boom", reply["error"]["message"])  # details stay in the log

    def test_command_error_passes_code_and_message_through(self):
        @service.command("friendly_error_for_test")
        def friendly(args, ctx):
            raise service.CommandError("file_not_found", "The selected file could not be found.")

        try:
            reply = self.call("friendly_error_for_test")
        finally:
            del service.COMMANDS["friendly_error_for_test"]
        self.assertEqual(reply["error"], {"code": "file_not_found",
                                          "message": "The selected file could not be found."})

    def test_registering_a_name_twice_fails(self):
        with self.assertRaises(ValueError):
            service.command("ping")(lambda args, ctx: None)


class TestRealProcess(unittest.TestCase):
    """Start service.py as a child process, the way Electron will."""

    def setUp(self):
        self.data_dir = Path(tempfile.mkdtemp(prefix="calsim-proc-")) / "nested" / "data"

    def tearDown(self):
        shutil.rmtree(self.data_dir.parent.parent, ignore_errors=True)

    def test_round_trip_over_pipes_and_clean_exit(self):
        requests = [
            {"id": 1, "command": "ping"},
            "this is not json",
            {"id": 2, "command": "list_runs", "args": {}},
            {"id": 3, "command": "nope"},
        ]
        stdin_text = "\n".join(r if isinstance(r, str) else json.dumps(r) for r in requests) + "\n"

        # communicate() writes everything, then CLOSES stdin, which is exactly
        # Electron's quit signal. If the service didn't exit on its own, the
        # timeout would fire and the test would fail.
        result = subprocess.run(
            [sys.executable, str(BACKEND_DIR / "service.py"), "--data-dir", str(self.data_dir)],
            input=stdin_text, capture_output=True, text=True, encoding="utf-8", timeout=30,
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        )

        self.assertEqual(result.returncode, 0, msg=result.stderr)

        # EVERY stdout line must be valid JSON. One stray print would fail here.
        lines = result.stdout.splitlines()
        replies = [json.loads(line) for line in lines]

        self.assertEqual(len(replies), 4)
        self.assertEqual(replies[0]["result"]["version"], service.VERSION)
        self.assertEqual(replies[1]["error"]["code"], "invalid_request")
        self.assertEqual(replies[2], {"id": 2, "ok": True, "result": []})
        self.assertEqual(replies[3]["error"]["code"], "unknown_command")

        # The --data-dir folder (including missing parents) and the DB were created.
        self.assertTrue((self.data_dir / "calsim.db").is_file())
        # Logs went to stderr, not stdout.
        self.assertIn("ready", result.stderr)


if __name__ == "__main__":
    unittest.main()