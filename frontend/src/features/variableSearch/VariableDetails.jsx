import { useEffect, useRef, useState } from 'react';
import { getVariableChartData } from '../../data/variableSearch.js';
import { formatMonth } from './formatMonth.js';
import { loadVariableSeries, logSearchError, searchErrorMessages } from './loadDssVariables.js';
import { waterYearOf } from './searchVariables.js';

// Sample variables chart right away; imported ones read their values from the DSS file.
// Returns the points, undefined while loading, or null if the file couldn't be read.
function useChartPoints(variable, file) {
  const [loaded, setLoaded] = useState(null);

  useEffect(() => {
    if (!variable.dssPath) return undefined;
    let current = true;

    loadVariableSeries(variable, file).then(
      points => {
        if (current) setLoaded({ variable, points });
      },
      error => {
        logSearchError(error);
        if (current) setLoaded({ variable, points: null });
      },
    );

    return () => { current = false; };
  }, [variable, file]);

  if (!variable.dssPath) return getVariableChartData(variable);
  return loaded?.variable === variable ? loaded.points : undefined;
}

// Round away from zero to one significant digit (3,994 -> 4,000; 0.83 -> 0.9).
function niceBound(value) {
  if (value <= 0) return 0;
  const step = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / step) * step;
}

function VariableChart({ variable, points, dateRange, waterYearType, waterYears }) {
  // Leave room for the axes inside the SVG's 800 × 320 coordinate system.
  const top = niceBound(points.reduce((max, point) => Math.max(max, point.value), 0));
  const bottom = -niceBound(-points.reduce((min, point) => Math.min(min, point.value), 0));
  const span = top - bottom || 1;
  // Place points by date, so missing values leave a gap instead of squeezing time together.
  const times = points.map(point => Date.parse(point.date));
  const firstTime = times[0];
  const timeSpan = times.at(-1) - firstTime;
  const x = index => 72 + (timeSpan > 0 ? (times[index] - firstTime) / timeSpan : 0.5) * 700;
  const y = value => 270 - ((value - bottom) / span) * 240;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(fraction => bottom + fraction * span);

  // With a water year type chosen, draw only those years; each gap starts a new line.
  const shownYears = waterYearType ? new Set(waterYears) : null;
  const lines = [[]];
  points.forEach((point, index) => {
    if (!shownYears || shownYears.has(waterYearOf(point.date))) lines.at(-1).push(`${x(index)},${y(point.value)}`);
    else if (lines.at(-1).length > 0) lines.push([]);
  });

  return (
    <div className="variable-chart-scroll" role="region" aria-label="Variable chart" tabIndex={0}>
      <svg viewBox="0 0 800 320" role="img" aria-labelledby="variable-chart-title" aria-describedby="variable-chart-description">
        <title id="variable-chart-title">{variable.identifier} in {variable.runName}</title>
        <desc id="variable-chart-description">
          {variable.location}, {variable.componentType}. Values in {variable.units} at {variable.interval} intervals, {dateRange}.
          {waterYearType && ` Showing ${waterYearType} water years only.`}
        </desc>
        <text x="72" y="18" className="variable-chart-label">{variable.units}</text>
        {ticks.map(tick => (
          <g key={tick}>
            <line x1="72" x2="772" y1={y(tick)} y2={y(tick)} className="variable-chart-grid" />
            <text x="60" y={y(tick) + 5} textAnchor="end" className="variable-chart-label">
              {tick.toLocaleString('en-US', { maximumFractionDigits: 2 })}
            </text>
          </g>
        ))}
        <line x1="72" x2="72" y1="30" y2="270" className="variable-chart-axis" />
        <line x1="72" x2="772" y1="270" y2="270" className="variable-chart-axis" />
        {lines.filter(line => line.length > 0).map((line, index) => (
          <polyline key={index} points={line.join(' ')} className="variable-chart-line" />
        ))}
        <text x="72" y="300" className="variable-chart-label">{formatMonth(variable.startMonth)}</text>
        <text x="422" y="300" textAnchor="middle" className="variable-chart-label">
          {formatMonth(new Date(firstTime + timeSpan / 2).toISOString().slice(0, 7))}
        </text>
        <text x="772" y="300" textAnchor="end" className="variable-chart-label">{formatMonth(variable.endMonth)}</text>
      </svg>
    </div>
  );
}

function VariableDetails({ variable, file, waterYearType, waterYears, onBack }) {
  const headingRef = useRef(null);
  const points = useChartPoints(variable, file);
  const dateRange = `${formatMonth(variable.startMonth)} – ${formatMonth(variable.endMonth)}`;

  useEffect(() => {
    headingRef.current.focus();
  }, []);

  return (
    <section className="variable-details variable-search-content" aria-labelledby="variable-details-title">
      <button type="button" onClick={onBack}>Return to variable search</button>
      <h2 id="variable-details-title" ref={headingRef} tabIndex={-1}>Variable details</h2>

      <dl className="variable-details-metadata">
        <div><dt>Identifier</dt><dd>{variable.identifier}</dd></div>
        <div><dt>Mapped location</dt><dd>{variable.location || '—'}</dd></div>
        <div><dt>Run</dt><dd>{variable.runName}</dd></div>
        <div><dt>Component type</dt><dd>{variable.componentType}</dd></div>
        <div><dt>Node category</dt><dd>{variable.nodeCategory}</dd></div>
        <div><dt>Units</dt><dd>{variable.units || '—'}</dd></div>
        <div><dt>Interval</dt><dd>{variable.interval}</dd></div>
        <div><dt>Date range</dt><dd>{dateRange}</dd></div>
      </dl>

      <figure className="variable-chart-card" aria-labelledby="variable-chart-heading">
        <h3 id="variable-chart-heading">Variable chart</h3>
        {points === undefined && <p role="status">Loading values…</p>}
        {points === null && <p role="alert">{searchErrorMessages.dataUnavailable}</p>}
        {points?.length === 0 && <p>This variable has no values to chart.</p>}
        {points?.length > 0 && (
          <VariableChart
            variable={variable}
            points={points}
            dateRange={dateRange}
            waterYearType={waterYearType}
            waterYears={waterYears}
          />
        )}
        <figcaption>
          {variable.identifier} · {variable.interval} · {variable.units}
          {waterYearType && ` · ${waterYearType} water years`}
        </figcaption>
      </figure>
    </section>
  );
}

export default VariableDetails;
