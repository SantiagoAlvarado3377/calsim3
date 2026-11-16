import { useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import './SimulationRuns.css';

// Figma sample data for SCRUM-135. No file import or backend connection yet.
const sampleRuns = [
  { id: 'baseline-2025', name: 'Baseline 2025', source: 'baseline_sample.dss', imported: 'Sep 30', dateRange: '2000–2025', series: 482, status: 'Ready' },
  { id: 'alternative-a', name: 'Alternative Operations A', source: 'alternative_a.dss', imported: 'Sep 29', dateRange: '2000–2025', series: 421, status: 'In review' },
  { id: 'alternative-b', name: 'Alternative Operations B', source: 'alternative_b.dss', imported: 'Sep 28', dateRange: '2005–2025', series: 381, status: 'Archived' },
];

function SimulationRuns({ runs = sampleRuns }) {
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRunId, setSelectedRunId] = useState(null);

  const searchText = search.trim().toLowerCase();
  const statuses = [...new Set(runs.map(run => run.status).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const displayedRuns = runs
    .filter(run => run.name.toLowerCase().includes(searchText))
    .filter(run => statusFilter === 'all' || run.status === statusFilter)
    .toSorted((a, b) => {
      const comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  const selectedRun = runs.find(run => run.id === selectedRunId);

  function closeDetails() {
    setSelectedRunId(null);
  }

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

          <div className="simulation-runs-filter">
            <label htmlFor="run-status">Status</label>
            <select
              id="run-status"
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value)}
            >
              <option value="all">All statuses</option>
              {statuses.map(status => <option key={status} value={status}>{status}</option>)}
            </select>
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

        <div className={`simulation-runs-layout${selectedRun ? ' simulation-runs-layout--details-open' : ''}`}>
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
                  <th scope="col"><span className="simulation-runs-visually-hidden">Actions</span></th>
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
                    <td className="simulation-runs-action-cell">
                      <button
                        type="button"
                        className="simulation-runs-details-trigger"
                        aria-label={`View details for ${run.name}`}
                        aria-pressed={selectedRunId === run.id}
                        onClick={() => setSelectedRunId(run.id)}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
                {displayedRuns.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <span role="status">No matching runs found.</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {selectedRun && (
            <aside className="simulation-runs-details" aria-labelledby="run-details-title">
              <div className="simulation-runs-details-heading">
                <h2 id="run-details-title">Run details</h2>
                <button
                  type="button"
                  className="simulation-runs-details-close"
                  onClick={closeDetails}
                  aria-label="Close run details"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              <dl className="simulation-runs-details-list">
                <div><dt>Name</dt><dd>{selectedRun.name}</dd></div>
                <div><dt>Source file</dt><dd>{selectedRun.source || '—'}</dd></div>
                <div><dt>Imported date</dt><dd>{selectedRun.imported || '—'}</dd></div>
                <div><dt>Date range</dt><dd>{selectedRun.dateRange || '—'}</dd></div>
                <div><dt>Series count</dt><dd>{selectedRun.series ?? '—'}</dd></div>
                <div><dt>Status</dt><dd>{selectedRun.status || '—'}</dd></div>
              </dl>
            </aside>
          )}
        </div>
      </div>
    </main>
  );
}

export default SimulationRuns;
