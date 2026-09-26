// Live activity sensing for the assistant: which app/window is in front and how
// long the user has been idle. Uses only tools that ship with each OS — no
// native modules — and degrades gracefully when a platform can't report it.
//
//   Linux  : xprop (X11 / XWayland apps); on Wayland it falls back to kdotool
//            (KDE) when installed, otherwise reports { supported: false }
//   Windows: one long-lived PowerShell helper printing the foreground window
//   macOS  : osascript (System Events; needs Accessibility permission for titles)

const { execFile, spawn } = require('node:child_process');
const { powerMonitor } = require('electron');

function run(cmd, args, timeout = 1500) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, windowsHide: true }, (err, stdout) => resolve(err ? null : String(stdout)));
  });
}

function cleanTitle(title) {
  return String(title || '').replace(/\s+/g, ' ').trim().slice(0, 160);
}

// ---- Linux ------------------------------------------------------------------
async function linuxActive() {
  const root = await run('xprop', ['-root', '_NET_ACTIVE_WINDOW']);
  const id = root && (root.match(/window id # (0x[0-9a-f]+)/i) || [])[1];
  if (id && id !== '0x0') {
    const props = await run('xprop', ['-id', id, 'WM_CLASS', '_NET_WM_NAME', 'WM_NAME']);
    if (props) {
      const cls = (props.match(/WM_CLASS\([^)]*\) = "([^"]*)"(?:, "([^"]*)")?/) || []);
      const name = (props.match(/_NET_WM_NAME\([^)]*\) = "(.*)"/) || props.match(/WM_NAME\([^)]*\) = "(.*)"/) || [])[1];
      return { app: prettyApp(cls[2] || cls[1] || ''), title: cleanTitle(name), supported: true };
    }
  }
  // Wayland without XWayland focus info: try kdotool on KDE Plasma
  const kd = await run('kdotool', ['getactivewindow', 'getwindowclassname']);
  if (kd != null) {
    const title = await run('kdotool', ['getactivewindow', 'getwindowname']);
    return { app: prettyApp(kd.trim()), title: cleanTitle(title), supported: true };
  }
  return { app: null, title: null, supported: false, reason: process.env.WAYLAND_DISPLAY ? 'wayland' : 'no-xprop' };
}

// ---- Windows ------------------------------------------------------------------
const PS_SCRIPT = `
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class LT { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p); }
"@
while ($true) {
  $h = [LT]::GetForegroundWindow(); $sb = New-Object System.Text.StringBuilder 512
  [void][LT]::GetWindowText($h, $sb, 512); $p = 0; [void][LT]::GetWindowThreadProcessId($h, [ref]$p)
  $name = ''; try { $proc = Get-Process -Id $p -ErrorAction Stop; $name = $proc.MainModule.FileVersionInfo.FileDescription; if (-not $name) { $name = $proc.ProcessName } } catch {}
  [Console]::Out.WriteLine((@{ app = $name; title = $sb.ToString() } | ConvertTo-Json -Compress)); [Console]::Out.Flush()
  Start-Sleep -Seconds 3
}`;
let winHelper = null;
let winLatest = null;
function startWindowsHelper() {
  if (winHelper) return;
  winHelper = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_SCRIPT], { windowsHide: true });
  let buf = '';
  winHelper.stdout.on('data', (d) => {
    buf += d;
    const lines = buf.split(/\r?\n/);
    buf = lines.pop();
    for (const line of lines) {
      try {
        const j = JSON.parse(line);
        winLatest = { app: prettyApp(j.app), title: cleanTitle(j.title), supported: true };
      } catch {
        /* partial line */
      }
    }
  });
  winHelper.on('exit', () => {
    winHelper = null;
  });
}

// ---- macOS --------------------------------------------------------------------
async function macActive() {
  const out = await run('osascript', [
    '-e',
    'tell application "System Events" to set p to first application process whose frontmost is true',
    '-e',
    'set n to name of p',
    '-e',
    'set t to ""',
    '-e',
    'try',
    '-e',
    'tell p to set t to name of front window',
    '-e',
    'end try',
    '-e',
    'return n & "\\n" & t',
  ]);
  if (out == null) return { app: null, title: null, supported: false, reason: 'permission' };
  const [app, title] = out.split('\n');
  return { app: prettyApp(app), title: cleanTitle(title), supported: true };
}

const PRETTY = {
  code: 'VS Code',
  'code - oss': 'VS Code',
  'google-chrome': 'Chrome',
  chromium: 'Chromium',
  'chromium-browser': 'Chromium',
  firefox: 'Firefox',
  navigator: 'Firefox',
  'org.kde.dolphin': 'Dolphin',
  dolphin: 'Dolphin',
  konsole: 'Konsole',
  'gnome-terminal-server': 'Terminal',
  'org.gnome.nautilus': 'Files',
  slack: 'Slack',
  discord: 'Discord',
  spotify: 'Spotify',
  lifetracker: 'LifeTracker',
};

function prettyApp(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  return PRETTY[s.toLowerCase()] || s.replace(/\.exe$/i, '').replace(/^\w/, (c) => c.toUpperCase());
}

/** One sample: { app, title, idleSec, locked, supported, reason?, at } */
async function sample() {
  let active;
  try {
    if (process.platform === 'linux') active = await linuxActive();
    else if (process.platform === 'win32') {
      startWindowsHelper();
      active = winLatest || { app: null, title: null, supported: true };
    } else if (process.platform === 'darwin') active = await macActive();
    else active = { app: null, title: null, supported: false, reason: 'platform' };
  } catch {
    active = { app: null, title: null, supported: false, reason: 'error' };
  }
  let idleSec = 0;
  let locked = false;
  try {
    idleSec = powerMonitor.getSystemIdleTime();
    locked = powerMonitor.getSystemIdleState(60) === 'locked';
  } catch {
    /* not available before app ready */
  }
  return { ...active, idleSec: locked ? Math.max(idleSec, 600) : idleSec, locked, at: Date.now() };
}

function stop() {
  winHelper?.kill();
  winHelper = null;
}

module.exports = { sample, stop, prettyApp };
