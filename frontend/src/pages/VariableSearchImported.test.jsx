// @vitest-environment jsdom
// Variable Search with an imported DSS file (SCRUM-146, SCRUM-147).
// These tests swap the DSS reader for a fake one so they can shape the data;
// the reader itself is tested against real DSS files in readDssCatalog.test.js.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App.jsx';
import { readDssCatalog, readDssSeries } from '../features/variableSearch/dss/readDssCatalog.js';
import { searchVariables } from '../features/variableSearch/searchVariables.js';

vi.mock('../features/variableSearch/dss/readDssCatalog.js', () => ({
  readDssCatalog: vi.fn(),
  readDssSeries: vi.fn(),
}));

// Wrap the real search so one test can make it fail.
vi.mock('../features/variableSearch/searchVariables.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, searchVariables: vi.fn(actual.searchVariables) };
});

const series = (b, c, units = 'CFS') => ({
  a: 'CALSIM', b, c, e: '1MON', f: 'L2020A', units, dataType: 'PER-AVER', startMonth: '1921-10', endMonth: '2021-09',
});

// 30 channels, 30 storages, the water year types, and a name without a prefix.
const catalog = [
  ...Array.from({ length: 30 }, (_, index) => series(`C_SAC${String(index).padStart(3, '0')}`, 'CHANNEL')),
  ...Array.from({ length: 30 }, (_, index) => series(`S_RES${String(index).padStart(2, '0')}`, 'STORAGE', 'TAF')),
  series('WYT_SAC_', 'WATERYEARTYPE', 'NONE'),
  series('DELTAINDEX', 'INDEX', ''),
];

// Water years 1922–2021: Wet (1) when the year ends in 0, otherwise Dry (4).
const waterYearValues = Array.from({ length: 100 }, (_, index) => ({
  date: `${1922 + index}-09-30`, value: (1922 + index) % 10 === 0 ? 1 : 4,
}));

const chartValues = [
  { date: '1921-10-31', value: 120 },
  { date: '1921-11-30', value: -40 },
  { date: '1921-12-31', value: 300 },
];

let log;

beforeEach(() => {
  log = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(readDssCatalog).mockResolvedValue(catalog);
  vi.mocked(readDssSeries).mockImplementation(async (file, { b }) => (b === 'WYT_SAC_' ? waterYearValues : chartValues));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const importedFile = new File(['dss bytes'], 'run1.dss');

function openImportedRun() {
  render(<App importedRuns={[{ id: 'run-1', name: 'Run 1', file: importedFile }]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Search variables' }));
}

function visibleIdentifiers() {
  return within(screen.getByRole('table')).getAllByRole('row').slice(1)
    .map(row => within(row).getByRole('rowheader').firstChild.textContent);
}

describe('Variable Search with an imported DSS file', () => {
  it.each([
    ['Identifier', ['A_ECHO', 'B_ZULU', 'D_ALPHA'], ['D_ALPHA', 'B_ZULU', 'A_ECHO']],
    ['Location', ['D_ALPHA', 'A_ECHO', 'B_ZULU'], ['B_ZULU', 'A_ECHO', 'D_ALPHA']],
    ['Component Type', ['B_ZULU', 'A_ECHO', 'D_ALPHA'], ['D_ALPHA', 'A_ECHO', 'B_ZULU']],
    ['Units', ['A_ECHO', 'D_ALPHA', 'B_ZULU'], ['B_ZULU', 'D_ALPHA', 'A_ECHO']],
    ['Interval', ['B_ZULU', 'A_ECHO', 'D_ALPHA'], ['D_ALPHA', 'A_ECHO', 'B_ZULU']],
    ['Date range', ['A_ECHO', 'B_ZULU', 'D_ALPHA'], ['D_ALPHA', 'B_ZULU', 'A_ECHO']],
  ])('sorts the imported %s column with accessible direction and action labels (SCRUM-194)', async (label, ascending, descending) => {
    vi.mocked(readDssCatalog).mockResolvedValue([
      { ...series('D_ALPHA', 'Storage', 'CFS'), e: '1MON', startMonth: '2010-12', endMonth: '2011-01' },
      { ...series('B_ZULU', 'Channel', 'TAF'), e: '1DAY', startMonth: '2010-02', endMonth: '2010-11' },
      { ...series('A_ECHO', 'Flow', 'AF'), e: '1HOUR', startMonth: '2010-02', endMonth: '2010-03' },
    ]);
    openImportedRun();
    await screen.findByText('3 matching variables');
    expect(visibleIdentifiers()).toEqual(['A_ECHO', 'B_ZULU', 'D_ALPHA']);
    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Identifier' }).getAttribute('aria-sort')).toBe('ascending');
    expect(within(table).getAllByRole('button', { name: /: sort / })).toHaveLength(6);
    expect(within(table).getByRole('columnheader', { name: 'Action' }).getAttribute('aria-sort')).toBeNull();

    if (label !== 'Identifier') fireEvent.click(within(table).getByRole('button', { name: `${label}: sort ascending` }));
    expect(visibleIdentifiers()).toEqual(ascending);
    const button = within(table).getByRole('button', { name: `${label}: sort descending` });
    fireEvent.click(button);
    expect(visibleIdentifiers()).toEqual(descending);
    expect(button.getAttribute('aria-label')).toBe(`${label}: sort ascending`);
    expect(button.closest('th').getAttribute('aria-sort')).toBe('descending');
    expect(table.querySelectorAll('th[aria-sort]')).toHaveLength(1);
    expect(button.querySelector('[aria-hidden="true"]').textContent).toBe('↓');
    fireEvent.click(button);
    expect(visibleIdentifiers()).toEqual(ascending);
    expect(button.querySelector('[aria-hidden="true"]').textContent).toBe('↑');
  });

  it('sorts the whole matching catalog before paging, resets page on sort, and retains sort through search and reset (SCRUM-194)', async () => {
    openImportedRun();
    await screen.findByText('62 matching variables');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Page 2 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Identifier: sort descending' }));
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
    expect(visibleIdentifiers().slice(0, 3)).toEqual(['WYT_SAC_', 'S_RES29', 'S_RES28']);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(visibleIdentifiers().slice(0, 3)).toEqual(['S_RES05', 'S_RES04', 'S_RES03']);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'RES0' } });
    // A draft keyword does not replace the existing results or page.
    expect(screen.getByText('Page 2 of 3')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
    expect(visibleIdentifiers()).toEqual(['S_RES09', 'S_RES08', 'S_RES07', 'S_RES06', 'S_RES05', 'S_RES04', 'S_RES03', 'S_RES02', 'S_RES01', 'S_RES00']);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'no matches' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
    expect(screen.getByText('No variables match your search.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset Search' }));
    expect(visibleIdentifiers().slice(0, 3)).toEqual(['WYT_SAC_', 'S_RES29', 'S_RES28']);
    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
  });

  it.each([
    ['Run', 'run-1', 'WYT_SAC_'],
    ['Component Type', 'STORAGE', 'S_RES29'],
    ['Node Category', 'Storage', 'S_RES29'],
    ['Units', 'TAF', 'S_RES29'],
    ['Interval', '1MON', 'WYT_SAC_'],
    ['Water Year Type', 'Wet', 'WYT_SAC_'],
  ])('retains sorting when %s changes and when filters are cleared (SCRUM-194)', async (label, value, first) => {
    openImportedRun();
    await screen.findByText('62 matching variables');
    fireEvent.click(screen.getByRole('button', { name: 'Identifier: sort descending' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('combobox', { name: label }), { target: { value } });
    expect(visibleIdentifiers()[0]).toBe(first);
    expect(screen.getByRole('button', { name: 'Identifier: sort ascending' }).closest('th').getAttribute('aria-sort')).toBe('descending');
    expect(screen.getByRole('button', { name: 'Previous' }).disabled).toBe(true);
    if (label === 'Water Year Type') {
      expect(screen.getByText('Date range sorting uses full date coverage, even when water year counts are shown.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Date range: sort ascending' }).getAttribute('aria-describedby')).toBe('variable-date-sort-note');
    }
    fireEvent.click(screen.getByRole('button', { name: 'Clear Filters' }));
    expect(visibleIdentifiers()[0]).toBe('WYT_SAC_');
    expect(screen.getByRole('columnheader', { name: 'Identifier' }).getAttribute('aria-sort')).toBe('descending');
  });

  it('keeps sorting when page size changes or a chart closes, including return focus (SCRUM-194)', async () => {
    openImportedRun();
    await screen.findByText('62 matching variables');
    fireEvent.click(screen.getByRole('button', { name: 'Identifier: sort descending' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Rows per page' }), { target: { value: '50' } });
    expect(visibleIdentifiers()).toHaveLength(50);
    expect(visibleIdentifiers()[0]).toBe('WYT_SAC_');
    const chartButton = screen.getByRole('button', { name: 'View Chart for S_RES29 in Run 1' });
    fireEvent.click(chartButton);
    await screen.findByRole('img', { name: 'S_RES29 in Run 1' });
    fireEvent.click(screen.getByRole('button', { name: 'Return to variable search' }));
    expect(visibleIdentifiers()[0]).toBe('WYT_SAC_');
    expect(screen.getByRole('combobox', { name: 'Rows per page' }).value).toBe('50');
    expect(document.activeElement).toBe(chartButton);
  });

  it('lists the variables and locations read from the file (SCRUM-159)', async () => {
    openImportedRun();
    expect(screen.getByRole('status').textContent).toBe('Loading variables from run1.dss…');

    expect(await screen.findByText('62 matching variables')).toBeTruthy();
    expect(readDssCatalog).toHaveBeenCalledWith(importedFile);
    expect(screen.queryByText(/Showing sample data/)).toBeNull();

    // Rows are sorted by identifier, so the channels come first.
    const firstRows = within(screen.getByRole('table')).getAllByRole('row').slice(1, 3);
    expect(firstRows.map(row => within(row).getByRole('rowheader').firstChild.textContent)).toEqual(['C_SAC000', 'C_SAC001']);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'res00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
    const row = screen.getByRole('row', { name: /S_RES00/ });
    for (const text of ['Run 1', 'RES00', 'STORAGE', 'TAF', '1MON', 'Oct 1921 – Sep 2021']) {
      expect(within(row).getByText(text)).toBeTruthy();
    }

    const nodeCategories = within(screen.getByRole('combobox', { name: 'Node Category' })).getAllByRole('option');
    expect(nodeCategories.map(option => option.textContent)).toEqual(['All node categories', 'Channel', 'Other', 'Storage', 'WYT']);

    // Keyword search matches the location (node) part of the name too.
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'deltaindex' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
    const deltaRow = screen.getByRole('row', { name: /DELTAINDEX/ });
    expect(within(deltaRow).getAllByText('—')).toHaveLength(2); // no location, no units
  });

  it('pages through large result sets and returns to page 1 when the results change (SCRUM-161)', async () => {
    openImportedRun();
    await screen.findByText('62 matching variables');
    const pager = screen.getByRole('navigation', { name: 'Results pages' });

    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(26);
    expect(within(pager).getByText('1–25 of 62')).toBeTruthy();
    expect(within(pager).getByRole('button', { name: 'Previous' }).disabled).toBe(true);

    fireEvent.click(within(pager).getByRole('button', { name: 'Next' }));
    expect(within(pager).getByText('26–50 of 62')).toBeTruthy();
    expect(within(pager).getByText('Page 2 of 3')).toBeTruthy();
    fireEvent.click(within(pager).getByRole('button', { name: 'Next' }));
    expect(within(pager).getByRole('button', { name: 'Next' }).disabled).toBe(true);
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(13);

    fireEvent.change(within(pager).getByRole('combobox', { name: 'Rows per page' }), { target: { value: '50' } });
    expect(within(pager).getByText('1–50 of 62')).toBeTruthy();

    fireEvent.click(within(pager).getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Node Category' }), { target: { value: 'Storage' } });
    expect(screen.getByRole('status').textContent).toBe('30 matching variables');
    expect(screen.getByText('1–30 of 30')).toBeTruthy();

    // 25 or fewer results don't need a pager.
    fireEvent.change(screen.getByRole('combobox', { name: 'Units' }), { target: { value: 'CFS' } });
    expect(screen.getByText('No variables match your search.')).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Results pages' })).toBeNull();
  });

  it('filters by the water year types read from WYT_SAC_ (SCRUM-160)', async () => {
    openImportedRun();
    await screen.findByText('62 matching variables');
    expect(readDssSeries).toHaveBeenCalledWith(importedFile, expect.objectContaining({ b: 'WYT_SAC_' }));

    const waterYearType = screen.getByRole('combobox', { name: 'Water Year Type' });
    fireEvent.change(waterYearType, { target: { value: 'Wet' } });
    expect(within(screen.getByRole('row', { name: /C_SAC000/ })).getByText('10 Wet water years')).toBeTruthy();

    fireEvent.change(waterYearType, { target: { value: 'Critical' } });
    expect(screen.getByText('No variables match your search.')).toBeTruthy();
  });

  it('disables the water year filter when the file has no WYT_SAC_ series', async () => {
    vi.mocked(readDssCatalog).mockResolvedValue(catalog.filter(entry => entry.b !== 'WYT_SAC_'));
    openImportedRun();
    await screen.findByText('61 matching variables');

    const waterYearType = screen.getByRole('combobox', { name: 'Water Year Type' });
    expect(waterYearType.disabled).toBe(true);
    expect(waterYearType.textContent).toBe('Not in this file');
  });

  it('charts an imported variable from the values in its DSS file', async () => {
    openImportedRun();
    await screen.findByText('62 matching variables');
    fireEvent.click(screen.getByRole('button', { name: 'View Chart for C_SAC000 in Run 1' }));

    expect(screen.getByText('Loading values…')).toBeTruthy();
    const chart = await screen.findByRole('img', { name: 'C_SAC000 in Run 1' });
    expect(readDssSeries).toHaveBeenCalledWith(importedFile, { a: 'CALSIM', b: 'C_SAC000', c: 'CHANNEL', e: '1MON', f: 'L2020A' });
    // Negative values get room below zero.
    expect(within(chart).getByText('-40')).toBeTruthy();
    expect(within(chart).getByText('300')).toBeTruthy();
  });

  it('places chart points by date, leaving room for a missing month', async () => {
    vi.mocked(readDssSeries).mockImplementation(async (file, { b }) => (b === 'WYT_SAC_' ? waterYearValues : [
      { date: '1921-10-31', value: 100 }, { date: '1921-11-30', value: 200 }, { date: '1922-01-31', value: 150 },
    ]));
    openImportedRun();
    await screen.findByText('62 matching variables');
    fireEvent.click(screen.getByRole('button', { name: 'View Chart for C_SAC000 in Run 1' }));
    await screen.findByRole('img', { name: 'C_SAC000 in Run 1' });

    // Nov 30 is 30 of the 92 days between the first and last point, not halfway.
    const xs = document.querySelector('.variable-chart-line').getAttribute('points').split(' ').map(point => Number(point.split(',')[0]));
    expect(xs[0]).toBe(72);
    expect(xs[1]).toBeCloseTo(72 + (700 * 30) / 92);
    expect(xs[2]).toBe(772);
  });

  it('closes the chart when the active run changes to another imported run', async () => {
    const otherFile = new File(['other dss'], 'run2.dss');
    vi.mocked(readDssCatalog).mockImplementation(async file => (file === otherFile ? [series('S_OTHER', 'STORAGE', 'TAF')] : catalog));
    render(<App importedRuns={[{ id: 'run-1', name: 'Run 1', file: importedFile }, { id: 'run-2', name: 'Run 2', file: otherFile }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Search variables' }));
    await screen.findByText('62 matching variables');
    fireEvent.click(screen.getByRole('button', { name: 'View Chart for C_SAC000 in Run 1' }));
    expect(screen.getByRole('heading', { name: 'Variable details' })).toBeTruthy();

    fireEvent.change(screen.getByRole('combobox', { name: 'Active run:' }), { target: { value: 'run-2' } });
    expect(await screen.findByText('1 matching variable')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Variable details' })).toBeNull();
    expect(screen.getByRole('row', { name: /S_OTHER/ })).toBeTruthy();
  });

  it('asks for a re-import when chart values cannot be read', async () => {
    vi.mocked(readDssSeries).mockImplementation(async (file, { b }) => {
      if (b === 'WYT_SAC_') return waterYearValues;
      throw new RangeError('offset is outside the bounds of the DataView');
    });
    openImportedRun();
    await screen.findByText('62 matching variables');
    fireEvent.click(screen.getByRole('button', { name: 'View Chart for C_SAC000 in Run 1' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Unable to read the imported data file. Please re-import the DSS file and try again.');
    expect(log).toHaveBeenCalled();
  });

  it('recovers from an unreadable file with Retry Search or Re-import File (SCRUM-149, SCRUM-150, SCRUM-158)', async () => {
    vi.mocked(readDssCatalog).mockRejectedValue(new RangeError('offset is outside the bounds of the DataView'));
    openImportedRun();

    let alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Unable to read the imported data file. Please re-import the DSS file and try again.');
    expect(alert.textContent).not.toContain('DataView');
    expect(log).toHaveBeenCalled();

    fireEvent.click(within(alert).getByRole('button', { name: 'Retry Search' }));
    expect(screen.getByRole('status').textContent).toBe('Loading variables from run1.dss…');
    alert = await screen.findByRole('alert');
    expect(readDssCatalog).toHaveBeenCalledTimes(2);

    // A file that isn't .dss is refused without reading it.
    const fileInput = screen.getByLabelText('Choose HEC-DSS file to re-import');
    fireEvent.change(fileInput, { target: { files: [new File(['x'], 'notes.txt')] } });
    expect(alert.textContent).toContain('"notes.txt" is not an HEC-DSS file.');
    expect(readDssCatalog).toHaveBeenCalledTimes(2);

    vi.mocked(readDssCatalog).mockResolvedValue(catalog);
    const fixed = new File(['dss bytes'], 'fixed.dss');
    fireEvent.change(fileInput, { target: { files: [fixed] } });
    expect(await screen.findByText('62 matching variables')).toBeTruthy();
    expect(readDssCatalog).toHaveBeenLastCalledWith(fixed);
  });

  it('treats a DSS file without time series as unreadable', async () => {
    vi.mocked(readDssCatalog).mockResolvedValue([]);
    openImportedRun();
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to read the imported data file.');
  });

  it('shows the search-failed message with Try Again when a search throws (SCRUM-149)', async () => {
    const realSearch = vi.mocked(searchVariables).getMockImplementation();
    vi.mocked(searchVariables).mockImplementation((variables, keyword, filters) => {
      if (keyword === 'broken') throw new Error('unexpected search failure');
      return realSearch(variables, keyword, filters);
    });
    openImportedRun();
    await screen.findByText('62 matching variables');

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'broken' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Search failed. Please check your spelling or search terms.');
    expect(alert.textContent).not.toContain('unexpected');

    fireEvent.click(within(alert).getByRole('button', { name: 'Try Again' }));
    expect(screen.getByRole('searchbox').value).toBe('');
    expect(screen.getByText('62 matching variables')).toBeTruthy();
  });

  it('searches the file chosen on Import Data (SCRUM-163)', async () => {
    render(<App />);
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'Import Data' }));
    const form = screen.getByRole('form', { name: 'Import simulation run' });
    const chosen = new File(['dss bytes'], 'baseline.dss');
    fireEvent.change(within(form).getByLabelText('Choose HEC-DSS file'), { target: { files: [chosen] } });
    fireEvent.change(within(form).getByLabelText('Run name'), { target: { value: 'Scenario 2026' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Import Data' }));

    fireEvent.click(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name: 'Variable Search' }));
    expect(await screen.findByText('62 matching variables')).toBeTruthy();
    expect(readDssCatalog).toHaveBeenCalledWith(chosen);
    expect(screen.getByRole('combobox', { name: 'Active run:' }).value).toMatch(/^run-/);
    expect(within(screen.getByRole('combobox', { name: 'Run' })).getByText('Scenario 2026')).toBeTruthy();
  });
});
