import { app, BrowserWindow, ipcMain, net, protocol, shell } from 'electron';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  APP_HOST, APP_ORIGIN, APP_SCHEME, contentTypeFor, isApiPath, isAppUrl, isSafeExternalUrl, proxyApi, resolveStaticPath,
} from './appProtocol.mjs';
import { registerAlertSurface } from './alertSurface.mjs';
import { DEFAULT_TITLE_BAR_COLORS, sanitizeTitleBarColors, TITLE_BAR_HEIGHT } from './titleBar.mjs';
import { startAutoUpdate } from './updater.mjs';

const APP_ID = 'com.connectedmobilityai.projecttracker';
// L'origin API dell'app pacchettizzata arriva dal build (electron-builder extraMetadata.apiOrigin, variabile API_ORIGIN);
// in sviluppo si sceglie il backend con PT_API_ORIGIN.
function packagedApiOrigin() {
  const { apiOrigin: origin } = JSON.parse(readFileSync(path.join(app.getAppPath(), 'package.json'), 'utf8'));
  if (!URL.canParse(origin ?? '')) throw new Error(`apiOrigin non valido in package.json: ${origin}`);
  return origin;
}
let apiOrigin;
let distDir;

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
].join('; ');

let mainWindow = null;
export const getMainWindow = () => mainWindow;

const fetchApi = (url, init) => net.fetch(url, { ...init, credentials: 'include' });

async function serveStatic(pathname) {
  const filePath = resolveStaticPath(pathname, distDir);
  if (!filePath) return new Response(null, { status: 403 });
  try {
    const file = await net.fetch(pathToFileURL(filePath).toString());
    const headers = new Headers(file.headers);
    const contentType = contentTypeFor(filePath);
    if (contentType) headers.set('Content-Type', contentType);
    headers.set('Content-Security-Policy', CSP);
    return new Response(file.body, { status: file.status, headers });
  } catch {
    return new Response(null, { status: 404 });
  }
}

function handleAppRequest(request) {
  const url = new URL(request.url);
  if (url.host !== APP_HOST) return new Response(null, { status: 403 });
  if (isApiPath(url.pathname)) return proxyApi(request, { apiOrigin, fetchImpl: fetchApi });
  return serveStatic(url.pathname);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Project Tracker',
    // Barra nativa nascosta: la disegna il frontend (DesktopTitleBar) con i token del tema.
    // macOS tiene i semafori, Windows/Linux i pulsanti nativi in overlay colorato dal renderer.
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 13 },
    titleBarOverlay: { ...DEFAULT_TITLE_BAR_COLORS, height: TITLE_BAR_HEIGHT },
    backgroundColor: DEFAULT_TITLE_BAR_COLORS.color,
    webPreferences: {
      preload: path.join(import.meta.dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  void mainWindow.loadURL(`${APP_ORIGIN}/`);
  return mainWindow;
}

export function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  return mainWindow;
}

function registerTitleBarColors() {
  ipcMain.on('titlebar:colors', (event, value) => {
    if (process.platform === 'darwin') return;
    if (!isAppUrl(event.senderFrame?.url ?? '')) return;
    const colors = sanitizeTitleBarColors(value);
    if (!colors || !mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setTitleBarOverlay(colors);
  });
}

function initializeApp() {
  apiOrigin = app.isPackaged ? packagedApiOrigin() : (process.env.PT_API_ORIGIN ?? 'http://localhost:3001');
  distDir = app.isPackaged
    ? path.join(process.resourcesPath, 'web')
    : path.resolve(import.meta.dirname, '../../frontend/dist');

  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
  ]);

  // Nessuna navigazione fuori da app://project-tracker; i link https esterni vanno nel browser di sistema.
  app.on('web-contents-created', (_event, contents) => {
    contents.setWindowOpenHandler(({ url }) => {
      if (isSafeExternalUrl(url)) void shell.openExternal(url);
      return { action: 'deny' };
    });
    contents.on('will-navigate', (event, url) => {
      if (isAppUrl(url)) return;
      event.preventDefault();
      if (isSafeExternalUrl(url)) void shell.openExternal(url);
    });
  });

  if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

  app.on('second-instance', showMainWindow);
  app.whenReady().then(() => {
    protocol.handle(APP_SCHEME, handleAppRequest);
    registerAlertSurface(getMainWindow, showMainWindow);
    registerTitleBarColors();
    createWindow();
    startAutoUpdate(getMainWindow);
    app.on('activate', showMainWindow);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  initializeApp();
}
