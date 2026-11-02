import { useEffect, useState } from 'react';
import { getVariableSearchData } from '../../data/variableSearch.js';
import { loadDssVariables, logSearchError, VariableSearchError } from './loadDssVariables.js';

// "Explore sample data" searches the sample runs instead of an imported file.
const sampleCatalog = { status: 'ready', data: getVariableSearchData(), sample: true };

/**
 * SCRUM-158 / SCRUM-163: load the active run's variables and report progress.
 *
 * Returns { status, data?, sample?, error?, retry } where status is 'loading',
 * 'ready', 'error' or 'no-import'. retry() reads the same file again (SCRUM-150).
 * showSample switches to the sample runs when no DSS file has been imported.
 */
export function useVariableCatalog(activeRun, showSample = false) {
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

  // SCRUM-163: with no imported file, prompt for one (or show the samples).
  if (!activeRun?.file) return showSample ? { ...sampleCatalog, retry } : { status: 'no-import', retry };
  if (loaded?.run !== activeRun || loaded.attempt !== attempt) return { status: 'loading', retry };
  return loaded.error
    ? { status: 'error', error: loaded.error, retry }
    : { status: 'ready', data: loaded.data, retry };
}
