// Prototype-only fixtures. Replace this module with an API-backed adapter when
// simulation-run metadata is available from the backend.
export const mockSimulationRuns = [
  {
    id: 'baseline-2025',
    name: 'Baseline 2025',
    startMonth: '2020-01',
    endMonth: '2025-12',
    variables: [
      'SAMPLE_SHASTA_STORAGE',
      'SAMPLE_OROVILLE_STORAGE',
      'DELTA_OUTFLOW',
    ],
  },
  {
    id: 'alternative-operations-a',
    name: 'Alternative Operations A',
    startMonth: '2019-01',
    endMonth: '2026-12',
    variables: [
      'SAMPLE_SHASTA_STORAGE',
      'SAMPLE_OROVILLE_STORAGE',
      'DELTA_OUTFLOW',
      'SAN_LUIS_STORAGE',
    ],
  },
  {
    id: 'alternative-operations-b',
    name: 'Alternative Operations B',
    startMonth: '2022-01',
    endMonth: '2027-06',
    variables: [
      'SAMPLE_SHASTA_STORAGE',
      'SAMPLE_OROVILLE_STORAGE',
    ],
  },
  {
    id: 'climate-stress-c',
    name: 'Climate Stress Test C',
    startMonth: '2021-04',
    endMonth: '2024-09',
    variables: ['SAMPLE_FOLSOM_STORAGE', 'SACRAMENTO_FLOW'],
  },
  {
    id: 'historical-drought',
    name: 'Historical Drought Study',
    startMonth: '2010-01',
    endMonth: '2015-12',
    variables: ['SAMPLE_SHASTA_STORAGE', 'DELTA_OUTFLOW'],
  },
];
