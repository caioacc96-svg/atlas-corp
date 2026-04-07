import { defaultAppData, defaultLanguageConfig } from '../data/defaultAppData';
import { allLanguageIds, activeLanguageIds } from './languages';
import {
  AppData,
  ArtifactRecord,
  AtlasMode,
  AtlasState,
  EventLogEntry,
  LanguageId,
  LaunchScreen,
  MemoryEntry,
  MemoryLayerId,
  Project,
  ProjectLanguageConfig,
  TaskRecord,
  ThemePreset,
  WorkspaceTechnicalProfile,
  WorkspaceSettings,
} from './types';

const modeSet = new Set<AtlasMode>([
  'estrategia',
  'producao',
  'design',
  'imagem-html',
  'revisao-etica',
  'prompt',
  'sistema',
]);

const stateSet = new Set<AtlasState>([
  'Ingestão',
  'Mapeamento',
  'Construção Paralela',
  'Auditoria Ativa',
  'Correção Estrutural',
  'Fechamento',
  'Retroalimentação',
]);

const themeSet = new Set<ThemePreset>(['azul-clinico', 'neutro-claro', 'atlas-profundo']);
const launchScreenSet = new Set<LaunchScreen>(['chat', 'dashboard', 'workspace', 'projects', 'memory', 'research']);
const technicalProfileSet = new Set<WorkspaceTechnicalProfile>([
  'editorial-medico',
  'frontend',
  'automacao',
  'dados',
  'fullstack',
  'pesquisa',
]);
const memoryLayerSet = new Set<MemoryLayerId>(['user', 'project', 'operational', 'evolutionary']);
const languageSet = new Set<LanguageId>(allLanguageIds);

function asString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asObject(value: unknown) {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

export function isAtlasMode(value: unknown): value is AtlasMode {
  return typeof value === 'string' && modeSet.has(value as AtlasMode);
}

export function normalizeAtlasMode(value: unknown, fallback: AtlasMode = 'estrategia'): AtlasMode {
  return isAtlasMode(value) ? value : fallback;
}

export function normalizeAtlasStateTrail(value: unknown): AtlasState[] {
  const list = Array.isArray(value) ? value.filter((item): item is AtlasState => stateSet.has(item as AtlasState)) : [];
  return list.length > 0
    ? list
    : ['Ingestão', 'Mapeamento', 'Construção Paralela', 'Auditoria Ativa', 'Correção Estrutural', 'Fechamento', 'Retroalimentação'];
}

export function isLanguageId(value: unknown): value is LanguageId {
  return typeof value === 'string' && languageSet.has(value as LanguageId);
}

export function normalizeLanguageId(value: unknown, fallback: LanguageId = 'typescript'): LanguageId {
  return isLanguageId(value) ? value : fallback;
}

export function normalizeLanguageList(value: unknown, fallback: LanguageId[] = activeLanguageIds.slice(0, 3), allowEmpty = false): LanguageId[] {
  const list = Array.isArray(value) ? value.filter((item): item is LanguageId => isLanguageId(item)) : [];
  const unique = Array.from(new Set(list));
  if (unique.length > 0) return unique;
  return allowEmpty ? [] : fallback;
}

export function sanitizeProjectLanguageConfig(value: unknown): ProjectLanguageConfig {
  const candidate = asObject(value);
  const primaryLanguage = normalizeLanguageId(candidate.primaryLanguage, defaultLanguageConfig.primaryLanguage);
  return {
    primaryLanguage,
    secondaryLanguages: normalizeLanguageList(candidate.secondaryLanguages, defaultLanguageConfig.secondaryLanguages, true).filter((item) => item !== primaryLanguage),
    technicalContext: asString(candidate.technicalContext, defaultLanguageConfig.technicalContext),
    preferredStack: asString(candidate.preferredStack, defaultLanguageConfig.preferredStack),
    workNature: asString(candidate.workNature, defaultLanguageConfig.workNature),
  };
}

export function sanitizeSettings(value: unknown): WorkspaceSettings {
  const candidate = asObject(value);
  const preferredLanguages = normalizeLanguageList(candidate.preferredLanguages, defaultAppData.settings.preferredLanguages);
  return {
    workspaceName: asString(candidate.workspaceName, defaultAppData.settings.workspaceName).trim() || defaultAppData.settings.workspaceName,
    themePreset: themeSet.has(candidate.themePreset as ThemePreset) ? (candidate.themePreset as ThemePreset) : defaultAppData.settings.themePreset,
    launchScreen: launchScreenSet.has(candidate.launchScreen as LaunchScreen)
      ? (candidate.launchScreen as LaunchScreen)
      : defaultAppData.settings.launchScreen,
    preferredLanguages,
    inactiveLanguages: normalizeLanguageList(candidate.inactiveLanguages, defaultAppData.settings.inactiveLanguages, true).filter(
      (item) => !preferredLanguages.includes(item),
    ),
    languagePriority: normalizeLanguageList(candidate.languagePriority, defaultAppData.settings.languagePriority, true),
    technicalProfile: technicalProfileSet.has(candidate.technicalProfile as WorkspaceTechnicalProfile)
      ? (candidate.technicalProfile as WorkspaceTechnicalProfile)
      : defaultAppData.settings.technicalProfile,
  };
}

export function sanitizeProject(value: unknown): Project {
  const candidate = asObject(value);
  return {
    id: asString(candidate.id) || `project-${crypto.randomUUID?.() ?? Date.now()}`,
    name: asString(candidate.name, 'Projeto Atlas').trim() || 'Projeto Atlas',
    description: asString(candidate.description),
    taskIds: asStringArray(candidate.taskIds),
    languageConfig: sanitizeProjectLanguageConfig(candidate.languageConfig),
    createdAt: asString(candidate.createdAt, new Date().toISOString()),
    updatedAt: asString(candidate.updatedAt, new Date().toISOString()),
  };
}

export function sanitizeTask(value: unknown): TaskRecord | null {
  const candidate = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  if (!candidate) return null;
  const input = asObject(candidate.input);
  const output = asObject(candidate.output);
  return {
    id: asString(candidate.id) || `task-${Date.now()}`,
    projectId: asString(candidate.projectId),
    title: asString(candidate.title, 'Nova tarefa Atlas'),
    mode: normalizeAtlasMode(candidate.mode),
    input: {
      tema: asString(input.tema),
      objetivo: asString(input.objetivo),
      publico: asString(input.publico),
      formato: asString(input.formato),
      canal: asString(input.canal),
      restricoes: asString(input.restricoes),
    },
    output: {
      mode: normalizeAtlasMode(output.mode, normalizeAtlasMode(candidate.mode)),
      stateTrail: normalizeAtlasStateTrail(output.stateTrail),
      sections: Array.isArray(output.sections)
        ? (output.sections as unknown[])
            .map((section) => {
              const raw = asObject(section);
              const title = asString(raw.title);
              return title ? { title, content: asString(raw.content) } : null;
            })
            .filter((item): item is { title: string; content: string } => Boolean(item))
        : [],
    },
    createdAt: asString(candidate.createdAt, new Date().toISOString()),
    updatedAt: asString(candidate.updatedAt, new Date().toISOString()),
  };
}

export function sanitizeMemoryEntry(value: unknown): MemoryEntry | null {
  const candidate = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  if (!candidate) return null;
  const layer = memoryLayerSet.has(candidate.layer as MemoryLayerId) ? (candidate.layer as MemoryLayerId) : 'operational';
  return {
    id: asString(candidate.id) || `memory-${Date.now()}`,
    layer,
    title: asString(candidate.title, 'Memória Atlas'),
    summary: asString(candidate.summary),
    relatedProjectId: asString(candidate.relatedProjectId) || undefined,
    createdAt: asString(candidate.createdAt, new Date().toISOString()),
  };
}

export function sanitizeArtifactRecord(value: unknown): ArtifactRecord | null {
  const candidate = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  if (!candidate) return null;
  const kind = ['research-note', 'research-source', 'research-synthesis'].includes(String(candidate.kind))
    ? (candidate.kind as ArtifactRecord['kind'])
    : 'research-note';
  const sources = Array.isArray(candidate.sources)
    ? (candidate.sources as unknown[])
        .map((item) => {
          const raw = asObject(item);
          const title = asString(raw.title);
          const url = asString(raw.url);
          if (!title || !url) return null;
          return {
            title,
            url,
            provider: asString(raw.provider, 'origem supervisionada'),
            provenance: asString(raw.provenance, 'captura Atlas'),
            excerpt: asString(raw.excerpt) || undefined,
          };
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
    : [];

  return {
    id: asString(candidate.id) || `artifact-${Date.now()}`,
    kind,
    projectId: asString(candidate.projectId) || undefined,
    title: asString(candidate.title, 'Artefato Atlas'),
    summary: asString(candidate.summary),
    content: asString(candidate.content),
    query: asString(candidate.query) || undefined,
    workspace: 'research-viva',
    sources,
    createdAt: asString(candidate.createdAt, new Date().toISOString()),
    updatedAt: asString(candidate.updatedAt, new Date().toISOString()),
  };
}

export function sanitizeEventLogEntry(value: unknown): EventLogEntry | null {
  const candidate = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
  if (!candidate) return null;
  const scopeList = ['system', 'research', 'memory', 'project', 'online'] as const;
  const levelList = ['info', 'warning', 'error'] as const;
  return {
    id: asString(candidate.id) || `event-${Date.now()}`,
    scope: scopeList.includes(candidate.scope as (typeof scopeList)[number]) ? (candidate.scope as EventLogEntry['scope']) : 'system',
    level: levelList.includes(candidate.level as (typeof levelList)[number]) ? (candidate.level as EventLogEntry['level']) : 'info',
    message: asString(candidate.message, 'Evento Atlas'),
    detail: asString(candidate.detail) || undefined,
    relatedProjectId: asString(candidate.relatedProjectId) || undefined,
    createdAt: asString(candidate.createdAt, new Date().toISOString()),
  };
}

export function sanitizeAppData(value: unknown) {
  const candidate = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
  const settings = sanitizeSettings(candidate.settings);
  const rawProjects = Array.isArray(candidate.projects) ? candidate.projects.map(sanitizeProject) : defaultAppData.projects;
  const rawTasks = Array.isArray(candidate.tasks)
    ? candidate.tasks.map(sanitizeTask).filter((item): item is TaskRecord => Boolean(item))
    : defaultAppData.tasks;
  const memory = Array.isArray(candidate.memory)
    ? candidate.memory.map(sanitizeMemoryEntry).filter((item): item is MemoryEntry => Boolean(item))
    : defaultAppData.memory;
  const rawArtifacts = Array.isArray(candidate.artifacts)
    ? candidate.artifacts.map(sanitizeArtifactRecord).filter((item): item is ArtifactRecord => Boolean(item))
    : defaultAppData.artifacts;
  const eventLog = Array.isArray(candidate.eventLog)
    ? candidate.eventLog.map(sanitizeEventLogEntry).filter((item): item is EventLogEntry => Boolean(item))
    : defaultAppData.eventLog;

  const safeProjects = rawProjects.length > 0 ? rawProjects : defaultAppData.projects.map(sanitizeProject);
  const projectMap = new Map(safeProjects.map((project) => [project.id, project]));
  const normalizedTasks = rawTasks.filter((task) => projectMap.has(task.projectId));
  const normalizedProjects = safeProjects.map((project) => {
    const taskIds = normalizedTasks.filter((task) => task.projectId === project.id).map((task) => task.id);
    return { ...project, taskIds };
  });
  const normalizedProjectMap = new Map(normalizedProjects.map((project) => [project.id, project]));
  const requestedProjectId = asString(candidate.currentProjectId);
  const normalizedCurrentProjectId = normalizedProjectMap.has(requestedProjectId)
    ? requestedProjectId
    : normalizedProjects[0]?.id ?? defaultAppData.currentProjectId;
  const normalizedArtifacts = rawArtifacts.filter((artifact) => !artifact.projectId || normalizedProjectMap.has(artifact.projectId));

  const normalized: AppData = {
    settings,
    projects: normalizedProjects,
    tasks: normalizedTasks,
    memory,
    artifacts: normalizedArtifacts,
    eventLog,
    currentProjectId: normalizedCurrentProjectId,
  };

  const wasNormalized = JSON.stringify(normalized) !== JSON.stringify({
    settings: candidate.settings,
    projects: candidate.projects,
    tasks: candidate.tasks,
    memory: candidate.memory,
    artifacts: candidate.artifacts,
    eventLog: candidate.eventLog,
    currentProjectId: candidate.currentProjectId,
  });

  return { normalized, wasNormalized };
}
