// @vitest-environment jsdom
// Tests for the Import Data page (SCRUM-114 and subtasks 115–119).
// Same style as VariableSearch.test.jsx: render the whole <App />, navigate
// like a user would, use fireEvent (user-event isn't installed), and use
// toBeTruthy()/toBe() (jest-dom matchers aren't installed).
 
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../App.jsx';
import { formatFileSize, validateDssFile } from '../features/importData/validateDssFile.js';
import { fileNameToRunName, RUN_NAME_MAX_LENGTH } from '../features/importData/fileNameToRunName.js';
import { validateRunMetadata } from '../features/importData/validateRunMetadata.js';
 
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
 
function runNameBox() {
  return page().getByRole('textbox', { name: 'Run name' });
}
 
function descriptionBox() {
  return page().getByRole('textbox', { name: 'Description' });
}
 
// Text of each field's inline error line ('' = no error showing).
// getElementById because the line has no role; its id is what the input's
// aria-describedby points at, so this checks the same element a screen reader reads.
function runNameError() {
  return document.getElementById('import-run-name-error').textContent;
}
 
function descriptionError() {
  return document.getElementById('import-description-error').textContent;
}
 
// Current text in the Run name box.
function runNameValue() {
  return page().getByRole('textbox', { name: 'Run name' }).value;
}
 
// NOTE (SCRUM-124): "Baseline 2025" is a mock run, so it now counts as a
// DUPLICATE name. Tests that need a valid, enabled form use "Scenario 2026"
// (or scenario_2026.dss) instead.
function typeRunName(value) {
  fireEvent.change(page().getByRole('textbox', { name: 'Run name' }), { target: { value } });
}
 
// ---------- page + drop zone UI (SCRUM-115) ----------
 
describe('Import Data page', () => {
  it('opens from the sidebar with the header, drop zone, fields and a disabled Import button', () => {
    openImportData();
 
    expect(screen.getByRole('heading', { level: 1, name: 'Import Data' })).toBeTruthy();
    expect(page().getByRole('combobox', { name: 'Active run:' }).disabled).toBe(true);
    expect(page().getByRole('heading', { name: 'Drag and drop an HEC-DSS file here' })).toBeTruthy();
    expect(page().getByText('Supported format: .dss')).toBeTruthy();
    expect(page().getByRole('button', { name: 'Browse Files' })).toBeTruthy();
    expect(page().getByRole('textbox', { name: 'Run name' })).toBeTruthy();
    expect(page().getByRole('textbox', { name: 'Description' })).toBeTruthy();
    expect(importButton().disabled).toBe(true);
    expect(dropZone().dataset.state).toBe('idle');
  });
 
  // ---------- Run name + Description fields (SCRUM-121) ----------
 
  it('shows labelled, empty Run name and Description fields that update as the user types', () => {
    openImportData();
    // getByRole('textbox', { name }) only works if the <label> is correctly
    // tied to its input, so finding them this way also proves the labels work
    // (clicking a tied label focuses its input in a real browser).
    const runName = page().getByRole('textbox', { name: 'Run name' });
    const description = page().getByRole('textbox', { name: 'Description' });
 
    // The Figma text is placeholder (grey hint), not a pre-filled value.
    expect(runName.value).toBe('');
    expect(runName.placeholder).toBe('Baseline 2025');
    expect(description.value).toBe('');
    expect(description.placeholder).toBe('Reference simulation run');
 
    // Controlled inputs: React state drives the value, so after a change event
    // the DOM value reflects what was typed.
    fireEvent.change(runName, { target: { value: 'Alternative A' } });
    fireEvent.change(description, { target: { value: 'Higher Delta outflow' } });
    expect(runName.value).toBe('Alternative A');
    expect(description.value).toBe('Higher Delta outflow');
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
    browseFor(makeFile('scenario_2026.dss', 'x'.repeat(2048)));
 
    expect(dropZone().dataset.state).toBe('selected');
    expect(page().getByRole('heading', { name: 'Selected file' })).toBeTruthy();
    expect(page().getByText('scenario_2026.dss')).toBeTruthy();
    expect(page().getByText('2.0 KB')).toBeTruthy();
    // Browse relabels once a file is chosen, and Remove appears.
    expect(page().getByRole('button', { name: 'Choose a Different File' })).toBeTruthy();
    expect(page().getByRole('button', { name: 'Remove' })).toBeTruthy();
    // SCRUM-122: the run name auto-fills from the file name, so with a valid
    // file AND a name, Import is now enabled. (Before SCRUM-122 this test
    // expected "disabled" because the name stayed empty.)
    expect(page().getByRole('textbox', { name: 'Run name' }).value).toBe('scenario 2026');
    expect(importButton().disabled).toBe(false);
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
    typeRunName('Scenario 2026');
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
    typeRunName('Scenario 2026');
    expect(importButton().disabled).toBe(true); // name, no file
 
    browseFor(makeFile('baseline.dss'));
    expect(importButton().disabled).toBe(false); // both: enabled
 
    typeRunName('   ');
    expect(importButton().disabled).toBe(true); // spaces-only name doesn't count
 
    typeRunName('Scenario 2026');
    fireEvent.click(page().getByRole('button', { name: 'Remove' }));
    expect(importButton().disabled).toBe(true); // file removed
    expect(dropZone().dataset.state).toBe('idle');
  });
 
  // ---------- auto-fill run name from the file name (SCRUM-122) ----------
 
  it('auto-fills Run name from a browsed .dss file name (Figma example)', () => {
    openImportData();
    browseFor(makeFile('DCR2023_DV_9.3.1_v2a_Danube_Adj_v1.8.dss'));
    expect(runNameValue()).toBe('DCR2023 DV 9.3.1 v2a Danube Adj v1.8');
  });
 
  it('auto-fills Run name from a dropped .dss file too', () => {
    openImportData();
    fireEvent.drop(dropZone(), { dataTransfer: fileDragData([makeFile('alternative_a.dss')]) });
    expect(runNameValue()).toBe('alternative a');
  });
 
  it('keeps a name the user typed when a file is selected afterwards', () => {
    openImportData();
    typeRunName('My Baseline');
    browseFor(makeFile('baseline_2025.dss'));
    expect(runNameValue()).toBe('My Baseline');
  });
 
  it('replaces an auto-filled name when a different file is selected (no typing in between)', () => {
    openImportData();
    browseFor(makeFile('file_a.dss'));
    expect(runNameValue()).toBe('file a');
 
    browseFor(makeFile('file_b.dss'));
    expect(runNameValue()).toBe('file b');
  });
 
  it('auto-fills again after the user clears Run name completely', () => {
    openImportData();
    typeRunName('Typed name');
    typeRunName(''); // cleared: the "user edited" flag turns off
    browseFor(makeFile('baseline_2025.dss'));
    expect(runNameValue()).toBe('baseline 2025');
  });
 
  it('an invalid file never changes Run name (empty or auto-filled)', () => {
    openImportData();
    fireEvent.drop(dropZone(), { dataTransfer: fileDragData([makeFile('not-a-dss.txt')]) });
    expect(runNameValue()).toBe(''); // stays empty
 
    browseFor(makeFile('baseline_2025.dss'));
    fireEvent.drop(dropZone(), { dataTransfer: fileDragData([makeFile('not-a-dss.txt')]) });
    expect(runNameValue()).toBe('baseline 2025'); // keeps the earlier auto-fill
  });
 
  it('cuts a very long auto-filled name to the maximum length', () => {
    openImportData();
    browseFor(makeFile(`${'a'.repeat(150)}.dss`));
    expect(runNameValue().length).toBe(RUN_NAME_MAX_LENGTH);
  });
 
  it('Remove clears an auto-filled name but keeps a typed one', () => {
    openImportData();
    browseFor(makeFile('baseline_2025.dss'));
    fireEvent.click(page().getByRole('button', { name: 'Remove' }));
    expect(runNameValue()).toBe(''); // came from the file, so it goes with it
 
    typeRunName('Typed name');
    browseFor(makeFile('baseline_2025.dss'));
    fireEvent.click(page().getByRole('button', { name: 'Remove' }));
    expect(runNameValue()).toBe('Typed name'); // the user's own name stays
  });
 
  // ---------- run name + description validation (SCRUM-124) ----------
 
  it('does not show a Run name error while typing, only after leaving the field', () => {
    openImportData();
    typeRunName('Baseline 2025'); // a duplicate, but the user hasn't left the field yet
    expect(runNameError()).toBe('');
 
    fireEvent.blur(runNameBox());
    expect(runNameError()).toBe('A run named "Baseline 2025" already exists. Choose a different name.');
  });
 
  it('shows the duplicate-name error and keeps Import disabled (trimmed, any case)', () => {
    openImportData();
    browseFor(makeFile('good.dss'));
 
    // ' baseline 2025 ' matches the mock run "Baseline 2025" after trimming + lowercasing.
    typeRunName(' baseline 2025 ');
    fireEvent.blur(runNameBox());
 
    expect(runNameError()).toBe('A run named "baseline 2025" already exists. Choose a different name.');
    expect(importButton().disabled).toBe(true);
  });
 
  it('ties a visible error to its input with aria-describedby and aria-invalid', () => {
    openImportData();
    expect(runNameBox().getAttribute('aria-describedby')).toBeNull(); // no error yet
 
    fireEvent.blur(runNameBox()); // leave it empty
    expect(runNameError()).toBe('Run name is required.');
    expect(runNameBox().getAttribute('aria-describedby')).toBe('import-run-name-error');
    expect(runNameBox().getAttribute('aria-invalid')).toBe('true');
  });
 
  it('shows the too-long Run name error', () => {
    openImportData();
    typeRunName('x'.repeat(101));
    fireEvent.blur(runNameBox());
    expect(runNameError()).toBe('Run name must be 100 characters or fewer.');
  });
 
  it('clears the error as soon as the input is fixed, and Import enables', () => {
    openImportData();
    browseFor(makeFile('good.dss'));
    typeRunName('Baseline 2025');
    fireEvent.blur(runNameBox());
    expect(importButton().disabled).toBe(true);
 
    typeRunName('Scenario 2026'); // no blur needed: once touched, errors update live
    expect(runNameError()).toBe('');
    expect(runNameBox().getAttribute('aria-invalid')).toBeNull();
    expect(importButton().disabled).toBe(false);
  });
 
  it('shows the duplicate error right away when a file auto-fills a taken name', () => {
    openImportData();
    browseFor(makeFile('Baseline_2025.dss')); // auto-fills "Baseline 2025"
    expect(runNameError()).toBe('A run named "Baseline 2025" already exists. Choose a different name.');
    expect(importButton().disabled).toBe(true);
  });
 
  it('allows an empty Description but rejects one over 500 characters', () => {
    openImportData();
    browseFor(makeFile('scenario_2026.dss'));
    fireEvent.blur(descriptionBox()); // empty Description is fine
    expect(descriptionError()).toBe('');
    expect(importButton().disabled).toBe(false);
 
    fireEvent.change(descriptionBox(), { target: { value: 'd'.repeat(501) } });
    fireEvent.blur(descriptionBox());
    expect(descriptionError()).toBe('Description must be 500 characters or fewer.');
    expect(descriptionBox().getAttribute('aria-describedby')).toBe('import-description-error');
    expect(importButton().disabled).toBe(true);
  });
 
  it('keeps Import disabled while Run name is empty, even before any error is shown', () => {
    openImportData();
    browseFor(makeFile('good.dss'));
    typeRunName(''); // user cleared the auto-filled name but hasn't left the field
    expect(importButton().disabled).toBe(true);
  });
 
  it('Import shows the prototype confirmation with the run and file names', () => {
    openImportData();
    browseFor(makeFile('baseline.dss'));
    typeRunName('  Scenario 2026  ');
    fireEvent.click(importButton());
 
    expect(screen.getByRole('status').textContent).toBe(
      'Prototype mode: "Scenario 2026" from baseline.dss is ready to import.',
    );
  });
 
  it('Cancel resets the file, fields, error and status', () => {
    openImportData();
    browseFor(makeFile('baseline.dss'));
    typeRunName('Scenario 2026');
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
 
describe('fileNameToRunName (SCRUM-122)', () => {
  // it.each runs the same test once per row: [input file name, expected run name].
  it.each([
    // the Figma example: only the LAST extension goes, version dots stay
    ['DCR2023_DV_9.3.1_v2a_Danube_Adj_v1.8.dss', 'DCR2023 DV 9.3.1 v2a Danube Adj v1.8'],
    ['baseline_2025.dss', 'baseline 2025'], // underscores -> spaces
    ['BASELINE.DSS', 'BASELINE'], // uppercase extension is removed too
    ['run.v2.dss', 'run.v2'], // multiple dots: only the last one is an extension
    ['alt__ops___a.dss', 'alt ops a'], // repeated underscores collapse to one space
    ['_ padded _ name _.dss', 'padded name'], // mixed underscores/spaces collapse; ends trimmed
  ])('turns %s into "%s"', (fileName, expected) => {
    expect(fileNameToRunName(fileName)).toBe(expected);
  });
 
  it(`never returns more than ${RUN_NAME_MAX_LENGTH} characters`, () => {
    expect(fileNameToRunName(`${'x'.repeat(250)}.dss`)).toBe('x'.repeat(RUN_NAME_MAX_LENGTH));
  });
 
  it('does not leave a trailing space when the cut lands on a space', () => {
    // 99 letters, then an underscore at position 100 (becomes a space), then more
    const name = `${'x'.repeat(99)}_yyy.dss`;
    expect(fileNameToRunName(name)).toBe('x'.repeat(99));
  });
});
 
describe('validateRunMetadata (SCRUM-124)', () => {
  const existingNames = ['Baseline 2025', 'Alternative Operations A'];
  // Small helper so each test only spells out what it cares about.
  const check = (name, description = '') => validateRunMetadata({ name, description, existingNames });
  const noErrors = { runName: '', description: '' };
 
  it('accepts a new name with an empty description', () => {
    expect(check('Scenario 2026')).toEqual(noErrors);
  });
 
  it.each(['', '   '])('requires a run name (%j)', name => {
    expect(check(name).runName).toBe('Run name is required.');
  });
 
  it('allows exactly 100 characters but not 101', () => {
    expect(check('x'.repeat(100)).runName).toBe('');
    expect(check('x'.repeat(101)).runName).toBe('Run name must be 100 characters or fewer.');
  });
 
  it('measures length after trimming, so outer spaces do not count', () => {
    expect(check(`  ${'x'.repeat(100)}  `).runName).toBe('');
  });
 
  it.each(['Baseline 2025', ' Baseline 2025 ', 'baseline 2025', 'BASELINE 2025'])(
    'treats %j as a duplicate of "Baseline 2025"',
    name => {
      expect(check(name).runName).toBe(
        `A run named "${name.trim()}" already exists. Choose a different name.`,
      );
    },
  );
 
  it('does not flag names that only partly match', () => {
    expect(check('Baseline 2025 v2').runName).toBe('');
  });
 
  it('works with no existing names passed in', () => {
    expect(validateRunMetadata({ name: 'Baseline 2025', description: '' })).toEqual(noErrors);
  });
 
  it('allows a 500-character description but not 501', () => {
    expect(check('Scenario 2026', 'd'.repeat(500)).description).toBe('');
    expect(check('Scenario 2026', 'd'.repeat(501)).description).toBe(
      'Description must be 500 characters or fewer.',
    );
  });
 
  it('reports both fields at once when both are wrong', () => {
    expect(check('', 'd'.repeat(501))).toEqual({
      runName: 'Run name is required.',
      description: 'Description must be 500 characters or fewer.',
    });
  });
});
 