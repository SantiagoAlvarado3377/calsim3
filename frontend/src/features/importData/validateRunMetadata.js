// SCRUM-124: rules for the Run name and Description fields.
//
// Pure function again (plain values in -> plain values out, no React), so
// every rule can be unit-tested without rendering the page, and the future
// storage/backend story can run the exact same check before saving.
 
import { RUN_NAME_MAX_LENGTH } from './fileNameToRunName.js';
 
export const DESCRIPTION_MAX_LENGTH = 500;
 
// Messages live in one object so the page, the tests and any future code all
// use the same wording. The duplicate one is a function because it has to
// include the name the user typed.
export const runMetadataMessages = {
  runNameRequired: 'Run name is required.',
  runNameTooLong: `Run name must be ${RUN_NAME_MAX_LENGTH} characters or fewer.`,
  runNameDuplicate: name => `A run named "${name}" already exists. Choose a different name.`,
  descriptionTooLong: `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`,
};
 
// Make two names comparable: ignore spaces at the ends and upper/lower case.
//   " Baseline 2025 " -> "baseline 2025"
//   "BASELINE 2025"   -> "baseline 2025"
// toLocaleLowerCase (not toLowerCase) handles non-English letters correctly too.
function normalizeName(name) {
  return name.trim().toLocaleLowerCase();
}
 
/**
 * Check the run name and description.
 *
 * Always returns BOTH keys, with '' meaning "no problem", so the caller can do
 * `errors.runName` without checking whether it exists:
 *   { runName: '', description: '' }                        -> all good
 *   { runName: 'Run name is required.', description: '' }   -> one problem
 *
 * Run name rules are checked in order and only the FIRST failure is reported
 * (one clear message instead of a stack of them):
 *   1. required (after trimming)
 *   2. at most RUN_NAME_MAX_LENGTH characters (after trimming)
 *   3. not the same as an existing run (trimmed, case-insensitive)
 *
 * @param {{ name: string, description: string, existingNames?: string[] }} input
 *   existingNames: names already in use. Comes from mock data for now; when
 *   real storage exists, only the CALLER changes what it passes in.
 * @returns {{ runName: string, description: string }}
 */
export function validateRunMetadata({ name = '', description = '', existingNames = [] }) {
  const errors = { runName: '', description: '' };
  // Trim once and reuse: the name that would actually be saved is the trimmed one,
  // so that's the one we measure and compare.
  const trimmedName = name.trim();
 
  if (trimmedName === '') {
    errors.runName = runMetadataMessages.runNameRequired;
  } else if (trimmedName.length > RUN_NAME_MAX_LENGTH) {
    errors.runName = runMetadataMessages.runNameTooLong;
  } else {
    // Set = a list built for fast "is this in here?" checks (.has()).
    // Fine either way at this size, but it reads clearly.
    const taken = new Set(existingNames.map(normalizeName));
    if (taken.has(normalizeName(trimmedName))) {
      errors.runName = runMetadataMessages.runNameDuplicate(trimmedName);
    }
  }
 
  // Description is optional, so empty is fine; only the length matters.
  if (description.trim().length > DESCRIPTION_MAX_LENGTH) {
    errors.description = runMetadataMessages.descriptionTooLong;
  }
 
  return errors;
}