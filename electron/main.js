const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const DATA_FILE = 'crew-data.json';

function getDataDir() {
  if (app.isPackaged) {
    return path.join(path.dirname(process.execPath), 'data');
  }
  return path.join(__dirname, '..', 'data');
}

function getDataFilePath() {
  return path.join(getDataDir(), DATA_FILE);
}

function getDocumentsDir() {
  return path.join(getDataDir(), 'documents');
}

function crewDocPath(crewId, docType) {
  return path.join(getDocumentsDir(), crewId, `${docType}.pdf`);
}

function ensureDataDir() {
  const dir = getDataDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '..', 'dist', 'crew', 'browser', 'index.html'));
  } else {
    win.loadURL('http://localhost:4200');
  }
}

ipcMain.handle('read-data', () => {
  ensureDataDir();
  const filePath = getDataFilePath();
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
});

ipcMain.handle('write-data', (_event, data) => {
  ensureDataDir();
  fs.writeFileSync(getDataFilePath(), JSON.stringify(data, null, 2), 'utf-8');
});

ipcMain.handle('get-data-path', () => getDataFilePath());

ipcMain.handle('pick-pdf-file', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined, {
    title: 'Select PDF document',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths?.[0]) return null;
  return filePaths[0];
});

ipcMain.handle('save-crew-pdf', (_event, crewId, docType, sourcePath) => {
  ensureDataDir();
  const dir = path.join(getDocumentsDir(), crewId);
  fs.mkdirSync(dir, { recursive: true });
  const dest = crewDocPath(crewId, docType);
  fs.copyFileSync(sourcePath, dest);
  return true;
});

ipcMain.handle('save-crew-pdf-bytes', (_event, crewId, docType, base64) => {
  ensureDataDir();
  const dir = path.join(getDocumentsDir(), crewId);
  fs.mkdirSync(dir, { recursive: true });
  const dest = crewDocPath(crewId, docType);
  fs.writeFileSync(dest, Buffer.from(base64, 'base64'));
  return true;
});

ipcMain.handle('read-crew-pdf', (_event, crewId, docType) => {
  const file = crewDocPath(crewId, docType);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file).toString('base64');
});

ipcMain.handle('crew-pdf-exists', (_event, crewId, docType) => {
  return fs.existsSync(crewDocPath(crewId, docType));
});

ipcMain.handle('delete-crew-pdf', (_event, crewId, docType) => {
  const file = crewDocPath(crewId, docType);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  return true;
});

ipcMain.handle('delete-crew-documents', (_event, crewId) => {
  const dir = path.join(getDocumentsDir(), crewId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return true;
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
