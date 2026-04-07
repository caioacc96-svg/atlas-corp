import { contextBridge, ipcRenderer } from 'electron';
import { AppData, BootstrapPayload } from '../shared/types';

type BackendStatusPayload = { status: 'ok' | 'degraded'; message?: string | null };

contextBridge.exposeInMainWorld('atlasDesktop', {
  loadData: () => ipcRenderer.invoke('atlas:load-data') as Promise<BootstrapPayload>,
  saveData: (data: AppData) => ipcRenderer.invoke('atlas:save-data', data) as Promise<AppData>,
  openDataFolder: () => ipcRenderer.invoke('atlas:open-data-folder') as Promise<void>,
  getBackendStatus: () => ipcRenderer.invoke('atlas:get-backend-status') as Promise<BackendStatusPayload>,
  onBackendStatus: (callback: (payload: BackendStatusPayload) => void) => {
    const listener = (_event: unknown, payload: BackendStatusPayload) => callback(payload);
    ipcRenderer.on('atlas:backend-status', listener as never);
    return () => ipcRenderer.removeListener('atlas:backend-status', listener as never);
  },
});
