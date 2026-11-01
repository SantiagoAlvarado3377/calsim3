// Data seam for Variable Search (SCRUM-146 / SCRUM-147).
// The page only ever receives { runs, variables } (the same shape as
// getVariableSearchData) or a VariableSearchError, so replacing the sample data
// with real DSS data doesn't change searchVariables, the filters, or the table.

// SCRUM-149: the only error text users see. Technical details go to the log.
export const searchErrorMessages = {
  searchFailed: 'Search failed. Please check your spelling or search terms.',
  dataUnavailable: 'Unable to read the imported data file. Please re-import the DSS file and try again.',
};

export class VariableSearchError extends Error {
  constructor(kind, cause) {
    super(searchErrorMessages[kind], { cause });
    this.name = 'VariableSearchError';
    this.kind = kind;
  }
}

// SCRUM-149: log the technical details quietly instead of showing them.
export function logSearchError(error) {
  // TODO(SCRUM-149): also write these details to a local log file.
  console.error('[variable-search]', error.cause ?? error);
}

/**
 * SCRUM-159: read the variable and location metadata from an imported run's DSS file.
 *
 * @param {{ id: string, name: string, file: File }} run  imported run; file comes from the Import Data page
 * @returns {Promise<{ runs: object[], variables: object[] }>} same shape as getVariableSearchData();
 *   every variable needs id, runId, runName, identifier, location ('' if unmapped), category,
 *   units, interval, startMonth and endMonth
 * @throws {VariableSearchError} kind 'dataUnavailable' when the file is missing, unreadable, or unsupported
 */
export async function loadDssVariables(run) {
  // TODO(SCRUM-159): parse run.file's DSS catalog on the user's machine; the app
  // runs locally with no server. CalSim 3 record paths look like /A/B/C/D/E/F/:
  // B is the variable identifier, C its type (for example STORAGE), E the interval
  // (for example 1MON).
  throw new VariableSearchError('dataUnavailable', new Error(`DSS parsing is not implemented yet (${run.file?.name ?? 'no file'})`));
}
