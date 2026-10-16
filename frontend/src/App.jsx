import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import DataExplorer from './pages/DataExplorer';
import './App.css';

const destinations = {
  'import-data': 'Import Data',
  'variable-search': 'Variable Search',
  'compare-runs': 'Compare Runs',
  'anomaly-detection': 'Anomaly Detection',
};

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

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h2>CalSim 3 Copilot</h2>
        <nav aria-label="Main navigation">
          <button
            type="button"
            onClick={() => setCurrentPage('dashboard')}
            aria-current={currentPage === 'dashboard' ? 'page' : undefined}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setCurrentPage('data-explorer')}
            aria-current={currentPage === 'data-explorer' ? 'page' : undefined}
          >
            Data Explorer
          </button>
        </nav>
      </aside>
      {currentPage === 'dashboard' ? (
        <Dashboard onNavigate={setCurrentPage} />
      ) : currentPage === 'data-explorer' ? (
        <DataExplorer />
      ) : (
        <DestinationPage title={destinations[currentPage]} />
      )}
    </div>
  );
}

export default App;
