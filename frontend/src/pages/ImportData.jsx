// Import Data page (SCRUM-114).
// Lets the user choose a completed CalSim 3 run's HEC-DSS (.dss) file, name the
// run, and (in prototype mode) "import" it.
//
// How the pieces fit:
//   ImportData (this file)  -> owns the form state: chosen file, error, run name, description
//   DssDropZone             -> UI for picking a file (drag-and-drop + Browse)
//   validateDssFile         -> the rule for what counts as a valid file
//
// App.jsx also passes an onNavigate prop. This page doesn't use it yet, so it
// isn't destructured (that keeps ESLint's no-unused-vars quiet). Add it back
// when a later story needs to send the user somewhere after importing.
 
import { useEffect, useState } from 'react';
import { mockSimulationRuns } from '../data/mockSimulationRuns.js';
import DssDropZone from '../features/importData/DssDropZone.jsx';
import { validateDssFile } from '../features/importData/validateDssFile.js';
import './ImportData.css'; // page-specific styles, same pattern as the other pages
 
// Starting values for the text fields. Kept in one object so Cancel can reset
// everything in one line.
const emptyFields = { runName: '', description: '' };
 
// Same rule Variable Search uses: with no app-wide "active run" yet, show the
// first mock run so both pages agree.
const activeRunName = mockSimulationRuns[0]?.name ?? 'None';
 
function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v5 M12 8h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
 
function ImportData() {
  // The File object the user chose (or null). Holding the whole File (not just
  // its name) means a later story can actually read or upload the contents.
  const [selectedFile, setSelectedFile] = useState(null);
  // Message for the drop zone's error state ('' = no error).
  const [fileError, setFileError] = useState('');
  const [fields, setFields] = useState(emptyFields);
  // Feedback shown after clicking Import Data ('' = nothing to show).
  const [statusMessage, setStatusMessage] = useState('');
 
  // Safety net: if someone drops a file just OUTSIDE the drop zone, the
  // browser's default is to open that file and navigate away, which would
  // wipe the app (and in Electron, replace the whole window). Cancelling
  // dragover/drop on the window while this page is open prevents that.
  // The drop zone's own handlers still run first, so real drops work.
  useEffect(() => {
    function blockDefault(event) {
      event.preventDefault();
    }
    window.addEventListener('dragover', blockDefault);
    window.addEventListener('drop', blockDefault);
    // Cleanup runs when the user leaves the page, so other pages are unaffected.
    return () => {
      window.removeEventListener('dragover', blockDefault);
      window.removeEventListener('drop', blockDefault);
    };
  }, []);
 
  // Called by DssDropZone with an array of files, from either a drop or Browse.
  function handleFilesChosen(files) {
    setStatusMessage(''); // a new choice makes any old "ready" message stale
 
    if (files.length > 1) {
      setSelectedFile(null);
      setFileError('Choose only one .dss file at a time.');
      return;
    }
 
    // SCRUM-118: invalid files go to the error state AND clear any previously
    // chosen file, so the Import button can't submit a stale file.
    const { valid, error } = validateDssFile(files[0]);
    if (!valid) {
      setSelectedFile(null);
      setFileError(error);
      return;
    }
 
    // SCRUM-117 / 119: store the valid file in form state; the drop zone
    // shows its name and the Import button can enable.
    setSelectedFile(files[0]);
    setFileError('');
  }
 
  function clearFile() {
    setSelectedFile(null);
    setFileError('');
    setStatusMessage('');
  }
 
  // One handler for both inputs: the input's `name` attribute says which key
  // of `fields` to update. Spread (...) copies the other field unchanged.
  function handleFieldChange(event) {
    const { name, value } = event.target;
    setFields(current => ({ ...current, [name]: value }));
    setStatusMessage('');
  }
 
  // SCRUM-119: the form is valid only with BOTH a valid file AND a run name.
  // trim() so a name that's only spaces doesn't count.
  // This is "derived state": calculated from existing state on every render
  // rather than stored separately, so it can never get out of sync.
  const isFormValid = selectedFile !== null && fields.runName.trim() !== '';
 
  function handleSubmit(event) {
    event.preventDefault(); // stop the browser's default full-page form submit
    if (!isFormValid) return; // belt and braces; the button is disabled anyway
 
    // Prototype mode: actually reading and storing the run is a later story.
    // For now, confirm what WOULD be imported so the workflow can be demoed.
    setStatusMessage(
      `Prototype mode: "${fields.runName.trim()}" from ${selectedFile.name} is ready to import.`,
    );
  }
 
  function handleCancel() {
    setSelectedFile(null);
    setFileError('');
    setFields(emptyFields);
    setStatusMessage('');
  }
 
  return (
    <main className="import-data-page" aria-labelledby="import-data-title">
      {/* Header matches the Variable Search layout: title on the left,
          active run pill on the right. */}
      <header className="import-data-header">
        <h1 id="import-data-title">Import Data</h1>
        <p className="import-data-active-run"><strong>Active run:</strong> {activeRunName}</p>
      </header>
 
      <div className="import-data-content">
        <p className="import-data-subtitle">
          Add a completed CalSim 3 simulation run from an HEC-DSS file
        </p>
 
        {/* noValidate turns off the browser's own "Please fill out this field"
            popups; we handle validity ourselves via the disabled button. */}
        <form className="import-data-card" aria-label="Import simulation run" onSubmit={handleSubmit} noValidate>
          <DssDropZone
            selectedFile={selectedFile}
            error={fileError}
            onFilesChosen={handleFilesChosen}
            onClearFile={clearFile}
          />
 
          <div className="import-data-fields">
            <label htmlFor="import-run-name">
              Run name
              <input
                id="import-run-name"
                name="runName"
                type="text"
                placeholder="Baseline 2025"
                value={fields.runName}
                onChange={handleFieldChange}
                required
                autoComplete="off"
              />
            </label>
            <label htmlFor="import-description">
              Description
              <input
                id="import-description"
                name="description"
                type="text"
                placeholder="Reference simulation run"
                value={fields.description}
                onChange={handleFieldChange}
                autoComplete="off"
              />
            </label>
          </div>
 
          <p className="import-data-note">
            <InfoIcon />
            Imported results remain separate and associated with their simulation run and source file.
          </p>
 
          <p className="import-data-prototype-note">
            Prototype mode: importing demonstrates the workflow using sample simulation results.
          </p>
 
          {/* role="status" = polite live region: screen readers read the
              message when it appears. Hidden by CSS while empty. */}
          <p className="import-data-status" role="status">{statusMessage}</p>
 
          <div className="import-data-actions">
            <button type="button" onClick={handleCancel}>Cancel</button>
            <button type="submit" className="import-data-primary" disabled={!isFormValid}>
              Import Data
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
 
export default ImportData;