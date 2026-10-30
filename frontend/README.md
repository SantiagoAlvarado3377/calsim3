# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Variable Search (SCRUM-140–145)

From this directory, run `npm install` and `npm run dev`. Open **Search variables** on Dashboard or **Variable Search** in the sidebar.

- Search submits with the Search button or Enter and matches identifier or mapped location text, ignoring case.
- Dropdowns apply immediately. Clear Filters resets all four dropdowns and keeps the keyword.
- View Chart opens metadata and a chart for that specific variable and run. Return to variable search preserves the controls and restores focus to the row's button.
- Search data comes from the existing comparison fixtures. The shared page header displays the workspace active run; the search Run filter and chart details retain their own run context. With no imported runs connected, the shared header displays No imported runs.
- Metadata and chart values are mocks behind `getVariableSearchData()` and `getVariableChartData()` in `src/data/variableSearch.js`. API integration and empty/error screens belong to SCRUM-146/147.

Run `npm test`, `npm run lint`, and `npm run build` to check the feature. Tests cover navigation, submitted searches, combined filters, table metadata, details/return focus, and monthly/daily chart data.
