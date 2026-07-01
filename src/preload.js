const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  load: () => ipcRenderer.invoke('load-data'),
  save: (data) => ipcRenderer.invoke('save-data', data),
  hide: () => ipcRenderer.invoke('hide-window'),
  quit: () => ipcRenderer.invoke('quit-app')
});
