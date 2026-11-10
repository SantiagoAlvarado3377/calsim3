# calsim3
CSC 190/191 Senior Project – CalSim 3 data analysis and visualization application

## Desktop development on Windows

Install Node.js 22.12 or newer with npm. From `frontend`, install the locked dependencies and start Electron:

```powershell
npm ci
npm run desktop:dev
```

`npm run dev` is also available for browser-based UI development.
`npm run desktop:dev` refreshes the window as you edit and stops its development server when you close it.
Use `npm run desktop:start` to build and open the production UI locally. If the build fails, the command reports the error and exits.
Development launches store their local data in `.calsim-data.local/` at the repository root.

## Build the portable Windows app

Run these commands from `frontend` after `npm ci`:

```powershell
npm run lint
npm run desktop:pack
```

The no-install Windows x64 executable is created at
`frontend/release/CalSim3-Copilot-0.1.0-portable.exe`.
Copy the executable to a writable folder and double-click it to open the Dashboard.
It includes the desktop runtime and built interface and runs without a separate Node.js installation or development server.

The first launch creates `CalSim3Data/` beside the executable. `settings/` holds the saved window size and maximized state, `session/` holds browser session data and cache, and `logs/` holds desktop startup logs. Keep that folder beside the executable when moving the app if you want to retain its settings.

This development build is unsigned. Windows may show an unknown-publisher warning.
