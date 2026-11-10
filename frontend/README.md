# CalSim 3 Copilot frontend

See the [project README](../README.md) for development and portable
Windows builds.

- `npm run dev`: browser preview
- `npm run desktop:dev`: Windows desktop development
- `npm run desktop:start`: build and open the current UI in Electron
- `npm run build`: production UI build
- `npm test`: feature tests
- `npm run lint`: code checks
- `npm run desktop:pack`: portable Windows executable

## Variable Search (SCRUM-140–145)

From this directory, run `npm install` and `npm run dev`. Open **Search variables** on Dashboard or **Variable Search** in the sidebar.

- Search submits with the Search button or Enter and matches identifier or mapped location text, ignoring case.
- Dropdowns apply immediately. Clear Filters resets all four dropdowns and keeps the keyword.
- View Chart opens metadata and a chart for that specific variable and run. Return to variable search preserves the controls and restores focus to the row's button.
- Search data comes from the existing comparison fixtures. The shared page header displays the workspace active run; the search Run filter and chart details retain their own run context. With no imported runs connected, the shared header displays No imported runs.
- Metadata and chart values are mocks behind `getVariableSearchData()` and `getVariableChartData()` in `src/data/variableSearch.js`. API integration and empty/error screens belong to SCRUM-146/147.

Run `npm test`, `npm run lint`, and `npm run build` to check the feature. Tests cover navigation, submitted searches, combined filters, table metadata, details/return focus, and monthly/daily chart data.
