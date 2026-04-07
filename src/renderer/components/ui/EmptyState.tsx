import { ReactNode } from 'react';

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-atlas-line bg-white px-5 py-10 text-center">
      <h3 className="font-serif text-xl text-atlas-ink">{title}</h3>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-atlas-body/80">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
