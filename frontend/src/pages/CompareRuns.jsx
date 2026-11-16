import { useReducer, useRef, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { mockSimulationRuns } from '../data/mockSimulationRuns.js';
import { ComparisonControls } from '../features/comparison/ComparisonControls.jsx';
import { ComparisonPreview, PrototypeAction } from '../features/comparison/ComparisonPreview.jsx';
import {
  createComparisonState,
  deriveComparisonView,
  transitionComparison,
} from '../features/comparison/comparisonModel.js';
import { compareFixtureMonthlyRuns } from '../features/comparison/fixtureComparisonProvider.js';
import './CompareRuns.css';
import AnalysisInput from '../components/AnalysisInput.jsx';

const idleRequest = { status: 'idle', result: null, error: null };

function CompareRuns({ runs = mockSimulationRuns, compare = compareFixtureMonthlyRuns, analysisSelection }) {
  const [state, dispatch] = useReducer(
    (currentState, action) => transitionComparison(currentState, action, runs),
    runs,
    createComparisonState,
  );
  const [dateExpanded, setDateExpanded] = useState(false);
  const [requestState, setRequestState] = useState(idleRequest);
  const requestVersion = useRef(0);
  const view = deriveComparisonView(state, runs);
  const canSwapRuns = Boolean(
    view.baselineRun &&
      view.alternativeRun &&
      view.baselineRun.id !== view.alternativeRun.id,
  );

  const invalidateComparison = () => {
    requestVersion.current += 1;
    setRequestState(idleRequest);
  };

  const selectRun = (role, runId) => {
    invalidateComparison();
    dispatch({ type: 'select-run', role, runId });
    setDateExpanded(false);
  };

  const updateDateRange = range => {
    invalidateComparison();
    dispatch({ type: 'select-date-range', range });
  };

  const selectVariable = variable => {
    invalidateComparison();
    dispatch({ type: 'select-variable', variable });
  };

  const handleSwapRuns = () => {
    invalidateComparison();
    dispatch({ type: 'swap-runs' });
    setDateExpanded(false);
  };

  const handleApplyComparison = async () => {
    if (!view.isValid || requestState.status === 'loading') return;

    const currentRequestVersion = requestVersion.current + 1;
    requestVersion.current = currentRequestVersion;
    setRequestState({ status: 'loading', result: null, error: null });
    let response;
    try {
      response = await compare({
        baselineRunId: state.baselineRunId,
        alternativeRunId: state.alternativeRunId,
        variableId: state.variable,
        range: { ...state.dateRange },
      });
    } catch {
      response = {
        ok: false,
        error: {
          code: 'data-source-error',
          message: 'Comparison data could not be loaded. Please try again.',
        },
      };
    }

    if (requestVersion.current === currentRequestVersion) {
      setRequestState(response.ok
        ? { status: 'success', result: response.result, error: null }
        : { status: 'error', result: null, error: response.error });
    }
  };

  return (
    <main className="comparison-page" aria-labelledby="comparison-title">
      <PageHeader id="comparison-title" title="Compare Simulation Runs" />

      <div className="comparison-workspace">
        <AnalysisInput selection={analysisSelection} />
        {analysisSelection && (
          <p>The selected input has been received. The comparison controls and charts below use sample data; comparison calculations for this input are not available yet.</p>
        )}
        <ComparisonControls
          runs={runs}
          baselineRunId={state.baselineRunId}
          alternativeRunId={state.alternativeRunId}
          variables={view.sharedVariables}
          variable={state.variable}
          range={state.dateRange}
          overlap={view.overlap}
          dateExpanded={dateExpanded}
          onBaselineChange={runId => selectRun('baseline', runId)}
          onAlternativeChange={runId => selectRun('alternative', runId)}
          onVariableChange={selectVariable}
          onDateToggle={() => setDateExpanded(isExpanded => !isExpanded)}
          onStartChange={start => updateDateRange({ start, end: state.dateRange.end })}
          onEndChange={end => updateDateRange({ start: state.dateRange.start, end })}
        />

        <div className="comparison-feedback" aria-live="polite">
          {view.messages.map(message => <p key={message}>{message}</p>)}
          {requestState.status === 'loading' ? <p role="status">Applying comparison…</p> : null}
          {requestState.status === 'error' ? <p role="alert">{requestState.error.message}</p> : null}
        </div>

        <div className="comparison-actions">
          <PrototypeAction
            disabled={!canSwapRuns}
            onClick={handleSwapRuns}
            showPrototypeLabel={false}
          >
            Swap Runs
          </PrototypeAction>
          <PrototypeAction
            disabled={!view.isValid || requestState.status === 'loading'}
            onClick={handleApplyComparison}
            showPrototypeLabel={false}
          >
            {requestState.status === 'loading' ? 'Applying…' : 'Apply Comparison'}
          </PrototypeAction>
        </div>

        <ComparisonPreview
          baselineName={view.baselineRun?.name}
          alternativeName={view.alternativeRun?.name}
          dateRange={state.dateRange}
          overlap={view.overlap}
          overlapStatus={view.overlapStatus}
          result={requestState.status === 'success' ? requestState.result : null}
        />
      </div>
    </main>
  );
}

export default CompareRuns;
