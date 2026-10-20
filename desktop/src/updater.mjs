import { app, dialog, ipcMain } from 'electron';
import { appendFile } from 'node:fs/promises';
import path from 'node:path';
import updaterPackage from 'electron-updater';
import { isAppUrl } from './appProtocol.mjs';
import { canAutoCheck, canCheck, canInstall, initialUpdateState, reduceUpdateState } from './updateState.mjs';

const { autoUpdater } = updaterPackage;

let promptedVersion = null;

export const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

// Log locale nella cartella log dell'app: contiene solo versioni, URL del feed ed errori, nessun dato utente.
function log(...parts) {
  const line = `${new Date().toISOString()} ${parts.map(String).join(' ')}\n`;
  appendFile(path.join(app.getPath('logs'), 'updater.log'), line).catch(() => {});
}

async function askToRestart(getWindow, version) {
  const options = {
    type: 'info',
    buttons: ['Riavvia ora', 'Più tardi'],
    defaultId: 0,
    cancelId: 1,
    title: 'Aggiornamento disponibile',
    message: `La versione ${version} di Project Tracker è pronta.`,
    detail: 'Se scegli "Più tardi" verrà installata alla chiusura dell\'app.',
  };
  const window = getWindow();
  const { response } = window ? await dialog.showMessageBox(window, options) : await dialog.showMessageBox(options);
  if (response === 0) autoUpdater.quitAndInstall();
}

let state = null;

function dispatch(getWindow, event) {
  const next = reduceUpdateState(state, event, new Date().toISOString());
  if (next === state) return;
  state = next;
  const window = getWindow();
  if (window && !window.isDestroyed()) window.webContents.send('updates:state', state);
}

// Solo la finestra dell'app può leggere o pilotare l'updater: install chiude l'app.
const fromApp = (event) => isAppUrl(event.senderFrame?.url ?? '');

function registerUpdateIpc(checkManually) {
  ipcMain.handle('updates:get-state', (event) => (fromApp(event) ? state : null));
  ipcMain.handle('updates:check', (event) => {
    if (!fromApp(event)) return null;
    checkManually();
    return state;
  });
  ipcMain.handle('updates:install', (event) => {
    if (fromApp(event) && canInstall(state)) autoUpdater.quitAndInstall();
  });
}

export function startAutoUpdate(getWindow) {
  state = initialUpdateState(app.getVersion(), app.isPackaged);
  // Un update fallito non deve mai bloccare l'uso dell'app: si logga e si riprova al giro successivo.
  const runCheck = () => autoUpdater.checkForUpdates().catch((error) => log('check fallito', error?.message ?? error));
  // Automatico: salta solo durante check o download, un check lì resetterebbe lo stato. Con ready il controllo continua.
  const checkAutomatically = () => {
    if (canAutoCheck(state)) runCheck();
  };
  registerUpdateIpc(() => {
    if (canCheck(state)) runCheck();
  });
  if (!app.isPackaged) return;

  autoUpdater.logger = { info: log, warn: log, error: log, debug: () => {} };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => dispatch(getWindow, { type: 'checking' }));
  autoUpdater.on('update-not-available', () => dispatch(getWindow, { type: 'not-available' }));
  autoUpdater.on('update-available', (info) => dispatch(getWindow, { type: 'available', version: info.version }));
  autoUpdater.on('download-progress', (progress) => dispatch(getWindow, { type: 'progress', percent: progress.percent }));
  autoUpdater.on('error', (error) => {
    // Il dettaglio resta nel log locale: al renderer arriva solo status 'error'.
    log('errore', error?.message ?? error);
    dispatch(getWindow, { type: 'error' });
  });
  autoUpdater.on('update-downloaded', (info) => {
    dispatch(getWindow, { type: 'downloaded', version: info.version });
    // Gli update in cache riemettono l'evento: evita dialoghi ripetuti o sovrapposti per la stessa versione.
    if (info.version === promptedVersion) return;
    promptedVersion = info.version;
    askToRestart(getWindow, info.version).catch((error) => log('errore dialog', error?.message ?? error));
  });

  checkAutomatically();
  setInterval(checkAutomatically, CHECK_INTERVAL_MS);
}
