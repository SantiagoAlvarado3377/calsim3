"""SQLite access for the CalSim 3 Python service (SCRUM-218 / SCRUM-219).

This is the ONLY file that talks to calsim.db. service.py asks it for things
("open the database", "list the runs") and never writes SQL itself, so if the
schema changes there is one place in Python to update.

The tables themselves are NOT defined here. They live in db/schema.sql (the
team's single source of truth), and we run that file on every connection.
Think of schema.sql as the building's blueprint and this file as the front
desk: the desk doesn't decide where the walls go, it just knows how to find
rooms and hand out keys.

Standard library only (sqlite3), so nothing extra to install for this part.
"""

import sqlite3
from pathlib import Path

# backend/database.py -> repo root -> db/schema.sql. Resolved from this file's
# location (not the current folder), so it works no matter where Python was
# started from: Electron starts us from frontend/, the tests from the repo root.
SCHEMA_PATH = Path(__file__).resolve().parent.parent / "db" / "schema.sql"

# The database file name inside the data folder. Electron passes the folder
# (--data-dir), we pick the name, so the two sides can't disagree about it.
DB_FILE_NAME = "calsim.db"


def connect(db_path):
    """Open (or create) the database at db_path and make sure the schema exists.

    Returns a sqlite3.Connection that is ready to use.

    Order matters here:
      1. PRAGMA foreign_keys = ON FIRST. SQLite ships with foreign keys OFF and
         the setting is per connection (not saved in the file). Without it,
         deleting a run would leave its series behind (ON DELETE CASCADE is
         silently ignored). See the warning at the top of db/schema.sql.
      2. Then run schema.sql. Every statement in it is "CREATE ... IF NOT
         EXISTS", so running it on an existing database is a harmless no-op.
         That's what lets us run it on EVERY connection without a separate
         "first launch" check: a new database gets its tables, an old one is
         left alone.

    Pass ":memory:" for a throwaway in-RAM database (tests can use that).
    """
    # str() because sqlite3 accepts Path objects only on newer Pythons, and
    # teammates may have an older 3.x on Windows.
    connection = sqlite3.connect(str(db_path))

    # sqlite3.Row lets us read columns by name (row["series_count"]) instead of
    # by position (row[7]), so adding a column later can't shift everything.
    connection.row_factory = sqlite3.Row

    try:
        connection.execute("PRAGMA foreign_keys = ON;")
        # executescript runs the whole file (many statements) in one go.
        connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    except Exception:
        # Don't leak an open file handle if the schema fails (e.g. schema.sql
        # missing or the folder is read-only). The caller gets the error.
        connection.close()
        raise

    return connection


def foreign_keys_enabled(connection):
    """True when foreign keys are ON for this connection (used by tests and ping)."""
    return connection.execute("PRAGMA foreign_keys;").fetchone()[0] == 1


def list_runs(connection):
    """Every saved run, newest first, in the same camelCase shape as createRun().

    Shape of each item (see frontend/src/data/runModel.js and db/README.md):
        {
          "id", "name", "description", "source", "filePath", "importedAt",
          "status", "catalogSummary": {seriesCount, variableCount, startDate, endDate} | None,
          "errorMessage", "dssVersion"
        }

    Two small additions beyond createRun(): errorMessage and dssVersion. They
    are real columns (db/README.md lists them as "filled in by the future
    import pipeline"), and the failure screen will need errorMessage, so we
    return them now rather than changing the shape later. `file` is NOT
    returned: it's a browser File object that only exists for one session.
    """
    # JOIN the run_summary VIEW so the counts come from the database, computed
    # fresh on every read (they can never go stale). Every run has a row in the
    # view because the view LEFT JOINs series, so a plain JOIN is safe here.
    # Newest first: imported_at is ISO 8601 text, which sorts correctly as text.
    # id DESC breaks ties if two runs were imported in the same millisecond.
    rows = connection.execute(
        """
        SELECT r.id, r.name, r.description, r.source_file_name, r.file_path,
               r.imported_at, r.status, r.error_message, r.dss_version,
               s.series_count, s.variable_count, s.start_date, s.end_date
        FROM runs r
        JOIN run_summary s ON s.run_id = r.id
        ORDER BY r.imported_at DESC, r.id DESC
        """
    ).fetchall()
    return [_run_row_to_dict(row) for row in rows]


def _run_row_to_dict(row):
    """One database row -> the camelCase dict the React side expects."""
    # catalogSummary follows createRun()'s rule: None means "catalog not read",
    # which is different from "read and empty". Only a 'ready' run has a read
    # catalog. A 'processing' run hasn't finished reading, and a 'failed' run
    # never will, so both get None instead of a misleading "0 series".
    if row["status"] == "ready":
        catalog_summary = {
            "seriesCount": row["series_count"],
            "variableCount": row["variable_count"],
            "startDate": row["start_date"],
            "endDate": row["end_date"],
        }
    else:
        catalog_summary = None

    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        # Column is source_file_name, JS field is `source` (see db/README.md).
        "source": row["source_file_name"],
        "filePath": row["file_path"],
        "importedAt": row["imported_at"],
        "status": row["status"],
        "catalogSummary": catalog_summary,
        "errorMessage": row["error_message"],
        "dssVersion": row["dss_version"],
    }