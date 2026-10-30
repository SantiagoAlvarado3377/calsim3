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

function DataExplorer() {
  const [selectedRunId, setSelectedRunId] = useState('');
  const [selectedVariableId, setSelectedVariableId] = useState('');

  const selectedRun = sampleRuns.find(
    (run) => run.id === selectedRunId
  );

  function handleRunChange(event) {
    setSelectedRunId(event.target.value);
    setSelectedVariableId(''); // clears the previous variable when the run changes
  }

  return (
    <main className="data-explorer" aria-labelledby="data-explorer-title">
      <PageHeader id="data-explorer-title" title="Data Explorer" />
      <div className="data-explorer-content">
        <p>Sample data shown for development.</p>

        <div className="data-explorer-selectors">
          <div className="data-explorer-field">
            <label htmlFor="simulation-run">Simulation run</label>
            <select
              id="simulation-run"
              value={selectedRunId}
              onChange={handleRunChange}
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
              onChange={(event) => setSelectedVariableId(event.target.value)}
              disabled={!selectedRun}
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
        </div>
      </div>
    </main>
  );
}

export default DataExplorer;
