// @vitest-environment jsdom
// Tests for the Import Data page (SCRUM-114 and subtasks 115–119).
// Same style as VariableSearch.test.jsx: render the whole <App />, navigate
// like a user would, use fireEvent (user-event isn't installed), and use
// toBeTruthy()/toBe() (jest-dom matchers aren't installed).
 
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App.jsx';
import { formatFileSize, validateDssFile } from '../features/importData/validateDssFile.js';
 
afterEach(() => {
  cleanup();
  vi.restoreAllMocks(); // undo any spies (e.g. on input.click) between tests
});
 
// ---------- helpers ----------
 
// Opens Import Data from the sidebar. We search INSIDE the navigation because
// "Import Data" is also the page heading and the submit button's name, so a
// page-wide search would find more than one button and throw.
function openImportData() {
  render(<App />);
  const nav = screen.getByRole('navigation', { name: 'Main navigation' });
  fireEvent.click(within(nav).getByRole('button', { name: 'Import Data' }));
}
 
// Everything on the page except the sidebar lives in <main>.
function page() {
  return within(screen.getByRole('main'));
}
 
// A fake file. Contents don't matter; only name (and size) are used.
function makeFile(name, contents = 'fake dss bytes') {
  return new File([contents], name);
}
 
// Builds the dataTransfer object a real drag carries. 'Files' in `types`
// is what tells the drop zone this is a file drag (not dragged text).
function fileDragData(files) {
  return {
    types: ['Files'],
    files,
    items: files.map(file => ({ kind: 'file', type: file.type })),
  };
}
 
// The hidden <input type="file">. getByLabelText still finds hidden
// elements, unlike getByRole.
function fileInput() {
  return screen.getByLabelText('Choose HEC-DSS file');
}
 
function dropZone() {
  return page().getByRole('region', { name: /HEC-DSS file|Selected file|Release|Drop only/ });
}
 
function importButton() {
  return page().getByRole('button', { name: 'Import Data' });
}
 
// Simulate choosing a file through the OS dialog (SCRUM-117).
function browseFor(file) {
  fireEvent.change(fileInput(), { target: { files: [file] } });
}
 
function typeRunName(value) {
  fireEvent.change(page().getByRole('textbox', { name: 'Run name' }), { target: { value } });
}
 
// ---------- page + drop zone UI (SCRUM-115) ----------
 
describe('Import Data page', () => {
  it('opens from the sidebar with the header, drop zone, fields and a disabled Import button', () => {
    openImportData();
 
    expect(screen.getByRole('heading', { level: 1, name: 'Import Data' })).toBeTruthy();
    expect(page().getByText('Baseline 2025', { selector: 'p' })).toBeTruthy(); // active run pill
    expect(page().getByRole('heading', { name: 'Drag and drop an HEC-DSS file here' })).toBeTruthy();
    expect(page().getByText('Supported format: .dss')).toBeTruthy();
    expect(page().getByRole('button', { name: 'Browse Files' })).toBeTruthy();
    expect(page().getByRole('textbox', { name: 'Run name' })).toBeTruthy();
    expect(page().getByRole('textbox', { name: 'Description' })).toBeTruthy();
    expect(importButton().disabled).toBe(true);
    expect(dropZone().dataset.state).toBe('idle');
  });
 
  // ---------- Browse Files (SCRUM-117) ----------
 
  it('Browse Files opens the native file dialog filtered to .dss', () => {
    openImportData();
    // jsdom can't show a real dialog, so we spy on the hidden input's click()
    // (that's what opens the dialog in a real browser).
    const clickSpy = vi.spyOn(fileInput(), 'click');
 
    fireEvent.click(page().getByRole('button', { name: 'Browse Files' }));
 
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(fileInput().getAttribute('accept')).toBe('.dss');
    expect(fileInput().type).toBe('file');
  });
 
  it('stores a browsed .dss file in the form and shows its name and size (SCRUM-119)', () => {
    openImportData();
    browseFor(makeFile('baseline_2025.dss', 'x'.repeat(2048)));
 
    expect(dropZone().dataset.state).toBe('selected');
    expect(page().getByRole('heading', { name: 'Selected file' })).toBeTruthy();
    expect(page().getByText('baseline_2025.dss')).toBeTruthy();
    expect(page().getByText('2.0 KB')).toBeTruthy();
    // Browse relabels once a file is chosen, and Remove appears.
    expect(page().getByRole('button', { name: 'Choose a Different File' })).toBeTruthy();
    expect(page().getByRole('button', { name: 'Remove' })).toBeTruthy();
    // Still disabled: the run name is empty.
    expect(importButton().disabled).toBe(true);
  });
 
  // ---------- validation (SCRUM-118) ----------
 
  it.each(['run.dss', 'RUN.DSS', 'Run.Dss'])('accepts %s (extension check ignores case)', name => {
    openImportData();
    browseFor(makeFile(name));
    expect(page().getByText(name)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('');
  });
 
  it.each(['notes.txt', 'results.dss.txt', 'dss', 'baseline.dsss'])('routes %s to the error state', name => {
    openImportData();
    browseFor(makeFile(name));
 
    expect(dropZone().dataset.state).toBe('error');
    expect(screen.getByRole('alert').textContent).toContain('is not an HEC-DSS file');
    expect(importButton().disabled).toBe(true);
  });
 
  it('an invalid file replaces a previously valid one, so Import cannot use a stale file', () => {
    openImportData();
    browseFor(makeFile('good.dss'));
    typeRunName('Baseline 2025');
    expect(importButton().disabled).toBe(false);
 
    browseFor(makeFile('bad.csv'));
 
    expect(page().queryByText('good.dss')).toBeNull();
    expect(importButton().disabled).toBe(true);
  });
 
  it('a valid file clears an earlier error', () => {
    openImportData();
    browseFor(makeFile('bad.csv'));
    expect(screen.getByRole('alert').textContent).not.toBe('');
 
    browseFor(makeFile('good.dss'));
    expect(screen.getByRole('alert').textContent).toBe('');
    expect(dropZone().dataset.state).toBe('selected');
  });
 
  // ---------- drag and drop (SCRUM-116) ----------
 
  it('highlights while a file is dragged over and un-highlights on leave', () => {
    openImportData();
    const zone = dropZone();
    const data = fileDragData([makeFile('run.dss')]);
 
    fireEvent.dragEnter(zone, { dataTransfer: data });
    expect(zone.dataset.state).toBe('dragging');
    expect(page().getByRole('heading', { name: 'Release to select this file' })).toBeTruthy();
 
    fireEvent.dragLeave(zone, { dataTransfer: data });
    expect(zone.dataset.state).toBe('idle');
  });
 
  it('does not flicker off when the drag moves over a child element', () => {
    openImportData();
    const zone = dropZone();
    const child = within(zone).getByText('Supported format: .dss');
    const data = fileDragData([makeFile('run.dss')]);
 
    // Real browsers fire: enter(zone) -> enter(child) -> leave(zone)
    fireEvent.dragEnter(zone, { dataTransfer: data });
    fireEvent.dragEnter(child, { dataTransfer: data });
    fireEvent.dragLeave(zone, { dataTransfer: data });
    expect(zone.dataset.state).toBe('dragging'); // still inside, still highlighted
 
    fireEvent.dragLeave(child, { dataTransfer: data });
    expect(zone.dataset.state).toBe('idle'); // now actually left
  });
 
  it('warns while several files are dragged at once', () => {
    openImportData();
    fireEvent.dragEnter(dropZone(), {
      dataTransfer: fileDragData([makeFile('a.dss'), makeFile('b.dss')]),
    });
    expect(page().getByRole('heading', { name: 'Drop only one file at a time' })).toBeTruthy();
  });
 
  it('ignores drags that are not files (e.g. selected text)', () => {
    openImportData();
    fireEvent.dragEnter(dropZone(), { dataTransfer: { types: ['text/plain'], files: [], items: [] } });
    expect(dropZone().dataset.state).toBe('idle');
  });
 
  it('dropping a .dss file selects it', () => {
    openImportData();
    const zone = dropZone();
    const data = fileDragData([makeFile('drought_study.DSS')]);
 
    fireEvent.dragEnter(zone, { dataTransfer: data });
    fireEvent.dragOver(zone, { dataTransfer: data });
    fireEvent.drop(zone, { dataTransfer: data });
 
    expect(zone.dataset.state).toBe('selected');
    expect(page().getByText('drought_study.DSS')).toBeTruthy();
  });
 
  it('dropping a non-.dss file shows the error state', () => {
    openImportData();
    const data = fileDragData([makeFile('photo.png')]);
    fireEvent.dragEnter(dropZone(), { dataTransfer: data });
    fireEvent.drop(dropZone(), { dataTransfer: data });
 
    expect(dropZone().dataset.state).toBe('error');
    expect(screen.getByRole('alert').textContent).toContain('"photo.png" is not an HEC-DSS file');
  });
 
  it('dropping more than one file shows an error instead of picking one silently', () => {
    openImportData();
    const data = fileDragData([makeFile('a.dss'), makeFile('b.dss')]);
    fireEvent.drop(dropZone(), { dataTransfer: data });
 
    expect(screen.getByRole('alert').textContent).toBe('Choose only one .dss file at a time.');
    expect(page().queryByText('a.dss')).toBeNull();
  });
 
  // ---------- enabling Import (SCRUM-119) ----------
 
  it('enables Import Data only when there is a valid file AND a run name', () => {
    openImportData();
    typeRunName('Baseline 2025');
    expect(importButton().disabled).toBe(true); // name, no file
 
    browseFor(makeFile('baseline.dss'));
    expect(importButton().disabled).toBe(false); // both: enabled
 
    typeRunName('   ');
    expect(importButton().disabled).toBe(true); // spaces-only name doesn't count
 
    typeRunName('Baseline 2025');
    fireEvent.click(page().getByRole('button', { name: 'Remove' }));
    expect(importButton().disabled).toBe(true); // file removed
    expect(dropZone().dataset.state).toBe('idle');
  });
 
  it('Import shows the prototype confirmation with the run and file names', () => {
    openImportData();
    browseFor(makeFile('baseline.dss'));
    typeRunName('  Baseline 2025  ');
    fireEvent.click(importButton());
 
    expect(screen.getByRole('status').textContent).toBe(
      'Prototype mode: "Baseline 2025" from baseline.dss is ready to import.',
    );
  });
 
  it('Cancel resets the file, fields, error and status', () => {
    openImportData();
    browseFor(makeFile('baseline.dss'));
    typeRunName('Baseline 2025');
    fireEvent.change(page().getByRole('textbox', { name: 'Description' }), {
      target: { value: 'Reference simulation run' },
    });
    fireEvent.click(importButton());
 
    fireEvent.click(page().getByRole('button', { name: 'Cancel' }));
 
    expect(dropZone().dataset.state).toBe('idle');
    expect(page().queryByText('baseline.dss')).toBeNull();
    expect(page().getByRole('textbox', { name: 'Run name' }).value).toBe('');
    expect(page().getByRole('textbox', { name: 'Description' }).value).toBe('');
    expect(screen.getByRole('status').textContent).toBe('');
    expect(importButton().disabled).toBe(true);
  });
});
 
// ---------- pure helper unit tests ----------
 
describe('validateDssFile', () => {
  it('rejects a missing file', () => {
    expect(validateDssFile(null)).toEqual({ valid: false, error: 'No file was selected.' });
  });
 
  it('accepts .dss in any case and rejects other extensions', () => {
    expect(validateDssFile({ name: 'a.dss' }).valid).toBe(true);
    expect(validateDssFile({ name: 'A.DSS' }).valid).toBe(true);
    expect(validateDssFile({ name: 'a.dss.bak' }).valid).toBe(false);
    expect(validateDssFile({ name: 'a.csv' }).valid).toBe(false);
  });
});
 
describe('formatFileSize', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1536, '1.5 KB'],
    [5 * 1024 * 1024, '5.0 MB'],
  ])('formats %i bytes as %s', (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});