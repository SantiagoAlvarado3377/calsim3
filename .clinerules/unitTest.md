# Unit Testing Rule for New Code

Whenever you create or significantly modify code, you **must** also create or update corresponding unit tests in the same change.

## Core Requirements

- Write unit tests for every new function, component, hook, or module.
- Test **behavior and the public API**, not implementation details. Refactors should not break tests.
- Tests must be readable, focused, and deterministic. No real timers, network calls, or random data.
- Cover the happy path plus the important edge cases and error states (empty data, invalid input, failed load).

## Frontend Stack (`frontend/`)

- **Test runner:** Vitest. Never add Jest or another runner.
- **Component testing:** React Testing Library (`@testing-library/react`).
- **Environment:** start component test files with `// @vitest-environment jsdom`.
- **Queries:** prefer `getByRole` and `getByLabelText` the way a user finds things. Avoid test ids and class names.
- **Mocks:** mock the data layer, not React. For DSS data, mock `features/variableSearch/dss/readDssCatalog.js` with `vi.mock`, as `pages/DataExplorer.test.jsx` and `pages/VariableSearchImported.test.jsx` do.
- Clean up after each test with `afterEach(cleanup)` and restore mocks.

## Backend Stack (`backend/`, `db/`)

- Use Python's standard `unittest` only. Put tests in `backend/tests/`.
- Use temporary folders for databases. Never touch a real `.calsim-data.local/` folder.

## Test File Conventions

- Place test files next to the source file: `DataExplorer.jsx` gets `DataExplorer.test.jsx`.
- Name tests after the behavior: `it('keeps the applied name until apply is pressed again')`.

## Before You Finish

- You must run the tests and make sure they pass: `npm test` from `frontend/`, or `py -3 -m unittest discover backend/tests -v` from the repo root.
- You must run `npm run lint` from `frontend/` after frontend changes.
- Never delete or skip a failing test to make the suite pass. Fix the code or ask.
