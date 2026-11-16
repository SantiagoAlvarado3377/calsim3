// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import CompareRuns from './CompareRuns.jsx';

afterEach(cleanup);

it('preserves the Variable Search handoff while applying a comparison', async () => {
  const compare = vi.fn().mockResolvedValue({
    ok: false,
    error: { message: 'No paired observations available.' },
  });
  const analysisSelection = {
    variable: { identifier: 'S_SHSTA', units: 'TAF', interval: '1MON' },
    run: { name: 'Imported run', file: new File([], 'imported.dss') },
  };
  render(<CompareRuns compare={compare} analysisSelection={analysisSelection} />);

  const receipt = within(screen.getByRole('region', { name: 'Selected analysis input' }));
  expect(receipt.getByText('S_SHSTA')).toBeTruthy();
  expect(receipt.getByText('Imported run')).toBeTruthy();
  expect(receipt.getByText('imported.dss')).toBeTruthy();

  fireEvent.click(screen.getByRole('button', { name: 'Apply Comparison' }));
  expect(compare).toHaveBeenCalledWith({
    baselineRunId: 'baseline-2025',
    alternativeRunId: 'alternative-operations-a',
    variableId: 'SAMPLE_SHASTA_STORAGE',
    range: { start: '2020-01', end: '2025-12' },
  });
  expect((await screen.findByRole('alert')).textContent).toBe('No paired observations available.');
  expect(receipt.getByText('S_SHSTA')).toBeTruthy();
});

function run(id, startMonth, endMonth) {
  return {
    id,
    name: id,
    startMonth,
    endMonth,
    variables: ['STORAGE'],
  };
}

function renderSummary(runs) {
  render(<CompareRuns runs={runs} />);
  return within(screen.getByRole('complementary', {
    name: 'Prototype comparison summary',
  }));
}

describe('comparison calendar overlap status', () => {
  it('shows the actual overlapping calendar range and its data-availability limit', () => {
    const summary = renderSummary([
      run('baseline-2025', '2020-01', '2025-12'),
      run('alternative-operations-a', '2022-03', '2026-06'),
    ]);

    fireEvent.click(screen.getByRole('button', { name: /Overlapping dates/ }));
    fireEvent.change(screen.getByLabelText('Start month'), {
      target: { value: '2023-01' },
    });

    expect(screen.getByText('Jan 2023 – Dec 2025')).toBeTruthy();
    expect(summary.getByText('Calendar overlap: Mar 2022 – Dec 2025')).toBeTruthy();
    expect(summary.getByText(
      'Calendar coverage only; paired time-series data availability is not confirmed.',
    )).toBeTruthy();
  });

  it('shows a one-month calendar overlap without widening the range', () => {
    const summary = renderSummary([
      run('baseline-2025', '2024-05', '2024-05'),
      run('alternative-operations-a', '2024-01', '2024-12'),
    ]);

    expect(summary.getByText('Calendar overlap: May 2024 – May 2024')).toBeTruthy();
  });

  it('shows a clear message when the calendar ranges do not overlap', () => {
    const summary = renderSummary([
      run('baseline-2025', '2020-01', '2020-12'),
      run('alternative-operations-a', '2021-01', '2021-12'),
    ]);

    expect(summary.getByText('No calendar date overlap')).toBeTruthy();
  });

  it('reports invalid date coverage without calling it a no-overlap result', () => {
    const summary = renderSummary([
      run('baseline-2025', '2024-13', '2024-12'),
      run('alternative-operations-a', '2024-01', '2024-12'),
    ]);

    expect(summary.getByText('Calendar overlap unavailable: invalid date coverage')).toBeTruthy();
    expect(summary.queryByText('No calendar date overlap')).toBeNull();
  });
});
