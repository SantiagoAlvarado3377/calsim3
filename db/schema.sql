-- =============================================================================
-- CalSim 3 Copilot: SQLite schema for saved runs and their series catalog
-- SCRUM-125 (story) / SCRUM-127 (this file). Tests come in SCRUM-188.
-- =============================================================================
--
-- !!! IMPORTANT: run this on EVERY connection, before anything else:
--
--         PRAGMA foreign_keys = ON;
--
-- SQLite ships with foreign keys TURNED OFF, and the setting is per connection
-- (it is not saved in the database file). Without it:
--   - a series could point at a run that doesn't exist, and
--   - deleting a run would NOT delete its series (ON DELETE CASCADE is ignored).
-- That's why this file can't just turn it on once for you.
--
-- Plain SQLite only (no Python- or Node-specific features), so whichever
-- backend the team picks (Python + pydsstools, or Electron/Node + the JS
-- reader) can run this file as-is.
--
-- The big picture, as an analogy: a DSS file is a huge warehouse of boxes.
--   - `runs`   = the list of warehouses we've registered.
--   - `series` = the inventory list for each warehouse: box labels, sizes,
--                date ranges. NOT the box contents.
-- The actual numbers (series VALUES) stay in the DSS file and are read on
-- demand. Storing them would bloat the database and duplicate the file.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- runs: one row per imported simulation run.
-- Mirrors createRun() in frontend/src/data/runModel.js. If you change one,
-- change the other (and db/README.md's mapping table).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS runs (
    -- Same string as the JS run.id, e.g. 'run-1794297600000'.
    -- TEXT (not INTEGER) because the 'run-' prefix is part of the id.
    id               TEXT PRIMARY KEY,

    -- Run name shown everywhere (Active run dropdown, Dashboard, ...).
    -- UNIQUE + COLLATE NOCASE = 'Baseline 2025' and 'baseline 2025' count as
    -- the same name, matching the app's existing duplicate rule (SCRUM-124).
    -- So even if a bug skipped the frontend check, the database still refuses.
    name             TEXT NOT NULL UNIQUE COLLATE NOCASE,

    -- Optional notes. '' (empty string) when not given, never NULL,
    -- because createRun() turns a missing description into ''.
    description      TEXT NOT NULL DEFAULT '',

    -- The original file's name, e.g. 'DCR2023_DV_9.3.1_v2a_Danube_Adj_v1.8.dss'.
    -- JS field: `source`. Just the name: browsers never reveal the full path.
    source_file_name TEXT NOT NULL,

    -- Where the COPY of the file lives, relative to the workspace folder,
    -- e.g. 'runs/run-1794297600000/DCR2023.dss'. Relative so moving the whole
    -- workspace (USB drive, new PC) keeps working.
    -- NULL until the workspace story exists (createRun sets filePath: null).
    file_path        TEXT,

    -- When the run was imported, ISO 8601 text like '2026-11-10T08:00:00.000Z'.
    -- SQLite has no real DATE type; ISO strings sort correctly as plain text,
    -- so ORDER BY imported_at gives oldest -> newest.
    imported_at      TEXT NOT NULL,

    -- Where the import stands. Must match RUN_STATUS in runModel.js exactly.
    --   processing -> still reading the catalog
    --   ready      -> usable everywhere
    --   failed     -> import couldn't finish (see error_message)
    status           TEXT NOT NULL
                     CHECK (status IN ('processing', 'ready', 'failed')),

    -- Human-readable reason for a failed import (shown on the failure screen).
    -- Only allowed when status = 'failed' (see the CHECK below), so a 'ready'
    -- run can never carry a leftover error message.
    error_message    TEXT,

    -- HEC-DSS file format version (6 or 7), filled in once the reader detects
    -- it. NULL = not detected yet. Matters because the JS reader is v7-only.
    dss_version      INTEGER CHECK (dss_version IS NULL OR dss_version IN (6, 7)),

    -- Same limits as the Import form (SCRUM-124): name 1..100 characters,
    -- description at most 500. length() counts characters, not bytes.
    CHECK (length(name) BETWEEN 1 AND 100),
    CHECK (length(description) <= 500),

    -- error_message only makes sense on a failed run.
    CHECK (error_message IS NULL OR status = 'failed')
);


-- -----------------------------------------------------------------------------
-- series: the catalog. One row per time series in a run. NO VALUES.
--
-- A DSS "pathname" has 6 parts:  /A/B/C/D/E/F/
--   A = project/basin, B = variable or location (CalSim: e.g. 'S_SHSTA'),
--   C = category (e.g. 'STORAGE'), D = date block (e.g. '01JAN2000'),
--   E = interval (e.g. '1MON'), F = version/scenario tag.
-- DSS splits one long series into many date blocks (many D parts). We combine
-- them, so we store the pathname WITHOUT the D part: '/A/B/C//E/F/'.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS series (
    -- Auto-numbered row id. In SQLite, 'INTEGER PRIMARY KEY' becomes the
    -- built-in rowid, so you don't have to supply it on INSERT.
    id          INTEGER PRIMARY KEY,

    -- Which run this series belongs to.
    -- ON DELETE CASCADE: delete the run -> its series rows are deleted too.
    -- (Only works with PRAGMA foreign_keys = ON, see top of file.)
    run_id      TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,

    -- Full pathname without the date part, e.g. '/CALSIM/S_SHSTA/STORAGE//1MON/DCR2023/'.
    pathname    TEXT NOT NULL,

    -- The individual parts, split out so we can search/filter on them
    -- without string-parsing pathname in every query.
    part_a      TEXT,
    part_b      TEXT,   -- variable / location (what Variable Search looks up)
    part_c      TEXT,   -- category (the category filter)
    part_e      TEXT,   -- interval, e.g. '1MON', '1DAY'
    part_f      TEXT,

    units       TEXT,   -- e.g. 'TAF', 'CFS'
    data_type   TEXT,   -- e.g. 'PER-AVER', 'PER-CUM', 'INST-VAL'

    -- First and last dates with data, ISO 8601 text (same reasoning as imported_at).
    start_date  TEXT,
    end_date    TEXT,

    -- How many values the series has (e.g. 312 months). Lets the UI show sizes
    -- without opening the DSS file.
    value_count INTEGER,

    -- The same series can't be listed twice in ONE run,
    -- but two different runs can (and usually do) have the same pathname.
    -- That's exactly what Compare Runs needs.
    UNIQUE (run_id, pathname)
);

-- Indexes = the "index at the back of a book": find rows without reading
-- every page. Both start with run_id because every query is "within this run".
-- Variable Search: WHERE run_id = ? AND part_b = ?
CREATE INDEX IF NOT EXISTS idx_series_run_part_b ON series (run_id, part_b);
-- Category filter: WHERE run_id = ? AND part_c = ?
CREATE INDEX IF NOT EXISTS idx_series_run_part_c ON series (run_id, part_c);
-- (No separate index on run_id alone is needed: UNIQUE(run_id, pathname)
--  already creates one that starts with run_id, which the cascade delete uses.)


-- -----------------------------------------------------------------------------
-- run_summary: per-run totals for the success screen and run lists, e.g.
--   "482 time series across 137 variables, Jan 2000 to Dec 2025".
-- A VIEW is a saved query, not a table: the numbers are computed from `series`
-- every time you read it, so they can never go stale or disagree with the catalog.
-- Maps to createRun()'s catalogSummary { seriesCount, variableCount, startDate, endDate }.
-- -----------------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS run_summary AS
SELECT
    r.id                       AS run_id,
    COUNT(s.id)                AS series_count,    -- COUNT(column) skips NULLs, so a run with no series -> 0
    COUNT(DISTINCT s.part_b)   AS variable_count,  -- distinct B parts = distinct variables
    MIN(s.start_date)          AS start_date,      -- earliest date across all series
    MAX(s.end_date)            AS end_date         -- latest date across all series
FROM runs r
-- LEFT JOIN (not JOIN) so a run that has no series yet (e.g. still 'processing')
-- still appears, with series_count = 0 and NULL dates.
LEFT JOIN series s ON s.run_id = r.id
GROUP BY r.id;