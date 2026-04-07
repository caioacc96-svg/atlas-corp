import { ChatConversationSummary, ChatGateway, ChatHealthStatus, ChatMessage, ChatStreamEvent, ChatStreamRequest } from '../../shared/types';

const ATLAS_BACKEND_ORIGIN = import.meta.env.VITE_ATLAS_BACKEND_ORIGIN || 'http://127.0.0.1:6677';

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Falha ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export const chatGateway: ChatGateway = {
  health: async () => parseJson<ChatHealthStatus>(await fetch(`${ATLAS_BACKEND_ORIGIN}/health`)),

  listConversations: async () => parseJson<ChatConversationSummary[]>(await fetch(`${ATLAS_BACKEND_ORIGIN}/chat/conversations`)),

  createConversation: async () =>
    parseJson<ChatConversationSummary>(
      await fetch(`${ATLAS_BACKEND_ORIGIN}/chat/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    ),

  getMessages: async (conversationId: string) =>
    parseJson<ChatMessage[]>(await fetch(`${ATLAS_BACKEND_ORIGIN}/chat/conversations/${conversationId}/messages`)),

  renameConversation: async (conversationId: string, title: string) =>
    parseJson<ChatConversationSummary>(
      await fetch(`${ATLAS_BACKEND_ORIGIN}/chat/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      }),
    ),

  streamReply: async (input: ChatStreamRequest, handlers: { onEvent: (event: ChatStreamEvent) => void }) => {
    const response = await fetch(`${ATLAS_BACKEND_ORIGIN}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok || !response.body) {
      const text = await response.text();
      throw new Error(text || 'Falha ao iniciar streaming do Atlas.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          handlers.onEvent(JSON.parse(line) as ChatStreamEvent);
        } catch (e) {
          console.error('[ChatGateway] Failed to parse SSE line:', line, e);
        }
      }
    }

    if (buffer.trim()) {
      try {
        handlers.onEvent(JSON.parse(buffer) as ChatStreamEvent);
      } catch (e) {
        console.error('[ChatGateway] Failed to parse final SSE buffer:', buffer, e);
      }
    }
  },
};
