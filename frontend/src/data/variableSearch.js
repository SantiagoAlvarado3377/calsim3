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
