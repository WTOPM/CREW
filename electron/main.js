const { app, BrowserWindow, ipcMain } = require('electron');
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

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
