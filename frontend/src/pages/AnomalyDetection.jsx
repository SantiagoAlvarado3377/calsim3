import { useContext, useMemo, useState } from 'react';
import noticeIcon from '../assets/anomaly-notice-info.svg';
import { ActiveRunContext } from '../components/ActiveRunContext.js';
import PageHeader from '../components/PageHeader.jsx';
import { mockSimulationRuns } from '../data/mockSimulationRuns.js';
import { dateRangeKey, dateRangeOptions, supportedVariableOptions } from '../features/anomalyDetection/analysisConfiguration.js';
import { useVariableCatalog } from '../features/variableSearch/useVariableCatalog.js';
import './AnomalyDetection.css';

const initialSampleRun = mockSimulationRuns[0];
const emptyVariables = [];

function AnomalyDetection({ onAnalyze }) {
  const { runs, activeRunId, onActiveRunChange } = useContext(ActiveRunContext);
  const [useSamples, setUseSamples] = useState(false);
  const [selectedSampleRunId, setSelectedSampleRunId] = useState(initialSampleRun.id);
  const [variableKey, setVariableKey] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [sensitivity, setSensitivity] = useState(65);
  const [submitted, setSubmitted] = useState(null);

  const availableRuns = useSamples ? mockSimulationRuns : runs;
  const run = availableRuns.find(item => item.id === (useSamples ? selectedSampleRunId : activeRunId));
  const catalog = useVariableCatalog(useSamples ? null : run, useSamples);
  const catalogVariables = catalog.data?.variables ?? emptyVariables;
  const variables = useMemo(
    () => supportedVariableOptions(catalogVariables.filter(variable => variable.runId === run?.id)),
    [catalogVariables, run?.id],
  );
  const variable = variables.find(option => option.key === variableKey)?.variable;
  const ranges = dateRangeOptions(variable, dateRange);
  const range = dateRange && ranges.find(option => option.key === dateRangeKey(dateRange));

  // Keep equivalent selections across runs once the new catalog is available.
  if (catalog.status !== 'loading') {
    if (variableKey && !variable) setVariableKey('');
    if (dateRange && !range) setDateRange(null);
  }

  const loading = catalog.status === 'loading';
  const catalogError = catalog.status === 'error';
  const canAnalyze = Boolean(run && variable && range);
  const isSubmitted = submitted && submitted.run === run && submitted.variable === variable
    && dateRangeKey(submitted.dateRange) === range?.key && submitted.sensitivity === sensitivity;

  function changeRun(event) {
    if (useSamples) setSelectedSampleRunId(event.target.value);
    else onActiveRunChange(event.target.value);
    setSubmitted(null);
  }

  function toggleSamples() {
    setUseSamples(!useSamples);
    setSelectedSampleRunId(initialSampleRun.id);
    setVariableKey(useSamples ? '' : initialSampleRun.variables[0]);
    setDateRange(useSamples ? null : {
      startMonth: initialSampleRun.startMonth,
      endMonth: initialSampleRun.endMonth,
    });
    setSubmitted(null);
  }

  function handleAnalyze(event) {
    event.preventDefault();
    if (!canAnalyze) return;

    const configuration = { run, variable, dateRange: { startMonth: range.startMonth, endMonth: range.endMonth }, sensitivity };
    if (onAnalyze) onAnalyze(configuration);
    else setSubmitted(configuration);
  }

  let variablePlaceholder = 'Choose a supported variable';
  if (!run) variablePlaceholder = 'Choose a simulation run first';
  else if (loading) variablePlaceholder = 'Loading variables…';
  else if (catalogError) variablePlaceholder = 'Unable to read variables';
  else if (variables.length === 0) variablePlaceholder = 'No supported monthly variables';

  return (
    <main className="anomaly-detection" aria-labelledby="anomaly-detection-title">
      <PageHeader id="anomaly-detection-title" title="Anomaly Detection" />
      <form className="anomaly-configuration" onSubmit={handleAnalyze}>
        <div className="anomaly-selection">
          <label className="anomaly-field">
            <span>Simulation run</span>
            <select value={run?.id ?? ''} disabled={!availableRuns.length} onChange={changeRun}>
              {!run && <option value="">{availableRuns.length ? 'Choose a simulation run' : 'No imported runs'}</option>}
              {availableRuns.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="anomaly-field">
            <span>Supported monthly variable</span>
            <select
              value={variable ? variableKey : ''}
              disabled={!variables.length}
              onChange={event => {
                setVariableKey(event.target.value);
                setSubmitted(null);
              }}
            >
              <option value="">{variablePlaceholder}</option>
              {variables.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </label>
          <label className="anomaly-field">
            <span>Date range</span>
            <select
              value={range?.key ?? ''}
              disabled={!variable}
              onChange={event => {
                setDateRange(ranges.find(option => option.key === event.target.value) ?? null);
                setSubmitted(null);
              }}
            >
              <option value="">{variable ? 'Choose a date range' : 'Choose a variable first'}</option>
              {ranges.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
            </select>
          </label>
          <button className="anomaly-analyze" type="submit" disabled={!canAnalyze}>Analyze</button>
        </div>

        {isSubmitted && <p className="anomaly-submission" role="status">Configuration ready. Running an analysis will be available in a later update.</p>}

        <div className="anomaly-panels">
          <section className="anomaly-panel" aria-labelledby="anomaly-method-title">
            <h2 id="anomaly-method-title">Machine-learning-assisted detection</h2>
            <p className="anomaly-method-description">Detection flags unusual monthly observations for review.</p>
            <div className="anomaly-sensitivity">
              <div className="anomaly-sensitivity-heading">
                <label htmlFor="anomaly-sensitivity">Sensitivity</label>
                <output htmlFor="anomaly-sensitivity" aria-hidden="true">{sensitivity}%</output>
              </div>
              <input
                id="anomaly-sensitivity"
                type="range"
                min="0"
                max="100"
                value={sensitivity}
                aria-valuetext={`${sensitivity}%`}
                style={{ '--anomaly-sensitivity': `${sensitivity}%` }}
                onChange={event => {
                  setSensitivity(Number(event.target.value));
                  setSubmitted(null);
                }}
              />
              <div className="anomaly-slider-labels" aria-hidden="true"><span>Low</span><span>High</span></div>
            </div>
            <p className="anomaly-notice">
              <img src={noticeIcon} alt="" />
              <span>Review potential anomalies with an engineer before classifying them as model errors.</span>
            </p>
          </section>

          <section className="anomaly-panel anomaly-supported" aria-labelledby="anomaly-supported-title">
            <h2 id="anomaly-supported-title">Supported variables</h2>
            <p>Only monthly variables with confirmed meanings, units, and reporting conventions are available.</p>
            {loading && <p role="status">Loading monthly variables…</p>}
            {catalogError && <p role="status">{catalog.error.message}</p>}
            {!loading && !catalogError && !variables.length && (
              <p>{run ? 'No supported monthly variables are available in this run.' : 'Select an imported run to see its supported variables.'}</p>
            )}
            {variables.length > 0 && (
              <ul className="anomaly-variables" aria-label="Supported monthly variables" tabIndex={0}>
                {variables.map(option => <li key={option.key}>{option.label}</li>)}
              </ul>
            )}
            <p className="anomaly-prototype-note">
              {useSamples ? 'Prototype mode uses sample data. Analysis is pending.' : 'Prototype mode supports configuration. Analysis is pending.'}
            </p>
            <button className="anomaly-sample-action" type="button" onClick={toggleSamples}>
              {useSamples ? 'Use imported runs' : 'Explore sample data'}
            </button>
          </section>
        </div>
      </form>
    </main>
  );
}

export default AnomalyDetection;
