// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import DataExplorer from './DataExplorer.jsx';

afterEach(cleanup);

// fills every input so apply is valid
function chooseSelections({ run = 'sample-run-1', variable = 'sample-storage' } = {}) {
  fireEvent.change(screen.getByLabelText('Simulation run'), { target: { value: run } });
  fireEvent.change(screen.getByLabelText('Variable'), { target: { value: variable } });
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-01-01' } });
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-06-30' } });
}

function apply() {
  fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
}

describe('Data Explorer chart header', () => {
  it('asks the user to apply selections before anything is applied', () => {
    render(<DataExplorer />);

    const chart = screen.getByRole('region', { name: 'Chart' });
    expect(within(chart).getByText('Apply your selections to view the chart.')).toBeTruthy();
  });

  it('shows the applied variable name above the chart', () => {
    render(<DataExplorer />);
    chooseSelections();
    apply();

    const chart = screen.getByRole('region', { name: 'Sample Reservoir Storage' });
    expect(within(chart).getByRole('heading', { level: 2 }).textContent)
      .toBe('Sample Reservoir Storage');
  });

  it('keeps the applied name until apply is pressed again', () => {
    render(<DataExplorer />);
    chooseSelections();
    apply();

    fireEvent.change(screen.getByLabelText('Variable'), { target: { value: 'sample-flow' } });
    expect(screen.getByRole('region', { name: 'Sample Reservoir Storage' })).toBeTruthy();

    apply();
    expect(screen.getByRole('region', { name: 'Sample River Flow' })).toBeTruthy();
  });

  it('keeps the previous name when an apply is invalid', () => {
    render(<DataExplorer />);
    chooseSelections();
    apply();

    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '' } });
    apply();

    expect(screen.getByRole('alert').textContent)
      .toBe('Choose both a start date and an end date.');
    expect(screen.getByRole('region', { name: 'Sample Reservoir Storage' })).toBeTruthy();
  });
});
