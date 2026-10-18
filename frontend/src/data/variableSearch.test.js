import { describe, expect, it } from 'vitest';
import { getVariableChartData, getVariableSearchData } from './variableSearch.js';

describe('Variable Search mock data', () => {
  it('provides complete metadata for every variable in the shared run fixtures', () => {
    const { variables, runs } = getVariableSearchData();
    expect(new Set(variables.map(variable => variable.id)).size).toBe(variables.length);

    for (const variable of variables) {
      for (const field of ['identifier', 'location', 'category', 'units', 'interval', 'startMonth', 'endMonth', 'runName']) {
        expect(variable[field]).toBeTruthy();
      }
      expect(runs.find(run => run.id === variable.runId).variables).toContain(variable.identifier);
    }
  });

  it('supplies monthly chart values for the selected variable and run date range', () => {
    const { variables } = getVariableSearchData();
    const variable = variables.find(item => item.id === 'baseline-2025:SAMPLE_SHASTA_STORAGE');
    const series = getVariableChartData(variable);

    expect(series).toHaveLength(72);
    expect(series[0].date).toBe('2020-01-01');
    expect(series.at(-1).date).toBe('2025-12-01');
    expect(series.every(point => Number.isFinite(point.value))).toBe(true);
  });

  it('supplies a point for every day in a daily variable’s date range', () => {
    const { variables } = getVariableSearchData();
    const variable = variables.find(item => item.identifier === 'SACRAMENTO_FLOW');
    const series = getVariableChartData(variable);

    expect(series[0].date).toBe('2021-04-01');
    expect(series.at(-1).date).toBe('2024-09-30');
    for (let index = 1; index < series.length; index += 1) {
      expect(new Date(series[index].date) - new Date(series[index - 1].date)).toBe(24 * 60 * 60 * 1000);
    }
  });

  it('keeps charts deterministic and distinct for different variables and runs', () => {
    const { variables } = getVariableSearchData();
    const baseline = variables.find(item => item.id === 'baseline-2025:SAMPLE_SHASTA_STORAGE');
    const alternative = variables.find(item => item.id === 'alternative-operations-a:SAMPLE_SHASTA_STORAGE');
    const oroville = variables.find(item => item.id === 'baseline-2025:SAMPLE_OROVILLE_STORAGE');

    expect(getVariableChartData(baseline)).toEqual(getVariableChartData(baseline));
    expect(getVariableChartData(baseline)[0].value).not.toBe(getVariableChartData(alternative)[0].value);
    expect(getVariableChartData(baseline)[0].value).not.toBe(getVariableChartData(oroville)[0].value);
  });
});
