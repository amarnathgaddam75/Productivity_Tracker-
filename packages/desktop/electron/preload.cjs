// Minimal, safe bridge between the renderer and the main process.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  platform: process.platform,
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),
  setBadge: (count) => ipcRenderer.send('badge', count),
  onNavigate: (cb) => {
    const handler = (_e, view) => cb(view);
    ipcRenderer.on('navigate', handler);
    return () => ipcRenderer.removeListener('navigate', handler);
  },
});
