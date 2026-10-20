// Preload in sandbox: deve restare CommonJS e usare solo i moduli electron ammessi in sandbox.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  platform: process.platform,
  setAlertCount: (count) => ipcRenderer.send('alerts:count', count),
  setTitleBarColors: (colors) => ipcRenderer.send('titlebar:colors', colors),
  updates: {
    getState: () => ipcRenderer.invoke('updates:get-state'),
    check: () => ipcRenderer.invoke('updates:check'),
    install: () => ipcRenderer.invoke('updates:install'),
    // Al renderer arriva solo lo stato, mai l'oggetto event di Electron.
    onState: (callback) => {
      const listener = (_event, state) => callback(state);
      ipcRenderer.on('updates:state', listener);
      return () => ipcRenderer.removeListener('updates:state', listener);
    },
  },
});
