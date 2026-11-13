import { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';

// sample options used until imported simulation data is connected
const sampleRuns = [
  {
    id: 'sample-run-1',
    name: 'Sample Run 1',
    variables: [
      { id: 'sample-storage', name: 'Sample Reservoir Storage' },
      { id: 'sample-flow', name: 'Sample River Flow' },
    ],
  },
  {
    id: 'sample-run-2',
    name: 'Sample Run 2',
    variables: [
      { id: 'sample-flow', name: 'Sample River Flow' },
      { id: 'sample-demand', name: 'Sample Water Demand' },
    ],
  },
];

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

function DataExplorer() {
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedVariableId, setSelectedVariableId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [formError, setFormError] = useState('');
  const [appliedSelections, setAppliedSelections] = useState(null);

  const selectedRun = sampleRuns.find(
    (run) => run.id === selectedRunId
  );

  const appliedRun = sampleRuns.find(
    (run) => run.id === appliedSelections?.runId
  );

  const appliedVariable = appliedRun?.variables.find(
    (variable) => variable.id === appliedSelections?.variableId
  );

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

    const selectedVariable = selectedRun.variables.find(
      (variable) => variable.id === selectedVariableId
    );

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
      runId: selectedRunId,
      variableId: selectedVariableId,
      startDate,
      endDate,
    });

    setFormError('');
  }

  return (
    <main className="data-explorer" aria-labelledby="data-explorer-title">
      <PageHeader id="data-explorer-title" title="Data Explorer" />

      <div className="data-explorer-content">
        <p>Sample data shown for development.</p>

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
              {sampleRuns.map((run) => (
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
              disabled={!selectedRun}
              required
            >
              <option value="">
                {selectedRun ? 'Choose a variable' : 'Choose a run first'}
              </option>

              {/* shows only the variables available in the selected run */}
              {selectedRun?.variables.map((variable) => (
                <option key={variable.id} value={variable.id}>
                  {variable.name}
                </option>
              ))}
            </select>
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
                <dd>{appliedRun?.name}</dd>
              </div>
              <div>
                <dt>Variable</dt>
                <dd>{appliedVariable?.name}</dd>
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
      </div>
    </main>
  );
}

export default DataExplorer;