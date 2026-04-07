import { AlertCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChatComposer } from '../components/chat/ChatComposer';
import { MessageList } from '../components/chat/MessageList';
import { useChatStore } from '../../store/chatStore';
import { desktopBridge } from '../lib/desktopApi';

export function ChatPage() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const initialize = useChatStore((state) => state.initialize);
  const selectConversation = useChatStore((state) => state.selectConversation);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const conversations = useChatStore((state) => state.conversations);
  const messagesByConversation = useChatStore((state) => state.messagesByConversation);
  const activeConversationId = useChatStore((state) => state.activeConversationId);
  const health = useChatStore((state) => state.health);
  const hydrated = useChatStore((state) => state.hydrated);
  const streaming = useChatStore((state) => state.streaming);
  const error = useChatStore((state) => state.error);
  const clearError = useChatStore((state) => state.clearError);
  const [backendStatus, setBackendStatus] = useState<{ status: 'ok' | 'degraded'; message?: string | null } | null>(null);

  useEffect(() => {
    void initialize(conversationId);
  }, [initialize, conversationId]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void desktopBridge.getBackendStatus?.().then((status) => setBackendStatus(status)).catch(() => undefined);
    unsubscribe = desktopBridge.onBackendStatus?.((status) => setBackendStatus(status));
    return () => unsubscribe?.();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (conversationId) {
      void selectConversation(conversationId);
      return;
    }
    if (activeConversationId) {
      navigate(`/chat/${activeConversationId}`, { replace: true });
    }
  }, [conversationId, hydrated, activeConversationId, navigate, selectConversation]);

  const currentMessages = activeConversationId ? messagesByConversation[activeConversationId] || [] : [];
  const conversation = conversations.find((item) => item.id === activeConversationId);

  return (
    <div className="flex min-h-screen bg-atlas-gradient text-atlas-body">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-atlas-line/70 bg-white/72 px-6 py-4 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-atlas-steel">Atlas</p>
              <h1 className="mt-1 font-serif text-[1.55rem] tracking-tight text-atlas-ink">
                {conversation?.title || 'Nova conversa'}
              </h1>
            </div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-body/50">
              {health?.configured ? `${health.model || 'qwen/qwen3.6-plus:free'} · backend ativo` : 'backend local'}
            </div>
          </div>

          {backendStatus?.status === 'degraded' ? (
            <div className="mx-auto mt-3 flex max-w-5xl items-start gap-3 rounded-[22px] border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Backend embutido em modo degradado</p>
                <p className="mt-1 leading-6">
                  {backendStatus.message || 'A interface abriu, mas a camada local do backend falhou no boot.'}
                </p>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mx-auto mt-3 flex max-w-5xl items-start gap-3 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Erro controlado no núcleo conversacional</p>
                <p className="mt-1 leading-6">{error}</p>
              </div>
              <button
                onClick={clearError}
                className="rounded-full border border-amber-300 px-3 py-1 text-xs font-medium text-amber-900"
              >
                Fechar
              </button>
            </div>
          ) : null}
        </header>

        <MessageList messages={currentMessages} streaming={streaming} />

        <ChatComposer
          disabled={backendStatus?.status === 'degraded'}
          streaming={streaming}
          onSend={async (content) => {
            await sendMessage(content);
          }}
        />
      </div>
    </div>
  );
}