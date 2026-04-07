import { MessageSquarePlus, Settings2 } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { atlasVersion } from '../../../shared/constants';
import { useChatStore } from '../../../store/chatStore';
import { cn } from '../utils';

export function ConversationSidebar() {
  const navigate = useNavigate();
  const params = useParams();
  const conversations = useChatStore((state) => state.conversations);
  const createConversation = useChatStore((state) => state.createConversation);

  const selectedId = params.conversationId;
  const sorted = useMemo(() => [...conversations].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [conversations]);

  const handleCreate = async () => {
    const id = await createConversation();
    if (id) navigate(`/chat/${id}`);
  };

  return (
    <aside className="flex h-screen w-[320px] shrink-0 flex-col border-r border-atlas-line/70 bg-white/72 px-4 py-5 backdrop-blur-sm">
      <div className="px-2 pb-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-steel">Atlas</p>
        <h1 className="mt-3 font-serif text-[2rem] tracking-tight text-atlas-ink">Atlas Corp</h1>
        <p className="mt-2 text-sm leading-7 text-atlas-body/78">
          Conversa real, contexto persistente e backend protegido.
        </p>
        <button
          onClick={() => void handleCreate()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-atlas-soft bg-atlas-mist px-4 py-3 text-sm font-medium text-atlas-ink"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Nova conversa
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-1">
        <div className="space-y-2">
          {sorted.map((conversation) => {
            const active = selectedId === conversation.id;
            return (
              <button
                key={conversation.id}
                onClick={() => navigate(`/chat/${conversation.id}`)}
                className={cn(
                  'w-full rounded-[22px] border px-4 py-3 text-left transition',
                  active
                    ? 'border-atlas-soft bg-atlas-mist shadow-card'
                    : 'border-transparent bg-white/60 hover:border-atlas-line hover:bg-white',
                )}
              >
                <p className="truncate text-sm font-medium text-atlas-ink">{conversation.title}</p>
                <p className="mt-1 truncate text-xs text-atlas-body/55">
                  {conversation.lastMessagePreview || 'Sem mensagens ainda'}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 rounded-[24px] border border-atlas-line bg-atlas-mist/55 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-atlas-body/65">núcleo conversacional</p>
            <p className="mt-2 text-sm leading-6 text-atlas-ink">Menos casca. Mais utilidade.</p>
          </div>
          <button
            onClick={() => navigate('/settings')}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-atlas-line bg-white text-atlas-body/70"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-4 text-[11px] uppercase tracking-[0.18em] text-atlas-body/46">v{atlasVersion}</p>
      </div>
    </aside>
  );
}