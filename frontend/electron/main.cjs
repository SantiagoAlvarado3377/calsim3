const { app, BrowserWindow, dialog, Menu } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const projectRoot = path.resolve(__dirname, '../..');
const portableRoot = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'));
const settingsRoot = app.isPackaged
  ? path.join(portableRoot, 'CalSim3Data')
  : path.join(projectRoot, '.calsim-data.local');
const settingsDir = path.join(settingsRoot, 'settings');
const sessionDir = path.join(settingsRoot, 'session');
const logsDir = path.join(settingsRoot, 'logs');
const preferencesFile = path.join(settingsDir, 'window.json');
const logFile = path.join(logsDir, 'desktop.log');
const defaultWindowSize = { width: 1388, height: 930 };
const minimumWindowSize = { width: 1024, height: 700 };

app.setName('CalSim 3 Copilot');
app.setAppUserModelId('org.calsim3.copilot');

let mainWindow;

function writeLog(message) {
  fs.appendFileSync(logFile, `${new Date().toISOString()} ${message}\n`);
}

function configureStorage() {
  try {
    for (const directory of [settingsDir, sessionDir, logsDir]) {
      fs.mkdirSync(directory, { recursive: true });
    }
    // Electron needs these directories before its ready event.
    app.setPath('userData', settingsDir);
    app.setPath('sessionData', sessionDir);
    app.setAppLogsPath(logsDir);
    writeLog(`Starting ${app.name} ${app.getVersion()}`);
  } catch (error) {
    throw new Error(
      `CalSim 3 Copilot could not prepare its local data folder.\n\n${settingsRoot}\n\n` +
      `Check that the folder is writable. For a portable build, move the executable to a writable folder and try again.\n\n${error.message}`,
      { cause: error },
    );
  }
}

function readWindowSettings() {
  try {
    const { width, height, maximized } = JSON.parse(fs.readFileSync(preferencesFile, 'utf8'));
    if (Number.isSafeInteger(width) && width >= minimumWindowSize.width &&
        Number.isSafeInteger(height) && height >= minimumWindowSize.height) {
      return { width, height, maximized: maximized === true };
    }
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Could not read window settings:', error.message);
  }
  return defaultWindowSize;
}

function saveWindowSettings(window) {
  const { width, height } = window.getNormalBounds();
  const settings = { width, height, maximized: window.isMaximized() };
  const temporaryFile = `${preferencesFile}.tmp`;
  try {
    fs.writeFileSync(temporaryFile, JSON.stringify(settings), 'utf8');
    fs.renameSync(temporaryFile, preferencesFile);
  } catch (error) {
    console.error('Could not save window settings:', error.message);
  }
}

async function start() {
  configureStorage();
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore();
    mainWindow?.focus();
  });
  await app.whenReady();
  const windowSettings = readWindowSettings();
  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    title: app.name,
    width: windowSettings.width,
    height: windowSettings.height,
    minWidth: minimumWindowSize.width,
    minHeight: minimumWindowSize.height,
    backgroundColor: '#f5f7fa',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.on('page-title-updated', event => event.preventDefault());
  mainWindow.on('close', () => saveWindowSettings(mainWindow));
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', event => event.preventDefault());
  mainWindow.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  const devUrl = !app.isPackaged && process.env.CALSIM_DEV_URL;
  if (devUrl && !/^http:\/\/127\.0\.0\.1:\d+\/$/.test(devUrl)) throw new Error('Invalid development URL.');
  mainWindow.webContents.session.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] },
    (details, callback) => {
      const allowed = devUrl
        && ['http:', 'ws:'].includes(new URL(details.url).protocol)
        && new URL(details.url).host === new URL(devUrl).host;
      callback({ cancel: !allowed });
    },
  );
  mainWindow.once('ready-to-show', () => {
    if (windowSettings.maximized) mainWindow.maximize();
    mainWindow.show();
  });
  const entry = pathToFileURL(path.join(__dirname, '../dist/index.html')).href;
  await mainWindow.loadURL(devUrl || entry);
}

app.on('window-all-closed', () => app.quit());
start().catch(error => {
  console.error(error.message);
  dialog.showErrorBox('CalSim 3 could not start', error.message);
  app.quit();
});
