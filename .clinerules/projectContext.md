# Project Context (Cline Rules)

Read this before planning or writing code. It describes what this project is so every task starts from the same picture.

## What we are building

CalSim 3 Copilot is a desktop app for MBK Engineers. Engineers import CalSim 3 output files (HEC-DSS), search variables, explore time series, compare runs, and flag anomalies.

## Tech stack

- **Frontend:** React 19 + Vite, plain JavaScript (`.js` / `.jsx`). This project is JS-only.
- **Desktop shell:** Electron, packaged as a portable Windows app with electron-builder.
- **Backend:** Python data service in `backend/`. It reads HEC-DSS files with `hecdss` and owns the SQLite database.
- **Database:** SQLite, defined by `db/schema.sql` (`runs` and `series` tables, `run_summary` view).
- **Tests:** Vitest + React Testing Library for the frontend, Python `unittest` for `backend/` and `db/`.

## Folder map

- `frontend/src/pages/`: one file per page (`DataExplorer.jsx`, `VariableSearch.jsx`, ...) with its CSS file next to it.
- `frontend/src/components/`: shared UI pieces (`PageHeader.jsx`, `ActiveRunContext.js`).
- `frontend/src/features/<feature>/`: logic and sub-components for one feature (`variableSearch`, `comparison`, `importData`, `anomalyDetection`).
- `frontend/src/data/`: data models (`runModel.js`).
- `frontend/electron/`: Electron main process and preload.
- `backend/`: Python service. `db/`: schema and its tests.

## Rules

- You must keep the existing folder layout. Never create a new top-level folder without asking.
- You must not hardcode simulation data in pages. Read runs from `ActiveRunContext` and real data from the imported DSS file or the backend.
- Never add a new framework or library (state manager, UI kit, CSS framework, chart library) without the team agreeing first. Ask before installing any package.
- Never commit secrets: API keys, `.env` files, or anything in `.calsim-data.local/`.
- Use "run" for one imported CalSim 3 simulation and "variable" or "series" for one DSS record (A through F path parts). Use the same names the code already uses.
