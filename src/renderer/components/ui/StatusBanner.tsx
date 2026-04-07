import { AlertCircle, CheckCircle2, Info, ShieldAlert } from 'lucide-react';
import { BootstrapStatus } from '../../../shared/types';

const toneMap = {
  info: {
    container: 'border-atlas-line bg-atlas-mist/70 text-atlas-body',
    icon: Info,
  },
  success: {
    container: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: CheckCircle2,
  },
  warning: {
    container: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: ShieldAlert,
  },
  error: {
    container: 'border-rose-200 bg-rose-50 text-rose-900',
    icon: AlertCircle,
  },
} as const;

export function StatusBanner({ status, onDismiss }: { status: BootstrapStatus; onDismiss?: () => void }) {
  const tone = toneMap[status.severity];
  const Icon = tone.icon;

  return (
    <div className={`mb-6 rounded-[26px] border px-4 py-4 shadow-card ${tone.container}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-white/70 bg-white/70 p-2">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-75">estado da base</p>
            <p className="mt-1 font-medium">{status.title}</p>
            <p className="mt-1 text-sm leading-6 opacity-90">{status.message}</p>
            {status.backupPath ? <p className="mt-1 text-xs opacity-80">Backup preservado em: {status.backupPath}</p> : null}
            {status.details ? <p className="mt-1 text-xs opacity-80">Detalhe técnico: {status.details}</p> : null}
          </div>
        </div>
        {onDismiss ? (
          <button onClick={onDismiss} className="rounded-2xl border border-current/20 bg-white/60 px-3 py-2 text-xs font-medium">
            dispensar
          </button>
        ) : null}
      </div>
    </div>
  );
}
