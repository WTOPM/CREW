const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gpsFloatApi', {
  ready: () => ipcRenderer.send('gps-float-ready'),
  commit: (payload) => ipcRenderer.send('gps-float-commit', payload),
  close: (payload) => ipcRenderer.send('gps-float-close', payload ?? null),
  onInit: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('gps-float-init', listener);
    return () => ipcRenderer.removeListener('gps-float-init', listener);
  },
});
