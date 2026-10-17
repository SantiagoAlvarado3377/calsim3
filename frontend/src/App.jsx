import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import DataExplorer from './pages/DataExplorer';
import CompareRuns from './pages/CompareRuns';
import './App.css';

const destinations = {
  'import-data': 'Import Data',
  'variable-search': 'Variable Search',
  'compare-runs': 'Compare Runs',
  'anomaly-detection': 'Anomaly Detection',
};

const sidebarDestinations = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'data-explorer', label: 'Data Explorer' },
  { id: 'compare-runs', label: 'Compare Runs' },
];

// Only navigation destinations are provided here; their features belong to later work.
function DestinationPage({ title }) {
  return (
    <main className="data-explorer" aria-labelledby="destination-title">
      <header className="data-explorer-header">
        <h1 id="destination-title">{title}</h1>
      </header>
    </main>
  );
}

function Sidebar({ currentPage, onNavigate }) {
  return (
    <aside className="sidebar">
      <h2>CalSim 3 Copilot</h2>
      <nav aria-label="Main navigation">
        {sidebarDestinations.map(destination => (
          <button
            key={destination.id}
            type="button"
            onClick={() => onNavigate(destination.id)}
            aria-current={currentPage === destination.id ? 'page' : undefined}
          >
            {destination.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function PageContent({ currentPage, onNavigate }) {
  if (currentPage === 'dashboard') return <Dashboard onNavigate={onNavigate} />;
  if (currentPage === 'data-explorer') return <DataExplorer />;
  if (currentPage === 'compare-runs') return <CompareRuns />;

  return <DestinationPage title={destinations[currentPage]} />;
}

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  return (
    <div className={`app-layout${currentPage === 'compare-runs' ? ' app-layout--compare-runs' : ''}`}>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <PageContent currentPage={currentPage} onNavigate={setCurrentPage} />
    </div>
  );
}

export default App;
