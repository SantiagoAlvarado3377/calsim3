# React Style Guide (Cline Rules)

You are an expert React engineer. Follow these rules strictly when writing or editing React code in `frontend/`.

## Core Principles

- Use functional components and hooks only. Never create class components.
- This project is JavaScript only. Use `.jsx` for components and `.js` for logic. Never add TypeScript files.
- Keep components small and focused. Move logic into a custom hook or a helper in `features/<feature>/` when it grows past about 30 to 40 lines or is reused.
- Favor composition and context (`ActiveRunContext`) over deep prop drilling.
- Keep state as local as possible. Copy applied values into state instead of reading them live when the user must press a button to confirm them.

## Naming and File Structure

- Components: `PascalCase` (`DataExplorer.jsx`, `PageHeader.jsx`).
- Hooks: `camelCase` starting with `use` (`useVariableCatalog.js`).
- Helpers: `camelCase` (`formatMonth.js`, `validateDssFile.js`).
- Constants: `UPPER_SNAKE_CASE`.
- One component per file. Pages go in `src/pages/`, shared components in `src/components/`, feature logic in `src/features/<feature>/`.
- Co-locate related files: `DataExplorer.jsx`, `DataExplorer.test.jsx`, and its CSS sit side by side.

## Styling

- Use plain CSS in the page or component's own `.css` file. Never add inline style objects for layout, CSS-in-JS, Tailwind, or a UI kit.
- Prefix class names with the page or component name (`data-explorer-chart`, `variable-search-results`).
- Every interactive element must have visible `:hover` and `:focus-visible` states.
- Layouts must wrap on small screens without overlapping.

## Accessibility

- Every input and select must have a `<label>` connected with matching `htmlFor` and `id`.
- Sections get `aria-labelledby` pointing at their heading.
- Error messages use `role="alert"` and say exactly what the user needs to fix.
- Use real `<button>` elements for actions. Never put click handlers on a `div`.

## Comments

- Only add a comment when it explains **why**, not what.
- Keep comments short, lowercase, and on their own line above the code.

## Data

- Never hardcode simulation runs or variables in a page. Read runs from `ActiveRunContext` and load variables from the run's DSS file or the backend.
- Show a loading state, an error state, and an empty state for any data that loads.
- Ignore results from a slow request that finishes after the user changed the selection.
