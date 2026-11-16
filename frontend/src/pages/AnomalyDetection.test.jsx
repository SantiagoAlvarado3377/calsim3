// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import AnomalyDetection from './AnomalyDetection.jsx';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const runSelect = () => screen.getByRole('combobox', { name: 'Simulation run' });
const variableSelect = () => screen.getByRole('combobox', { name: 'Supported monthly variable' });
const rangeSelect = () => screen.getByRole('combobox', { name: 'Date range' });
const analyze = () => screen.getByRole('button', { name: 'Analyze', exact: true });
const advanceAnalysis = () => act(() => { vi.advanceTimersByTime(1200); });

it('opens from Dashboard and keeps dependent controls disabled with no imported runs', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Detect anomalies' }));

  expect(screen.getByRole('heading', { name: 'Anomaly Detection', level: 1 })).toBeTruthy();
  expect(within(runSelect()).getByRole('option', { name: 'No imported runs' })).toBeTruthy();
  expect([runSelect(), variableSelect(), rangeSelect(), analyze()].every(control => control.disabled)).toBe(true);
  expect(screen.getByText(/Review potential anomalies with an engineer/)).toBeTruthy();
});

it('keeps valid selections when switching sample runs and clears selections that become invalid', () => {
  render(<AnomalyDetection />);
  fireEvent.click(screen.getByRole('button', { name: 'Explore sample data' }));

  fireEvent.change(runSelect(), { target: { value: 'alternative-operations-a' } });
  expect(variableSelect().value).toBe('SAMPLE_SHASTA_STORAGE');
  expect(rangeSelect().value).toBe('2020-01/2025-12');

  fireEvent.change(runSelect(), { target: { value: 'alternative-operations-b' } });
  expect(variableSelect().value).toBe('SAMPLE_SHASTA_STORAGE');
  expect(rangeSelect().value).toBe('');
  expect(analyze().disabled).toBe(true);

  fireEvent.change(runSelect(), { target: { value: 'climate-stress-c' } });
  expect(variableSelect().value).toBe('');
  expect(rangeSelect().disabled).toBe(true);
  expect(within(variableSelect()).queryByRole('option', { name: 'SACRAMENTO_FLOW' })).toBeNull();
  const list = screen.getByRole('list', { name: 'Supported monthly variables' });
  expect(within(list).getAllByRole('listitem').map(item => item.textContent)).toEqual(['SAMPLE_FOLSOM_STORAGE']);
});

it('submits the selected run, variable, covered dates, and current sensitivity', () => {
  const onAnalyze = vi.fn();
  render(<AnomalyDetection onAnalyze={onAnalyze} />);
  fireEvent.click(screen.getByRole('button', { name: 'Explore sample data' }));
  fireEvent.change(rangeSelect(), { target: { value: '2025-01/2025-12' } });
  const slider = screen.getByRole('slider', { name: 'Sensitivity' });
  expect(slider.value).toBe('65');
  fireEvent.change(slider, { target: { value: '82' } });
  expect(screen.getByText('82%')).toBeTruthy();
  fireEvent.click(analyze());

  expect(onAnalyze).toHaveBeenCalledExactlyOnceWith({
    run: expect.objectContaining({ id: 'baseline-2025' }),
    variable: expect.objectContaining({ identifier: 'SAMPLE_SHASTA_STORAGE' }),
    dateRange: { startMonth: '2025-01', endMonth: '2025-12' },
    sensitivity: 82,
  });
});

it('shows each processing status and automatically opens results for the submitted selection', () => {
  vi.useFakeTimers();
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Detect anomalies' }));
  fireEvent.click(screen.getByRole('button', { name: 'Explore sample data' }));
  fireEvent.click(analyze());

  const heading = screen.getByRole('heading', { name: 'Analyzing monthly time-series data.' });
  expect(document.activeElement).toBe(heading);
  expect(screen.getByText('Baseline 2025 / SAMPLE_SHASTA_STORAGE')).toBeTruthy();
  const steps = within(screen.getByRole('list', { name: 'Analysis steps' })).getAllByRole('listitem');
  expect(steps.map(step => step.firstElementChild.textContent)).toEqual([
    'Preparing selected observations', 'Evaluating unusual patterns', 'Generating findings for review',
  ]);
  const statuses = () => steps.map(step => step.lastElementChild.textContent);
  expect(statuses()).toEqual(['In progress', 'Waiting', 'Waiting']);
  advanceAnalysis();
  expect(statuses()).toEqual(['Complete', 'In progress', 'Waiting']);
  advanceAnalysis();
  expect(statuses()).toEqual(['Complete', 'Complete', 'In progress']);
  advanceAnalysis();

  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Analysis results' }));
  expect(screen.getByText('Sep 2022')).toBeTruthy();
  expect(screen.getByText('May 2024')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Cancel Analysis' })).toBeNull();
});

it('cancels an active preview, preserves the configuration, and can rerun with zero sample findings', () => {
  vi.useFakeTimers();
  render(<AnomalyDetection />);
  fireEvent.click(screen.getByRole('button', { name: 'Explore sample data' }));
  const selection = [runSelect().value, variableSelect().value];
  fireEvent.change(rangeSelect(), { target: { value: '2025-01/2025-12' } });
  fireEvent.change(screen.getByRole('slider', { name: 'Sensitivity' }), { target: { value: '82' } });
  fireEvent.click(analyze());
  advanceAnalysis();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel Analysis' }));
  act(() => { vi.runAllTimers(); });

  expect(screen.queryByRole('heading', { name: 'Analysis results' })).toBeNull();
  expect(document.activeElement).toBe(analyze());
  expect([runSelect().value, variableSelect().value]).toEqual(selection);
  expect(rangeSelect().value).toBe('2025-01/2025-12');
  expect(screen.getByRole('slider', { name: 'Sensitivity' }).value).toBe('82');

  fireEvent.click(analyze());
  for (let step = 0; step < 3; step++) advanceAnalysis();
  expect(screen.getByRole('heading', { name: 'Analysis results' })).toBeTruthy();
  expect(screen.getByText('No sample findings in the selected date range.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Run Another Analysis' }));
  expect(rangeSelect().value).toBe('2025-01/2025-12');
});

it('uses the existing imported DSS catalog and only offers eligible monthly series', async () => {
  const fixture = `${import.meta.dirname}/../features/variableSearch/dss/fixtures/calsim_sample.dss`;
  const file = new File([readFileSync(fixture)], 'calsim_sample.dss');
  render(<App importedRuns={[{ id: 'test-run', name: 'Imported test run', file }]} />);
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Anomaly Detection' }));

  expect(runSelect().value).toBe('test-run');
  const storage = await within(variableSelect()).findByRole('option', { name: 'S_SHSTA' });
  expect(Array.from(variableSelect().options).slice(1).map(option => option.textContent)).toEqual(['C_DUMMY', 'C_SAC000', 'S_SHSTA']);
  fireEvent.change(variableSelect(), { target: { value: storage.value } });
  expect([...rangeSelect().options].slice(1).map(option => option.value)).toEqual([
    '1921-10/1951-09', '1941-10/1951-09', '1946-10/1951-09', '1950-10/1951-09',
  ]);
  fireEvent.change(rangeSelect(), { target: { value: '1950-10/1951-09' } });
  expect(analyze().disabled).toBe(false);

  const channel = within(variableSelect()).getByRole('option', { name: 'C_SAC000' });
  fireEvent.change(variableSelect(), { target: { value: channel.value } });
  expect(rangeSelect().value).toBe('');
  expect(analyze().disabled).toBe(true);

  vi.useFakeTimers();
  fireEvent.change(rangeSelect(), { target: { value: '1921-10/1931-09' } });
  fireEvent.click(analyze());
  expect(screen.getByText('Imported test run / C_SAC000')).toBeTruthy();
  expect(screen.getByRole('combobox', { name: 'Active run:' }).disabled).toBe(true);
  for (let step = 0; step < 3; step++) advanceAnalysis();
  expect(screen.getByRole('heading', { name: 'Analysis results' })).toBeTruthy();
  expect(screen.getByText(/Findings for this imported run will be available/)).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Sample findings' })).toBeNull();
});
