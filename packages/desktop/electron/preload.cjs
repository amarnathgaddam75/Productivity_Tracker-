// Minimal, safe bridge between the renderer and the main process.
const { contextBridge, ipcRenderer } = require('electron');

function on(channel, cb) {
  const handler = (_e, payload) => cb(payload);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
}

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),
  setBadge: (count) => ipcRenderer.send('badge', count),
  onNavigate: (cb) => on('navigate', cb),
  // assistant
  sampleActivity: () => ipcRenderer.invoke('activity:sample'),
  sendPush: (subscriptions, payload, vapid) => ipcRenderer.invoke('push:send', { subscriptions, payload, vapid }),
  updateTray: (state) => ipcRenderer.send('tray:update', state),
  setPrefs: (prefs) => ipcRenderer.send('app:prefs', prefs),
  onCommandBar: (cb) => on('command-bar', cb),
  onAssistantCommand: (cb) => on('assistant-command', cb),
  onVoice: (cb) => on('voice', cb),
  // brain (AI) — API keys stay in the main process
  llm: (provider, req) => ipcRenderer.invoke('llm:request', { provider, req }),
  setBrainKey: (provider, key) => ipcRenderer.invoke('llm:set-key', { provider, key }),
  brainKeyStatus: () => ipcRenderer.invoke('llm:key-status'),
  openUrl: (url) => ipcRenderer.invoke('system:open-url', url),
  openApp: (name) => ipcRenderer.invoke('system:open-app', name),
  micAccess: () => ipcRenderer.invoke('mic:access'),
});
