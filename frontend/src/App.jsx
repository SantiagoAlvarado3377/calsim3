import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import DataExplorer from './pages/DataExplorer';
import CompareRuns from './pages/CompareRuns';
import VariableSearch from './pages/VariableSearch';
import ImportData from './pages/ImportData'; 
import SimulationRuns from './pages/SimulationRuns';
import PageHeader from './components/PageHeader.jsx';
import { ActiveRunContext } from './components/ActiveRunContext.js';
import './App.css';

const destinations = {
    'import-data': 'Import Data',
    'variable-search': 'Variable Search',
    'compare-runs': 'Compare Runs',
    'anomaly-detection': 'Anomaly Detection',
};

const sidebarDestinations = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'simulation-runs', label: 'Simulation Runs' },
    { id: 'data-explorer', label: 'Data Explorer' },
    { id: 'variable-search', label: 'Variable Search' },
    { id: 'compare-runs', label: 'Compare Runs' },
    { id: 'import-data', label: 'Import Data' },
];

// Only navigation destinations are provided here; their features belong to later work.
function DestinationPage({ title, onNavigate }) {
    return (
        <main className="data-explorer" aria-labelledby="destination-title">
            <PageHeader id="destination-title" title={title} />
            <div className="destination-content">
                <button type="button" onClick={() => onNavigate('variable-search')}>Return to variable search</button>
            </div>
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

function PageContent({ currentPage, onNavigate, importedRuns, recentActivity, onImport }) {
    if (currentPage === 'dashboard') {
        return (
            <Dashboard
                onNavigate={onNavigate}
                runs={importedRuns}
                activities={recentActivity}
            />
        );
    }
    if (currentPage === 'simulation-runs') return <SimulationRuns />;
    if (currentPage === 'data-explorer') return <DataExplorer />;
    if (currentPage === 'compare-runs') return <CompareRuns />;
    if (currentPage === 'variable-search') return <VariableSearch onNavigate={onNavigate} />;
    if (currentPage === 'import-data') return <ImportData onNavigate={onNavigate} onImport={onImport} />;

    return <DestinationPage title={destinations[currentPage]} onNavigate={onNavigate} />;
}

function App({ importedRuns = [], recentActivity = [] }) {
    const [currentPage, setCurrentPage] = useState('dashboard');
    // Runs imported during this session, each with the File the user chose
    // (SCRUM-163). Saving them between sessions belongs to SCRUM-125.
    const [runs, setRuns] = useState(importedRuns);
    // Keep the selection above the pages so navigation doesn't reset it.
    const [selectedRunId, setSelectedRunId] = useState('');
    const activeRunId = runs.some(run => run.id === selectedRunId)
        ? selectedRunId
        : runs[0]?.id ?? '';

    // A newly imported run becomes the active run.
    function addRun(run) {
        setRuns(current => [...current, run]);
        setSelectedRunId(run.id);
    }

    // SCRUM-150: Re-import File swaps in a new file for the same run.
    function replaceRunFile(runId, file) {
        setRuns(current => current.map(run => (run.id === runId ? { ...run, file, source: file.name } : run)));
    }

    return (
        <ActiveRunContext.Provider value={{ runs, activeRunId, onActiveRunChange: setSelectedRunId, onRunFileChange: replaceRunFile }}>
            <div className={`app-layout app-layout--${currentPage}`}>
                <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
                <PageContent
                    currentPage={currentPage}
                    onNavigate={setCurrentPage}
                    importedRuns={runs}
                    recentActivity={recentActivity}
                    onImport={addRun}
                />
            </div>
        </ActiveRunContext.Provider>
    );
}

export default App;
