// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App.jsx';

afterEach(cleanup);

function openVariableSearch() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Search variables' }));
}

describe('Variable Search', () => {
  it('opens from Dashboard with an active run and the page layout', () => {
    openVariableSearch();

    expect(screen.getByRole('heading', { name: 'Variable and Location Search' })).toBeTruthy();
    expect(screen.getByText('Baseline 2025', { selector: 'p' })).toBeTruthy();
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
});
