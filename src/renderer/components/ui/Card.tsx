import { ReactNode } from 'react';
import { cn } from '../utils';

interface CardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, subtitle, actions, children, className }: CardProps) {
  return (
    <section className={cn('rounded-[28px] border border-atlas-line/80 bg-white/84 shadow-card', className)}>
      {(title || subtitle || actions) && (
        <header className="flex items-start justify-between gap-4 px-5 py-4">
          <div>
            {title ? <h3 className="font-serif text-[1.25rem] text-atlas-ink">{title}</h3> : null}
            {subtitle ? <p className="mt-1 text-sm leading-6 text-atlas-body/78">{subtitle}</p> : null}
          </div>
          {actions}
        </header>
      )}
      <div className="px-5 pb-5">{children}</div>
    </section>
  );
}
