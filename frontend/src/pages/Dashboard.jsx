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

function Dashboard({ summary = emptySummary, onNavigate }) {
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

  return (
    <main className="dashboard" aria-labelledby="dashboard-title">
      <header className="dashboard-header">
        <h1 id="dashboard-title">Dashboard</h1>
      </header>
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
      </div>
    </main>
  );
}

export default Dashboard;
