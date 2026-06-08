const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readData: () => ipcRenderer.invoke('read-data'),
  writeData: (data) => ipcRenderer.invoke('write-data', data),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
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
  saveCrewPdf: (crewId, docType, sourcePath) =>
    ipcRenderer.invoke('save-crew-pdf', crewId, docType, sourcePath),
  saveCrewPdfBytes: (crewId, docType, base64) =>
    ipcRenderer.invoke('save-crew-pdf-bytes', crewId, docType, base64),
  readCrewPdf: (crewId, docType) => ipcRenderer.invoke('read-crew-pdf', crewId, docType),
  crewPdfExists: (crewId, docType) => ipcRenderer.invoke('crew-pdf-exists', crewId, docType),
  deleteCrewPdf: (crewId, docType) => ipcRenderer.invoke('delete-crew-pdf', crewId, docType),
  deleteCrewDocuments: (crewId) => ipcRenderer.invoke('delete-crew-documents', crewId),
  pickShipAssetFile: () => ipcRenderer.invoke('pick-ship-asset-file'),
  saveShipAssetFromPath: (kind, sourcePath) =>
    ipcRenderer.invoke('save-ship-asset-from-path', kind, sourcePath),
  saveShipAssetBytes: (kind, base64, fileName) =>
    ipcRenderer.invoke('save-ship-asset-bytes', kind, base64, fileName),
  readShipAsset: (kind) => ipcRenderer.invoke('read-ship-asset', kind),
  deleteShipAsset: (kind) => ipcRenderer.invoke('delete-ship-asset', kind),
});
