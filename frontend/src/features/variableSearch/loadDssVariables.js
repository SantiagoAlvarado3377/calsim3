// Data source for Variable Search (SCRUM-146 / SCRUM-147).
// The page only ever receives { runs, variables, waterYearTypes } (the same shape
// as getVariableSearchData) or a VariableSearchError, so searchVariables, the
// filters, and the table work the same for sample data and imported DSS files.
// Everything runs on the user's machine; nothing is sent to a server.
import { readDssCatalog, readDssSeries } from './dss/readDssCatalog.js';
import { WATER_YEAR_TYPES, waterYearOf } from './searchVariables.js';

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

// SCRUM-149: keep technical details out of the UI but available to developers.
// The console is the local log for now; SCRUM-178 adds the app's logs folder.
export function logSearchError(error) {
  console.error('[variable-search]', error.cause ?? error);
}

// CalSim 3 names most variables PREFIX_NODE, e.g. S_SHSTA is the storage at node SHSTA.
const nodeCategories = {
  S: 'Storage', C: 'Channel', D: 'Diversion', I: 'Inflow', R: 'Return flow', E: 'Evaporation',
};

// One DSS time series -> one search row. The DSS C part (the record's kind,
// e.g. STORAGE) is the component type; the B-part prefix is the node category.
function toVariable(run, { a, b, c, e, f, units, startMonth, endMonth }) {
  const split = b.indexOf('_');
  const prefix = split > 0 ? b.slice(0, split) : '';

  return {
    id: `${run.id}:/${a}/${b}/${c}//${e}/${f}/`,
    runId: run.id,
    runName: run.name,
    identifier: b,
    location: split > 0 ? b.slice(split + 1) : '',
    componentType: c,
    nodeCategory: nodeCategories[prefix] ?? (prefix || 'Other'),
    units,
    interval: e,
    startMonth,
    endMonth,
    dssPath: { a, b, c, e, f },
  };
}

// CalSim writes the Sacramento Valley water year type as WYT_SAC_, with
// values 1 (Wet) to 5 (Critical). Files without it have no year types.
async function readWaterYearTypes(file, catalog) {
  const series = catalog.find(entry => /^WYT_SAC_?$/i.test(entry.b));
  if (!series) return {};

  const types = {};
  for (const { date, value } of await readDssSeries(file, series)) {
    const type = WATER_YEAR_TYPES[Math.round(value) - 1];
    if (type) types[waterYearOf(date)] = type;
  }
  return types;
}

/**
 * SCRUM-159: read the variables and locations from an imported run's DSS file.
 *
 * @param {{ id: string, name: string, file: File }} run  imported run; file comes from the Import Data page
 * @returns {Promise<{ runs: object[], variables: object[], waterYearTypes: object }>}
 * @throws {VariableSearchError} kind 'dataUnavailable' when the file is missing, unreadable, or unsupported
 */
export async function loadDssVariables(run) {
  try {
    const catalog = await readDssCatalog(run.file);
    // A DSS file without time series (only paired data, for example) has nothing to search.
    if (catalog.length === 0) throw new Error(`No time series in ${run.file.name}`);

    return {
      runs: [run],
      // DSS files list records in storage order; sort so results read alphabetically.
      variables: catalog.map(entry => toVariable(run, entry))
        .sort((first, second) => first.identifier.localeCompare(second.identifier)),
      waterYearTypes: await readWaterYearTypes(run.file, catalog),
    };
  } catch (error) {
    throw new VariableSearchError('dataUnavailable', error);
  }
}

// The chart values for one imported variable.
export async function loadVariableSeries(variable, file) {
  try {
    return await readDssSeries(file, variable.dssPath);
  } catch (error) {
    throw new VariableSearchError('dataUnavailable', error);
  }
}
