import { useEffect, useState } from 'react';
import { getVariableSearchData } from '../../data/variableSearch.js';
import { loadDssVariables, logSearchError, VariableSearchError } from './loadDssVariables.js';

// Prototype mode: a run without an imported file searches the sample runs, as before.
const sampleCatalog = { status: 'ready', data: getVariableSearchData() };

/**
 * SCRUM-158 / SCRUM-163: load the active run's variables and report progress.
 *
 * Returns { status, data?, error?, retry } where status is 'loading', 'ready',
 * 'error' or 'no-import'. retry() reads the same file again (SCRUM-150).
 */
export function useVariableCatalog(activeRun) {
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(null);

  useEffect(() => {
    if (!activeRun?.file) return undefined;
    let current = true;

    loadDssVariables(activeRun)
      .then(data => ({ data }), error => {
        logSearchError(error);
        // Anything unexpected becomes the generic message, never a raw error.
        return { error: error instanceof VariableSearchError ? error : new VariableSearchError('dataUnavailable', error) };
      })
      .then(result => {
        if (current) setLoaded({ run: activeRun, attempt, ...result });
      });

    return () => { current = false; };
  }, [activeRun, attempt]);

  const retry = () => setAttempt(count => count + 1);

  // TODO(SCRUM-163): once Import Data stores runs with their File, return
  // { status: 'no-import', retry } here so the page prompts for an import.
  if (!activeRun?.file) return { ...sampleCatalog, retry };
  if (loaded?.run !== activeRun || loaded.attempt !== attempt) return { status: 'loading', retry };
  return loaded.error
    ? { status: 'error', error: loaded.error, retry }
    : { status: 'ready', data: loaded.data, retry };
}
