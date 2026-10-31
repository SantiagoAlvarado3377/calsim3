import { searchErrorMessages } from './loadDssVariables.js';

// Placeholder copy and layout. SCRUM-148 owns the final empty-state design.

// SCRUM-158
export function LoadingState({ fileName }) {
  return <p className="variable-search-state" role="status">Loading variables from {fileName}…</p>;
}

// SCRUM-148 / SCRUM-162
export function EmptyState({ onReset }) {
  return (
    <div className="variable-search-state">
      <p>No variables match your search.</p>
      <div className="variable-search-state-actions">
        <button type="button" onClick={onReset}>Reset Search</button>
      </div>
    </div>
  );
}

// SCRUM-149 / SCRUM-150
export function ErrorState({ error, onRetry, onReimport }) {
  const unreadableFile = error.kind === 'dataUnavailable';

  return (
    <div className="variable-search-state variable-search-state--error" role="alert">
      <p>{searchErrorMessages[error.kind]}</p>
      <div className="variable-search-state-actions">
        {/* TODO(SCRUM-150): open the file browser directly instead of going to Import Data. */}
        {unreadableFile && <button type="button" onClick={onReimport}>Re-import File</button>}
        <button type="button" onClick={onRetry}>{unreadableFile ? 'Retry Search' : 'Try Again'}</button>
      </div>
    </div>
  );
}

// SCRUM-163
export function NoImportState({ onImport }) {
  return (
    <div className="variable-search-state">
      <p>Import a CalSim 3 DSS file to search its variables.</p>
      <div className="variable-search-state-actions">
        <button type="button" onClick={onImport}>Import a DSS file</button>
      </div>
    </div>
  );
}
