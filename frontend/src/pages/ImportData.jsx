// Import Data page (SCRUM-114).
// Lets the user choose a completed CalSim 3 run's HEC-DSS (.dss) file, name the
// run, and import it for this session (Variable Search reads the file locally).
//
// How the pieces fit:
//   ImportData (this file)  -> owns the form state: chosen file, error, run name, description
//   DssDropZone             -> UI for picking a file (drag-and-drop + Browse)
//   validateDssFile         -> the rule for what counts as a valid file
//   fileNameToRunName       -> suggests a run name from the file name (SCRUM-122)
//   validateRunMetadata     -> rules + messages for Run name / Description (SCRUM-124)
//
// App.jsx also passes an onNavigate prop. This page doesn't use it yet, so it
// isn't destructured (that keeps ESLint's no-unused-vars quiet). Add it back
// when a later story needs to send the user somewhere after importing.
 
import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader.jsx';
import DssDropZone from '../features/importData/DssDropZone.jsx';
import { validateDssFile } from '../features/importData/validateDssFile.js';
import { fileNameToRunName } from '../features/importData/fileNameToRunName.js';
import { validateRunMetadata } from '../features/importData/validateRunMetadata.js';
import { mockSimulationRuns } from '../data/mockSimulationRuns.js';
import './ImportData.css'; // page-specific styles, same pattern as the other pages
 
// Starting values for the text fields. Kept in one object so Cancel can reset
// everything in one line.
const emptyFields = { runName: '', description: '' };
 
// SCRUM-124: which fields the user has "finished with" at least once (left the
// field, or the field was auto-filled). Errors only show for touched fields,
// so a message doesn't flash at the user while they're still typing.
const untouchedFields = { runName: false, description: false };
 
// SCRUM-124: names already taken, for the duplicate-name rule.
// Prototype: the mock runs. When real storage exists, App can pass the real
// names in through the existingRunNames prop and nothing else here changes.
const mockRunNames = mockSimulationRuns.map(run => run.name);
 
function InfoIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 11v5 M12 8h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
 
// existingRunNames defaults to the mock names; tests or a future storage
// story can pass a different list.
function ImportData({ onImport, existingRunNames = mockRunNames }) {
  // The File object the user chose (or null). Holding the whole File (not just
  // its name) means a later story can actually read or upload the contents.
  const [selectedFile, setSelectedFile] = useState(null);
  // Message for the drop zone's error state ('' = no error).
  const [fileError, setFileError] = useState('');
  const [fields, setFields] = useState(emptyFields);
  // SCRUM-122: has the user typed their own run name?
  //   false -> choosing a file may fill in (or replace) the run name
  //   true  -> leave the run name alone; it's the user's choice
  // Analogy: a "reserved" sign on a seat. Once the user sits down (types), the
  // auto-fill won't take the seat. Clearing the field takes the sign away.
  const [runNameEdited, setRunNameEdited] = useState(false);
  // SCRUM-124: see untouchedFields above.
  const [touched, setTouched] = useState(untouchedFields);
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
 
    // SCRUM-122: suggest a run name from the file name, unless the user has
    // typed their own. This runs ONLY for valid files: the invalid and
    // multi-file cases above `return` early, so they never touch the name.
    // Because it runs on every valid pick, choosing file A then file B (without
    // typing) shows B's name.
    if (!runNameEdited) {
      setFields(current => ({ ...current, runName: fileNameToRunName(files[0].name) }));
      // SCRUM-124: an auto-filled name counts as touched, so if it's a problem
      // (e.g. "Baseline_2025.dss" -> "Baseline 2025", which already exists) the
      // user sees WHY Import is disabled right away, instead of a silent grey button.
      setTouched(current => ({ ...current, runName: true }));
    }
  }
 
  function clearFile() {
    setSelectedFile(null);
    setFileError('');
    setStatusMessage('');
    // If the run name only came from the file (the user never typed one),
    // it belongs to that file, so Remove takes it away too. A name the user
    // typed is kept. (Not in the ticket; a team-agreed default.)
    if (!runNameEdited) {
      setFields(current => ({ ...current, runName: '' }));
      // The name went away with the file, so don't greet the user with
      // "Run name is required." for a field they never touched themselves.
      setTouched(current => ({ ...current, runName: false }));
    }
  }
 
  // One handler for both inputs: the input's `name` attribute says which key
  // of `fields` to update. Spread (...) copies the other field unchanged.
  function handleFieldChange(event) {
    const { name, value } = event.target;
    setFields(current => ({ ...current, [name]: value }));
    setStatusMessage('');
 
    // SCRUM-122: typing in Run name marks it as the user's own...
    // ...unless they cleared it completely, which hands control back to
    // auto-fill so the next file can fill it in again.
    // (Only an EMPTY field counts as cleared; "   " is still user input.)
    if (name === 'runName') {
      setRunNameEdited(value !== '');
    }
  }
 
  // SCRUM-124: blur = the user left the field. From then on that field's
  // error is visible and updates live as they type.
  function handleFieldBlur(event) {
    const { name } = event.target;
    setTouched(current => ({ ...current, [name]: true }));
  }
 
  // SCRUM-124: errors are "derived state": recalculated from the current
  // values on every render instead of stored, so fixing the input clears the
  // error immediately and the errors can never be out of date.
  const errors = validateRunMetadata({
    name: fields.runName,
    description: fields.description,
    existingNames: existingRunNames,
  });
 
  // What to actually SHOW: an error only appears once its field is touched.
  // (The button below uses `errors`, not these, so it's disabled even before
  // the message is visible, e.g. while the Run name is still empty.)
  const visibleErrors = {
    runName: touched.runName ? errors.runName : '',
    description: touched.description ? errors.description : '',
  };
 
  // SCRUM-119 + 124: valid only with a valid file AND no field errors.
  // (An empty run name is an error, "Run name is required.", so this also
  // covers the old "needs a run name" rule.)
  const isFormValid = selectedFile !== null && errors.runName === '' && errors.description === '';
 
  function handleSubmit(event) {
    event.preventDefault(); // stop the browser's default full-page form submit
    // Ticket: errors also appear when Import is clicked. The button is disabled
    // while anything is invalid, so in practice this only matters if a submit
    // sneaks through another way, but marking both touched keeps the rule true.
    setTouched({ runName: true, description: true });
    if (!isFormValid) return; // belt and braces; the button is disabled anyway
 
    // SCRUM-163: hand the run and its File to the app for this session so
    // Variable Search can read it. Saving runs between sessions is SCRUM-125.
    onImport?.({
      id: `run-${Date.now()}`,
      name: fields.runName.trim(),
      description: fields.description.trim(),
      source: selectedFile.name,
      importedAt: new Date().toISOString(),
      file: selectedFile,
    });
    setStatusMessage(
      `"${fields.runName.trim()}" was imported from ${selectedFile.name} and is now the active run.`,
    );
    // Clear the form so the same run isn't added twice.
    setSelectedFile(null);
    setFields(emptyFields);
  }
 
  // SCRUM-123: Cancel = "start over". Put EVERY piece of form state back to its
  // starting value, and stay on this page (no onNavigate call).
  // Checklist of what the earlier subtasks added, so nothing is missed:
  //   SCRUM-114/118/119: selectedFile, fileError, statusMessage
  //   SCRUM-121:         fields (Run name + Description text)
  //   SCRUM-122:         runNameEdited (so the next file auto-fills again)
  //   SCRUM-124:         touched (so no "Run name is required." greets the user)
  // Validation errors don't need resetting: they're derived from fields +
  // touched, so they disappear on their own once those are reset.
  // The hidden <input type="file"> also doesn't need resetting here:
  // DssDropZone clears its value right after every pick, so choosing the same
  // file again after Cancel still fires a change.
  function handleCancel() {
    setSelectedFile(null);
    setFileError('');
    setFields(emptyFields);
    setRunNameEdited(false);
    setTouched(untouchedFields);
    setStatusMessage('');
  }
 
  return (
    <main className="import-data-page" aria-labelledby="import-data-title">
      <PageHeader id="import-data-title" title="Import Data" />
 
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
            {/* Each field = label (with its input) + error line underneath.
                The error <p> sits OUTSIDE the <label> on purpose: text inside
                a label becomes part of the input's accessible name, so the
                field would be announced as "Run name Run name is required." */}
            <div className="import-data-field">
              <label htmlFor="import-run-name">
                Run name
                <input
                  id="import-run-name"
                  name="runName"
                  type="text"
                  placeholder="Baseline 2025"
                  value={fields.runName}
                  onChange={handleFieldChange}
                  onBlur={handleFieldBlur}
                  required
                  autoComplete="off"
                  // aria-invalid tells screen readers the value has a problem;
                  // aria-describedby makes them read the error after the label.
                  // Both only while an error is visible.
                  aria-invalid={visibleErrors.runName ? true : undefined}
                  aria-describedby={visibleErrors.runName ? 'import-run-name-error' : undefined}
                />
              </label>
              {/* Always rendered (hidden by CSS while empty), same pattern as the
                  drop zone's error, so its id always exists for aria-describedby. */}
              <p id="import-run-name-error" className="import-data-field-error">{visibleErrors.runName}</p>
            </div>
            <div className="import-data-field">
              <label htmlFor="import-description">
                Description
                <input
                  id="import-description"
                  name="description"
                  type="text"
                  placeholder="Reference simulation run"
                  value={fields.description}
                  onChange={handleFieldChange}
                  onBlur={handleFieldBlur}
                  autoComplete="off"
                  aria-invalid={visibleErrors.description ? true : undefined}
                  aria-describedby={visibleErrors.description ? 'import-description-error' : undefined}
                />
              </label>
              <p id="import-description-error" className="import-data-field-error">{visibleErrors.description}</p>
            </div>
          </div>
 
          <p className="import-data-note">
            <InfoIcon />
            Imported results remain separate and associated with their simulation run and source file.
          </p>
 
          <p className="import-data-prototype-note">
            Imported runs are kept for this session. The DSS file is read on this computer; nothing is uploaded.
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
 