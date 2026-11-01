import { useRef, useState } from 'react';
import { validateDssFile } from '../importData/validateDssFile.js';
import { searchErrorMessages } from './loadDssVariables.js';

// SCRUM-158: shown while the imported DSS file is being read.
export function LoadingState({ fileName }) {
  return (
    <p className="variable-search-state variable-search-state--loading" role="status">
      <span className="variable-search-spinner" aria-hidden="true" />
      Loading variables from {fileName}…
    </p>
  );
}

// SCRUM-148 / SCRUM-162: replaces the table when nothing matches.
export function EmptyState({ onReset }) {
  return (
    <div className="variable-search-state">
      <p className="variable-search-state-title">No variables match your search.</p>
      <p>Try a broader keyword, or reset the search to see every variable again.</p>
      <div className="variable-search-state-actions">
        <button type="button" onClick={onReset}>Reset Search</button>
      </div>
    </div>
  );
}

// SCRUM-149 / SCRUM-150: a failed search, or a file that can't be read.
// Re-import File opens the file browser and hands the new file to onReimport.
export function ErrorState({ error, onRetry, onReimport }) {
  const fileInputRef = useRef(null);
  const [fileError, setFileError] = useState('');
  const unreadableFile = error.kind === 'dataUnavailable';

  function handleFileChosen(event) {
    const [file] = event.target.files;
    event.target.value = ''; // lets the same file be chosen again
    if (!file) return;

    const { valid, error: message } = validateDssFile(file);
    setFileError(message);
    if (valid) onReimport(file);
  }

  return (
    <div className="variable-search-state variable-search-state--error" role="alert">
      <p className="variable-search-state-title">{searchErrorMessages[error.kind]}</p>
      {fileError && <p>{fileError}</p>}
      <div className="variable-search-state-actions">
        {unreadableFile && onReimport && (
          <>
            <button type="button" className="variable-search-primary" onClick={() => fileInputRef.current.click()}>
              Re-import File
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".dss"
              hidden
              aria-label="Choose HEC-DSS file to re-import"
              onChange={handleFileChosen}
            />
          </>
        )}
        <button type="button" onClick={onRetry}>{unreadableFile ? 'Retry Search' : 'Try Again'}</button>
      </div>
    </div>
  );
}

// SCRUM-163: nothing imported yet.
export function NoImportState({ onImport, onUseSample }) {
  return (
    <div className="variable-search-state">
      <p className="variable-search-state-title">Import a CalSim 3 DSS file to search its variables.</p>
      <p>The file is read on this computer; nothing is uploaded.</p>
      <div className="variable-search-state-actions">
        <button type="button" className="variable-search-primary" onClick={onImport}>Import a DSS file</button>
        <button type="button" onClick={onUseSample}>Explore sample data</button>
      </div>
    </div>
  );
}
