import { useState } from 'react';
import DataExplorer from './pages/DataExplorer';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('');

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h2>CalSim 3 Copilot</h2>

        <nav aria-label="Main navigation">
          <button
            type="button"
            onClick={() => setCurrentPage('data-explorer')}
            aria-current={currentPage === 'data-explorer' ? 'page' : undefined}
          >
            Data Explorer
          </button>
        </nav>
      </aside>

      {/* opens the page when Data Explorer is selected */}
      {currentPage === 'data-explorer' ? (
        <DataExplorer />
      ) : (
        <main className="welcome">
          <p>Select Data Explorer to open your workspace.</p>
        </main>
      )}
    </div>
  );
}

export default App;