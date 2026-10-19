// Drop zone for choosing an HEC-DSS file (SCRUM-115, 116, 117, 119).
//
// Division of labour:
//   - This component owns everything about HOW a file gets picked:
//     drag highlighting, the hidden <input type="file">, and the Browse button.
//   - The parent page (ImportData.jsx) owns WHAT happens with the file:
//     validation, the selected file, and the error message.
// That keeps the drop zone "dumb" and reusable: it just reports
// "the user gave me these files" through onFilesChosen.
 
import { useRef, useState } from 'react';
import { formatFileSize } from './validateDssFile.js';
 
// Upload icon from the Figma (a page with an up arrow).
// aria-hidden because it's decorative; the heading text already says what to do.
function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path
        d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M12 17v-6 M9.5 13.5 12 11l2.5 2.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
 
// A drag only counts if it's carrying files. Without this check, dragging
// selected text or an image from the page would also light up the drop zone.
// The browser puts the string 'Files' in dataTransfer.types for file drags.
function isFileDrag(event) {
  return Array.from(event.dataTransfer?.types ?? []).includes('Files');
}
 
export default function DssDropZone({ selectedFile, error, onFilesChosen, onClearFile }) {
  // Reference to the hidden <input type="file">, so the Browse button can
  // "click" it for the user and open the OS file dialog.
  const inputRef = useRef(null);
 
  // --- Why a counter instead of just true/false? (SCRUM-116) ---
  // dragenter/dragleave fire for EVERY child element, not just the zone.
  // Moving the cursor from the zone onto its heading fires:
  //   dragenter(heading) -> dragleave(zone)
  // With a plain boolean, that dragleave would switch the highlight off even
  // though the cursor never left the zone, so the highlight flickers.
  // Analogy: count people walking through doors. +1 on enter, -1 on leave;
  // the room is only empty when the count is back at 0.
  // It's a ref (not state) because changing it shouldn't re-render anything.
  const dragDepth = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  // How many items are being dragged (lets us warn about multi-file drags).
  const [dragItemCount, setDragItemCount] = useState(0);
 
  function handleDragEnter(event) {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
    // Browsers hide file NAMES until the drop (privacy), but the item COUNT is
    // available, which is enough to say "1 file" vs "several files".
    setDragItemCount(event.dataTransfer.items?.length ?? 0);
  }
 
  function handleDragOver(event) {
    if (!isFileDrag(event)) return;
    // REQUIRED: the browser only allows a drop on elements that cancel
    // dragover. Without this line, the drop event never fires.
    event.preventDefault();
    // Shows the "copy" cursor (+) instead of a "move" or "not allowed" cursor.
    event.dataTransfer.dropEffect = 'copy';
  }
 
  function handleDragLeave(event) {
    if (!isFileDrag(event)) return;
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0; // never let it go negative
      setIsDragging(false);
    }
  }
 
  function handleDrop(event) {
    // Stop the browser's default behaviour, which is to OPEN the file
    // (navigating away from our app).
    event.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
 
    // Copy into a real array right away. FileList is a "live" browser object,
    // and copying makes it safe to hand to the parent.
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length > 0) onFilesChosen(files);
  }
 
  // SCRUM-117: Browse Files opens the native OS file picker by clicking the
  // hidden input for the user.
  function openFileDialog() {
    inputRef.current?.click();
  }
 
  function handleInputChange(event) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) onFilesChosen(files);
    // Reset the input. Otherwise picking the SAME file twice in a row (e.g.
    // after clicking Remove) wouldn't fire onChange, since the value
    // "didn't change".
    event.target.value = '';
  }
 
  // One string drives the CSS (data-state="dragging" etc.), so the styles
  // and the logic can't disagree about which state we're in.
  // Precedence: dragging > error > selected > idle.
  let state = 'idle';
  if (isDragging) state = 'dragging';
  else if (error) state = 'error';
  else if (selectedFile) state = 'selected';
 
  // SCRUM-116 "indicate what's being dragged": the heading changes during a
  // drag so the user knows releasing will do something (or warns them).
  let heading = 'Drag and drop an HEC-DSS file here';
  if (isDragging) {
    heading = dragItemCount > 1 ? 'Drop only one file at a time' : 'Release to select this file';
  } else if (selectedFile) {
    heading = 'Selected file';
  }
 
  return (
    <section
      className="import-data-dropzone"
      data-state={state}
      aria-labelledby="import-data-dropzone-title"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span className="import-data-dropzone-icon">
        <UploadIcon />
      </span>
 
      {/* aria-live="polite" makes screen readers read the heading again when
          it changes (e.g. to "Selected file") without interrupting the user. */}
      <h2 id="import-data-dropzone-title" aria-live="polite">{heading}</h2>
 
      {/* SCRUM-119: once a file is chosen, show its name (and size) in place
          of the format hint. Otherwise show the hint from the Figma. */}
      {selectedFile && !isDragging ? (
        <p className="import-data-file-details">
          <span className="import-data-file-name">{selectedFile.name}</span>
          <span className="import-data-file-size">{formatFileSize(selectedFile.size)}</span>
        </p>
      ) : (
        <p className="import-data-dropzone-hint">Supported format: .dss</p>
      )}
 
      {/* SCRUM-118 error state. The element is always rendered (just empty
          when there's no error) because screen readers announce alert regions
          more reliably when the element already exists and its text changes.
          The CSS hides it while it's empty. */}
      <p className="import-data-dropzone-error" role="alert">{error}</p>
 
      <div className="import-data-dropzone-actions">
        {/* type="button" matters: these sit inside the page's <form>, and a
            button's default type is "submit", which would submit the form. */}
        <button type="button" onClick={openFileDialog}>
          {selectedFile ? 'Choose a Different File' : 'Browse Files'}
        </button>
        {selectedFile && (
          <button type="button" onClick={onClearFile}>Remove</button>
        )}
      </div>
 
      {/* The real file input stays hidden; the Browse button above stands in
          for it because native file inputs can't be styled to match the Figma.
          accept=".dss" filters the OS dialog (SCRUM-117), but it's only a hint,
          so the page still validates whatever comes back.
          Note: in a normal browser we only get the file NAME, not its full
          path on disk (a security rule). If this becomes an Electron/Tauri app
          later, the real path can come from the native dialog API instead. */}
      <input
        ref={inputRef}
        type="file"
        accept=".dss"
        aria-label="Choose HEC-DSS file"
        hidden
        tabIndex={-1}
        onChange={handleInputChange}
      />
    </section>
  );
}