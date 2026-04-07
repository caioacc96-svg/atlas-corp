export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export type ChatTaskType =
  | 'chat_simple'
  | 'chat_with_rag'
  | 'long_generation'
  | 'code_generation'
  | 'retrieval_only'
  | 'embedding_only'
  | 'fallback_recovery';

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  taskType?: ChatTaskType;
  useRag?: boolean;
}

export interface ChatResponse {
  content: string;
  model: string;
  provider: string;
  promptTokens?: number;
  completionTokens?: number;
  latencyMs: number;
}

export interface StreamChunk {
  content: string;
  done?: boolean;
  model?: string;
  provider?: string;
}

export interface EmbedRequest {
  texts: string[];
  model?: string;
}

export interface EmbedResponse {
  embeddings: number[][];
  model: string;
  provider: string;
}

export interface Provider {
  readonly id: string;
  readonly displayName: string;
  readonly supportsChat: boolean;
  readonly supportsEmbed: boolean;
  readonly supportsStreaming: boolean;

  probe(): Promise<boolean>;
  chat(req: ChatRequest): Promise<ChatResponse>;
  stream(req: ChatRequest): AsyncGenerator<StreamChunk>;
  embed(req: EmbedRequest): Promise<EmbedResponse>;
}
