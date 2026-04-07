import { create } from 'zustand';
import { chatGateway } from '../features/chat/chatGateway';
import { ChatConversationSummary, ChatHealthStatus, ChatMessage, ChatStreamEvent } from '../shared/types';

type ChatStoreState = {
  conversations: ChatConversationSummary[];
  messagesByConversation: Record<string, ChatMessage[]>;
  activeConversationId?: string;
  health: ChatHealthStatus | null;
  hydrated: boolean;
  loading: boolean;
  streaming: boolean;
  error: string | null;
  initialize: (preferredConversationId?: string) => Promise<void>;
  createConversation: () => Promise<string | undefined>;
  selectConversation: (conversationId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  renameConversation: (conversationId: string, title: string) => Promise<void>;
  clearError: () => void;
};

function upsertConversation(list: ChatConversationSummary[], conversation: ChatConversationSummary) {
  const filtered = list.filter((item) => item.id !== conversation.id);
  return [conversation, ...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function appendMessage(messages: ChatMessage[], message: ChatMessage) {
  const filtered = messages.filter((item) => item.id !== message.id);
  return [...filtered, message].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  conversations: [],
  messagesByConversation: {},
  activeConversationId: undefined,
  health: null,
  hydrated: false,
  loading: false,
  streaming: false,
  error: null,

  initialize: async (preferredConversationId) => {
    set({ loading: true, error: null });
    try {
      const [health, conversations] = await Promise.all([chatGateway.health(), chatGateway.listConversations()]);
      const activeConversationId = preferredConversationId || conversations[0]?.id;
      set({ conversations, health, activeConversationId, hydrated: true, loading: false });
      if (activeConversationId) {
        const messages = await chatGateway.getMessages(activeConversationId);
        set((state) => ({
          messagesByConversation: { ...state.messagesByConversation, [activeConversationId]: messages },
        }));
      }
    } catch (error) {
      set({
        hydrated: true,
        loading: false,
        error: error instanceof Error ? error.message : 'Falha ao inicializar o chat do Atlas.',
      });
    }
  },

  createConversation: async () => {
    try {
      const conversation = await chatGateway.createConversation();
      set((state) => ({
        conversations: upsertConversation(state.conversations, conversation),
        activeConversationId: conversation.id,
        messagesByConversation: { ...state.messagesByConversation, [conversation.id]: [] },
      }));
      return conversation.id;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Falha ao criar conversa.' });
      return undefined;
    }
  },

  selectConversation: async (conversationId) => {
    set({ activeConversationId: conversationId, error: null });
    if (get().messagesByConversation[conversationId]) return;
    try {
      const messages = await chatGateway.getMessages(conversationId);
      set((state) => ({
        messagesByConversation: { ...state.messagesByConversation, [conversationId]: messages },
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Falha ao carregar conversa.' });
    }
  },

  sendMessage: async (content) => {
    const trimmed = content.trim();
    if (!trimmed || get().streaming) return;

    let conversationId = get().activeConversationId;
    if (!conversationId) {
      conversationId = await get().createConversation();
    }
    if (!conversationId) return;

    set({ streaming: true, error: null });

    const timeout = setTimeout(() => {
      if (get().streaming) {
        set({
          streaming: false,
          error: 'Tempo de resposta excedido. O backend pode estar indisponível.',
        });
      }
    }, 60_000);

    const cleanup = () => {
      clearTimeout(timeout);
      if (get().streaming) {
        set({ streaming: false });
      }
    };

    try {
      await chatGateway.streamReply({ conversationId, content: trimmed }, {
        onEvent: (event: ChatStreamEvent) => {
          if (event.type === 'conversation') {
            set((state) => ({
              conversations: upsertConversation(state.conversations, event.conversation),
              activeConversationId: event.conversation.id,
            }));
          }

          if (event.type === 'user-message') {
            set((state) => ({
              messagesByConversation: {
                ...state.messagesByConversation,
                [event.message.conversationId]: appendMessage(state.messagesByConversation[event.message.conversationId] || [], event.message),
              },
            }));
          }

          if (event.type === 'assistant-start') {
            set((state) => ({
              messagesByConversation: {
                ...state.messagesByConversation,
                [event.message.conversationId]: appendMessage(state.messagesByConversation[event.message.conversationId] || [], event.message),
              },
            }));
          }

          if (event.type === 'delta') {
            set((state) => {
              const list = state.messagesByConversation[event.conversationId] || [];
              return {
                messagesByConversation: {
                  ...state.messagesByConversation,
                  [event.conversationId]: list.map((item) =>
                    item.id === event.messageId
                      ? { ...item, content: `${item.content}${event.delta}`, status: 'streaming' }
                      : item,
                  ),
                },
              };
            });
          }

          if (event.type === 'done') {
            cleanup();
            set((state) => ({
              conversations: upsertConversation(state.conversations, event.conversation),
              messagesByConversation: {
                ...state.messagesByConversation,
                [event.message.conversationId]: appendMessage(
                  (state.messagesByConversation[event.message.conversationId] || []).map((item) =>
                    item.id === event.message.id ? { ...item, status: 'complete' } : item,
                  ),
                  event.message,
                ),
              },
            }));
          }

          if (event.type === 'error') {
            cleanup();
            set((state) => ({
              error: event.message,
              messagesByConversation: conversationId
                ? {
                    ...state.messagesByConversation,
                    [conversationId]: (state.messagesByConversation[conversationId] || []).map((item) =>
                      item.status === 'streaming' && item.role === 'assistant'
                        ? { ...item, status: 'error' }
                        : item,
                    ),
                  }
                : state.messagesByConversation,
            }));
          }
        },
      });
    } catch (error) {
      cleanup();
      set({ error: error instanceof Error ? error.message : 'Falha ao conversar com o Atlas.' });
    }
  },

  renameConversation: async (conversationId, title) => {
    try {
      const conversation = await chatGateway.renameConversation(conversationId, title);
      set((state) => ({ conversations: upsertConversation(state.conversations, conversation) }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Falha ao renomear conversa.' });
    }
  },

  clearError: () => set({ error: null }),
}));
