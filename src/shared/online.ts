import {
  AgentOrchestratorContract,
  ConnectorDescriptor,
  OnlineWorkspace,
  SessionBootstrapResponse,
} from './types';

export const ATLAS_BACKEND_ORIGIN = 'http://127.0.0.1:4467';

export function createRuntimeStatus(mode: 'backend-scaffold' | 'local-safe-fallback') {
  if (mode === 'backend-scaffold') {
    return {
      mode,
      label: 'backend scaffold ativo',
      summary: 'Camada online servida pelo backend scaffold local, ainda supervisionada e não equivalente a backend de produção.',
      backendAvailable: true,
    } as const;
  }

  return {
    mode,
    label: 'modo local-safe',
    summary: 'Camada online em fallback local seguro. A interface permanece utilizável, mas sem backend local ativo nesta sessão.',
    backendAvailable: false,
  } as const;
}

export const preparedConnectors: ConnectorDescriptor[] = [
  {
    id: 'research-supervised',
    label: 'Pesquisa supervisionada',
    summary: 'Primeiro pulmão online do Atlas para pesquisa, leitura e síntese com proveniência visível.',
    kind: 'search',
    status: 'mock',
  },
  {
    id: 'memory-service',
    label: 'MemoryService',
    summary: 'Borda preparada para memória remota, ainda convivendo com a memória viva local.',
    kind: 'memory',
    status: 'prepared',
  },
  {
    id: 'connector-registry',
    label: 'ConnectorRegistry',
    summary: 'Registro preparado para fontes externas supervisionadas e crescimento federado.',
    kind: 'connector',
    status: 'prepared',
  },
  {
    id: 'agent-orchestrator',
    label: 'AgentOrchestrator',
    summary: 'Contrato base para futura orquestração agentic, sem IA plena nesta fase.',
    kind: 'agent',
    status: 'planned',
  },
];

export const preparedAgentOrchestrator: AgentOrchestratorContract = {
  status: 'prepared',
  scope: 'workflow',
  summary: 'Base preparada para orquestração futura de agentes sem abrir IA decorativa nesta rodada.',
};

export function createPreparedSessionBootstrap(
  workspace: OnlineWorkspace = 'web-research',
  mode: 'backend-scaffold' | 'local-safe-fallback' = 'local-safe-fallback',
): SessionBootstrapResponse {
  return {
    status: 'ready',
    message: mode === 'backend-scaffold'
      ? 'Sessão bootstrapada pelo backend scaffold local da fase online.'
      : 'Sessão local preparada em modo local-safe, sem backend local ativo nesta execução.',
    session: {
      sessionId: `session-${Date.now()}`,
      workspace,
      authState: 'local-safe',
      onlineMode: mode,
      startedAt: new Date().toISOString(),
    },
    runtime: createRuntimeStatus(mode),
  };
}
