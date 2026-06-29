const { app, BrowserWindow, ipcMain, dialog, protocol, net, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
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
  const root = path.normalize(getRendererDir());
  const rootWithSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

  protocol.handle(APP_SCHEME, (request) => {
    const url = new URL(request.url);
    let rel = decodeURIComponent(url.pathname);
    if (!rel || rel === '/') {
      rel = 'index.html';
    } else {
      rel = rel.replace(/^\/+/, '');
      if (rel.endsWith('/')) rel += 'index.html';
    }

    let filePath = path.normalize(path.join(root, rel));
    const underRoot = filePath === root || filePath.startsWith(rootWithSep);
    if (!underRoot) {
      return new Response('Not found', { status: 404 });
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath)) {
      // Do not SPA-fallback for static HTML forms or missing assets — only Angular routes.
      if (rel.startsWith('forms/') || /\.[a-z0-9]+$/i.test(rel)) {
        return new Response('Not found', { status: 404 });
      }
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

function writeDataFile(data) {
  const filePath = getDataFilePath();
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
}

const SECTION_LOCK_IDS = ['home', 'dg', 'reefer', 'eta', 'settings'];
const LOCK_STALE_MS = 90_000;

function getLocksDir() {
  return path.join(getDataDir(), 'locks');
}

function sectionLockPath(section) {
  return path.join(getLocksDir(), `${section}.lock.json`);
}

function readSectionLock(section) {
  const p = sectionLockPath(section);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

function isSectionLockStale(lock) {
  if (!lock || typeof lock.heartbeatAt !== 'number') return true;
  return Date.now() - lock.heartbeatAt > LOCK_STALE_MS;
}

function clearStaleSectionLock(section) {
  const lock = readSectionLock(section);
  if (lock && isSectionLockStale(lock)) {
    try {
      fs.unlinkSync(sectionLockPath(section));
    } catch {
      /* ignore */
    }
  }
}

/** Per-PC preferences (not in shared crew-data.json). */
const LOCAL_PREFS_FILE = 'local-prefs.json';

function getLocalPrefsPath() {
  return path.join(app.getPath('userData'), LOCAL_PREFS_FILE);
}

function readLocalPrefs() {
  try {
    const raw = fs.readFileSync(getLocalPrefsPath(), 'utf-8');
    const parsed = JSON.parse(raw);
    return { minimizeToTray: !!parsed.minimizeToTray };
  } catch {
    return { minimizeToTray: false };
  }
}

function writeLocalPrefs(prefs) {
  const dir = path.dirname(getLocalPrefsPath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getLocalPrefsPath(), JSON.stringify(prefs, null, 2), 'utf-8');
}

let mainWindow = null;
let tray = null;
let appIsQuitting = false;
let minimizeToTrayEnabled = false;

function getTrayIcon() {
  const iconPath = path.join(__dirname, 'icon.ico');
  if (fs.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath);
  }
  const pngPath = path.join(__dirname, 'icon.png');
  if (fs.existsSync(pngPath)) {
    return nativeImage.createFromPath(pngPath);
  }
  return nativeImage.createEmpty();
}

function ensureTray() {
  if (tray) return;
  const icon = getTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('CREW Documents');
  const menu = Menu.buildFromTemplate([
    {
      label: 'Show CREW Documents',
      click: () => showMainWindowFromTray(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        appIsQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => showMainWindowFromTray());
  if (process.platform === 'win32') {
    tray.on('click', () => showMainWindowFromTray());
  }
}

function destroyTray() {
  if (!tray) return;
  tray.destroy();
  tray = null;
}

function applyMinimizeToTrayPref(enabled) {
  minimizeToTrayEnabled = !!enabled;
  if (minimizeToTrayEnabled) {
    ensureTray();
  } else {
    destroyTray();
  }
}

function hideMainWindowToTray() {
  if (!mainWindow || !minimizeToTrayEnabled) return;
  mainWindow.hide();
}

function showMainWindowFromTray() {
  if (!mainWindow) return;
  const wasHidden = !mainWindow.isVisible();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  if (wasHidden) {
    mainWindow.webContents.send('app-restored-from-tray');
  }
}

function attachTrayWindowHandlers(win) {
  win.on('minimize', (event) => {
    if (!minimizeToTrayEnabled) return;
    event.preventDefault();
    hideMainWindowToTray();
  });

  win.on('close', (event) => {
    if (!minimizeToTrayEnabled || appIsQuitting) return;
    event.preventDefault();
    hideMainWindowToTray();
  });
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

  mainWindow = win;
  attachTrayWindowHandlers(win);
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null;
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

function getAppOrigin() {
  return app.isPackaged ? APP_ORIGIN : 'http://localhost:4200';
}

/** Poll hidden capture window until the HTML form sets window.__pdfReady. */
async function waitForHtmlFormPdfReady(webContents, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ready = await webContents.executeJavaScript('Boolean(window.__pdfReady)');
      if (ready) return;
    } catch {
      /* page still loading */
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error('HTML form failed to render for PDF export');
}

/**
 * Chromium printToPDF — vector text/lines (not html2canvas raster).
 * Snapshot is injected via sessionStorage on the app origin before loading the form.
 */
ipcMain.handle('capture-html-form-pdf', async (_event, relativeUrl, snapshot, captureOpts = {}) => {
  const landscape = !!captureOpts.landscape;
  const origin = getAppOrigin();
  const urlObj = new URL(relativeUrl.startsWith('/') ? relativeUrl : `/${relativeUrl}`, `${origin}/`);
  urlObj.searchParams.set('pdfExport', '1');
  urlObj.searchParams.set('pdfData', '1');
  const formUrl = urlObj.toString();
  const snapshotJson = JSON.stringify(snapshot ?? {});
  const storageKey = 'crew-html-form-pdf-snapshot';

  const win = new BrowserWindow({
    show: false,
    width: landscape ? 1280 : 900,
    height: landscape ? 900 : 1280,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  let debuggerAttached = false;
  try {
    await win.loadURL(`${origin}/`);
    await win.webContents.executeJavaScript(
      `sessionStorage.setItem(${JSON.stringify(storageKey)}, ${JSON.stringify(snapshotJson)});`,
    );

    await win.loadURL(formUrl);
    await waitForHtmlFormPdfReady(win.webContents);
    await new Promise((resolve) => setTimeout(resolve, 250));

    const wc = win.webContents;
    try {
      if (!wc.debugger.isAttached()) {
        wc.debugger.attach('1.3');
        debuggerAttached = true;
      }
      await wc.debugger.sendCommand('Emulation.setEmulatedMedia', { media: 'screen' });
    } catch {
      /* screen layout optional — print CSS still works */
    }

    const pdfBuffer = await wc.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      margins: { marginType: 'none' },
      pageSize: 'A4',
      landscape,
    });

    return pdfBuffer.toString('base64');
  } finally {
    if (debuggerAttached) {
      try {
        if (!win.isDestroyed() && win.webContents.debugger.isAttached()) {
          win.webContents.debugger.detach();
        }
      } catch {
        /* ignore */
      }
    }
    if (!win.isDestroyed()) win.destroy();
  }
});

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
  writeDataFile(data);
});

ipcMain.handle('get-client-info', () => {
  let userName = '';
  try {
    userName = os.userInfo().username || '';
  } catch {
    userName = '';
  }
  return {
    hostName: os.hostname(),
    userName,
  };
});

ipcMain.handle('acquire-section-lock', (_event, section, clientId, displayName) => {
  if (!SECTION_LOCK_IDS.includes(section)) {
    return { ok: false, error: 'invalid section' };
  }
  ensureDataDir();
  fs.mkdirSync(getLocksDir(), { recursive: true });
  clearStaleSectionLock(section);
  const existing = readSectionLock(section);
  const now = Date.now();
  if (existing && existing.clientId !== clientId && !isSectionLockStale(existing)) {
    return { ok: false, heldBy: existing };
  }
  const lock = {
    section,
    clientId,
    displayName: String(displayName || 'User'),
    acquiredAt: existing?.acquiredAt ?? now,
    heartbeatAt: now,
  };
  fs.writeFileSync(sectionLockPath(section), JSON.stringify(lock, null, 2), 'utf-8');
  return { ok: true, lock };
});

ipcMain.handle('renew-section-lock', (_event, section, clientId) => {
  if (!SECTION_LOCK_IDS.includes(section)) return { ok: false };
  const existing = readSectionLock(section);
  if (!existing || existing.clientId !== clientId || isSectionLockStale(existing)) {
    return { ok: false };
  }
  existing.heartbeatAt = Date.now();
  fs.writeFileSync(sectionLockPath(section), JSON.stringify(existing, null, 2), 'utf-8');
  return { ok: true };
});

ipcMain.handle('release-section-lock', (_event, section, clientId) => {
  if (!SECTION_LOCK_IDS.includes(section)) return { ok: true };
  const existing = readSectionLock(section);
  if (existing && existing.clientId === clientId) {
    try {
      fs.unlinkSync(sectionLockPath(section));
    } catch {
      /* ignore */
    }
  }
  return { ok: true };
});

ipcMain.handle('read-section-lock', (_event, section) => {
  if (!SECTION_LOCK_IDS.includes(section)) return null;
  clearStaleSectionLock(section);
  const lock = readSectionLock(section);
  if (!lock || isSectionLockStale(lock)) return null;
  return lock;
});

ipcMain.handle('list-section-locks', () => {
  const locks = {};
  for (const section of SECTION_LOCK_IDS) {
    clearStaleSectionLock(section);
    const lock = readSectionLock(section);
    if (lock && !isSectionLockStale(lock)) {
      locks[section] = lock;
    }
  }
  return locks;
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

ipcMain.handle('get-local-prefs', () => readLocalPrefs());

ipcMain.handle('set-local-prefs', (_event, patch) => {
  const current = readLocalPrefs();
  const next = { ...current, ...patch };
  if (typeof patch?.minimizeToTray === 'boolean') {
    next.minimizeToTray = patch.minimizeToTray;
    applyMinimizeToTrayPref(next.minimizeToTray);
    if (!next.minimizeToTray && mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  }
  writeLocalPrefs(next);
  return next;
});

app.whenReady().then(() => {
  if (app.isPackaged) registerAppProtocol();
  const prefs = readLocalPrefs();
  applyMinimizeToTrayPref(prefs.minimizeToTray);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (minimizeToTrayEnabled && mainWindow && !appIsQuitting) return;
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  appIsQuitting = true;
});
