import type { Provider } from './types';
import { getAtlasConfig } from '../../config/atlas-config';

export interface ProviderHealthReport {
  id: string;
  available: boolean;
  reason: string | null;
  models: string[];
  lastLatencyMs: number | null;
  lastError: string | null;
  recommendedUsage: string;
}

export async function checkProviderHealth(provider: Provider): Promise<ProviderHealthReport> {
  const reachable = await provider.probe();
  return {
    id: provider.id,
    available: reachable,
    reason: reachable ? null : 'Provider not reachable',
    models: [],
    lastLatencyMs: null,
    lastError: reachable ? null : 'probe failed',
    recommendedUsage: reachable ? 'Disponível' : 'Verifique conexão',
  };
}

export async function checkAllProviders(providers: Provider[]): Promise<ProviderHealthReport[]> {
  const results = await Promise.allSettled(
    providers.map((p) => checkProviderHealth(p)),
  );
  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      id: providers[i]?.id ?? 'unknown',
      available: false,
      reason: r.reason instanceof Error ? r.reason.message : String(r.reason),
      models: [],
      lastLatencyMs: null,
      lastError: r.reason instanceof Error ? r.reason.message : 'unknown',
      recommendedUsage: 'Provider indisponível.',
    };
  });
}

export function getGlobalHealthSummary(reports: ProviderHealthReport[]): {
  anyAvailable: boolean;
  degraded: boolean;
  primaryRecommended: string | null;
} {
  const available = reports.filter((r) => r.available);
  return {
    anyAvailable: available.length > 0,
    degraded: reports.length > 1 && available.length < reports.length,
    primaryRecommended: available.length > 0 ? available[0].id : null,
  };
}
