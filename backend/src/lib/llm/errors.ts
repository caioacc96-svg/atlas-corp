export type ProviderPhase =
  | 'healthcheck'
  | 'stream_connect'
  | 'stream_read'
  | 'stream_stall'
  | 'non_stream'
  | 'embedding'
  | 'model_not_found';

/** Legacy Forge error — kept for backward compat */
export class AtlasProviderError extends Error {
  public readonly provider: string;
  public readonly model: string;
  public readonly phase: ProviderPhase;
  public readonly isRetryable: boolean;
  public readonly originalMessage: string;
  public readonly code: string;

  constructor(opts: {
    provider: string;
    model: string;
    phase: ProviderPhase;
    isRetryable?: boolean;
    originalMessage: string;
    code?: string;
  }) {
    super(`[${opts.provider}/${opts.model}] ${opts.phase}: ${opts.originalMessage}`);
    this.name = 'AtlasProviderError';
    this.provider = opts.provider;
    this.model = opts.model;
    this.phase = opts.phase;
    this.isRetryable = opts.isRetryable ?? true;
    this.originalMessage = opts.originalMessage;
    this.code = opts.code ?? `atlas_provider_${opts.phase}`;
  }
}

/** New patch-style error */
export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly statusCode?: number,
    public readonly retryable = false,
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'ProviderError';
  }
}

export class AllProvidersFailedError extends Error {
  constructor(public readonly details: Record<string, string>) {
    const summary = Object.entries(details)
      .map(([p, e]) => `  ${p}: ${e}`)
      .join('\n');
    super(`All providers failed:\n${summary}`);
    this.name = 'AllProvidersFailedError';
  }
}

export function isAtlasProviderError(err: unknown): err is AtlasProviderError {
  return err instanceof AtlasProviderError;
}

export function isProviderError(err: unknown): err is ProviderError {
  return err instanceof ProviderError;
}

export function isRetryableError(err: unknown): boolean {
  if (err instanceof AtlasProviderError) return err.isRetryable;
  if (err instanceof ProviderError) return err.retryable;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('econnreset') || msg.includes('timeout') || msg.includes('stall')) {
      return true;
    }
    if (msg.includes('api key') || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('invalid api key')) {
      return false;
    }
  }
  return true;
}
