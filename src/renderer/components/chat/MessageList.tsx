import { useEffect, useRef } from 'react';
import { Bot, User } from 'lucide-react';
import { ChatMessage } from '../../../shared/types';
import { cn } from '../utils';

export function MessageList({ messages, streaming }: { messages: ChatMessage[]; streaming: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [messages, streaming]);

  return (
    <div ref={containerRef} className="min-h-0 flex-1 overflow-auto px-6 py-6">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        {messages.length === 0 ? (
          <div className="rounded-[34px] border border-atlas-line bg-white/86 px-8 py-8 shadow-card">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-atlas-steel">Atlas</p>
            <h2 className="mt-3 font-serif text-[2rem] leading-tight text-atlas-ink">Agora existe um cérebro aqui dentro.</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-atlas-body/78">
              Abra uma conversa, escreva com clareza e deixe o Atlas responder com utilidade real, contexto persistente e backend protegido.
            </p>
          </div>
        ) : null}

        {messages.map((message) => {
          const assistant = message.role === 'assistant';
          return (
            <article key={message.id} className={cn('flex gap-4', assistant ? 'justify-start' : 'justify-end')}>
              {assistant ? (
                <div className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-atlas-soft bg-atlas-mist text-atlas-ink">
                  <Bot className="h-4 w-4" />
                </div>
              ) : null}
              <div className={cn('max-w-[78%] rounded-[28px] border px-5 py-4 shadow-card', assistant ? 'border-atlas-line bg-white text-atlas-ink' : 'border-atlas-soft bg-atlas-mist text-atlas-ink')}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-atlas-body/55">{assistant ? 'Atlas' : 'Você'}</p>
                <div className="mt-2 whitespace-pre-wrap text-[15px] leading-7">{message.content || (message.status === 'streaming' ? '▍' : '')}</div>
                {message.status === 'streaming' ? (
                  <p className="mt-2 text-[10px] uppercase tracking-[0.18em] text-atlas-body/46">streaming em andamento</p>
                ) : null}
              </div>
              {!assistant ? (
                <div className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-atlas-line bg-white text-atlas-body/72">
                  <User className="h-4 w-4" />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
