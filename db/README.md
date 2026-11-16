# `db/`: saved runs schema (SCRUM-125)
 
SQLite schema for saving imported runs and their series **catalog** between sessions.
This folder only **defines** the database. Nothing reads or writes it yet; that comes with the
local service / desktop shell stories.
 
| File | What it is |
|---|---|
| `schema.sql` | Tables `runs` and `series`, view `run_summary`, two indexes (SCRUM-127) |
| `test_schema.py` | Schema tests, Python standard library only (SCRUM-188) |
| `.gitignore` | Keeps Python's `__pycache__/` folder and local database files out of git |
 
## Running the tests
 
Needs Python 3 (nothing to `pip install`). From the **repo root**:
 
```
python -m unittest db/test_schema.py -v
```
 
Use `python3` (Mac/Linux) or `py` (Windows) if `python` isn't found.
You should see `Ran 18 tests ... OK`. Each test builds a fresh in-memory database, so the
tests never create or change a database file.
 
What they cover: valid data and the `run_summary` numbers; rejected data (duplicate name in a
different case, empty or too-long name, too-long description, invalid status, a series for a
missing run, the same series twice in one run); cascading deletes; and that the same series
is allowed in two different runs.
 
If the team picks a Node backend instead of Python, these tests are short enough to port.
 
## Always turn on foreign keys
 
SQLite turns foreign keys **off** by default, and the setting is per connection. Run this on
every connection before using the schema, or cascade deletes and the `run_id` check silently do nothing:
 
```sql
PRAGMA foreign_keys = ON;
```
 
## Tables
 
**`runs`**: one row per imported run. Same fields as `createRun()` in
`frontend/src/data/runModel.js`.
- `name` is unique ignoring case (`Baseline 2025` = `baseline 2025`), 1–100 characters.
- `description` is at most 500 characters, `''` when empty (never `NULL`).
- `status` is `processing`, `ready` or `failed` (same strings as `RUN_STATUS`).
- `error_message` is only allowed when `status = 'failed'`.
- `dss_version` is `6`, `7` or `NULL` (not detected yet).
**`series`**: the catalog: one row per time series in a run. **No values.** Values are read
from the DSS file when a page needs them.
- `pathname` is the DSS path **without** the D (date) part, e.g. `/CALSIM/S_SHSTA/STORAGE//1MON/DCR2023/`,
  because a series' date blocks are combined into one row.
- `part_b` = variable/location, `part_c` = category, `part_e` = interval.
- `UNIQUE(run_id, pathname)`: a series appears once per run, but different runs can share a pathname
  (that's what Compare Runs uses).
- Deleting a run deletes its series (`ON DELETE CASCADE`).
**`run_summary`** (view): per run, `series_count`, `variable_count` (distinct `part_b`),
`start_date` (earliest) and `end_date` (latest). Computed on every read, so it can't go stale.
Runs with no series yet show `0` and `NULL` dates.
 
## JS run field ↔ database column
 
| JS (`createRun()`) | Database | Notes |
|---|---|---|
| `id` | `runs.id` | e.g. `run-1794297600000` |
| `name` | `runs.name` | trimmed |
| `description` | `runs.description` | trimmed, `''` when missing |
| `source` | `runs.source_file_name` | file name only (browsers don't expose paths) |
| `filePath` | `runs.file_path` | workspace-relative; `null` until the workspace story |
| `importedAt` | `runs.imported_at` | ISO 8601 text |
| `status` | `runs.status` | `RUN_STATUS` values |
| `catalogSummary` | `run_summary` view | `{ seriesCount, variableCount, startDate, endDate }`; not stored |
| `file` | *(not stored)* | browser `File`, only exists for this session |
| *(none yet)* | `runs.error_message`, `runs.dss_version` | filled in by the future import pipeline |
 
If you change a field in one place, update `runModel.js`, `schema.sql` and this table together.