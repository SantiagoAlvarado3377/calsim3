import { useReducer, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { mockSimulationRuns } from '../data/mockSimulationRuns.js';
import { ComparisonControls } from '../features/comparison/ComparisonControls.jsx';
import { ComparisonPreview, PrototypeAction } from '../features/comparison/ComparisonPreview.jsx';
import {
  createComparisonState,
  deriveComparisonView,
  transitionComparison,
} from '../features/comparison/comparisonModel.js';
import './CompareRuns.css';
import AnalysisInput from '../components/AnalysisInput.jsx';

function CompareRuns({ runs = mockSimulationRuns, analysisSelection }) {
  const [state, dispatch] = useReducer(
    (currentState, action) => transitionComparison(currentState, action, runs),
    runs,
    createComparisonState,
  );
  const [dateExpanded, setDateExpanded] = useState(false);
  const view = deriveComparisonView(state, runs);
  const canSwapRuns = Boolean(
    view.baselineRun &&
      view.alternativeRun &&
      view.baselineRun.id !== view.alternativeRun.id,
  );

  const selectRun = (role, runId) => {
    dispatch({ type: 'select-run', role, runId });
    setDateExpanded(false);
  };

  const updateDateRange = range => {
    dispatch({ type: 'select-date-range', range });
  };

  const handleSwapRuns = () => {
    dispatch({ type: 'swap-runs' });
    setDateExpanded(false);
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
          onVariableChange={variable => dispatch({ type: 'select-variable', variable })}
          onDateToggle={() => setDateExpanded(isExpanded => !isExpanded)}
          onStartChange={start => updateDateRange({ start, end: state.dateRange.end })}
          onEndChange={end => updateDateRange({ start: state.dateRange.start, end })}
        />

        <div className="comparison-feedback" aria-live="polite">
          {view.messages.map(message => <p key={message}>{message}</p>)}
        </div>

        <div className="comparison-actions">
          <PrototypeAction
            disabled={!canSwapRuns}
            onClick={handleSwapRuns}
            showPrototypeLabel={false}
          >
            Swap Runs
          </PrototypeAction>
          <PrototypeAction>Apply Comparison</PrototypeAction>
        </div>

        <ComparisonPreview
          baselineName={view.baselineRun?.name}
          alternativeName={view.alternativeRun?.name}
          dateRange={state.dateRange}
          hasOverlap={Boolean(view.overlap)}
        />
      </div>
    </main>
  );
}

export default CompareRuns;
