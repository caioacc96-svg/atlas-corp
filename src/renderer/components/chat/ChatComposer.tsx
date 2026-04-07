import { FormEvent, useState } from 'react';
import { ArrowUp, LoaderCircle } from 'lucide-react';
import { cn } from '../utils';

export function ChatComposer({
  disabled,
  streaming,
  onSend,
}: {
  disabled?: boolean;
  streaming: boolean;
  onSend: (content: string) => Promise<void>;
}) {
  const [value, setValue] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const content = value.trim();
    if (!content || disabled || streaming) return;
    setValue('');
    await onSend(content);
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-atlas-line/70 bg-white/82 px-5 py-4 backdrop-blur-sm">
      <div className="mx-auto flex max-w-4xl items-end gap-3 rounded-[28px] border border-atlas-line bg-white px-4 py-3 shadow-card">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={disabled || streaming}
          rows={1}
          placeholder="Converse com o Atlas…"
          className="max-h-48 min-h-[56px] flex-1 resize-none border-0 bg-transparent px-1 py-2 text-[15px] leading-7 text-atlas-ink outline-none placeholder:text-atlas-body/45"
        />
        <button
          type="submit"
          disabled={disabled || streaming || !value.trim()}
          className={cn(
            'inline-flex h-11 w-11 items-center justify-center rounded-full border transition',
            disabled || streaming || !value.trim()
              ? 'border-atlas-line bg-atlas-mist/60 text-atlas-body/40'
              : 'border-atlas-soft bg-atlas-mist text-atlas-ink hover:bg-atlas-paper',
          )}
        >
          {streaming ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </div>
      <p className="mx-auto mt-2 max-w-4xl px-2 text-[11px] uppercase tracking-[0.18em] text-atlas-body/46">
        respostas via backend · streaming real · chave protegida no servidor
      </p>
    </form>
  );
}
