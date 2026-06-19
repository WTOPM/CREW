const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

/**
 * In the packaged app the renderer is served over a custom privileged scheme
 * (app://) instead of file://. This is REQUIRED because the document templates
 * are loaded with fetch('/xxx.pdf'), and Chromium does not allow fetch() over
 * file://. The custom scheme behaves like http for the renderer.
 */
const APP_SCHEME = 'app';
const APP_ORIGIN = `${APP_SCHEME}://local`;

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

function getRendererDir() {
  return path.join(__dirname, '..', 'dist', 'crew', 'browser');
}

function registerAppProtocol() {
  const root = getRendererDir();
  protocol.handle(APP_SCHEME, (request) => {
    let rel = decodeURIComponent(new URL(request.url).pathname);
    if (!rel || rel === '/') rel = '/index.html';
    const filePath = path.normalize(path.join(root, rel));
    // Block path traversal outside the renderer dir; SPA fallback to index.html.
    if (!filePath.startsWith(root)) {
      return new Response('Not found', { status: 404 });
    }
    if (!fs.existsSync(filePath)) {
      return net.fetch(pathToFileURL(path.join(root, 'index.html')).toString());
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

const DATA_FILE = 'crew-data.json';

/**
 * The folder that holds the .exe at runtime.
 * For a portable build, the exe is unpacked to a temp dir, so process.execPath
 * points there — PORTABLE_EXECUTABLE_DIR is the real folder the user double-clicked.
 */
function getExeDir() {
  return process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
}

/**
 * Where all app data lives. Resolution order (first match wins):
 *  1. CREW_DATA_DIR environment variable.
 *  2. A `data-path.txt` next to the exe whose first non-empty line is a folder
 *     path (may be a shared network path like \\\\SERVER\\share\\crew). This lets
 *     several PCs on the LAN point at one shared data folder without rebuilding.
 *  3. Default: a `data` folder next to the exe.
 */
function getDataDir() {
  if (!app.isPackaged) {
    return path.join(__dirname, '..', 'data');
  }
  if (process.env.CREW_DATA_DIR) {
    return process.env.CREW_DATA_DIR;
  }
  try {
    const cfg = path.join(getExeDir(), 'data-path.txt');
    if (fs.existsSync(cfg)) {
      const line = fs
        .readFileSync(cfg, 'utf-8')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .find((l) => l && !l.startsWith('#'));
      if (line) return line;
    }
  } catch {
    /* fall through to default */
  }
  return path.join(getExeDir(), 'data');
}

function getDataFilePath() {
  return path.join(getDataDir(), DATA_FILE);
}

function getDocumentsDir() {
  return path.join(getDataDir(), 'documents');
}

function getSignaturesDir() {
  return path.join(getDataDir(), 'signatures');
}

const CREW_SIGNATURE_EXTS = ['.png', '.jpg', '.jpeg', '.pdf'];

function findCrewSignaturePath(crewId) {
  const dir = getSignaturesDir();
  if (!fs.existsSync(dir)) return null;
  for (const ext of CREW_SIGNATURE_EXTS) {
    const p = path.join(dir, `${crewId}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function removeCrewSignatureFiles(crewId) {
  const dir = getSignaturesDir();
  if (!fs.existsSync(dir)) return;
  for (const ext of CREW_SIGNATURE_EXTS) {
    const p = path.join(dir, `${crewId}${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

function saveCrewSignatureFromPath(crewId, sourcePath) {
  ensureDataDir();
  const ext = path.extname(sourcePath).toLowerCase() || '.png';
  if (!CREW_SIGNATURE_EXTS.includes(ext)) {
    throw new Error('Unsupported file type');
  }
  const dir = getSignaturesDir();
  fs.mkdirSync(dir, { recursive: true });
  removeCrewSignatureFiles(crewId);
  const dest = path.join(dir, `${crewId}${ext}`);
  fs.copyFileSync(sourcePath, dest);
  return { fileName: path.basename(dest) };
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
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  // Launch maximized (fills the screen, keeps the taskbar).
  win.maximize();

  // Open the generated-document preview windows maximized too.
  win.webContents.setWindowOpenHandler(() => ({ action: 'allow' }));
  win.webContents.on('did-create-window', (childWindow) => {
    childWindow.maximize();
  });

  if (app.isPackaged) {
    win.loadURL(`${APP_ORIGIN}/index.html`);
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

ipcMain.handle('open-directory', async (_event, dirPath) => {
  const p = String(dirPath || '').trim();
  if (!p) return { ok: false, error: 'empty path' };
  if (!fs.existsSync(p)) return { ok: false, error: 'path not found' };
  const err = await shell.openPath(p);
  return err ? { ok: false, error: err } : { ok: true };
});

ipcMain.handle('open-temp-file', async (_event, fileName, base64) => {
  const safeName = path.basename(String(fileName || 'export.xlsx'));
  const p = path.join(app.getPath('temp'), safeName);
  try {
    fs.writeFileSync(p, Buffer.from(String(base64 || ''), 'base64'));
    const err = await shell.openPath(p);
    return err ? { ok: false, error: err } : { ok: true, path: p };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
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

ipcMain.handle('list-printers', async () => {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  if (!win) return [];
  try {
    const printers = await win.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName || p.name,
      isDefault: !!p.isDefault,
    }));
  } catch {
    return [];
  }
});

ipcMain.handle('print-pdf', (_event, base64, copies, deviceName) => {
  return new Promise((resolve) => {
    const os = require('os');
    const tmpFile = path.join(os.tmpdir(), `crew-print-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
    try {
      fs.writeFileSync(tmpFile, Buffer.from(base64, 'base64'));
    } catch (err) {
      resolve({ ok: false, error: String(err) });
      return;
    }

    const printWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    let settled = false;
    const cleanup = () => {
      try { if (!printWin.isDestroyed()) printWin.destroy(); } catch {}
      try { fs.unlinkSync(tmpFile); } catch {}
    };
    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    printWin.webContents.on('did-finish-load', () => {
      // Give the embedded PDF viewer a moment to lay out before printing.
      setTimeout(() => {
        const options = {
          silent: true,
          printBackground: true,
          copies: Math.max(1, Number(copies) || 1),
        };
        if (deviceName) options.deviceName = deviceName;
        try {
          printWin.webContents.print(options, (success, failureReason) => {
            finish({ ok: success, error: success ? undefined : failureReason });
          });
        } catch (err) {
          finish({ ok: false, error: String(err) });
        }
      }, 600);
    });
    printWin.webContents.on('did-fail-load', (_e, _code, desc) => finish({ ok: false, error: desc }));
    setTimeout(() => finish({ ok: false, error: 'Print timed out' }), 20000);

    printWin.loadURL(pathToFileURL(tmpFile).toString());
  });
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
  removeCrewSignatureFiles(crewId);
  return true;
});

ipcMain.handle('pick-crew-signature-file', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(win ?? undefined, {
    title: 'Select crew signature',
    filters: [{ name: 'Image or PDF', extensions: ['png', 'jpg', 'jpeg', 'pdf'] }],
    properties: ['openFile'],
  });
  if (canceled || !filePaths?.[0]) return null;
  return filePaths[0];
});

ipcMain.handle('save-crew-signature-from-path', (_event, crewId, sourcePath) =>
  saveCrewSignatureFromPath(crewId, sourcePath),
);

ipcMain.handle('save-crew-signature-bytes', (_event, crewId, base64, fileName) => {
  ensureDataDir();
  const ext = path.extname(fileName).toLowerCase() || '.png';
  if (!CREW_SIGNATURE_EXTS.includes(ext)) {
    throw new Error('Unsupported file type');
  }
  const dir = getSignaturesDir();
  fs.mkdirSync(dir, { recursive: true });
  removeCrewSignatureFiles(crewId);
  const dest = path.join(dir, `${crewId}${ext}`);
  fs.writeFileSync(dest, Buffer.from(base64, 'base64'));
  return { fileName: path.basename(dest) };
});

ipcMain.handle('read-crew-signature', (_event, crewId) => {
  const file = findCrewSignaturePath(crewId);
  if (!file) return null;
  return fs.readFileSync(file).toString('base64');
});

ipcMain.handle('crew-signature-exists', (_event, crewId) => {
  return !!findCrewSignaturePath(crewId);
});

ipcMain.handle('delete-crew-signature', (_event, crewId) => {
  removeCrewSignatureFiles(crewId);
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
  if (app.isPackaged) registerAppProtocol();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
