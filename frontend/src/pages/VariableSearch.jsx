import { useState } from 'react';
import { getVariableSearchData } from '../data/variableSearch.js';
import { searchVariables } from '../features/variableSearch/searchVariables.js';
import './VariableSearch.css';

const defaultFilters = { runId: '', category: '', units: '', interval: '' };

function VariableSearch({ onNavigate }) {
  const [data] = useState(getVariableSearchData);
  const [keyword, setKeyword] = useState('');
  const [submittedKeyword, setSubmittedKeyword] = useState('');
  const [filters, setFilters] = useState(defaultFilters);
  const activeRun = data.runs[0];
  const results = searchVariables(data.variables, submittedKeyword, filters);
  const categories = [...new Set(data.variables.map(variable => variable.category))].sort();
  const units = [...new Set(data.variables.map(variable => variable.units))].sort();
  const intervals = [...new Set(data.variables.map(variable => variable.interval))].sort();

  function updateFilter(name, value) {
    setFilters({ ...filters, [name]: value });
  }

  function handleSearch(event) {
    event.preventDefault();
    setSubmittedKeyword(keyword);
  }

  return (
    <main className="variable-search-page" aria-labelledby="variable-search-title">
      <header className="variable-search-header">
        <h1 id="variable-search-title">Variable and Location Search</h1>
        <p className="variable-search-active-run"><strong>Active run:</strong> {activeRun.name}</p>
      </header>

      <div className="variable-search-content">
        <p className="variable-search-subtitle">Find CalSim 3 variables by identifier or mapped location.</p>

        <section className="variable-search-controls" aria-label="Search and filters">
          <form className="variable-search-form" role="search" aria-label="Variable search" onSubmit={handleSearch}>
            <label htmlFor="variable-keyword">Keyword</label>
            <div className="variable-search-input-row">
              <input
                id="variable-keyword"
                type="search"
                placeholder="Search identifier or location, e.g. storage"
                value={keyword}
                onChange={event => setKeyword(event.target.value)}
              />
              <button type="submit" className="variable-search-primary">Search</button>
            </div>
          </form>

          <div className="variable-search-filter-row">
            <label htmlFor="variable-run">Run
              <select id="variable-run" value={filters.runId} onChange={event => updateFilter('runId', event.target.value)}>
                <option value="">All runs</option>
                {data.runs.map(run => <option key={run.id} value={run.id}>{run.name}</option>)}
              </select>
            </label>
            <label htmlFor="variable-category">Category
              <select id="variable-category" value={filters.category} onChange={event => updateFilter('category', event.target.value)}>
                <option value="">All categories</option>
                {categories.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
            </label>
            <label htmlFor="variable-units">Units
              <select id="variable-units" value={filters.units} onChange={event => updateFilter('units', event.target.value)}>
                <option value="">All units</option>
                {units.map(unit => <option key={unit} value={unit}>{unit}</option>)}
              </select>
            </label>
            <label htmlFor="variable-interval">Interval
              <select id="variable-interval" value={filters.interval} onChange={event => updateFilter('interval', event.target.value)}>
                <option value="">All intervals</option>
                {intervals.map(interval => <option key={interval} value={interval}>{interval}</option>)}
              </select>
            </label>
            <button type="button" onClick={() => setFilters(defaultFilters)}>Clear Filters</button>
          </div>
        </section>

        <section className="variable-search-results" aria-labelledby="variable-results-title">
          <div className="variable-search-results-heading">
            <h2 id="variable-results-title">Search results</h2>
            <p role="status">{results.length} matching {results.length === 1 ? 'variable' : 'variables'}</p>
          </div>
          <div className="variable-search-table-scroll" role="region" aria-label="Variable results table" tabIndex={0}>
            <table>
              <caption>Variable search results</caption>
              <thead><tr><th scope="col">Identifier</th><th scope="col">Location</th></tr></thead>
              <tbody>
                {results.map(variable => (
                  <tr key={variable.id}>
                    <td>{variable.identifier}</td>
                    <td>{variable.location}</td>
                  </tr>
                ))}
              </tbody>
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
