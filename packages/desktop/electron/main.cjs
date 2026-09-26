// Electron main process for LifeTracker.
//
// In development the renderer is served by Vite (VITE_DEV_SERVER_URL). In
// production the built files are served from a privileged `app://` scheme so
// the renderer has a stable, secure origin (needed for IndexedDB/localStorage
// persistence used by Firebase Auth and the offline queue).

const { app, BrowserWindow, Notification, ipcMain, protocol, shell, Menu, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const DIST = path.join(__dirname, '..', 'dist');
const APP_ORIGIN = 'app://lifetracker';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebaseapp.com",
].join('; ');

// Many Linux GPU drivers are blocklisted by Chromium, which disables WebGL and
// with it the particle scene. Allow the SwiftShader software fallback instead.
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

let mainWindow = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
}

if (process.platform === 'win32') app.setAppUserModelId('com.lifetracker.desktop');

function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const { pathname } = new URL(request.url);
    let rel = decodeURIComponent(pathname).replace(/^\/+/, '') || 'index.html';
    const filePath = path.normalize(path.join(DIST, rel));
    if (!filePath.startsWith(DIST)) return new Response('Forbidden', { status: 403 });
    const res = await net.fetch(pathToFileURL(filePath).toString()).catch(() => null);
    if (!res || !res.ok) {
      // SPA fallback
      return net.fetch(pathToFileURL(path.join(DIST, 'index.html')).toString());
    }
    const headers = new Headers(res.headers);
    if (rel.endsWith('.html')) headers.set('Content-Security-Policy', CSP);
    return new Response(res.body, { status: res.status, headers });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: 'LifeTracker',
    backgroundColor: '#0f172a',
    show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false, // keep timers & notifications accurate when minimised
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  // Open external links in the user's browser, never inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = DEV_URL ? url.startsWith(DEV_URL) : url.startsWith(APP_ORIGIN);
    if (!allowed) {
      event.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });

  if (DEV_URL) {
    mainWindow.loadURL(DEV_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadURL(`${APP_ORIGIN}/index.html`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Tasks', accelerator: 'CmdOrCtrl+1', click: () => send('navigate', 'tasks') },
        { label: 'Reports', accelerator: 'CmdOrCtrl+2', click: () => send('navigate', 'reports') },
        { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => send('navigate', 'settings') },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function send(channel, payload) {
  mainWindow?.webContents.send(channel, payload);
}

ipcMain.on('notify', (_e, { title, body } = {}) => {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title: String(title || 'LifeTracker'), body: String(body || ''), silent: false });
  n.on('click', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  n.show();
});

ipcMain.on('badge', (_e, count) => {
  const n = Math.max(0, Number(count) || 0);
  app.setBadgeCount(n); // macOS dock + Linux Unity launchers
  if (process.platform === 'win32' && mainWindow) mainWindow.flashFrame(n > 0 && !mainWindow.isFocused());
});

app.whenReady().then(() => {
  registerAppProtocol();
  buildMenu();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
