---
name: connect-page-to-real-data
description: Use when a React page still uses hardcoded or sample data and needs to read real imported runs and variables instead, from ActiveRunContext, the imported DSS file, or the Python backend.
---

# Connect a Page to Real Data

Pages must never hardcode simulation runs, variables, or values. Follow this checklist.

## Steps

1. **Find the hardcoded data.** Search the page for arrays like `sampleRuns` or `mockSimulationRuns` and list every place they are used.
2. **Get runs from context.** Read `runs` (and `activeRunId` if needed) with `useContext(ActiveRunContext)` from `components/ActiveRunContext.js`. Never create a second list of runs.
3. **Load variables for a run.**
   - Today: call `loadDssVariables(run)` from `features/variableSearch/loadDssVariables.js`. Each variable has `id`, `identifier` (B part), `componentType` (C part), `units`, `startMonth`, and `endMonth`.
   - When the backend has a command for it: call it through `window.calsim` instead, and keep the same field names so the page does not change.
4. **Handle every state.**
   - No runs imported: explain it and offer a button to Import Data (`onNavigate('import-data')`).
   - Loading: disable dependent inputs and say "Loading...".
   - Error: show `searchErrorMessages.dataUnavailable` in a `role="alert"` message. Log details with `logSearchError`.
5. **Ignore stale results.** If the user picks another run before a load finishes, drop the old result (use a `current` flag in the effect cleanup).
6. **Update tests.** Replace sample-data tests with tests that render the page inside `ActiveRunContext.Provider` and mock `readDssCatalog.js` with `vi.mock`. See `pages/DataExplorer.test.jsx`.

## Pitfalls

- Never import the sample arrays "just for now". Remove them from the page.
- The imported `File` only lives for the session. Do not store it in `localStorage`.
- Label variables with both the B and C parts (`S_SHSTA (STORAGE)`); the B part alone is not unique.
