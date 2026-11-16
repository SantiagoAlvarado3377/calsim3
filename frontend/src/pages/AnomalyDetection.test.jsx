// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import AnomalyDetection from './AnomalyDetection.jsx';

afterEach(cleanup);

const runSelect = () => screen.getByRole('combobox', { name: 'Simulation run' });
const variableSelect = () => screen.getByRole('combobox', { name: 'Supported monthly variable' });
const rangeSelect = () => screen.getByRole('combobox', { name: 'Date range' });
const analyze = () => screen.getByRole('button', { name: 'Analyze', exact: true });

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
});
