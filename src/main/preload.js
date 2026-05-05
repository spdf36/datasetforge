// src/main/preload.js — Secure Context Bridge
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Dialogs
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),

  // Filesystem
  scanFolder: (folderPath) => ipcRenderer.invoke('fs:scanFolder', folderPath),
  validateBatchFolder: (folderPath) => ipcRenderer.invoke('fs:validateBatchFolder', folderPath),
  renameFolder: (args) => ipcRenderer.invoke('fs:renameFolder', args),
  getImagesInFolder: (folderPath) => ipcRenderer.invoke('fs:getImagesInFolder', folderPath),
  getRandomImage: (folderPath) => ipcRenderer.invoke('fs:getRandomImage', folderPath),
  readImageAsBase64: (filePath) => ipcRenderer.invoke('fs:readImageAsBase64', filePath),
  saveMetadata: (args) => ipcRenderer.invoke('fs:saveMetadata', args),
  showItemInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),

  // ExifTool
  extractHistoricalDates: (folderPath) => ipcRenderer.invoke('exif:extractHistoricalDates', folderPath),
});
