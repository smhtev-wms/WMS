const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('wmsCompanion', {
  getSystemInfo: () => ipcRenderer.invoke('getSystemInfo'),
  getAppPaths: () => ipcRenderer.invoke('getAppPaths'),
  saveUserDetails: (details) => ipcRenderer.invoke('saveUserDetails', details),
  getSharedInstallPath: () => ipcRenderer.invoke('getSharedInstallPath'),
  minimizeToTray: () => ipcRenderer.invoke('minimizeToTray'),
})
