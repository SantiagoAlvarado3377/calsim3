import { formatMonthRange } from './comparisonModel.js';

const baselinePoints = '52,310 128,254 205,272 282,204 359,180 436,218 513,163 590,198 667,148 744,170 821,126 898,154';
const alternativePoints = '52,300 128,236 205,260 282,182 359,164 436,205 513,108 590,180 667,133 744,163 821,116 898,151';

function PrototypeAction({ children }) {
  return (
    <button className="comparison-prototype-action" type="button" disabled>
      {children}
      <span>Prototype only</span>
    </button>
  );
}

export function ComparisonPreview({ baselineName, alternativeName, dateRange, hasOverlap }) {
  return (
    <section className="comparison-results" aria-label="Comparison preview">
      <article className="comparison-chart-card">
        <div className="comparison-card-heading">
          <div>
            <h2>Baseline and Alternative Storage</h2>
            <p className="prototype-data-label">Prototype chart data</p>
          </div>
          <div className="comparison-legend" aria-label="Chart legend">
            <span><i className="comparison-legend-line comparison-legend-line--baseline" />Baseline</span>
            <span><i className="comparison-legend-line comparison-legend-line--alternative" />Alternative</span>
          </div>
        </div>
        <div className="comparison-chart" aria-label="Prototype line chart">
          <span className="comparison-chart-unit">TAF</span>
          <svg viewBox="0 0 950 390" role="img" aria-labelledby="prototype-chart-title prototype-chart-description">
            <title id="prototype-chart-title">Baseline and alternative storage prototype</title>
            <desc id="prototype-chart-description">Static prototype series shown for layout only.</desc>
            <g className="comparison-chart-grid">
              <line x1="52" y1="40" x2="920" y2="40" />
              <line x1="52" y1="126" x2="920" y2="126" />
              <line x1="52" y1="212" x2="920" y2="212" />
              <line x1="52" y1="298" x2="920" y2="298" />
              <line x1="52" y1="350" x2="920" y2="350" />
            </g>
            <g className="comparison-chart-y-labels">
              <text x="12" y="45">800</text>
              <text x="12" y="131">650</text>
              <text x="12" y="217">500</text>
              <text x="12" y="303">350</text>
              <text x="12" y="355">200</text>
            </g>
            <line className="comparison-chart-axis" x1="52" y1="40" x2="52" y2="350" />
            <line className="comparison-chart-axis" x1="52" y1="350" x2="920" y2="350" />
            <polyline className="comparison-chart-series comparison-chart-series--baseline" points={baselinePoints} />
            <polyline className="comparison-chart-series comparison-chart-series--alternative" points={alternativePoints} />
            <g className="comparison-chart-x-labels">
              <text x="44" y="382">Jan</text>
              <text x="198" y="382">Mar</text>
              <text x="351" y="382">May</text>
              <text x="506" y="382">Jul</text>
              <text x="660" y="382">Sep</text>
              <text x="814" y="382">Nov</text>
            </g>
          </svg>
        </div>
        <p className="comparison-chart-caption">
          {baselineName ?? 'Baseline'} vs. {alternativeName ?? 'Alternative'} · {formatMonthRange(dateRange)}
        </p>
      </article>

      <aside className="comparison-summary-card" aria-label="Prototype comparison summary">
        <p className="prototype-data-label">Prototype summary data</p>
        <dl>
          <div>
            <dt>Average difference</dt>
            <dd>+22 TAF</dd>
          </div>
          <div>
            <dt>Maximum difference</dt>
            <dd>+71 TAF</dd>
          </div>
          <div>
            <dt>Comparable months</dt>
            <dd>72</dd>
          </div>
        </dl>
        <p className={hasOverlap ? 'comparison-overlap-status' : 'comparison-overlap-status comparison-overlap-status--invalid'}>
          <span aria-hidden="true">{hasOverlap ? '✓' : '!'}</span>
          {hasOverlap ? 'Overlap confirmed' : 'Overlap unavailable'}
        </p>
        <p className="comparison-summary-unit">Monthly / TAF</p>
        <PrototypeAction>Save Comparison</PrototypeAction>
      </aside>
    </section>
  );
}

export { PrototypeAction };
