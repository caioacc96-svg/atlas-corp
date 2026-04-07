import { AtlasMode, AtlasState, ThemePreset, WorkspaceTechnicalProfile } from './types';

export const atlasModes: { id: AtlasMode; label: string; summary: string }[] = [
  { id: 'estrategia', label: 'Estratégia', summary: 'Direção estratégica, priorização e próximos passos reais.' },
  { id: 'producao', label: 'Produção', summary: 'Peças editoriais, estrutura de conteúdo e mensagens operáveis.' },
  { id: 'design', label: 'Design Gráfico', summary: 'Direção visual, respiro, identidade e clareza.' },
  { id: 'imagem-html', label: 'Imagem HTML', summary: 'Peças programáticas, vetores e render editorial controlado.' },
  { id: 'revisao-etica', label: 'Revisão Ética', summary: 'Auditoria de tom, credibilidade e risco de imagem.' },
  { id: 'prompt', label: 'Prompt', summary: 'Prompts de produção, integração e transferência entre agentes.' },
  { id: 'sistema', label: 'Sistema', summary: 'Arquitetura, protocolos, memória e evolução do Atlas.' },
];

export const atlasStates: AtlasState[] = [
  'Ingestão',
  'Mapeamento',
  'Construção Paralela',
  'Auditoria Ativa',
  'Correção Estrutural',
  'Fechamento',
  'Retroalimentação',
];

export const themePresets: { id: ThemePreset; label: string; summary: string }[] = [
  { id: 'azul-clinico', label: 'azul-clínico', summary: 'Silêncio editorial, respiro e atmosfera clínica premium.' },
  { id: 'neutro-claro', label: 'neutro-claro', summary: 'Base mais sóbria e quase branca, com contraste delicado.' },
  { id: 'atlas-profundo', label: 'atlas-profundo', summary: 'Variação mais densa e estruturada, sem perder sobriedade.' },
];

export const technicalProfiles: { id: WorkspaceTechnicalProfile; label: string }[] = [
  { id: 'editorial-medico', label: 'editorial-médico' },
  { id: 'frontend', label: 'frontend' },
  { id: 'automacao', label: 'automação' },
  { id: 'dados', label: 'dados' },
  { id: 'fullstack', label: 'fullstack' },
  { id: 'pesquisa', label: 'pesquisa' },
];

export const sovereignRule = 'Beleza sem margem de segurança não é solução final.';
export const atlasVersion = '2.1.0';
