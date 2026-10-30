import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import './Dashboard.css';

// The team's data integration can supply this summary when it becomes available.
const emptySummary = {
  importedRuns: 0,
  timeSeries: 0,
  variables: 0,
  lastImport: null,
};

const quickActions = [
  { label: 'Import HEC-DSS', destination: 'import-data', primary: true },
  { label: 'Search variables', destination: 'variable-search' },
  { label: 'Compare runs', destination: 'compare-runs' },
  { label: 'Detect anomalies', destination: 'anomaly-detection' },
];

const activityTypes = {
  'import-completed': { label: 'Import completed', destination: 'simulation-runs', color: 'green' },
  'chart-viewed': { label: 'Chart viewed', destination: 'data-explorer', color: 'blue' },
  'comparison-saved': { label: 'Comparison saved', destination: 'compare-runs', color: 'blue' },
};

function timestampOrZero(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function relativeActivityTime(timestamp, now) {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (minutes === 0) return 'Just now';
  const formatter = new Intl.RelativeTimeFormat('en', { style: 'short', numeric: 'always' });
  if (minutes < 60) return formatter.format(-minutes, 'minute');
  if (minutes < 1440) return formatter.format(-Math.floor(minutes / 60), 'hour');
  return formatter.format(-Math.floor(minutes / 1440), 'day');
}

function RecentActivity({ activities, onNavigate }) {
  const [now, setNow] = useState(Date.now);
  const entries = activities
    .filter(activity => Object.hasOwn(activityTypes, activity.type))
    .toSorted((a, b) => timestampOrZero(b.occurredAt) - timestampOrZero(a.occurredAt));

  useEffect(() => {
    if (entries.length === 0) return;
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, [entries.length]);

  return (
    <section className="dashboard-activity" aria-labelledby="recent-activity-title">
      <h2 id="recent-activity-title">Recent activity</h2>
      {entries.length === 0 ? <p className="dashboard-empty">No recent activity yet.</p> : (
        <ul className="dashboard-activity-list">
          {entries.map(activity => {
            const details = activityTypes[activity.type];
            const timestamp = Date.parse(activity.occurredAt);
            return (
              <li key={activity.id}>
                <button type="button" onClick={() => onNavigate(details.destination)}>
                  <span className={`dashboard-activity-icon dashboard-activity-icon--${details.color}`} aria-hidden="true" />
                  <span className="dashboard-activity-text">
                    <span className="dashboard-activity-label">{details.label}</span>
                    {Number.isFinite(timestamp) ? (
                      <time dateTime={new Date(timestamp).toISOString()} title={new Date(timestamp).toLocaleString()}>
                        {relativeActivityTime(timestamp, now)}
                      </time>
                    ) : <span className="dashboard-activity-time">Time unavailable</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Dashboard({ summary = emptySummary, onNavigate, runs = [], activities = [] }) {
  const formatCount = value => new Intl.NumberFormat().format(value);
  const lastImport = summary.lastImport
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(summary.lastImport))
    : 'No imports yet';
  const cards = [
    { label: 'Imported runs', value: formatCount(summary.importedRuns), color: 'blue' },
    { label: 'Time series', value: formatCount(summary.timeSeries), color: 'teal' },
    { label: 'Variables', value: formatCount(summary.variables), color: 'purple' },
    { label: 'Last import', value: lastImport, color: 'green' },
  ];
  // These records come from the same supplied run list as the active-run selector.
  const recentRuns = runs.toSorted((a, b) => timestampOrZero(b.importedAt) - timestampOrZero(a.importedAt));

  return (
    <main className="dashboard" aria-labelledby="dashboard-title">
      <PageHeader id="dashboard-title" title="Dashboard" />
      <div className="dashboard-content">
        <p className="dashboard-subtitle">Overview of imported CalSim 3 simulation results</p>
        <dl className="dashboard-summary" aria-label="Imported simulation data summary">
          {cards.map(card => (
            <div className="dashboard-card" key={card.label}>
              <dt>
                <span className={`dashboard-card-icon dashboard-card-icon--${card.color}`} aria-hidden="true" />
                {card.label}
              </dt>
              <dd>{card.value}</dd>
            </div>
          ))}
        </dl>
        <section className="dashboard-actions" aria-labelledby="quick-actions-title">
          <h2 id="quick-actions-title">Quick actions</h2>
          <div className="dashboard-action-buttons">
            {quickActions.map(action => (
              <button
                key={action.destination}
                type="button"
                className={action.primary ? 'dashboard-action dashboard-action--primary' : 'dashboard-action'}
                onClick={() => onNavigate(action.destination)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </section>
        <div className="dashboard-recent">
          <section className="dashboard-recent-runs" aria-labelledby="recent-runs-title">
            <h2 id="recent-runs-title">Recent simulation runs</h2>
            <div className="dashboard-runs-table-wrap" role="region" aria-label="Recent simulation runs table" tabIndex={0}>
              <table className="dashboard-runs-table" aria-labelledby="recent-runs-title">
                <thead>
                  <tr>
                    <th scope="col">Run</th>
                    <th scope="col">Source file</th>
                    <th scope="col">Date range</th>
                    <th scope="col">Series</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map(run => (
                    <tr key={run.id}>
                      <th scope="row">{run.name}</th>
                      <td>{run.source ?? '—'}</td>
                      <td>{run.dateRange ?? '—'}</td>
                      <td>{Number.isFinite(run.series) ? formatCount(run.series) : '—'}</td>
                      <td>{run.status ?? '—'}</td>
                    </tr>
                  ))}
                  {recentRuns.length === 0 && (
                    <tr><td colSpan={5} className="dashboard-empty">No imported runs yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
          <RecentActivity activities={activities} onNavigate={onNavigate} />
        </div>
      </div>
    </main>
  );
}

export default Dashboard;
