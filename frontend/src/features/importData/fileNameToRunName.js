// SCRUM-122: turn a selected file's name into a suggested run name.
//
// Pure function (string in -> string out, no React), same idea as
// validateDssFile.js: easy to unit-test, and the page just calls it.
//
// Example from the Figma success screen:
//   "DCR2023_DV_9.3.1_v2a_Danube_Adj_v1.8.dss"
//     -> "DCR2023 DV 9.3.1 v2a Danube Adj v1.8"
 
// Longest run name allowed ( limit lives in one place).
export const RUN_NAME_MAX_LENGTH = 100;
 
// "The last dot, then anything that isn't a dot, up to the end of the string."
// Only the LAST extension matches, so the dots inside "9.3.1" and "v1.8" stay.
//   "baseline.dss"     -> match ".dss"
//   "v1.8.DSS"         -> match ".DSS"   (any case, so uppercase is handled)
//   "no-extension"     -> no match, name left as is
const LAST_EXTENSION = /\.[^.]*$/;
 
// One or more underscores and/or whitespace characters in a row.
// Replacing each run with a single space does both jobs from the ticket at once:
//   "a_b"     -> "a b"     (underscore becomes a space)
//   "a__ _b"  -> "a b"     (repeats collapse to ONE space)
const UNDERSCORES_AND_SPACES = /[_\s]+/g;
 
/**
 * Suggest a run name from a file name.
 *
 * Steps (each one is a line below):
 *   1. remove the last extension
 *   2. underscores/spaces -> single spaces
 *   3. trim the ends
 *   4. cut to RUN_NAME_MAX_LENGTH, so an auto-filled name never fails the
 *      length rule on its own (then trim again in case the cut left a space)
 *
 * @param {string} fileName  e.g. "baseline_2025.dss"
 * @returns {string}         e.g. "baseline 2025"
 */
export function fileNameToRunName(fileName = '') {
  return fileName
    .replace(LAST_EXTENSION, '')
    .replace(UNDERSCORES_AND_SPACES, ' ')
    .trim()
    .slice(0, RUN_NAME_MAX_LENGTH)
    .trim();
}