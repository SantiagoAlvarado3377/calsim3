import { useContext, useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import { ActiveRunContext } from '../components/ActiveRunContext.js';
import {
  loadDssVariables,
  logSearchError,
  searchErrorMessages,
} from '../features/variableSearch/loadDssVariables.js';
import { formatMonth } from '../features/variableSearch/formatMonth.js';

function validateDateRange(startDate, endDate) {
  if (!startDate || !endDate) {
    return 'Choose both a start date and an end date.';
  }

  const datesAreValid = [startDate, endDate].every((value) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const date = new Date(`${value}T00:00:00Z`);

    // checks the calendar date so an invalid day cannot roll into another month
    return !Number.isNaN(date.getTime()) &&
      date.getUTCFullYear() > 0 &&
      date.toISOString().slice(0, 10) === value;
  });

  if (!datesAreValid) {
    return 'Enter valid start and end dates.';
  }

  if (startDate > endDate) {
    return 'Start date must be on or before end date.';
  }

  return '';
}

// shows the dss b and c parts so two series at the same node stay apart
function variableLabel(variable) {
  return `${variable.identifier} (${variable.componentType})`;
}

// reads the chosen run's variables from its imported dss file, same reader as variable search
function useRunVariables(run) {
  const [loaded, setLoaded] = useState(null);

  useEffect(() => {
    if (!run?.file) return undefined;
    let current = true;

    loadDssVariables(run).then(
      ({ variables }) => {
        if (current) setLoaded({ run, variables });
      },
      (error) => {
        logSearchError(error);
        if (current) setLoaded({ run, error: searchErrorMessages.dataUnavailable });
      },
    );

    // ignores a slow read that finishes after the user picks another run
    return () => { current = false; };
  }, [run]);

  if (!run?.file) return { status: 'idle', variables: [] };
  if (loaded?.run !== run) return { status: 'loading', variables: [] };
  if (loaded.error) return { status: 'error', variables: [], error: loaded.error };
  return { status: 'ready', variables: loaded.variables };
}

function DataExplorer({ onNavigate }) {
  const { runs } = useContext(ActiveRunContext);
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedVariableId, setSelectedVariableId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formError, setFormError] = useState('');
  const [appliedSelections, setAppliedSelections] = useState(null);

  const selectedRun = runs.find((run) => run.id === selectedRunId);
  const catalog = useRunVariables(selectedRun);

  const selectedVariable = catalog.variables.find(
    (variable) => variable.id === selectedVariableId
  );

  // the applied run and variable are copied, so reloading a catalog cannot change them
  const appliedRun = appliedSelections?.run;
  const appliedVariable = appliedSelections?.variable;

  function handleRunChange(event) {
    setSelectedRunId(event.target.value);
    setSelectedVariableId(''); // clears the previous variable when the run changes
    setFormError('');
  }

  function handleApply(event) {
    event.preventDefault(); // keeps the form from reloading the page

    if (!selectedRun) {
      setFormError('Choose a simulation run.');
      return;
    }

    if (!selectedVariable) {
      setFormError('Choose a variable from the selected run.');
      return;
    }

    const dateError = validateDateRange(startDate, endDate);

    if (dateError) {
      setFormError(dateError);
      return;
    }

    // saves a separate copy so editing the inputs does not change applied selections
    setAppliedSelections({
      run: selectedRun,
      variable: selectedVariable,
      startDate,
      endDate,
    });

    setFormError('');
  }

  let variablePrompt = 'Choose a run first';
  if (catalog.status === 'loading') variablePrompt = 'Loading variables...';
  if (catalog.status === 'error') variablePrompt = 'Variables unavailable';
  if (catalog.status === 'ready') variablePrompt = 'Choose a variable';

  if (runs.length === 0) {
    return (
      <main className="data-explorer" aria-labelledby="data-explorer-title">
        <PageHeader id="data-explorer-title" title="Data Explorer" />

        <div className="data-explorer-content">
          <section className="data-explorer-empty" aria-labelledby="data-explorer-empty-title">
            <h2 id="data-explorer-empty-title">No simulation runs imported</h2>
            <p>Import a CalSim 3 DSS file to explore its variables.</p>
            {onNavigate && (
              <button type="button" onClick={() => onNavigate('import-data')}>
                Go to Import Data
              </button>
            )}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="data-explorer" aria-labelledby="data-explorer-title">
      <PageHeader id="data-explorer-title" title="Data Explorer" />

      <div className="data-explorer-content">
        <form
          className="data-explorer-selectors"
          onSubmit={handleApply}
          noValidate
        >
          <div className="data-explorer-field">
            <label htmlFor="simulation-run">Simulation run</label>
            <select
              id="simulation-run"
              value={selectedRunId}
              onChange={handleRunChange}
              required
            >
              <option value="">Choose a simulation run</option>
              {runs.map((run) => (
                <option key={run.id} value={run.id}>
                  {run.name}
                </option>
              ))}
            </select>
          </div>

          <div className="data-explorer-field">
            <label htmlFor="simulation-variable">Variable</label>
            <select
              id="simulation-variable"
              value={selectedVariableId}
              onChange={(event) => {
                setSelectedVariableId(event.target.value);
                setFormError('');
              }}
              disabled={catalog.status !== 'ready'}
              aria-describedby={selectedVariable ? 'variable-data-range' : undefined}
              required
            >
              <option value="">{variablePrompt}</option>

              {/* shows only the variables stored in the selected run's dss file */}
              {catalog.variables.map((variable) => (
                <option key={variable.id} value={variable.id}>
                  {variableLabel(variable)}
                </option>
              ))}
            </select>

            {selectedVariable && (
              <p id="variable-data-range" className="data-explorer-hint">
                Data from {formatMonth(selectedVariable.startMonth)} to{' '}
                {formatMonth(selectedVariable.endMonth)}
              </p>
            )}
          </div>

          <div className="data-explorer-field">
            <label htmlFor="start-date">Start date</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(event) => {
                setStartDate(event.target.value);
                setFormError('');
              }}
              required
            />
          </div>

          <div className="data-explorer-field">
            <label htmlFor="end-date">End date</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(event) => {
                setEndDate(event.target.value);
                setFormError('');
              }}
              required
            />
          </div>

          <div className="data-explorer-actions">
            {catalog.status === 'error' && (
              <p className="data-explorer-error" role="alert">
                {catalog.error}
              </p>
            )}

            {formError && (
              <p className="data-explorer-error" role="alert">
                {formError}
              </p>
            )}

            <button type="submit">Apply</button>
          </div>
        </form>

        {appliedSelections && (
          <section
            className="data-explorer-applied"
            aria-labelledby="applied-selections-title"
          >
            <h2 id="applied-selections-title">Applied selections</h2>

            <dl>
              <div>
                <dt>Simulation run</dt>
                <dd>{appliedRun.name}</dd>
              </div>
              <div>
                <dt>Variable</dt>
                <dd>{variableLabel(appliedVariable)}</dd>
              </div>
              <div>
                <dt>Start date</dt>
                <dd>{appliedSelections.startDate}</dd>
              </div>
              <div>
                <dt>End date</dt>
                <dd>{appliedSelections.endDate}</dd>
              </div>
            </dl>
          </section>
        )}

        {/* scrum-19 will swap the placeholder for the real time-series chart */}
        <section
          className="data-explorer-chart"
          aria-labelledby="chart-variable-name"
        >
          <div className="data-explorer-chart-header">
            {/* uses the applied variable so editing the dropdown alone does not change it */}
            <h2 id="chart-variable-name">
              {appliedVariable ? appliedVariable.identifier : 'Chart'}
            </h2>
          </div>

          <div className="data-explorer-chart-placeholder">
            <p>
              {appliedSelections
                ? 'The chart for these selections will appear here.'
                : 'Apply your selections to view the chart.'}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default DataExplorer;
