// Electron main process for LifeTracker.
//
// In development the renderer is served by Vite (VITE_DEV_SERVER_URL). In
// production the built files are served from a privileged `app://` scheme so
// the renderer has a stable, secure origin (needed for IndexedDB/localStorage
// persistence used by Firebase Auth and the offline queue).

const { app, BrowserWindow, Notification, ipcMain, protocol, shell, Menu, net, Tray, nativeImage, globalShortcut } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const activity = require('./activity.cjs');

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
  app.on('second-instance', () => showWindow());
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

  // --hidden: started at login, stay in the tray until summoned
  mainWindow.once('ready-to-show', () => !process.argv.includes('--hidden') && mainWindow.show());

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

  // Keep the assistant running in the tray when the window is closed.
  mainWindow.on('close', (e) => {
    if (!quitting && prefs.runInBackground && tray) {
      e.preventDefault();
      mainWindow.hide();
      if (!prefs.hintShown && Notification.isSupported()) {
        prefs.hintShown = true;
        new Notification({ title: 'LifeTracker is still running', body: 'Your assistant keeps tracking in the tray. Quit from the tray menu.' }).show();
      }
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function showWindow() {
  if (!mainWindow) createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// ---- tray ---------------------------------------------------------------------
let tray = null;
let quitting = false;
const prefs = { runInBackground: true, startAtLogin: false, hintShown: false };
let trayState = { label: 'No timer running', running: false };

function trayIcon() {
  const file = path.join(__dirname, '..', app.isPackaged ? 'dist' : 'public', 'icon.png');
  const img = nativeImage.createFromPath(file);
  return img.isEmpty() ? img : img.resize({ width: 22, height: 22 });
}

function buildTray() {
  try {
    if (!tray) {
      tray = new Tray(trayIcon());
      tray.on('click', showWindow);
    }
    tray.setToolTip(`LifeTracker — ${trayState.label}`);
    if (process.platform === 'darwin') tray.setTitle(trayState.running ? ` ${trayState.short || ''}` : '');
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: trayState.label, enabled: false },
        { type: 'separator' },
        { label: trayState.running ? 'Pause timer' : 'Start / resume next task', click: () => send('assistant-command', trayState.running ? 'pause' : 'start') },
        { label: 'Briefing — what’s left?', click: () => { showWindow(); send('assistant-command', 'status'); } },
        { label: 'Ask the assistant…  (Ctrl+Shift+Space)', click: () => { showWindow(); send('command-bar'); } },
        { type: 'separator' },
        { label: 'Open LifeTracker', click: showWindow },
        { label: 'Quit', click: () => { quitting = true; app.quit(); } },
      ]),
    );
  } catch (err) {
    console.warn('Tray unavailable', err);
    tray = null;
  }
}

ipcMain.on('tray:update', (_e, state = {}) => {
  trayState = { label: String(state.label || 'LifeTracker').slice(0, 80), short: String(state.short || '').slice(0, 12), running: Boolean(state.running) };
  if (tray) buildTray();
});

// ---- background + start at login ----------------------------------------------
function setStartAtLogin(on) {
  if (process.platform === 'linux') {
    const dir = path.join(os.homedir(), '.config', 'autostart');
    const file = path.join(dir, 'lifetracker.desktop');
    const exec = process.env.APPIMAGE || process.execPath;
    try {
      if (on) {
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(file, `[Desktop Entry]\nType=Application\nName=LifeTracker\nExec="${exec}" --hidden\nX-GNOME-Autostart-enabled=true\n`);
      } else if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch (err) {
      console.warn('autostart', err);
    }
  } else {
    app.setLoginItemSettings({ openAtLogin: on, args: ['--hidden'] });
  }
}

ipcMain.on('app:prefs', (_e, p = {}) => {
  if (typeof p.runInBackground === 'boolean') prefs.runInBackground = p.runInBackground;
  if (typeof p.startAtLogin === 'boolean' && p.startAtLogin !== prefs.startAtLogin) {
    prefs.startAtLogin = p.startAtLogin;
    setStartAtLogin(p.startAtLogin);
  }
});

// ---- activity sensing -------------------------------------------------------------
ipcMain.handle('activity:sample', () => activity.sample());

// ---- phone push (Web Push, sent directly from this desktop) ------------------------
ipcMain.handle('push:send', async (_e, { subscriptions = [], payload = {}, vapid } = {}) => {
  if (!vapid?.publicKey || !vapid?.privateKey) return [];
  const webpush = require('web-push');
  webpush.setVapidDetails(vapid.subject || 'mailto:lifetracker@example.com', vapid.publicKey, vapid.privateKey);
  const body = JSON.stringify(payload);
  return Promise.all(
    subscriptions.map((sub) =>
      webpush
        .sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, body, { TTL: 3600, urgency: payload.urgent ? 'high' : 'normal' })
        .then((r) => ({ id: sub.id, ok: true, status: r.statusCode }))
        .catch((err) => ({ id: sub.id, ok: false, status: err.statusCode || 0, gone: err.statusCode === 404 || err.statusCode === 410 })),
    ),
  );
});

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { label: 'Assistant', accelerator: 'CmdOrCtrl+1', click: () => send('navigate', 'assistant') },
        { label: 'Tasks', accelerator: 'CmdOrCtrl+2', click: () => send('navigate', 'tasks') },
        { label: 'Reports', accelerator: 'CmdOrCtrl+3', click: () => send('navigate', 'reports') },
        { label: 'Ask the assistant', accelerator: 'CmdOrCtrl+K', click: () => send('command-bar') },
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
  buildTray();
  // Global shortcuts: summon the assistant / toggle the timer from anywhere.
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    showWindow();
    send('command-bar');
  });
  globalShortcut.register('CommandOrControl+Shift+P', () => send('assistant-command', trayState.running ? 'pause' : 'start'));
  app.on('activate', showWindow);
});

app.on('before-quit', () => {
  quitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  activity.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !(prefs.runInBackground && tray)) app.quit();
});
