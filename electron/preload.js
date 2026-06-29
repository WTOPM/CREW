const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readData: () => ipcRenderer.invoke('read-data'),
  writeData: (data) => ipcRenderer.invoke('write-data', data),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  getClientInfo: () => ipcRenderer.invoke('get-client-info'),
  acquireSectionLock: (section, clientId, displayName) =>
    ipcRenderer.invoke('acquire-section-lock', section, clientId, displayName),
  renewSectionLock: (section, clientId) =>
    ipcRenderer.invoke('renew-section-lock', section, clientId),
  releaseSectionLock: (section, clientId) =>
    ipcRenderer.invoke('release-section-lock', section, clientId),
  readSectionLock: (section) => ipcRenderer.invoke('read-section-lock', section),
  listSectionLocks: () => ipcRenderer.invoke('list-section-locks'),
  getLocalPrefs: () => ipcRenderer.invoke('get-local-prefs'),
  setLocalPrefs: (patch) => ipcRenderer.invoke('set-local-prefs', patch),
  onAppRestoredFromTray: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('app-restored-from-tray', listener);
    return () => ipcRenderer.removeListener('app-restored-from-tray', listener);
  },
  pickPdfFile: () => ipcRenderer.invoke('pick-pdf-file'),
  pickDirectory: () => ipcRenderer.invoke('pick-directory'),
  openDirectory: (dirPath) => ipcRenderer.invoke('open-directory', dirPath),
  openTempFile: (fileName, base64) => ipcRenderer.invoke('open-temp-file', fileName, base64),
  listDirectories: (input) => ipcRenderer.invoke('list-directories', input),
  savePdfToPath: (dirPath, fileName, base64) =>
    ipcRenderer.invoke('save-pdf-to-path', dirPath, fileName, base64),
  pdfExists: (dirPath, fileName) => ipcRenderer.invoke('pdf-exists', dirPath, fileName),
  listPrinters: () => ipcRenderer.invoke('list-printers'),
  printPdf: (base64, copies, deviceName) =>
    ipcRenderer.invoke('print-pdf', base64, copies, deviceName),
  captureHtmlFormPdf: (relativeUrl, snapshot, options) =>
    ipcRenderer.invoke('capture-html-form-pdf', relativeUrl, snapshot, options ?? {}),
  saveCrewPdf: (crewId, docType, sourcePath) =>
    ipcRenderer.invoke('save-crew-pdf', crewId, docType, sourcePath),
  saveCrewPdfBytes: (crewId, docType, base64) =>
    ipcRenderer.invoke('save-crew-pdf-bytes', crewId, docType, base64),
  readCrewPdf: (crewId, docType) => ipcRenderer.invoke('read-crew-pdf', crewId, docType),
  crewPdfExists: (crewId, docType) => ipcRenderer.invoke('crew-pdf-exists', crewId, docType),
  deleteCrewPdf: (crewId, docType) => ipcRenderer.invoke('delete-crew-pdf', crewId, docType),
  deleteCrewDocuments: (crewId) => ipcRenderer.invoke('delete-crew-documents', crewId),
  pickCrewSignatureFile: () => ipcRenderer.invoke('pick-crew-signature-file'),
  saveCrewSignatureFromPath: (crewId, sourcePath) =>
    ipcRenderer.invoke('save-crew-signature-from-path', crewId, sourcePath),
  saveCrewSignatureBytes: (crewId, base64, fileName) =>
    ipcRenderer.invoke('save-crew-signature-bytes', crewId, base64, fileName),
  readCrewSignature: (crewId) => ipcRenderer.invoke('read-crew-signature', crewId),
  crewSignatureExists: (crewId) => ipcRenderer.invoke('crew-signature-exists', crewId),
  deleteCrewSignature: (crewId) => ipcRenderer.invoke('delete-crew-signature', crewId),
  pickShipAssetFile: () => ipcRenderer.invoke('pick-ship-asset-file'),
  saveShipAssetFromPath: (kind, sourcePath) =>
    ipcRenderer.invoke('save-ship-asset-from-path', kind, sourcePath),
  saveShipAssetBytes: (kind, base64, fileName) =>
    ipcRenderer.invoke('save-ship-asset-bytes', kind, base64, fileName),
  readShipAsset: (kind) => ipcRenderer.invoke('read-ship-asset', kind),
  deleteShipAsset: (kind) => ipcRenderer.invoke('delete-ship-asset', kind),
});
