import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  saveWorkflow: (data) => ipcRenderer.invoke('save-workflow', data),
  loadWorkflow: () => ipcRenderer.invoke('load-workflow'),
  
  // Generated file operations
  saveGeneratedFile: (data) => ipcRenderer.invoke('save-generated-file', data),
  loadHistoryFromFiles: (data) => ipcRenderer.invoke('load-history-from-files', data),
  clearHistoryFromFiles: (data) => ipcRenderer.invoke('clear-history-from-files', data),
  readFileAsDataUrl: (data) => ipcRenderer.invoke('read-file-as-data-url', data),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
});
