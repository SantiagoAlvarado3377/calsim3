// Shared run model (SCRUM-125, subtask SCRUM-126).
//
// WHY THIS FILE EXISTS
// Before this, every page invented its own idea of what a "run" looks like:
//   - ImportData built { id, name, description, source, importedAt, file } inline
//   - SimulationRuns used { id, name, source, imported, dateRange, series, status }
//   - Dashboard expected { ..., dateRange, series, status, importedAt }

// This file is the ONE agreed shape. New runs are built here ,
// so when we later save runs to SQLite ( for the database schema), 
// every run already has the fields the database will expect.
//
// WHAT IT DOES NOT DO 
//   - It doesn't save or load anything. It only builds a plain object.
//   - It doesn't validate the name/description. That's validateRunMetadata's job
//     (SCRUM-124), which runs before Import is even enabled.
//
// Planned JS field -> database column (the schema comes in SCRUM-127; keep the
// two in sync once it exists):
//   id             -> runs.id
//   name           -> runs.name
//   description    -> runs.description
//   source         -> runs.source_file_name
//   filePath       -> runs.file_path
//   importedAt     -> runs.imported_at
//   status         -> runs.status
//   catalogSummary -> comes from the run_summary VIEW (computed, never stored)
//   file           -> NOT stored. It's the browser File object, only alive this session.
 
// The three states a run can be in. Exported as constants so nobody hand-types
// 'ready' vs 'Ready' vs 'done' and gets a silent mismatch. The database schema
// (SCRUM-127) will only allow exactly these three strings, so the two must match.
//   PROCESSING -> import started, catalog still being read (future processing screen)
//   READY      -> catalog is available, run can be used everywhere
//   FAILED     -> import couldn't finish (future failure screen shows the reason)
// Object.freeze stops anyone from accidentally doing RUN_STATUS.READY = 'x' at runtime.

export const RUN_STATUS = Object.freeze({
  PROCESSING: 'processing',
  READY: 'ready',
  FAILED: 'failed',
});
 
/**
 * Build a new run object in the shared shape.
 *
 * @param {object} params
 * @param {string} params.name          Run name the user typed (or auto-filled). Trimmed here.
 * @param {string} [params.description] Optional description. Missing/undefined becomes ''.
 * @param {File}   params.file          The browser File the user picked. Must have a .name.
 * @param {Date}   [params.now]         The "current time". Defaults to new Date(). Tests pass
 *                                      a fixed date so id and importedAt are predictable.
 * @returns {{
 *   id: string, name: string, description: string, source: string,
 *   filePath: null, importedAt: string, status: string,
 *   catalogSummary: null, file: File
 * }}
 */
export function createRun({ name, description, file, now = new Date() }) {
  return {
    // Same format ImportData used before ('run-' + milliseconds since 1970), so
    // nothing that reads ids breaks. Using `now` instead of Date.now() means a
    // test can pin the time: new Date('2026-11-10T00:00:00Z') -> 'run-1794268800000'.
    id: `run-${now.getTime()}`,
 
    // Trim so " Scenario 2026 " and "Scenario 2026" are the same run name.
    // (validateRunMetadata already compares trimmed names for duplicates,
    // storing the trimmed value keeps the saved name consistent with that)
    name: name.trim(),
 
    // `?? ''` turns undefined/null into an empty string BEFORE trimming, so a
    // missing description never crashes with "cannot read .trim of undefined".
    // The database column is NOT NULL DEFAULT '', so '' (not null) is correct.
    description: (description ?? '').trim(),
 
    // The browser only tells us the file's NAME, never its full path 
    //  So `source` is just e.g. 'scenario_2026.dss'.
    source: file.name,
 
    // Where the copy of the file lives inside the workspace folder, as a path
    // RELATIVE to the workspace (so moving the whole workspace still works).
    // null for now: there's no workspace until the "Workspace + registration" story.
    filePath: null,
 
    // ISO 8601 string, e.g. '2026-11-10T00:00:00.000Z'. Sorts correctly as text,
    // which is why the database stores it as TEXT too.
    importedAt: now.toISOString(),
 
    // No processing step exists yet: the moment Import is clicked the run is
    // usable (Variable Search reads the File directly). Once the real import
    // pipeline exists, this will start as PROCESSING and move to READY/FAILED.
    status: RUN_STATUS.READY,
 
    // Will hold counts + date range ({ seriesCount, variableCount, startDate, endDate })
    // once the catalog is extracted (the database will compute these for us).
    // null = "not read yet", which is different from "read and empty".
    catalogSummary: null,
 
    // Kept so Variable Search can keep reading the DSS file this session.
    // Never saved to the database (a File object can't be stored there).
    file,
  };
}