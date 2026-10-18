import { useEffect, useRef } from 'react';
import { getVariableChartData } from '../../data/variableSearch.js';
import { formatMonth } from './formatMonth.js';

function VariableDetails({ variable, onBack }) {
  const headingRef = useRef(null);
  const series = getVariableChartData(variable);
  const maxValue = Math.ceil(Math.max(...series.map(point => point.value)) / 1000) * 1000;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  // Leave room for the axes inside the SVG's 800 × 320 coordinate system.
  const points = series.map((point, index) => (
    `${72 + (index / (series.length - 1)) * 700},${270 - (point.value / maxValue) * 240}`
  )).join(' ');
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
        <div><dt>Mapped location</dt><dd>{variable.location}</dd></div>
        <div><dt>Run</dt><dd>{variable.runName}</dd></div>
        <div><dt>Category</dt><dd>{variable.category}</dd></div>
        <div><dt>Units</dt><dd>{variable.units}</dd></div>
        <div><dt>Interval</dt><dd>{variable.interval}</dd></div>
        <div><dt>Date range</dt><dd>{dateRange}</dd></div>
      </dl>

      <figure className="variable-chart-card" aria-labelledby="variable-chart-heading">
        <h3 id="variable-chart-heading">Variable chart</h3>
        <div className="variable-chart-scroll" role="region" aria-label="Variable chart" tabIndex={0}>
          <svg viewBox="0 0 800 320" role="img" aria-labelledby="variable-chart-title" aria-describedby="variable-chart-description">
            <title id="variable-chart-title">{variable.identifier} in {variable.runName}</title>
            <desc id="variable-chart-description">
              {variable.location}, {variable.category}. Values in {variable.units} at {variable.interval} intervals, {dateRange}.
            </desc>
            <text x="72" y="18" className="variable-chart-label">{variable.units}</text>
            {ticks.map(tick => (
              <g key={tick}>
                <line x1="72" x2="772" y1={270 - tick * 240} y2={270 - tick * 240} className="variable-chart-grid" />
                <text x="60" y={275 - tick * 240} textAnchor="end" className="variable-chart-label">
                  {Math.round(tick * maxValue).toLocaleString('en-US')}
                </text>
              </g>
            ))}
            <line x1="72" x2="72" y1="30" y2="270" className="variable-chart-axis" />
            <line x1="72" x2="772" y1="270" y2="270" className="variable-chart-axis" />
            <polyline points={points} className="variable-chart-line" />
            <text x="72" y="300" className="variable-chart-label">{formatMonth(variable.startMonth)}</text>
            <text x="422" y="300" textAnchor="middle" className="variable-chart-label">
              {formatMonth(series[Math.floor(series.length / 2)].date.slice(0, 7))}
            </text>
            <text x="772" y="300" textAnchor="end" className="variable-chart-label">{formatMonth(variable.endMonth)}</text>
          </svg>
        </div>
        <figcaption>{variable.identifier} · {variable.interval} · {variable.units}</figcaption>
      </figure>
    </section>
  );
}

export default VariableDetails;
