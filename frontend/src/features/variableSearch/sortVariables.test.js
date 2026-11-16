import { describe, expect, it } from 'vitest';
import { sortVariables } from './sortVariables.js';

const rows = [
  { id: 'delta', identifier: 'D', location: 'Alpha', componentType: 'Storage', units: 'CFS', interval: '1MON', startMonth: '2010-12', endMonth: '2011-01' },
  { id: 'beta', identifier: 'b', location: 'Zulu', componentType: 'Channel', units: 'TAF', interval: '1DAY', startMonth: '2010-02', endMonth: '2010-11' },
  { id: 'alpha', identifier: 'A', location: 'echo', componentType: 'Flow', units: 'AF', interval: '1HOUR', startMonth: '2010-02', endMonth: '2010-03' },
];
const ids = items => items.map(item => item.id);

describe('sortVariables (SCRUM-194)', () => {
  it.each([
    ['identifier', ['alpha', 'beta', 'delta'], ['delta', 'beta', 'alpha']],
    ['location', ['delta', 'alpha', 'beta'], ['beta', 'alpha', 'delta']],
    ['componentType', ['beta', 'alpha', 'delta'], ['delta', 'alpha', 'beta']],
    ['units', ['alpha', 'delta', 'beta'], ['beta', 'delta', 'alpha']],
    ['interval', ['beta', 'alpha', 'delta'], ['delta', 'alpha', 'beta']],
    ['dateRange', ['alpha', 'beta', 'delta'], ['delta', 'beta', 'alpha']],
  ])('orders %s in both directions', (field, ascending, descending) => {
    expect(ids(sortVariables(rows, { field, direction: 'ascending' }))).toEqual(ascending);
    expect(ids(sortVariables(rows, { field, direction: 'descending' }))).toEqual(descending);
  });

  it('defaults to Identifier A–Z without changing the source array or row identities', () => {
    const original = Object.freeze(rows.map(row => Object.freeze({ ...row })));
    const sorted = sortVariables(original);
    expect(ids(sorted)).toEqual(['alpha', 'beta', 'delta']);
    expect(ids(original)).toEqual(['delta', 'beta', 'alpha']);
    expect(sorted[0]).toBe(original[2]);
  });

  it.each(['location', 'componentType', 'units', 'interval'])('keeps missing %s last in either direction', field => {
    const items = [
      { id: 'missing', identifier: 'A', [field]: null },
      { id: 'zulu', identifier: 'Z', [field]: 'Zulu' },
      { id: 'empty', identifier: 'B', [field]: '' },
      { id: 'alpha', identifier: 'C', [field]: 'alpha' },
    ];
    expect(ids(sortVariables(items, { field }))).toEqual(['alpha', 'zulu', 'missing', 'empty']);
    expect(ids(sortVariables(items, { field, direction: 'descending' }))).toEqual(['zulu', 'alpha', 'missing', 'empty']);
  });

  it('keeps incomplete date ranges last and compares equal starts by end date', () => {
    const items = [
      { id: 'missing', identifier: 'A', startMonth: '1900-01', endMonth: '' },
      ...rows,
    ];
    expect(ids(sortVariables(items, { field: 'dateRange' }))).toEqual(['alpha', 'beta', 'delta', 'missing']);
    expect(ids(sortVariables(items, { field: 'dateRange', direction: 'descending' }))).toEqual(['delta', 'beta', 'alpha', 'missing']);
  });

  it('breaks equal values consistently by identifier, run and full row identity', () => {
    const items = [
      { id: 'path-b', runId: 'run-1', identifier: 'S_SHSTA', units: 'TAF' },
      { id: 'run-two', runId: 'run-2', identifier: 'S_SHSTA', units: 'TAF' },
      { id: 'path-a', runId: 'run-1', identifier: 'S_SHSTA', units: 'TAF' },
      { id: 'channel', runId: 'run-2', identifier: 'C_SAC', units: 'TAF' },
    ];
    for (const direction of ['ascending', 'descending']) {
      expect(ids(sortVariables(items, { field: 'units', direction }))).toEqual(['channel', 'path-a', 'path-b', 'run-two']);
    }
    expect(sortVariables([], { field: 'dateRange' })).toEqual([]);
  });
});
