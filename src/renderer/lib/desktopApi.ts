import { defaultAppData } from '../../data/defaultAppData';
import { sanitizeAppData } from '../../shared/guards';
import { AppData, BootstrapPayload, DesktopBridge } from '../../shared/types';

const STORAGE_KEY = 'atlas-corp-desktop-fallback-v2';
const STORAGE_BACKUP_KEY = 'atlas-corp-desktop-fallback-v2-corrupted-backup';

let memoryFallbackData: AppData = defaultAppData;

function canUseLocalStorage() {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function buildStatus(payload: Omit<BootstrapPayload, 'data'>['status']): BootstrapPayload['status'] {
  return payload;
}

function getFallbackBridge(): DesktopBridge {
  return {
    async loadData() {
      if (!canUseLocalStorage()) {
        return {
          data: memoryFallbackData,
          status: buildStatus({
            kind: 'web-storage-error',
            severity: 'warning',
            title: 'Fallback em memória ativa',
            message: 'O localStorage não está disponível neste ambiente. O Atlas seguirá em memória temporária para preview seguro.',
          }),
        } satisfies BootstrapPayload;
      }

      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          const { normalized } = sanitizeAppData(defaultAppData);
          memoryFallbackData = normalized;
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          return {
            data: normalized,
            status: buildStatus({
              kind: 'web-fallback',
              severity: 'info',
              title: 'Ambiente web de fallback',
              message: 'Sem bridge desktop ativa, o Atlas está operando sobre localStorage para preview.',
            }),
          } satisfies BootstrapPayload;
        }

        const parsed = JSON.parse(raw) as unknown;
        const { normalized, wasNormalized } = sanitizeAppData(parsed);
        memoryFallbackData = normalized;

        if (wasNormalized) {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          return {
            data: normalized,
            status: buildStatus({
              kind: 'normalized',
              severity: 'warning',
              title: 'Dados de preview normalizados',
              message: 'O Atlas encontrou dados fora do domínio esperado no localStorage e aplicou normalização segura.',
            }),
          } satisfies BootstrapPayload;
        }

        return {
          data: normalized,
          status: buildStatus({
            kind: 'web-fallback',
            severity: 'info',
            title: 'Ambiente web de fallback',
            message: 'Sem bridge desktop ativa, o Atlas está operando sobre localStorage para preview.',
          }),
        } satisfies BootstrapPayload;
      } catch (error) {
        const raw = canUseLocalStorage() ? window.localStorage.getItem(STORAGE_KEY) : null;
        if (raw && canUseLocalStorage()) {
          try {
            window.localStorage.setItem(STORAGE_BACKUP_KEY, raw);
          } catch {
            // noop
          }
        }

        const { normalized } = sanitizeAppData(defaultAppData);
        memoryFallbackData = normalized;

        if (canUseLocalStorage()) {
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
          } catch {
            // noop
          }
        }

        return {
          data: normalized,
          status: buildStatus({
            kind: 'recovered-corrupted',
            severity: 'warning',
            title: 'Preview recuperado após corrupção',
            message: 'O Atlas detectou corrupção no localStorage de preview e restaurou uma base segura.',
            details: error instanceof Error ? error.message : 'Falha de leitura do localStorage.',
            backupPath: STORAGE_BACKUP_KEY,
          }),
        } satisfies BootstrapPayload;
      }
    },
    async saveData(data) {
      const { normalized } = sanitizeAppData(data);
      memoryFallbackData = normalized;

      if (!canUseLocalStorage()) {
        return normalized;
      }

      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      } catch (error) {
        console.warn('Atlas fallback storage save failed; mantendo dados em memória.', error);
      }
      return normalized;
    },
    async getBackendStatus() {
      return { status: 'degraded' as const, message: 'Bridge desktop inativa; backend embutido indisponível neste contexto.' };
    },
    onBackendStatus() {
      return () => {};
    },

    async openDataFolder() {
      if (canUseLocalStorage()) {
        window.alert('No preview web, os dados ficam no localStorage do navegador.');
        return;
      }
      window.alert('No preview web sem localStorage, os dados ficam apenas em memória temporária.');
    },
  };
}

export const desktopBridge: DesktopBridge = window.atlasDesktop ?? getFallbackBridge();
