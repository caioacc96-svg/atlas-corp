interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-atlas-line bg-atlas-mist/70 px-4 py-4 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-atlas-body/70">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-atlas-ink">{value}</p>
      {hint ? <p className="mt-2 text-sm text-atlas-body/75">{hint}</p> : null}
    </div>
  );
}
