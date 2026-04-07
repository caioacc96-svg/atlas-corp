import { create } from 'zustand';
import { defaultAppData } from '../data/defaultAppData';
import { AppData, BootstrapStatus, WorkspaceSettings } from '../shared/types';
import { appRepository } from './repository';

interface AppState extends AppData {
  hydrated: boolean;
  bootstrapStatus: BootstrapStatus | null;
  initialize: () => Promise<void>;
  clearBootstrapStatus: () => void;
  openDataFolder: () => Promise<void>;
  updateSettings: (partial: Partial<WorkspaceSettings>) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  ...defaultAppData,
  hydrated: false,
  bootstrapStatus: null,

  initialize: async () => {
    try {
      const bootstrap = await appRepository.loadData();
      set({ ...bootstrap.data, hydrated: true, bootstrapStatus: bootstrap.status.kind === 'loaded' ? null : bootstrap.status });
    } catch (error) {
      set({
        ...defaultAppData,
        hydrated: true,
        bootstrapStatus: {
          kind: 'initialize-error',
          severity: 'error',
          title: 'Inicialização com erro controlado',
          message: 'O Atlas encontrou uma falha ao inicializar a base e carregou o estado seguro padrão.',
          details: error instanceof Error ? error.message : 'Falha desconhecida na inicialização.',
        },
      });
    }
  },

  clearBootstrapStatus: () => set({ bootstrapStatus: null }),

  openDataFolder: async () => {
    await appRepository.openDataFolder();
  },

  updateSettings: async (partial: Partial<WorkspaceSettings>) => {
    const current = get();
    const nextSettings = { ...current.settings, ...partial };
    set({ settings: nextSettings });
    await appRepository.saveData({
      settings: nextSettings,
      projects: current.projects,
      tasks: current.tasks,
      memory: current.memory,
      artifacts: current.artifacts,
      eventLog: current.eventLog,
      currentProjectId: current.currentProjectId,
    });
  },
}));
