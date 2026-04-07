import { AppData, ProjectLanguageConfig, WorkspaceSettings } from '../shared/types';

const now = new Date().toISOString();
const defaultProjectId = 'project-atlas-workspace';

export const defaultLanguageConfig: ProjectLanguageConfig = {
  primaryLanguage: 'typescript',
  secondaryLanguages: ['html', 'css'],
  technicalContext: 'Aplicação desktop Atlas em React, Electron e TypeScript.',
  preferredStack: 'Electron + React + TypeScript + Vite + Tailwind + Zustand',
  workNature: 'chat conversacional, backend e ferramentas futuras',
};

export const defaultSettings: WorkspaceSettings = {
  workspaceName: 'Atlas Corp',
  themePreset: 'azul-clinico',
  launchScreen: 'chat',
  preferredLanguages: ['typescript', 'python', 'html'],
  inactiveLanguages: ['go', 'rust', 'java'],
  languagePriority: ['typescript', 'python', 'html', 'css', 'sql'],
  technicalProfile: 'editorial-medico',
};

export const defaultAppData: AppData = {
  settings: defaultSettings,
  projects: [
    {
      id: defaultProjectId,
      name: 'Atlas Chat Workspace',
      description: 'Projeto inicial para operar o núcleo conversacional do Atlas e preservar contexto de trabalho.',
      taskIds: [],
      languageConfig: { ...defaultLanguageConfig, secondaryLanguages: [...defaultLanguageConfig.secondaryLanguages] },
      createdAt: now,
      updatedAt: now,
    },
  ],
  tasks: [],
  memory: [
    {
      id: 'memory-user-1',
      layer: 'user',
      title: 'Preferência de operação',
      summary: 'O Atlas deve crescer com sobriedade, estrutura forte e expansão controlada.',
      createdAt: now,
    },
    {
      id: 'memory-operational-1',
      layer: 'operational',
      title: 'Regra soberana ativa',
      summary: 'Beleza sem margem de segurança não é solução final.',
      createdAt: now,
    },
  ],
  artifacts: [],
  eventLog: [
    {
      id: 'event-system-1',
      scope: 'system',
      level: 'info',
      message: 'Núcleo local consolidado e pronto para abertura disciplinada da fase online.',
      createdAt: now,
    },
  ],
  currentProjectId: defaultProjectId,
};
