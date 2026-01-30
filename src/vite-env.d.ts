/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    saveWorkflow: (data: any) => Promise<void>;
    loadWorkflow: () => Promise<any>;
    getSettings: () => Promise<any>;
    saveSettings: (settings: any) => Promise<void>;
  };
}
