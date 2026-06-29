export function StatCard({
  label,
  value,
  sublabel,
  accent = "signal",
  icon,
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: "signal" | "amber" | "coral" | "steel" | "violet";
  icon?: React.ReactNode;
}) {
  const accentBg = {
    signal: "bg-signal/10 text-signal",
    amber: "bg-amber/10 text-amber",
    coral: "bg-coral/10 text-coral",
    steel: "bg-steel/10 text-steel",
    violet: "bg-violet/10 text-violet",
  }[accent];

  return (
    <div className="surface-card px-5 py-4 relative overflow-hidden">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-steel font-medium">{label}</div>
          <div className="text-2xl font-display font-semibold text-ink dark:text-white mt-1">{value}</div>
          {sublabel && <div className="text-xs text-steel mt-1">{sublabel}</div>}
        </div>
        {icon && (
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${accentBg}`}>{icon}</div>
        )}
      </div>
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-steel">
      <span>
        Page {page} of {totalPages} &middot; {total} results
      </span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Go to previous page"
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
        >
          Previous
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Go to next page"
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="text-center py-16 border border-dashed border-slate-200 rounded-2xl bg-slate-50/40">
      <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-brand-gradient/20 flex items-center justify-center">
        <div className="h-2 w-2 rounded-full bg-signal" />
      </div>
      <div className="font-display font-semibold text-ink dark:text-white mb-1">{title}</div>
      <div className="text-sm text-steel">{message}</div>
    </div>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg skeleton-shimmer" />
      ))}
    </div>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink dark:text-white">{title}</h1>
        {subtitle && <p className="text-sm text-steel mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
