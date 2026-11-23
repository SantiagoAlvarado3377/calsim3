import { describe, expect, it } from 'vitest';
import { mockSimulationRuns } from '../../data/mockSimulationRuns.js';
import {
  createComparisonState,
  transitionComparison,
} from './comparisonModel.js';

describe('transitionComparison', () => {
  it('clears a previous error after swapping valid runs', () => {
    const initialState = createComparisonState(mockSimulationRuns);
    const stateWithError = transitionComparison(
      initialState,
      {
        type: 'select-run',
        role: 'baseline',
        runId: initialState.alternativeRunId,
      },
      mockSimulationRuns,
    );

    expect(stateWithError.message).not.toBeNull();

    const swappedState = transitionComparison(
      stateWithError,
      { type: 'swap-runs' },
      mockSimulationRuns,
    );

    expect(swappedState).toMatchObject({
      baselineRunId: initialState.alternativeRunId,
      alternativeRunId: initialState.baselineRunId,
      message: null,
    });
  });
});
