import { formatMonthRange } from './comparisonModel.js';

const Chevron = () => (
  <svg className="comparison-chevron" viewBox="0 0 16 16" aria-hidden="true">
    <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" />
  </svg>
);

export function RunSelect({ id, label, value, runs, excludedRunId, onChange }) {
  const availableRuns = runs.filter(run => run.id !== excludedRunId);

  return (
    <div className="comparison-field">
      <label htmlFor={id}>{label}</label>
      <div className="comparison-select-wrap">
        <select id={id} value={value ?? ''} onChange={event => onChange(event.target.value)}>
          {availableRuns.map(run => (
            <option key={run.id} value={run.id}>{run.name}</option>
          ))}
        </select>
        <Chevron />
      </div>
    </div>
  );
}

export function VariableSelect({ value, variables, disabled, onChange }) {
  return (
    <div className="comparison-field comparison-field--variable">
      <label htmlFor="comparison-variable">Variable</label>
      <div className="comparison-select-wrap">
        <select
          id="comparison-variable"
          value={value ?? ''}
          disabled={disabled}
          onChange={event => onChange(event.target.value)}
        >
          {variables.length === 0 ? (
            <option value="">No shared variables</option>
          ) : variables.map(variableName => (
            <option key={variableName} value={variableName}>{variableName}</option>
          ))}
        </select>
        <Chevron />
      </div>
    </div>
  );
}

export function DateRangeField({
  range,
  overlap,
  expanded,
  disabled,
  onToggle,
  onStartChange,
  onEndChange,
}) {
  return (
    <div className="comparison-field comparison-date-field">
      <span className="comparison-field-label" id="comparison-date-label">Overlapping dates</span>
      <button
        className="comparison-date-trigger"
        type="button"
        aria-labelledby="comparison-date-label comparison-date-value"
        aria-expanded={expanded}
        aria-controls="comparison-date-panel"
        disabled={disabled}
        onClick={onToggle}
      >
        <span id="comparison-date-value">{formatMonthRange(range)}</span>
        <Chevron />
      </button>
      {expanded && range && overlap ? (
        <div
          className="comparison-date-panel"
          id="comparison-date-panel"
          role="group"
          aria-label="Custom overlapping date range"
        >
          <label htmlFor="comparison-start-month">
            Start month
            <input
              id="comparison-start-month"
              type="month"
              value={range.start}
              min={overlap.start}
              max={range.end}
              onChange={event => onStartChange(event.target.value)}
            />
          </label>
          <label htmlFor="comparison-end-month">
            End month
            <input
              id="comparison-end-month"
              type="month"
              value={range.end}
              min={range.start}
              max={overlap.end}
              onChange={event => onEndChange(event.target.value)}
            />
          </label>
          <p>{formatMonthRange(overlap)} available</p>
        </div>
      ) : null}
    </div>
  );
}

export function ComparisonControls({
  runs,
  baselineRunId,
  alternativeRunId,
  variables,
  variable,
  range,
  overlap,
  dateExpanded,
  onBaselineChange,
  onAlternativeChange,
  onVariableChange,
  onDateToggle,
  onStartChange,
  onEndChange,
}) {
  return (
    <div className="comparison-controls">
      <RunSelect
        id="baseline-run"
        label="Baseline run"
        value={baselineRunId}
        runs={runs}
        excludedRunId={alternativeRunId}
        onChange={onBaselineChange}
      />
      <RunSelect
        id="alternative-run"
        label="Alternative run"
        value={alternativeRunId}
        runs={runs}
        excludedRunId={baselineRunId}
        onChange={onAlternativeChange}
      />
      <VariableSelect
        value={variable}
        variables={variables}
        disabled={variables.length === 0}
        onChange={onVariableChange}
      />
      <DateRangeField
        range={range}
        overlap={overlap}
        expanded={dateExpanded}
        disabled={!overlap}
        onToggle={onDateToggle}
        onStartChange={onStartChange}
        onEndChange={onEndChange}
      />
    </div>
  );
}
