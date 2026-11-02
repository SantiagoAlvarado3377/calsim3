import { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import './SimulationRuns.css';

// Figma sample data for SCRUM-135. No file import or backend connection yet.
const sampleRuns = [
  { id: 'baseline-2025', name: 'Baseline 2025', source: 'baseline_sample.dss', imported: 'Sep 30', dateRange: '2000–2025', series: 482, status: 'Ready' },
  { id: 'alternative-a', name: 'Alternative Operations A', source: 'alternative_a.dss', imported: 'Sep 29', dateRange: '2000–2025', series: 421, status: 'Ready' },
  { id: 'alternative-b', name: 'Alternative Operations B', source: 'alternative_b.dss', imported: 'Sep 28', dateRange: '2005–2025', series: 381, status: 'Ready' },
];

function SimulationRuns({ runs = sampleRuns }) {
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');

  const searchText = search.trim().toLowerCase();

  const displayedRuns = runs
    .filter(run => run.name.toLowerCase().includes(searchText))
    .sort((a, b) => {
      const comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  return (
    <main className="simulation-runs" aria-labelledby="simulation-runs-title">
      <PageHeader id="simulation-runs-title" title="Simulation Runs" />
      <div className="simulation-runs-content">
        <p className="simulation-runs-subtitle">Saved runs remain separate and linked to their source files</p>
        <p className="simulation-runs-note">Sample data for prototype</p>

        <div className="simulation-runs-controls">
          <div className="simulation-runs-search">
            <label htmlFor="run-search">Search runs</label>
            <input
              id="run-search"
              type="search"
              placeholder="Search runs by name"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>

          <div className="simulation-runs-sort">
            <label htmlFor="run-sort">Sort by</label>
            <select
              id="run-sort"
              value={sortOrder}
              onChange={event => setSortOrder(event.target.value)}
            >
              <option value="asc">Name: A–Z</option>
              <option value="desc">Name: Z–A</option>
            </select>
          </div>
        </div>

        <div className="simulation-runs-table-wrap" role="region" aria-label="Saved simulation runs" tabIndex={0}>
          <table className="simulation-runs-table">
            <caption>Saved simulation runs</caption>
            <thead>
              <tr>
                <th scope="col">Run</th>
                <th scope="col">Source</th>
                <th scope="col">Imported</th>
                <th scope="col">Date range</th>
                <th scope="col">Series</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayedRuns.map(run => (
                <tr key={run.id}>
                  <th scope="row">{run.name}</th>
                  <td>{run.source}</td>
                  <td>{run.imported}</td>
                  <td>{run.dateRange}</td>
                  <td>{run.series}</td>
                  <td>{run.status}</td>
                </tr>
              ))}
              {displayedRuns.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <span role="status">
                      {searchText
                        ? 'No matching runs found.'
                        : 'No saved simulation runs yet.'}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

export default SimulationRuns;
