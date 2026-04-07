import { defaultAppData } from '../data/defaultAppData';
import { AppData, AppRepository, BootstrapPayload, DesktopBridge } from '../shared/types';

function createUnboundBridge(): DesktopBridge {
  return {
    async loadData(): Promise<BootstrapPayload> {
      return {
        data: defaultAppData,
        status: {
          kind: 'initialize-error',
          severity: 'error',
          title: 'Bridge de persistência não configurada',
          message: 'O Atlas iniciou sem uma bridge ativa. A base segura padrão foi carregada para preservar continuidade.',
        },
      };
    },
    async saveData(data: AppData) {
      return data;
    },
    async openDataFolder() {
      return;
    },
  };
}

let currentBridge: DesktopBridge = createUnboundBridge();

export function bindDesktopBridge(bridge: DesktopBridge) {
  currentBridge = bridge;
}

export const appRepository: AppRepository = {
  loadData: () => currentBridge.loadData(),
  saveData: (data) => currentBridge.saveData(data),
  openDataFolder: () => currentBridge.openDataFolder(),
};
