// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import DataExplorer from './DataExplorer.jsx';
import { ActiveRunContext } from '../components/ActiveRunContext.js';
import { readDssCatalog, readDssSeries } from '../features/variableSearch/dss/readDssCatalog.js';

// swaps the dss reader for a fake one; the reader itself is tested in readDssCatalog.test.js
vi.mock('../features/variableSearch/dss/readDssCatalog.js', () => ({
  readDssCatalog: vi.fn(),
  readDssSeries: vi.fn(),
}));

const series = (b, c, units) => ({
  a: 'CALSIM', b, c, e: '1MON', f: 'L2020A', units, dataType: 'PER-AVER', startMonth: '1921-10', endMonth: '2021-09',
});

const catalog = [
  series('S_SHSTA', 'STORAGE', 'TAF'),
  series('C_SAC000', 'CHANNEL', 'CFS'),
];

const baseline = { id: 'run-1', name: 'Baseline 2025', file: new File(['dss'], 'baseline.dss') };
const alternative = { id: 'run-2', name: 'Alternative A', file: new File(['dss'], 'alternative.dss') };

function renderPage({ runs = [baseline, alternative], onNavigate = vi.fn() } = {}) {
  render(
    <ActiveRunContext.Provider value={{ runs, activeRunId: runs[0]?.id ?? '', onActiveRunChange: vi.fn() }}>
      <DataExplorer onNavigate={onNavigate} />
    </ActiveRunContext.Provider>
  );
  return { onNavigate };
}

// picks a run, waits for its dss variables, then fills valid dates
async function chooseSelections({ run = 'run-1', variable = 'S_SHSTA (STORAGE)' } = {}) {
  fireEvent.change(screen.getByLabelText('Simulation run'), { target: { value: run } });
  const option = await screen.findByRole('option', { name: variable });
  fireEvent.change(screen.getByLabelText('Variable'), { target: { value: option.value } });
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2000-01-01' } });
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2000-12-31' } });
}

function apply() {
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.mocked(readDssCatalog).mockResolvedValue(catalog);
  vi.mocked(readDssSeries).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('Data Explorer imported data', () => {
  it('asks for an import when no runs exist', () => {
    const { onNavigate } = renderPage({ runs: [] });

    expect(screen.getByRole('heading', { name: 'No simulation runs imported' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Go to Import Data' }));
    expect(onNavigate).toHaveBeenCalledWith('import-data');
  });

  it('lists the imported runs instead of sample data', () => {
    renderPage();

    const runSelect = screen.getByLabelText('Simulation run');
    const names = within(runSelect).getAllByRole('option').map((option) => option.textContent);
    expect(names).toEqual(['Choose a simulation run', 'Baseline 2025', 'Alternative A']);
    expect(screen.queryByText(/sample/i)).toBeNull();
  });

  it('reads the variables from the selected run dss file', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Simulation run'), { target: { value: 'run-2' } });

    expect(await screen.findByRole('option', { name: 'C_SAC000 (CHANNEL)' })).toBeTruthy();
    expect(readDssCatalog).toHaveBeenCalledWith(alternative.file);
  });

  it('shows the data range of the chosen variable', async () => {
    renderPage();
    await chooseSelections();

    expect(screen.getByText('Data from Oct 1921 to Sep 2021')).toBeTruthy();
  });

  it('shows a clear message when the dss file cannot be read', async () => {
    vi.mocked(readDssCatalog).mockRejectedValue(new Error('bad file'));
    renderPage();
    fireEvent.change(screen.getByLabelText('Simulation run'), { target: { value: 'run-1' } });

    expect((await screen.findByRole('alert')).textContent)
      .toBe('Unable to read the imported data file. Please re-import the DSS file and try again.');
    expect(screen.getByLabelText('Variable').disabled).toBe(true);
  });
});

describe('Data Explorer chart header', () => {
  it('asks the user to apply selections before anything is applied', () => {
    renderPage();

    const chart = screen.getByRole('region', { name: 'Chart' });
    expect(within(chart).getByText('Apply your selections to view the chart.')).toBeTruthy();
  });

  it('shows the applied variable name above the chart', async () => {
    renderPage();
    await chooseSelections();
    apply();

    const chart = screen.getByRole('region', { name: 'S_SHSTA' });
    expect(within(chart).getByRole('heading', { level: 2 }).textContent).toBe('S_SHSTA');
  });

  it('keeps the applied name until apply is pressed again', async () => {
    renderPage();
    await chooseSelections();
    apply();

    const flow = screen.getByRole('option', { name: 'C_SAC000 (CHANNEL)' });
    fireEvent.change(screen.getByLabelText('Variable'), { target: { value: flow.value } });
    expect(screen.getByRole('region', { name: 'S_SHSTA' })).toBeTruthy();

    apply();
    expect(screen.getByRole('region', { name: 'C_SAC000' })).toBeTruthy();
  });

  it('keeps the previous name when an apply is invalid', async () => {
    renderPage();
    await chooseSelections();
    apply();

    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '' } });
    apply();

    expect(screen.getByRole('alert').textContent)
      .toBe('Choose both a start date and an end date.');
    expect(screen.getByRole('region', { name: 'S_SHSTA' })).toBeTruthy();
  });
});
