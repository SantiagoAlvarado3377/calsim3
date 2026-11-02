// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App.jsx';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function openVariableSearch(importedRuns) {
  render(<App importedRuns={importedRuns} />);
  fireEvent.click(screen.getByRole('button', { name: 'Search variables' }));
}

describe('Variable Search', () => {
  it('opens from Dashboard with an active run and the page layout', () => {
    openVariableSearch();

    expect(screen.getByRole('heading', { name: 'Variable and Location Search' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Active run:' }).disabled).toBe(true);
    expect(screen.getByRole('searchbox', { name: 'Keyword' })).toBeTruthy();
    for (const name of ['Run', 'Category', 'Units', 'Interval']) {
      expect(screen.getByRole('combobox', { name })).toBeTruthy();
    }
    expect(screen.getByRole('table', { name: 'Variable search results' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear Filters' })).toBeTruthy();
  });

  it('connects the action buttons to the existing pages and supports returning', () => {
    openVariableSearch();
    fireEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Compare Runs' }));
    expect(screen.getByRole('heading', { name: 'Compare Simulation Runs' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Variable Search' }));
    fireEvent.click(screen.getByRole('button', { name: 'Analyze Anomalies' }));
    expect(screen.getByRole('heading', { name: 'Anomaly Detection' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Return to variable search' }));
    expect(screen.getByRole('heading', { name: 'Variable and Location Search' })).toBeTruthy();
  });

  it('waits for Search before matching identifiers, ignoring case and surrounding spaces', () => {
    openVariableSearch();
    const table = screen.getByRole('table');
    const initialRowCount = within(table).getAllByRole('row').length;

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '  sample_oroville_storage  ' } });
    expect(within(table).getAllByRole('row')).toHaveLength(initialRowCount);
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));

    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getAllByText('SAMPLE_OROVILLE_STORAGE')).toHaveLength(3);
    expect(within(table).queryByText('DELTA_OUTFLOW')).toBeNull();
  });

  it('matches mapped locations on form submission and restores all results for a blank keyword', () => {
    openVariableSearch();
    const input = screen.getByRole('searchbox');
    fireEvent.change(input, { target: { value: 'san luis reservoir' } });
    // Enter in the search field uses this same form submit handler.
    fireEvent.submit(screen.getByRole('search'));

    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('SAN_LUIS_STORAGE')).toBeTruthy();

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(14);
  });

  it('finds storage identifiers with a partial keyword', () => {
    openVariableSearch();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'storage' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));

    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(10);
    expect(screen.queryByText('DELTA_OUTFLOW')).toBeNull();
  });

  it.each([
    ['Run', 'alternative-operations-a', 4],
    ['Category', 'Flow', 4],
    ['Units', 'TAF', 9],
    ['Interval', '1DAY', 1],
  ])('filters by %s immediately', (name, value, expectedCount) => {
    openVariableSearch();
    fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(expectedCount + 1);
  });

  it('combines the keyword and all filters, then clears only the dropdowns', () => {
    openVariableSearch();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'storage' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
    for (const [name, value] of [
      ['Run', 'climate-stress-c'], ['Category', 'Storage'], ['Units', 'TAF'], ['Interval', '1MON'],
    ]) {
      fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });
    }
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('SAMPLE_FOLSOM_STORAGE')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    for (const name of ['Run', 'Category', 'Units', 'Interval']) {
      expect(screen.getByRole('combobox', { name }).value).toBe('');
    }
    expect(screen.getByRole('searchbox').value).toBe('storage');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(10);
  });

  it('keeps an unsubmitted keyword from being applied by a dropdown change', () => {
    openVariableSearch();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Shasta' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Run' }), { target: { value: 'baseline-2025' } });
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(4);
    expect(screen.getByText('DELTA_OUTFLOW')).toBeTruthy();
  });

  it('keeps the matching count in sync with visible rows after search, filtering, and reset', () => {
    openVariableSearch();
    expect(screen.getByRole('status').textContent).toBe('13 matching variables');

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'storage' } });
    expect(screen.getByRole('status').textContent).toBe('13 matching variables');
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
    expect(screen.getByRole('status').textContent).toBe('9 matching variables');

    fireEvent.change(screen.getByRole('combobox', { name: 'Run' }), { target: { value: 'climate-stress-c' } });
    expect(screen.getByRole('status').textContent).toBe('1 matching variable');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(screen.getByRole('status').textContent).toBe('9 matching variables');
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(10);
  });

  it('renders every results column with the correct run metadata and chart control', () => {
    openVariableSearch();
    fireEvent.change(screen.getByRole('combobox', { name: 'Run' }), { target: { value: 'historical-drought' } });
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map(header => header.textContent)).toEqual([
      'Identifier', 'Location', 'Category', 'Units', 'Interval', 'Date range', 'Action',
    ]);

    const storageRow = within(table).getByRole('row', { name: /SAMPLE_SHASTA_STORAGE/ });
    for (const text of ['Historical Drought Study', 'Shasta Lake', 'Storage', 'TAF', '1MON', 'Jan 2010 – Dec 2015']) {
      expect(within(storageRow).getByText(text)).toBeTruthy();
    }
    expect(within(storageRow).getByRole('button', {
      name: 'View Chart for SAMPLE_SHASTA_STORAGE in Historical Drought Study',
    })).toBeTruthy();

    const flowRow = within(table).getByRole('row', { name: /DELTA_OUTFLOW/ });
    expect(within(flowRow).getByText('CFS')).toBeTruthy();
    expect(within(flowRow).getByText('Flow')).toBeTruthy();
  });

  it.each([
    ['SAMPLE_SHASTA_STORAGE', 'historical-drought', 'Historical Drought Study', 'Shasta Lake', 'Storage', 'TAF', '1MON', 'Jan 2010 – Dec 2015'],
    ['DELTA_OUTFLOW', 'baseline-2025', 'Baseline 2025', 'Sacramento–San Joaquin Delta', 'Flow', 'CFS', '1MON', 'Jan 2020 – Dec 2025'],
    ['SACRAMENTO_FLOW', 'climate-stress-c', 'Climate Stress Test C', 'Sacramento River', 'Flow', 'CFS', '1DAY', 'Apr 2021 – Sep 2024'],
  ])('opens %s details and returns to the same search and focused row', (identifier, runId, runName, location, category, units, interval, dateRange) => {
    openVariableSearch();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: identifier } });
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Run' }), { target: { value: runId } });
    const chartButton = screen.getByRole('button', { name: `View Chart for ${identifier} in ${runName}` });
    fireEvent.click(chartButton);

    const details = screen.getByRole('region', { name: 'Variable details' });
    for (const text of [identifier, runName, location, category, units, interval, dateRange]) {
      expect(within(details).getByText(text, { selector: 'dd' })).toBeTruthy();
    }
    expect(screen.getByRole('img', { name: `${identifier} in ${runName}` })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Variable details' }));
    expect(screen.queryByRole('table')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Return to variable search' }));
    expect(screen.getByRole('searchbox').value).toBe(identifier);
    expect(screen.getByRole('combobox', { name: 'Run' }).value).toBe(runId);
    expect(screen.getByRole('status').textContent).toBe('1 matching variable');
    expect(document.activeElement).toBe(chartButton);
  });

  it('keeps the workspace active-run header separate from the local run filter', () => {
    openVariableSearch([{ id: 'alternative-operations-a', name: 'Alternative Operations A' }]);
    fireEvent.change(screen.getByRole('combobox', { name: 'Run' }), { target: { value: 'historical-drought' } });
    expect(screen.getByRole('combobox', { name: 'Active run:' }).value).toBe('alternative-operations-a');
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(screen.getByRole('combobox', { name: 'Active run:' }).value).toBe('alternative-operations-a');
  });

  it('replaces the table with an empty state and resets the whole search (SCRUM-148, SCRUM-162)', () => {
    openVariableSearch();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no such variable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));

    expect(screen.getByText('No variables match your search.')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('0 matching variables');

    fireEvent.click(screen.getByRole('button', { name: 'Reset Search' }));
    expect(screen.getByRole('searchbox').value).toBe('');
    expect(document.activeElement).toBe(screen.getByRole('searchbox'));
    expect(screen.getByRole('status').textContent).toBe('13 matching variables');
  });

  it('shows loading, then a recoverable error for an imported file it cannot read (SCRUM-149, SCRUM-150, SCRUM-158)', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    openVariableSearch([{ id: 'run-1', name: 'Run 1', file: new File(['not dss'], 'run1.dss') }]);
    expect(screen.getByRole('status').textContent).toBe('Loading variables from run1.dss…');

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Unable to read the imported data file. Please re-import the DSS file and try again.');
    expect(alert.textContent).not.toContain('not implemented');
    expect(log).toHaveBeenCalled();

    fireEvent.click(within(alert).getByRole('button', { name: 'Retry Search' }));
    expect(screen.getByRole('status')).toBeTruthy();
    fireEvent.click(within(await screen.findByRole('alert')).getByRole('button', { name: 'Re-import File' }));
    expect(screen.getByRole('heading', { name: 'Import Data' })).toBeTruthy();
  });
});

// Sprint 2 work the scaffold leaves open.
describe('Variable Search follow-ups', () => {
  it.todo('SCRUM-159: lists the variables and locations parsed from an imported DSS file');
  it.todo('SCRUM-160: filters by Component Type, Node Category, and Water Year Type');
  it.todo('SCRUM-161: pages through large result sets');
  it.todo('SCRUM-163: prompts for an import when no DSS file is loaded');
  it.todo('SCRUM-149: shows the search-failed message and Try Again for a failed search');
});
