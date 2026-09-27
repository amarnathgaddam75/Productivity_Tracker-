// Laptop powers for the assistant: AI requests (with API keys kept encrypted
// in the main process), opening websites and launching apps.

const { app, shell, safeStorage } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');

const KEY_PLACEHOLDER = '__LT_API_KEY__';
const KEY_HOSTS = ['generativelanguage.googleapis.com', 'api.groq.com', 'api.anthropic.com', 'api.openai.com', 'openrouter.ai'];

// ---- API keys ------------------------------------------------------------------

const keyFile = () => path.join(app.getPath('userData'), 'brain-keys.json');

function readKeys() {
  try {
    return JSON.parse(fs.readFileSync(keyFile(), 'utf8'));
  } catch {
    return {};
  }
}

function decrypt(entry) {
  if (!entry) return null;
  try {
    if (entry.enc === 'safe' && safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(Buffer.from(entry.v, 'base64'));
    if (entry.enc === 'b64') return Buffer.from(entry.v, 'base64').toString('utf8');
  } catch {
    /* unreadable key */
  }
  return null;
}

function setKey(provider, key) {
  const keys = readKeys();
  if (!key) delete keys[provider];
  else if (safeStorage.isEncryptionAvailable()) keys[provider] = { enc: 'safe', v: safeStorage.encryptString(key).toString('base64') };
  else keys[provider] = { enc: 'b64', v: Buffer.from(key).toString('base64') };
  fs.mkdirSync(path.dirname(keyFile()), { recursive: true });
  fs.writeFileSync(keyFile(), JSON.stringify(keys), { mode: 0o600 });
  return Object.fromEntries(Object.keys(keys).map((k) => [k, true]));
}

function keyStatus() {
  return Object.fromEntries(Object.keys(readKeys()).map((k) => [k, true]));
}

// ---- AI requests -------------------------------------------------------------------

/**
 * Perform an HTTP request built by packages/shared/src/llm.js.
 * The API key placeholder is only filled in for the known AI hosts.
 */
async function llmRequest({ provider, req }) {
  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) throw new Error('Unsupported URL');
  const headers = { ...(req.headers || {}) };
  const needsKey = Object.values(headers).some((v) => String(v).includes(KEY_PLACEHOLDER));
  if (needsKey) {
    if (!KEY_HOSTS.includes(url.hostname)) throw new Error('Refusing to send the API key to an unknown host.');
    const key = decrypt(readKeys()[provider]);
    if (!key) throw new Error('No API key saved for this brain. Add it in Settings → Brain.');
    for (const k of Object.keys(headers)) headers[k] = String(headers[k]).replace(KEY_PLACEHOLDER, key);
  }
  let body;
  if (req.multipart) {
    body = new FormData();
    for (const [k, v] of Object.entries(req.multipart.fields || {})) body.append(k, v);
    const f = req.multipart.file;
    body.append(f.field, new Blob([Buffer.from(f.base64, 'base64')], { type: f.mime }), f.name);
  } else body = JSON.stringify(req.body);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const res = await fetch(url, { method: req.method || 'POST', headers, body, signal: ctrl.signal });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 500) };
    }
    if (!res.ok) {
      const msg = json?.error?.message || json?.error || json?.raw || `${res.status} ${res.statusText}`;
      throw new Error(`${res.status}: ${String(msg).slice(0, 300)}`);
    }
    return json;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The AI took too long to answer.');
    if (/ECONNREFUSED|fetch failed/.test(String(e.message) + String(e.cause?.code)) && /^(127\.0\.0\.1|localhost)$/.test(url.hostname))
      throw new Error(`Nothing is listening on ${url.host}. Is Ollama (or your local server) running?`);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ---- open websites / apps ---------------------------------------------------------------

async function openUrl(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error('Only web links can be opened.');
  await shell.openExternal(url);
  return { ok: true };
}

const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function score(name, query) {
  const n = norm(name);
  const q = norm(query);
  if (!n || !q) return 0;
  if (n === q) return 100;
  if (n.startsWith(q)) return 90;
  if (n.includes(q)) return 70;
  const nc = n.replace(/ /g, '');
  const qc = q.replace(/ /g, '');
  if (nc.includes(qc)) return 65;
  const words = q.split(' ');
  const hits = words.filter((w) => n.includes(w)).length;
  return (hits / words.length) * 50;
}

const ALIASES = { 'vs code': 'visual studio code', vscode: 'visual studio code', code: 'visual studio code', terminal: 'terminal', chrome: 'google chrome', files: 'files', 'file manager': 'files' };

function linuxApps() {
  const dirs = [
    '/usr/share/applications',
    '/usr/local/share/applications',
    path.join(os.homedir(), '.local/share/applications'),
    '/var/lib/flatpak/exports/share/applications',
    path.join(os.homedir(), '.local/share/flatpak/exports/share/applications'),
    '/var/lib/snapd/desktop/applications',
  ];
  const apps = [];
  for (const dir of dirs) {
    let files = [];
    try {
      files = fs.readdirSync(dir).filter((f) => f.endsWith('.desktop'));
    } catch {
      continue;
    }
    for (const f of files) {
      try {
        const txt = fs.readFileSync(path.join(dir, f), 'utf8');
        const entry = txt.split(/\n\[/)[0];
        if (/^NoDisplay=true/m.test(entry) || /^Type=(?!Application)/m.test(entry)) continue;
        const name = entry.match(/^Name=(.+)$/m)?.[1];
        const exec = entry.match(/^Exec=(.+)$/m)?.[1];
        const generic = entry.match(/^GenericName=(.+)$/m)?.[1] || '';
        const keywords = entry.match(/^Keywords=(.+)$/m)?.[1] || '';
        if (name && exec) apps.push({ id: f.replace(/\.desktop$/, ''), file: path.join(dir, f), name, exec, extra: `${generic} ${keywords}` });
      } catch {
        /* skip unreadable */
      }
    }
  }
  return apps;
}

function has(cmd) {
  return new Promise((resolve) => execFile('which', [cmd], (err) => resolve(!err)));
}

function detached(cmd, args, opts = {}) {
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore', ...opts });
  child.on('error', () => {});
  child.unref();
}

async function openApp(query) {
  const q = ALIASES[norm(query)] || query;
  if (process.platform === 'linux') {
    const best = linuxApps()
      .map((a) => ({ a, s: Math.max(score(a.name, q), score(a.id, q), score(a.extra, q) * 0.6) }))
      .sort((x, y) => y.s - x.s)[0];
    if (!best || best.s < 40) return { ok: false };
    const { a } = best;
    if (await has('gtk-launch')) detached('gtk-launch', [a.id]);
    else if (await has('gio')) detached('gio', ['launch', a.file]);
    else detached('/bin/sh', ['-c', a.exec.replace(/\s%[fFuUdDnNickvm]/g, '')]);
    return { ok: true, name: a.name };
  }
  if (process.platform === 'darwin') {
    const dirs = ['/Applications', '/System/Applications', '/System/Applications/Utilities', path.join(os.homedir(), 'Applications')];
    const apps = dirs.flatMap((d) => {
      try {
        return fs.readdirSync(d).filter((f) => f.endsWith('.app')).map((f) => ({ name: f.replace(/\.app$/, ''), file: path.join(d, f) }));
      } catch {
        return [];
      }
    });
    const best = apps.map((a) => ({ a, s: score(a.name, q) })).sort((x, y) => y.s - x.s)[0];
    if (!best || best.s < 40) return { ok: false };
    await shell.openPath(best.a.file);
    return { ok: true, name: best.a.name };
  }
  if (process.platform === 'win32') {
    const roots = [path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft\\Windows\\Start Menu\\Programs'), path.join(process.env.APPDATA || '', 'Microsoft\\Windows\\Start Menu\\Programs')];
    const links = [];
    const walk = (dir, depth = 0) => {
      let entries = [];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (e.isDirectory() && depth < 3) walk(path.join(dir, e.name), depth + 1);
        else if (/\.(lnk|url)$/i.test(e.name)) links.push({ name: e.name.replace(/\.(lnk|url)$/i, ''), file: path.join(dir, e.name) });
      }
    };
    roots.forEach((r) => walk(r));
    const best = links.map((a) => ({ a, s: score(a.name, q) })).filter((x) => !/uninstall/i.test(x.a.name)).sort((x, y) => y.s - x.s)[0];
    if (!best || best.s < 40) return { ok: false };
    await shell.openPath(best.a.file);
    return { ok: true, name: best.a.name };
  }
  return { ok: false };
}

module.exports = { llmRequest, setKey, keyStatus, openUrl, openApp, _score: score };
