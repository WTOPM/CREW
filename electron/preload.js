const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readData: () => ipcRenderer.invoke('read-data'),
  writeData: (data) => ipcRenderer.invoke('write-data', data),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  pickPdfFile: () => ipcRenderer.invoke('pick-pdf-file'),
  saveCrewPdf: (crewId, docType, sourcePath) =>
    ipcRenderer.invoke('save-crew-pdf', crewId, docType, sourcePath),
  saveCrewPdfBytes: (crewId, docType, base64) =>
    ipcRenderer.invoke('save-crew-pdf-bytes', crewId, docType, base64),
  readCrewPdf: (crewId, docType) => ipcRenderer.invoke('read-crew-pdf', crewId, docType),
  crewPdfExists: (crewId, docType) => ipcRenderer.invoke('crew-pdf-exists', crewId, docType),
  deleteCrewPdf: (crewId, docType) => ipcRenderer.invoke('delete-crew-pdf', crewId, docType),
  deleteCrewDocuments: (crewId) => ipcRenderer.invoke('delete-crew-documents', crewId),
});
