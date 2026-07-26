const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  platform: process.platform,
  dragStart: () => ipcRenderer.send('pet:drag-start'),
  dragEnd: () => ipcRenderer.send('pet:drag-end'),
  getGeometry: () => ipcRenderer.invoke('pet:get-geometry'),
  setPosition: (x, y) => ipcRenderer.send('pet:set-position', x, y),
  setIgnoreMouse: (ignore) => ipcRenderer.send('pet:set-ignore-mouse', ignore),
  showMenu: (state) => ipcRenderer.send('pet:show-menu', state),
  chat: (messages) => ipcRenderer.invoke('pet:chat', messages),
  quit: () => ipcRenderer.send('pet:quit'),
  onCommand: (cb) => ipcRenderer.on('pet:command', (_e, cmd) => cb(cmd)),
});
