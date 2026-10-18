import { useState } from 'react';
import { getVariableSearchData } from '../data/variableSearch.js';
import './VariableSearch.css';

function VariableSearch({ onNavigate }) {
  const [data] = useState(getVariableSearchData);
  const activeRun = data.runs[0];

  return (
    <main className="variable-search-page" aria-labelledby="variable-search-title">
      <header className="variable-search-header">
        <h1 id="variable-search-title">Variable and Location Search</h1>
        <p className="variable-search-active-run"><strong>Active run:</strong> {activeRun.name}</p>
      </header>

      <div className="variable-search-content">
        <p className="variable-search-subtitle">Find CalSim 3 variables by identifier or mapped location.</p>
        <p className="variable-search-sample-note">Sample data for the UI prototype.</p>

        <section className="variable-search-controls" aria-label="Search and filters">
          <form className="variable-search-form" onSubmit={event => event.preventDefault()}>
            <label htmlFor="variable-keyword">Keyword</label>
            <div className="variable-search-input-row">
              <input id="variable-keyword" type="search" placeholder="Search identifier or location, e.g. storage" />
              <button type="submit" className="variable-search-primary" disabled>Search</button>
            </div>
          </form>

          <div className="variable-search-filter-row">
            <label htmlFor="variable-run">Run
              <select id="variable-run" disabled><option>{activeRun.name}</option></select>
            </label>
            <label htmlFor="variable-category">Category
              <select id="variable-category" disabled><option>All categories</option></select>
            </label>
            <label htmlFor="variable-units">Units
              <select id="variable-units" disabled><option>All units</option></select>
            </label>
            <label htmlFor="variable-interval">Interval
              <select id="variable-interval" disabled><option>All intervals</option></select>
            </label>
            <button type="button" disabled>Clear Filters</button>
          </div>
        </section>

        <section className="variable-search-results" aria-labelledby="variable-results-title">
          <h2 id="variable-results-title">Search results</h2>
          <div className="variable-search-table-scroll" role="region" aria-label="Variable results table" tabIndex={0}>
            <table>
              <caption>Variable search results</caption>
              <thead><tr><th scope="col">Identifier</th><th scope="col">Location</th></tr></thead>
              <tbody />
            </table>
          </div>
        </section>

        <div className="variable-search-actions">
          <button type="button" onClick={() => onNavigate('compare-runs')}>Compare Runs</button>
          <button type="button" onClick={() => onNavigate('anomaly-detection')}>Analyze Anomalies</button>
        </div>
      </div>
    </main>
  );
}

export default VariableSearch;
