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

function getAssetsDir() {
  return path.join(getDataDir(), 'assets');
}

const SHIP_ASSET_EXTS = ['.png', '.jpg', '.jpeg', '.pdf'];

function findShipAssetPath(kind) {
  const dir = getAssetsDir();
  if (!fs.existsSync(dir)) return null;
  for (const ext of SHIP_ASSET_EXTS) {
    const p = path.join(dir, `${kind}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function removeShipAssetFiles(kind) {
  const dir = getAssetsDir();
  if (!fs.existsSync(dir)) return;
  for (const ext of SHIP_ASSET_EXTS) {
    const p = path.join(dir, `${kind}${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

function saveShipAssetFromPath(kind, sourcePath) {
  ensureDataDir();
  const ext = path.extname(sourcePath).toLowerCase() || '.png';
  if (!SHIP_ASSET_EXTS.includes(ext)) {
    throw new Error('Unsupported file type');
  }
  const dir = getAssetsDir();
  fs.mkdirSync(dir, { recursive: true });
  removeShipAssetFiles(kind);
  const dest = path.join(dir, `${kind}${ext}`);
  fs.copyFileSync(sourcePath, dest);
  return { fileName: path.basename(dest) };
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

ipcMain.handle('pick-directory', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined, {
    title: 'Select output folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (canceled || !filePaths?.[0]) return null;
  return filePaths[0];
});

ipcMain.handle('list-directories', (_event, input) => {
  try {
    const raw = String(input || '').trim();
    if (raw.length < 2) return [];
    let baseDir;
    let prefix;
    if (raw.endsWith('\\') || raw.endsWith('/')) {
      baseDir = raw;
      prefix = '';
    } else {
      baseDir = path.dirname(raw);
      prefix = path.basename(raw).toLowerCase();
    }
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && e.name.toLowerCase().startsWith(prefix))
      .slice(0, 20)
      .map((e) => path.join(baseDir, e.name));
  } catch {
    return [];
  }
});

ipcMain.handle('pdf-exists', (_event, dirPath, fileName) => {
  try {
    const safeName = path.basename(String(fileName || ''));
    return fs.existsSync(path.join(String(dirPath || ''), safeName));
  } catch {
    return false;
  }
});

ipcMain.handle('save-pdf-to-path', (_event, dirPath, fileName, base64) => {
  if (!dirPath) throw new Error('No output folder selected');
  const safeName = path.basename(String(fileName || 'document.pdf'));
  fs.mkdirSync(dirPath, { recursive: true });
  const fullPath = path.join(dirPath, safeName);
  fs.writeFileSync(fullPath, Buffer.from(base64, 'base64'));
  return { fullPath };
});

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

ipcMain.handle('pick-ship-asset-file', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined, {
    title: 'Select stamp or signature',
    filters: [{ name: 'Image or PDF', extensions: ['png', 'jpg', 'jpeg', 'pdf'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths?.[0]) return null;
  return filePaths[0];
});

ipcMain.handle('save-ship-asset-from-path', (_event, kind, sourcePath) =>
  saveShipAssetFromPath(kind, sourcePath),
);

ipcMain.handle('save-ship-asset-bytes', (_event, kind, base64, fileName) => {
  ensureDataDir();
  const ext = path.extname(fileName).toLowerCase() || '.png';
  if (!SHIP_ASSET_EXTS.includes(ext)) {
    throw new Error('Unsupported file type');
  }
  const dir = getAssetsDir();
  fs.mkdirSync(dir, { recursive: true });
  removeShipAssetFiles(kind);
  const dest = path.join(dir, `${kind}${ext}`);
  fs.writeFileSync(dest, Buffer.from(base64, 'base64'));
  return { fileName: path.basename(dest) };
});

ipcMain.handle('read-ship-asset', (_event, kind) => {
  const file = findShipAssetPath(kind);
  if (!file) return null;
  return fs.readFileSync(file).toString('base64');
});

ipcMain.handle('delete-ship-asset', (_event, kind) => {
  removeShipAssetFiles(kind);
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
