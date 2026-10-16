import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import DataExplorer from './pages/DataExplorer';
import './App.css';

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
        <Dashboard />
      ) : (
        <DataExplorer />
      )}
    </div>
  );
}

export default App;
