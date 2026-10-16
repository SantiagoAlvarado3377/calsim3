import './Dashboard.css';

// The team's data integration can supply this summary when it becomes available.
const emptySummary = {
  importedRuns: 0,
  timeSeries: 0,
  variables: 0,
  lastImport: null,
};

function Dashboard({ summary = emptySummary }) {
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
      </div>
    </main>
  );
}

export default Dashboard;
