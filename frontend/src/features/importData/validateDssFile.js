// Pure helper functions for the Import Data page.
//
// These live outside the React component on purpose:
//   1. They're plain functions (input -> output, no React), so they're easy to
//      unit-test without rendering anything.
//   2. A later story (the real import / backend step) can reuse the same rules
//      instead of copy-pasting the check.
// This mirrors how Variable Search keeps its logic in
// features/variableSearch/searchVariables.js.
 
// SCRUM-118: extension check.
// The regex means: a literal "." then "dss" at the very END of the name ($),
// ignoring upper/lower case (the "i" flag).
//   "baseline.dss"   -> valid
//   "BASELINE.DSS"   -> valid   (case-insensitive)
//   "notes.dss.txt"  -> invalid (".dss" is not at the end)
//   "dss"            -> invalid (no dot, so it's not an extension)
const DSS_EXTENSION = /\.dss$/i;
 
/**
 * Decide whether a file chosen by the user can be imported.
 *
 * Always returns the same shape so the caller never has to guess:
 *   { valid: true,  error: '' }
 *   { valid: false, error: 'message to show the user' }
 *
 * Note: the browser's file dialog filter (accept=".dss") is only a HINT;
 * users can switch the dialog to "All files", and drag-and-drop ignores it
 * completely. That's why we validate here no matter how the file arrived.
 */
export function validateDssFile(file) {
  if (!file) {
    return { valid: false, error: 'No file was selected.' };
  }
 
  // trim() guards against stray whitespace at the end of a file name.
  if (!DSS_EXTENSION.test(file.name.trim())) {
    return {
      valid: false,
      error: `"${file.name}" is not an HEC-DSS file. Choose a file ending in .dss.`,
    };
  }
 
  return { valid: true, error: '' };
}
 
/**
 * Turn a byte count into something readable, e.g. 1536 -> "1.5 KB".
 *
 * Each unit is 1024x the previous one, so we keep dividing by 1024 until the
 * number is small enough, then show one decimal place (except for plain bytes).
 */
export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
 
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
 
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
 
  return unitIndex === 0 ? `${size} B` : `${size.toFixed(1)} ${units[unitIndex]}`;
}
