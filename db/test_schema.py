"""Tests for db/schema.sql (SCRUM-125 / SCRUM-188).

Standard library only (sqlite3 + unittest): nothing to pip install, works the
same on Mac, Windows and Linux.

Run from the REPO ROOT:
    python -m unittest db/test_schema.py -v
(On Mac/Linux you may need `python3` instead of `python`.)

How every test works:
    setUp()    -> brand-new in-memory database (":memory:" = lives in RAM,
                  vanishes when closed), foreign keys ON, schema.sql loaded.
    test_...() -> insert some rows and check what the database allows/refuses.
    tearDown() -> close it. Nothing leaks from one test into another.
"""

import sqlite3
import unittest
from pathlib import Path

# Find schema.sql next to this file, so the tests work no matter which folder
# you run them from.
SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"


class SchemaTestCase(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:")
        # SQLite has foreign keys OFF by default, per connection. Without this
        # line the cascade-delete and bad-run_id tests would wrongly pass/fail.
        self.db.execute("PRAGMA foreign_keys = ON;")
        # executescript runs the whole file (many statements) at once.
        self.db.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))

    def tearDown(self):
        self.db.close()

    # ---- helpers: keep each test short and focused on the one thing it checks ----

    def insert_run(self, run_id="run-1", name="Scenario 2026", description="",
                   status="ready", error_message=None, dss_version=None):
        """Insert a run with sensible defaults; override only what the test cares about."""
        self.db.execute(
            """INSERT INTO runs (id, name, description, source_file_name, file_path,
                                 imported_at, status, error_message, dss_version)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            # ? placeholders = parameters. Never build SQL with f-strings
            # (SQL injection, and quotes in names would break the query).
            (run_id, name, description, "scenario_2026.dss", None,
             "2026-11-10T08:00:00.000Z", status, error_message, dss_version),
        )

    def insert_series(self, run_id="run-1", part_b="S_SHSTA", part_c="STORAGE",
                      start="2000-01-31", end="2025-12-31", count=312):
        """Insert one catalog row. The pathname is built from the parts (no D part)."""
        pathname = f"/CALSIM/{part_b}/{part_c}//1MON/DCR2023/"
        self.db.execute(
            """INSERT INTO series (run_id, pathname, part_a, part_b, part_c, part_e, part_f,
                                   units, data_type, start_date, end_date, value_count)
               VALUES (?, ?, 'CALSIM', ?, ?, '1MON', 'DCR2023', 'TAF', 'PER-AVER', ?, ?, ?)""",
            (run_id, pathname, part_b, part_c, start, end, count),
        )

    def count(self, table):
        return self.db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


class TestValidData(SchemaTestCase):
    def test_schema_loads_on_empty_database(self):
        # If setUp got this far, schema.sql ran without errors. Also confirm
        # all three objects exist by name.
        names = {row[0] for row in self.db.execute(
            "SELECT name FROM sqlite_master WHERE type IN ('table', 'view')")}
        self.assertTrue({"runs", "series", "run_summary"} <= names)

    def test_valid_run_and_two_series_insert(self):
        self.insert_run()
        self.insert_series(part_b="S_SHSTA")
        self.insert_series(part_b="C_KSWCK", part_c="CHANNEL")
        self.assertEqual(self.count("runs"), 1)
        self.assertEqual(self.count("series"), 2)

    def test_description_defaults_to_empty_string(self):
        # Leave description out of the INSERT entirely -> DEFAULT '' kicks in.
        self.db.execute(
            """INSERT INTO runs (id, name, source_file_name, imported_at, status)
               VALUES ('run-9', 'No Notes', 'x.dss', '2026-11-10T08:00:00.000Z', 'ready')""")
        desc = self.db.execute("SELECT description FROM runs WHERE id = 'run-9'").fetchone()[0]
        self.assertEqual(desc, "")

    def test_failed_run_can_have_error_message(self):
        self.insert_run(status="failed", error_message="Not a readable HEC-DSS file.")
        self.assertEqual(self.count("runs"), 1)


class TestRunSummary(SchemaTestCase):
    def test_counts_and_date_range(self):
        self.insert_run()
        # 3 series but only 2 distinct variables (S_SHSTA appears twice, as
        # STORAGE and as a second category), with different date ranges.
        self.insert_series(part_b="S_SHSTA", part_c="STORAGE", start="2000-01-31", end="2025-12-31")
        self.insert_series(part_b="S_SHSTA", part_c="STORAGE-LEVEL", start="1999-10-31", end="2020-09-30")
        self.insert_series(part_b="C_KSWCK", part_c="CHANNEL", start="2001-01-31", end="2026-09-30")

        row = self.db.execute(
            """SELECT series_count, variable_count, start_date, end_date
               FROM run_summary WHERE run_id = 'run-1'""").fetchone()
        # series_count  = 3 rows
        # variable_count = |{S_SHSTA, C_KSWCK}| = 2
        # start_date = MIN(start dates) = 1999-10-31
        # end_date   = MAX(end dates)   = 2026-09-30
        self.assertEqual(row, (3, 2, "1999-10-31", "2026-09-30"))

    def test_run_with_no_series_shows_zero(self):
        # A run still 'processing' has no catalog yet; it must still appear.
        self.insert_run(status="processing")
        row = self.db.execute(
            "SELECT series_count, variable_count, start_date, end_date FROM run_summary").fetchone()
        self.assertEqual(row, (0, 0, None, None))

    def test_summary_is_per_run(self):
        # Two runs: each summary only counts its own series.
        self.insert_run(run_id="run-1", name="Run A")
        self.insert_run(run_id="run-2", name="Run B")
        self.insert_series(run_id="run-1", part_b="S_SHSTA")
        self.insert_series(run_id="run-2", part_b="S_SHSTA")
        self.insert_series(run_id="run-2", part_b="C_KSWCK")
        rows = dict(self.db.execute("SELECT run_id, series_count FROM run_summary"))
        self.assertEqual(rows, {"run-1": 1, "run-2": 2})


class TestRejectedData(SchemaTestCase):
    # sqlite3.IntegrityError = the database refused the row because it broke
    # a constraint (CHECK, UNIQUE, NOT NULL, FOREIGN KEY).

    def test_duplicate_name_different_case_rejected(self):
        self.insert_run(run_id="run-1", name="Baseline 2025")
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_run(run_id="run-2", name="baseline 2025")

    def test_empty_name_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_run(name="")

    def test_name_at_100_chars_allowed_but_101_rejected(self):
        # Boundary test: the limit itself (100) is OK, one past it (101) is not.
        self.insert_run(run_id="run-1", name="a" * 100)
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_run(run_id="run-2", name="b" * 101)

    def test_description_over_500_rejected(self):
        self.insert_run(run_id="run-1", name="Ok", description="x" * 500)  # exactly 500 is fine
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_run(run_id="run-2", name="Too Long", description="x" * 501)

    def test_invalid_status_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_run(status="done")

    def test_error_message_on_ready_run_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_run(status="ready", error_message="leftover error")

    def test_invalid_dss_version_rejected(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_run(dss_version=8)

    def test_series_with_unknown_run_id_rejected(self):
        # No run 'run-404' exists -> foreign key refuses the series.
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_series(run_id="run-404")


class TestCascadeAndUniqueness(SchemaTestCase):
    def test_deleting_run_deletes_its_series(self):
        self.insert_run(run_id="run-1", name="Run A")
        self.insert_run(run_id="run-2", name="Run B")
        self.insert_series(run_id="run-1", part_b="S_SHSTA")
        self.insert_series(run_id="run-1", part_b="C_KSWCK")
        self.insert_series(run_id="run-2", part_b="S_SHSTA")

        self.db.execute("DELETE FROM runs WHERE id = 'run-1'")

        # run-1's two series are gone; run-2's series is untouched.
        remaining = self.db.execute("SELECT run_id FROM series").fetchall()
        self.assertEqual(remaining, [("run-2",)])

    def test_same_pathname_twice_in_one_run_rejected(self):
        self.insert_run()
        self.insert_series(part_b="S_SHSTA")
        with self.assertRaises(sqlite3.IntegrityError):
            self.insert_series(part_b="S_SHSTA")  # same run, same pathname

    def test_same_pathname_in_two_runs_allowed(self):
        # This is the normal Compare Runs case: both runs have S_SHSTA.
        self.insert_run(run_id="run-1", name="Run A")
        self.insert_run(run_id="run-2", name="Run B")
        self.insert_series(run_id="run-1", part_b="S_SHSTA")
        self.insert_series(run_id="run-2", part_b="S_SHSTA")
        self.assertEqual(self.count("series"), 2)


if __name__ == "__main__":
    unittest.main()