import { mockSimulationRuns } from './mockSimulationRuns.js';

// Sample metadata only. The existing run fixtures supply run IDs and date ranges.
const variableMetadata = {
  SAMPLE_SHASTA_STORAGE: { location: 'Shasta Lake', category: 'Storage', units: 'TAF', interval: '1MON' },
  SAMPLE_OROVILLE_STORAGE: { location: 'Lake Oroville', category: 'Storage', units: 'TAF', interval: '1MON' },
  DELTA_OUTFLOW: { location: 'Sacramento–San Joaquin Delta', category: 'Flow', units: 'CFS', interval: '1MON' },
  SAN_LUIS_STORAGE: { location: 'San Luis Reservoir', category: 'Storage', units: 'TAF', interval: '1MON' },
  SAMPLE_FOLSOM_STORAGE: { location: 'Folsom Lake', category: 'Storage', units: 'TAF', interval: '1MON' },
  SACRAMENTO_FLOW: { location: 'Sacramento River', category: 'Flow', units: 'CFS', interval: '1DAY' },
};

// Keep mock data access here so a later story can replace it with the real API.
export function getVariableSearchData() {
  const variables = mockSimulationRuns.flatMap(run => run.variables.map(identifier => ({
    id: `${run.id}:${identifier}`,
    runId: run.id,
    runName: run.name,
    identifier,
    ...variableMetadata[identifier],
    startMonth: run.startMonth,
    endMonth: run.endMonth,
  })));

  return { runs: mockSimulationRuns, variables };
}

// Repeating seasonal values make the mock chart predictable across page visits.
// The later API story can replace this function as well as the metadata function.
export function getVariableChartData(variable) {
  const baseValues = {
    SAMPLE_SHASTA_STORAGE: 3200,
    SAMPLE_OROVILLE_STORAGE: 2400,
    DELTA_OUTFLOW: 14000,
    SAN_LUIS_STORAGE: 1600,
    SAMPLE_FOLSOM_STORAGE: 700,
    SACRAMENTO_FLOW: 18000,
  };
  const seasonalFactors = [0.85, 0.95, 1.1, 1.2, 1.15, 1.05, 0.9, 0.8, 0.75, 0.8, 0.9, 0.95];
  const runIndex = mockSimulationRuns.findIndex(run => run.id === variable.runId);
  const date = new Date(`${variable.startMonth}-01T00:00:00Z`);
  const [endYear, endMonth] = variable.endMonth.split('-').map(Number);
  const lastDate = new Date(Date.UTC(endYear, endMonth, 0));
  const series = [];

  while (date <= lastDate) {
    series.push({
      date: date.toISOString().slice(0, 10),
      value: Math.round(baseValues[variable.identifier] * seasonalFactors[date.getUTCMonth()] * (1 + runIndex * 0.04)),
    });

    if (variable.interval === '1DAY') date.setUTCDate(date.getUTCDate() + 1);
    else date.setUTCMonth(date.getUTCMonth() + 1);
  }

  return series;
}
