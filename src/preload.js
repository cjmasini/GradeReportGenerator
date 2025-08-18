// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  listStudents: (payload) => ipcRenderer.invoke('list-students', payload),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (obj) => ipcRenderer.invoke('save-settings', obj),
  generateSelected: (payload) => ipcRenderer.invoke('generate-selected', payload),
  revealPath: (absPath) => ipcRenderer.invoke('reveal-path', absPath),
  pickLogo: () => ipcRenderer.invoke('pick-logo'),
  log: (msg) => ipcRenderer.send('log', msg),

  onProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('progress', handler);
    return () => ipcRenderer.removeListener('progress', handler);
  },

  assetUrl: (rel) => {
    const path = require('path');
    const { pathToFileURL } = require('url');
    return pathToFileURL(path.join(__dirname, '..', rel)).href;
  },
});