import { app, ipcMain, nativeImage, Notification } from 'electron';
import { isAppUrl } from './appProtocol.mjs';
import { sanitizeAlertCount, shouldNotify } from './alerts.mjs';

const DOT_SIZE = 16;
let lastCount = null;
let dotIcon = null;
let currentNotification = null;

// Windows non ha un badge numerico sulla taskbar: si usa un overlay a pallino, il numero va nella descrizione.
function badgeDot() {
  if (dotIcon) return dotIcon;
  const pixels = Buffer.alloc(DOT_SIZE * DOT_SIZE * 4);
  const center = (DOT_SIZE - 1) / 2;
  const radius = DOT_SIZE / 2 - 1;
  for (let y = 0; y < DOT_SIZE; y++) {
    for (let x = 0; x < DOT_SIZE; x++) {
      if ((x - center) ** 2 + (y - center) ** 2 > radius ** 2) continue;
      const i = (y * DOT_SIZE + x) * 4;
      pixels[i] = 0x2b; pixels[i + 1] = 0x2b; pixels[i + 2] = 0xe5; pixels[i + 3] = 0xff; // BGRA rosso
    }
  }
  dotIcon = nativeImage.createFromBitmap(pixels, { width: DOT_SIZE, height: DOT_SIZE });
  return dotIcon;
}

function applyBadge(count, window) {
  if (process.platform === 'darwin') {
    app.setBadgeCount(count);
  } else if (process.platform === 'win32' && window && !window.isDestroyed()) {
    window.setOverlayIcon(count > 0 ? badgeDot() : null, count > 0 ? `${count} avvisi` : '');
  }
}

function notify(count, showWindow) {
  if (!Notification.isSupported()) return;
  const notification = new Notification({
    title: 'Project Tracker',
    body: count === 1 ? '1 avviso da verificare' : `${count} avvisi da verificare`,
  });
  currentNotification = notification;
  notification.on('click', () => {
    if (currentNotification === notification) currentNotification = null;
    showWindow();
  });
  notification.on('close', () => {
    if (currentNotification === notification) currentNotification = null;
  });
  notification.show();
}

export function registerAlertSurface(getWindow, showWindow) {
  ipcMain.on('alerts:count', (event, value) => {
    if (!isAppUrl(event.senderFrame?.url ?? '')) return;
    const count = sanitizeAlertCount(value);
    if (count === null) return;
    const window = getWindow();
    applyBadge(count, window);
    if (shouldNotify(lastCount, count)) notify(count, showWindow);
    lastCount = count;
  });
}
