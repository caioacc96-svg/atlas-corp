import { ReactNode } from 'react';
import { cn } from '../utils';

export function Badge({ children, active = false, className }: { children: ReactNode; active?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
        active ? 'border-atlas-soft bg-atlas-mist text-atlas-steel' : 'border-atlas-line bg-white text-atlas-body/70',
        className,
      )}
    >
      {children}
    </span>
  );
}
