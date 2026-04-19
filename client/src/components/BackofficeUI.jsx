import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export function BackofficeShell({ eyebrow, title, description, actions, stats, sidebar, children }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 rounded-[2rem] border border-white/50 bg-white/75 p-6 shadow-xl shadow-amber-100/40 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            {eyebrow ? <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-600 dark:text-amber-300">{eyebrow}</p> : null}
            <h1 className="mt-2 text-4xl font-black text-slate-900 dark:text-white">{title}</h1>
            {description ? <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
        </div>
      </div>

      {stats ? <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{stats}</div> : null}

      {sidebar ? (
        <div className="grid gap-8 lg:grid-cols-[280px,1fr]">
          <aside>{sidebar}</aside>
          <main>{children}</main>
        </div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, tone = 'amber', hint }) {
  const tones = {
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  };

  return (
    <div className="rounded-[1.75rem] border border-white/50 bg-white/75 p-5 shadow-lg shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</p>
          <p className="mt-3 text-3xl font-black text-slate-900 dark:text-white">{value}</p>
          {hint ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl ${tones[tone] || tones.amber}`}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Panel({ title, subtitle, actions, children }) {
  return (
    <section className="rounded-[1.75rem] border border-white/50 bg-white/75 p-5 shadow-lg shadow-amber-100/30 backdrop-blur dark:border-white/10 dark:bg-slate-900/60 dark:shadow-none">
      {(title || actions) ? (
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            {title ? <h2 className="text-2xl font-black text-slate-900 dark:text-white">{title}</h2> : null}
            {subtitle ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function FilterButton({ active, children, onClick, alert = false }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
        active
          ? alert
            ? 'bg-rose-500 text-white'
            : 'bg-slate-950 text-white dark:bg-amber-400 dark:text-slate-950'
          : 'border border-white/50 bg-white/70 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900'
      }`}
      type="button"
    >
      {children}
    </button>
  );
}

export function StatusBadge({ children, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  };

  return <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${tones[tone] || tones.slate}`}>{children}</span>;
}

export function DataTable({ columns, children, emptyMessage, colSpan }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 dark:border-white/10">
      <div className="max-h-[65vh] overflow-auto">
        <table className="w-full min-w-[760px]">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur dark:bg-slate-950/95">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white/80 dark:divide-white/10 dark:bg-transparent [&>tr]:transition [&>tr:hover]:bg-slate-50/70 dark:[&>tr:hover]:bg-white/5">
            {children || (
              <tr>
                <td colSpan={colSpan || columns.length} className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EmptyState({ title, text }) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-amber-200 bg-white/70 p-8 text-center dark:border-amber-500/20 dark:bg-white/5">
      <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="text-lg font-bold text-slate-900 dark:text-white">{title}</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{text}</p>
    </div>
  );
}

export function SuccessBadge({ children }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
      <CheckCircle2 className="h-3.5 w-3.5" />
      {children}
    </span>
  );
}
