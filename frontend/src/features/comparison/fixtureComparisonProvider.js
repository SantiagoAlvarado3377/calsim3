// Synthetic monthly observations for the comparison prototype.
// These values are deterministic UI/test fixtures, not imported or production CalSim3 results.
import { mockSimulationRuns } from '../../data/mockSimulationRuns.js';
import { compareMonthlyRuns } from './comparisonService.js';

const FIXTURE_SOURCE = {
  kind: 'fixture',
  label: 'Synthetic fixture data — not imported CalSim3 results',
};

const variableMetadata = {
  SAMPLE_SHASTA_STORAGE: { units: 'TAF', baseValue: 438 },
  SAMPLE_OROVILLE_STORAGE: { units: 'TAF', baseValue: 612 },
  DELTA_OUTFLOW: { units: 'CFS', baseValue: 8450 },
  SAN_LUIS_STORAGE: { units: 'TAF', baseValue: 835 },
  SAMPLE_FOLSOM_STORAGE: { units: 'TAF', baseValue: 274 },
  SACRAMENTO_FLOW: { units: 'CFS', baseValue: 12750 },
};

const runOffsets = {
  'baseline-2025': 0,
  'alternative-operations-a': 18,
  'alternative-operations-b': 31,
  'climate-stress-c': -14,
  'historical-drought': -28,
};

// Intentional gaps exercise paired-data availability separately from calendar coverage.
const missingFixtures = new Map([
  ['baseline-2025|SAMPLE_SHASTA_STORAGE|2022-02', 'omit'],
  ['alternative-operations-a|SAMPLE_SHASTA_STORAGE|2022-03', null],
]);

function monthNumber(month) {
  const [year, monthValue] = month.split('-').map(Number);
  return year * 12 + monthValue - 1;
}

function monthsBetween(start, end) {
  const months = [];
  let current = monthNumber(start);
  const final = monthNumber(end);

  while (current <= final) {
    const year = Math.floor(current / 12);
    const month = current % 12 + 1;
    months.push(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`);
    current += 1;
  }

  return months;
}

function fixtureValue(runId, variableId, month) {
  const { baseValue } = variableMetadata[variableId];
  const monthTrend = (monthNumber(month) - monthNumber('2020-01')) * 0.1;
  return Number((baseValue + runOffsets[runId] + monthTrend).toFixed(1));
}

function observationsFor(run, variableId) {
  const observations = [];

  for (const month of monthsBetween(run.startMonth, run.endMonth)) {
    const fixtureKey = `${run.id}|${variableId}|${month}`;
    if (missingFixtures.get(fixtureKey) === 'omit') continue;

    observations.push({
      month,
      value: missingFixtures.has(fixtureKey)
        ? missingFixtures.get(fixtureKey)
        : fixtureValue(run.id, variableId, month),
    });
  }

  return observations;
}

export const fixtureComparisonProvider = {
  async getMonthlySeries({ runId, variableId }) {
    const run = mockSimulationRuns.find(candidate => candidate.id === runId);
    if (!run) return { status: 'run-not-found' };
    if (!run.variables.includes(variableId) || !variableMetadata[variableId]) {
      return { status: 'variable-not-found' };
    }

    return {
      status: 'ok',
      series: {
        runId,
        variableId,
        startMonth: run.startMonth,
        endMonth: run.endMonth,
        units: variableMetadata[variableId].units,
        frequency: 'monthly',
        observations: observationsFor(run, variableId),
        source: { ...FIXTURE_SOURCE },
      },
    };
  },
};

export function compareFixtureMonthlyRuns(request) {
  return compareMonthlyRuns(request, fixtureComparisonProvider);
}
