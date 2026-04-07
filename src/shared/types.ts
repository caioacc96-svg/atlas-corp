export type AtlasMode =
  | 'estrategia'
  | 'producao'
  | 'design'
  | 'imagem-html'
  | 'revisao-etica'
  | 'prompt'
  | 'sistema';

export type AtlasState =
  | 'Ingestão'
  | 'Mapeamento'
  | 'Construção Paralela'
  | 'Auditoria Ativa'
  | 'Correção Estrutural'
  | 'Fechamento'
  | 'Retroalimentação';

export type ThemePreset = 'azul-clinico' | 'neutro-claro' | 'atlas-profundo';
export type LaunchScreen = 'chat' | 'dashboard' | 'workspace' | 'projects' | 'memory' | 'research';

export type WorkspaceTechnicalProfile =
  | 'editorial-medico'
  | 'frontend'
  | 'automacao'
  | 'dados'
  | 'fullstack'
  | 'pesquisa';

export type LanguageId =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'html'
  | 'css'
  | 'sql'
  | 'bash'
  | 'json'
  | 'yaml'
  | 'markdown'
  | 'go'
  | 'rust'
  | 'java'
  | 'csharp'
  | 'kotlin'
  | 'swift'
  | 'php'
  | 'ruby'
  | 'r'
  | 'dart'
  | 'lua'
  | 'cpp';

export type LanguageSupportLevel = 'active' | 'prepared' | 'planned';

export type LanguageCapability =
  | 'ui'
  | 'logic'
  | 'automation'
  | 'markup'
  | 'styling'
  | 'query'
  | 'config'
  | 'documentation'
  | 'tooling'
  | 'analysis'
  | 'data';

export type LanguageUseCase =
  | 'frontend'
  | 'backend'
  | 'automation'
  | 'markup'
  | 'styling'
  | 'query'
  | 'documentation'
  | 'configuration'
  | 'scripting'
  | 'data';

export interface LanguageProfile {
  id: LanguageId;
  label: string;
  supportLevel: LanguageSupportLevel;
  summary: string;
  capabilities: LanguageCapability[];
  defaultUseCases: LanguageUseCase[];
}

export interface ProjectLanguageConfig {
  primaryLanguage: LanguageId;
  secondaryLanguages: LanguageId[];
  technicalContext: string;
  preferredStack: string;
  workNature: string;
}

export interface TaskInput {
  tema: string;
  objetivo: string;
  publico: string;
  formato: string;
  canal: string;
  restricoes: string;
}

export interface EngineSection {
  title: string;
  content: string;
}

export interface EngineOutput {
  mode: AtlasMode;
  stateTrail: AtlasState[];
  sections: EngineSection[];
}

export interface TaskRecord {
  id: string;
  projectId: string;
  title: string;
  mode: AtlasMode;
  input: TaskInput;
  output: EngineOutput;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  taskIds: string[];
  languageConfig: ProjectLanguageConfig;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSettings {
  workspaceName: string;
  themePreset: ThemePreset;
  launchScreen: LaunchScreen;
  preferredLanguages: LanguageId[];
  inactiveLanguages: LanguageId[];
  languagePriority: LanguageId[];
  technicalProfile: WorkspaceTechnicalProfile;
}

export type MemoryLayerId = 'user' | 'project' | 'operational' | 'evolutionary';

export interface MemoryEntry {
  id: string;
  layer: MemoryLayerId;
  title: string;
  summary: string;
  relatedProjectId?: string;
  createdAt: string;
}

export type ArtifactKind = 'research-note' | 'research-source' | 'research-synthesis';

export interface ArtifactSource {
  title: string;
  url: string;
  provider: string;
  provenance: string;
  excerpt?: string;
}

export interface ArtifactRecord {
  id: string;
  kind: ArtifactKind;
  projectId?: string;
  title: string;
  summary: string;
  content: string;
  query?: string;
  workspace: 'research-viva';
  sources: ArtifactSource[];
  createdAt: string;
  updatedAt: string;
}

export type EventLogLevel = 'info' | 'warning' | 'error';
export type EventLogScope = 'system' | 'research' | 'memory' | 'project' | 'online';

export interface EventLogEntry {
  id: string;
  scope: EventLogScope;
  level: EventLogLevel;
  message: string;
  detail?: string;
  relatedProjectId?: string;
  createdAt: string;
}

export interface AppData {
  settings: WorkspaceSettings;
  projects: Project[];
  tasks: TaskRecord[];
  memory: MemoryEntry[];
  artifacts: ArtifactRecord[];
  eventLog: EventLogEntry[];
  currentProjectId: string;
}

export interface ProtocolCard {
  id: string;
  title: string;
  description: string;
  bullets: string[];
}

export type BootstrapStatusKind =
  | 'loaded'
  | 'created-default'
  | 'recovered-corrupted'
  | 'normalized'
  | 'io-error'
  | 'web-fallback'
  | 'web-storage-error'
  | 'initialize-error';

export type StatusSeverity = 'info' | 'success' | 'warning' | 'error';

export interface BootstrapStatus {
  kind: BootstrapStatusKind;
  severity: StatusSeverity;
  title: string;
  message: string;
  backupPath?: string;
  details?: string;
}

export interface BootstrapPayload {
  data: AppData;
  status: BootstrapStatus;
}

export interface AppRepository {
  loadData: () => Promise<BootstrapPayload>;
  saveData: (data: AppData) => Promise<AppData>;
  openDataFolder: () => Promise<void>;
  getBackendStatus?: () => Promise<{ status: 'ok' | 'degraded'; message?: string | null }>;
  onBackendStatus?: (callback: (payload: { status: 'ok' | 'degraded'; message?: string | null }) => void) => () => void;
}

export interface DesktopBridge {
  loadData: () => Promise<BootstrapPayload>;
  saveData: (data: AppData) => Promise<AppData>;
  openDataFolder: () => Promise<void>;
  getBackendStatus?: () => Promise<{ status: 'ok' | 'degraded'; message?: string | null }>;
  onBackendStatus?: (callback: (payload: { status: 'ok' | 'degraded'; message?: string | null }) => void) => () => void;
}

export type AtlasSurface =
  | 'dashboard'
  | 'atlas-chat'
  | 'web-browse'
  | 'web-research'
  | 'projects'
  | 'memory'
  | 'protocols'
  | 'settings'
  | 'development'
  | 'audio'
  | 'media';

export type OnlineWorkspace = AtlasSurface;

export type OnlineTransportMode = 'backend-scaffold' | 'local-safe-fallback';

export interface OnlineRuntimeStatus {
  mode: OnlineTransportMode;
  label: string;
  summary: string;
  backendAvailable: boolean;
}

export interface SessionContext {
  sessionId: string;
  workspace: OnlineWorkspace;
  projectId?: string;
  authState: 'local-safe' | 'prepared-remote';
  onlineMode: OnlineTransportMode;
  startedAt: string;
}

export interface SessionBootstrapResponse {
  session: SessionContext;
  status: 'ready';
  message: string;
  runtime: OnlineRuntimeStatus;
}

export interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  timestamp: string;
  runtime: OnlineRuntimeStatus;
}

export interface ConnectorDescriptor {
  id: string;
  label: string;
  summary: string;
  kind: 'search' | 'memory' | 'connector' | 'agent';
  status: 'mock' | 'prepared' | 'planned';
}

export interface SearchQueryInput {
  query: string;
  projectId?: string;
  origin?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  provider: string;
  snippet: string;
  provenance: string;
  originLabel: string;
}

export interface SearchQueryResponse {
  query: string;
  origin: string;
  status: 'scaffold' | 'fallback';
  summary: string;
  results: SearchResult[];
  runtime: OnlineRuntimeStatus;
}

export interface BackendGateway {
  health: () => Promise<HealthResponse>;
  bootstrapSession: (workspace?: OnlineWorkspace) => Promise<SessionBootstrapResponse>;
  listConnectors: () => Promise<ConnectorDescriptor[]>;
  querySearch: (input: SearchQueryInput) => Promise<SearchQueryResponse>;
}

export interface SearchService {
  query: (input: SearchQueryInput) => Promise<SearchQueryResponse>;
}

export interface MemoryServiceContract {
  saveResearchCapture: (payload: {
    projectId: string;
    query: string;
    synthesis: string;
    selectedResults: SearchResult[];
  }) => Promise<ArtifactRecord>;
}

export interface ArtifactStorage {
  saveArtifact: (artifact: ArtifactRecord) => Promise<ArtifactRecord>;
}

export interface EventLog {
  addEvent: (entry: Omit<EventLogEntry, 'id' | 'createdAt'>) => Promise<void>;
}

export interface AuthBoundary {
  mode: 'local-safe' | 'prepared-remote';
}

export interface AgentOrchestratorContract {
  status: 'prepared';
  scope: 'research' | 'memory' | 'workflow';
  summary: string;
}


export type ChatRole = 'user' | 'assistant';

export interface ChatConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  model: string;
  lastMessagePreview?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  createdAt: string;
  model?: string;
  status?: 'complete' | 'streaming' | 'error';
}

export interface ChatHealthStatus {
  status: 'ok';
  service: 'atlas-chat-backend';
  version: string;
  provider: string;
  model: string;
  configured: boolean;
  streaming: boolean;
  runtime: 'local-backend' | 'backend-unavailable';
  timestamp: string;
}

export interface ChatStreamRequest {
  conversationId?: string;
  content: string;
}

export type ChatStreamEvent =
  | { type: 'conversation'; conversation: ChatConversationSummary }
  | { type: 'user-message'; message: ChatMessage }
  | { type: 'assistant-start'; message: ChatMessage }
  | { type: 'delta'; messageId: string; conversationId: string; delta: string }
  | { type: 'done'; conversation: ChatConversationSummary; message: ChatMessage }
  | { type: 'error'; message: string; code?: string };

export interface ChatGateway {
  health: () => Promise<ChatHealthStatus>;
  listConversations: () => Promise<ChatConversationSummary[]>;
  createConversation: () => Promise<ChatConversationSummary>;
  getMessages: (conversationId: string) => Promise<ChatMessage[]>;
  renameConversation: (conversationId: string, title: string) => Promise<ChatConversationSummary>;
  streamReply: (
    input: ChatStreamRequest,
    handlers: {
      onEvent: (event: ChatStreamEvent) => void;
    },
  ) => Promise<void>;
}
