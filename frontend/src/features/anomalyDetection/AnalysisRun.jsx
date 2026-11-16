import { useEffect, useRef, useState } from 'react';
import spinnerIcon from '../../assets/anomaly-analysis-spinner.svg';
import completeIcon from '../../assets/anomaly-step-complete.svg';
import progressIcon from '../../assets/anomaly-step-spinner.svg';
import { formatMonth } from '../variableSearch/formatMonth.js';

const steps = [
  'Preparing selected observations',
  'Evaluating unusual patterns',
  'Generating findings for review',
];
const previewStepDurationMs = 1200;

// Illustrative findings for the Baseline 2025 Shasta sample, shown within the selected dates.
const sampleFindingMonths = ['2022-09', '2024-05'];

function AnalysisRun({ configuration, variableLabel, sample, onReturn }) {
  const [activeStep, setActiveStep] = useState(0);
  const headingRef = useRef(null);
  const finished = activeStep === steps.length;
  const { run, variable, dateRange } = configuration;

  useEffect(() => {
    if (finished) return;
    // The detection engine will replace these timed preview steps. Unmounting cancels the preview.
    const timer = setTimeout(() => setActiveStep(activeStep + 1), previewStepDurationMs);
    return () => clearTimeout(timer);
  }, [activeStep, finished]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [finished]);

  const selection = `${run.name} / ${variableLabel}`;

  if (finished) {
    const findings = sample && run.id === 'baseline-2025' && variable.identifier === 'SAMPLE_SHASTA_STORAGE'
      ? sampleFindingMonths.filter(month => month >= dateRange.startMonth && month <= dateRange.endMonth)
      : [];

    return (
      <section className="anomaly-run anomaly-outcome" aria-labelledby="anomaly-run-title">
        <div className="anomaly-outcome-heading">
          <h2 id="anomaly-run-title" ref={headingRef} tabIndex={-1}>Analysis results</h2>
          <button className="anomaly-run-button" type="button" onClick={onReturn}>Run Another Analysis</button>
        </div>
        <div className="anomaly-run-panel">
          <p className="anomaly-run-selection">{selection}</p>
          {sample ? (
            <>
              <h3>Sample findings</h3>
              {findings.length > 0 ? (
                <ul>{findings.map(month => <li key={month}>{formatMonth(month)}</li>)}</ul>
              ) : <p>No sample findings in the selected date range.</p>}
              <p>These example findings illustrate the workflow for engineering review.</p>
            </>
          ) : <p>Preview complete. Findings for this imported run will be available when the detection engine is connected.</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="anomaly-run" aria-labelledby="anomaly-run-title">
      <div className="anomaly-run-panel anomaly-progress">
        <span className="anomaly-progress-icon" aria-hidden="true"><img className="anomaly-spinner" src={spinnerIcon} alt="" /></span>
        <h2 id="anomaly-run-title" ref={headingRef} tabIndex={-1}>Analyzing monthly time-series data.</h2>
        <p className="anomaly-run-selection">{selection}</p>
        <ol className="anomaly-progress-steps" aria-label="Analysis steps" aria-live="polite">
          {steps.map((step, index) => {
            const status = index < activeStep ? 'Complete' : index === activeStep ? 'In progress' : 'Waiting';
            return (
              <li key={step} aria-current={index === activeStep ? 'step' : undefined}>
                <span className="anomaly-step-label">
                  {index < activeStep && <img src={completeIcon} alt="" />}
                  {index === activeStep && <img className="anomaly-spinner" src={progressIcon} alt="" />}
                  {step}
                </span>
                <span>{status}</span>
              </li>
            );
          })}
        </ol>
        <button className="anomaly-run-button" type="button" onClick={onReturn}>Cancel Analysis</button>
      </div>
    </section>
  );
}

export default AnalysisRun;
