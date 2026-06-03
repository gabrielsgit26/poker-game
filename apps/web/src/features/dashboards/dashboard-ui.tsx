"use client";

/** Two-letter avatar fallback from display name or user id. */
export function dashboardInitials(displayName: string | null, userId: string): string {
  const n = (displayName ?? "").trim();
  if (n.length >= 2) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parts[0]![0];
      const b = parts[1]![0];
      if (a && b) return (a + b).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const id = userId.replace(/^tg_/i, "");
  if (id.length >= 2) return id.slice(-2).toUpperCase();
  return id.toUpperCase() || "?";
}

/** Segmented control tab — sits inside {@link DashboardTabList}. */
export function DashboardTabButton({
  active,
  children,
  onClick,
  badge,
  id,
  "aria-controls": ariaControls,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  badge?: number;
  id?: string;
  "aria-controls"?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={ariaControls}
      onClick={onClick}
      className={`relative flex min-h-[38px] min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold tracking-wide transition sm:min-h-[40px] sm:flex-none sm:px-4 sm:text-xs ${
        active
          ? "bg-zinc-800/95 text-zinc-50 shadow-sm ring-1 ring-white/[0.08]"
          : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300"
      } `}
    >
      <span className="truncate">{children}</span>
      {badge != null && badge > 0 ? (
        <span
          className={`inline-flex min-w-[1.125rem] shrink-0 items-center justify-center rounded-md px-1 py-px text-[9px] font-bold tabular-nums ${
            active ? "bg-zinc-700/90 text-zinc-200" : "bg-zinc-800/80 text-zinc-400"
          }`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </button>
  );
}

export function DashboardTabList({
  children,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  "aria-label": string;
}) {
  return (
    <nav
      role="tablist"
      aria-label={ariaLabel}
      className="flex flex-wrap gap-1 rounded-xl border border-white/[0.07] bg-zinc-950/60 p-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
    >
      {children}
    </nav>
  );
}

export function DashboardPanel({
  id,
  role,
  "aria-labelledby": ariaLabelledby,
  children,
  className = "",
}: {
  id?: string;
  role?: "tabpanel";
  "aria-labelledby"?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      id={id}
      role={role}
      aria-labelledby={ariaLabelledby}
      className={`rounded-2xl border border-white/[0.07] bg-zinc-950/50 p-5 shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export type StatMetric = {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "default" | "amber" | "rose" | "emerald";
};

const toneLeft: Record<NonNullable<StatMetric["tone"]>, string> = {
  default: "border-l-zinc-500/50",
  amber: "border-l-amber-500/55",
  rose: "border-l-rose-500/50",
  emerald: "border-l-emerald-500/50",
};

function formatStatValue(value: number | string): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
  return String(value);
}

export function StatMetricGrid({ metrics }: { metrics: StatMetric[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {metrics.map((m) => (
        <li
          key={m.label}
          className={`rounded-xl border border-white/[0.06] border-l-[3px] bg-gradient-to-b from-zinc-900/70 to-zinc-950/90 px-4 py-4 text-left shadow-sm shadow-black/20 sm:px-4 sm:py-4 ${toneLeft[m.tone ?? "default"]}`}
        >
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-zinc-50 sm:text-[1.75rem]">
            {formatStatValue(m.value)}
          </p>
          <p className="mt-1.5 text-[11px] font-medium leading-snug text-zinc-400">{m.label}</p>
          {m.hint ? (
            <p className="mt-2 border-t border-white/[0.05] pt-2 text-[10px] leading-relaxed text-zinc-600">{m.hint}</p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function DashboardListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="space-y-2.5" aria-busy aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          className="h-14 animate-pulse rounded-xl border border-white/[0.04] bg-zinc-900/40 sm:h-[3.75rem]"
        />
      ))}
    </ul>
  );
}

export function DashboardEmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.1] bg-zinc-900/20 px-5 py-12 text-center sm:px-8 sm:py-14">
      <p className="text-[15px] font-semibold tracking-tight text-zinc-100">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-zinc-500">{description}</p>
      {children ? <div className="mt-6 flex flex-wrap justify-center gap-2">{children}</div> : null}
    </div>
  );
}

export function DashboardQueryError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-rose-500/20 bg-rose-950/[0.18] px-4 py-4 sm:px-5">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-500/15 text-sm font-bold text-rose-200"
        aria-hidden
      >
        !
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-rose-100">Something went wrong</p>
        <p className="mt-1 text-xs leading-relaxed text-rose-200/75">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-50 transition hover:bg-rose-500/20"
          >
            Try again
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Section heading inside a {@link DashboardPanel} (title, optional body, optional right slot). */
export function DashboardSectionHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-white/[0.06] pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-[13px] font-semibold tracking-tight text-zinc-100">{title}</h2>
        {description ? (
          <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-zinc-500">{description}</p>
        ) : null}
      </div>
      {aside ? <div className="shrink-0 text-[12px] text-zinc-500">{aside}</div> : null}
    </div>
  );
}

/** Page chrome: subtle ambient background, constrained width, executive header. */
export function DashboardPageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-[min(100vh,56rem)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-8%,rgba(245,158,11,0.07),transparent_55%),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(63,63,70,0.35),transparent_50%)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl px-4 pb-16 pt-7 sm:px-6 sm:pt-9">
        <header className="mb-7 sm:mb-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-500/90">{eyebrow}</p>
          <div className="mt-2.5 h-px w-10 bg-gradient-to-r from-amber-500/80 to-transparent" aria-hidden />
          <h1 className="mt-4 text-[1.65rem] font-semibold leading-tight tracking-tight text-zinc-50 sm:text-3xl">
            {title}
          </h1>
          <div className="mt-3 max-w-2xl text-[13px] leading-relaxed text-zinc-500 sm:text-sm">{description}</div>
        </header>
        <div className="flex flex-col gap-5 sm:gap-6">{children}</div>
      </div>
    </div>
  );
}

/** Consistent bottom navigation row for dashboards. */
export function DashboardFooterNav({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-5 sm:gap-3">{children}</div>
  );
}

export function dashboardFooterLinkClass(emphasis: "primary" | "ghost" | "text"): string {
  if (emphasis === "primary") {
    return "inline-flex items-center justify-center rounded-xl border border-white/[0.1] bg-zinc-900/60 px-4 py-2.5 text-[13px] font-medium text-zinc-100 shadow-sm transition hover:border-amber-500/30 hover:bg-zinc-900";
  }
  if (emphasis === "ghost") {
    return "inline-flex items-center justify-center rounded-xl border border-transparent px-4 py-2.5 text-[13px] font-medium text-zinc-400 transition hover:border-white/[0.08] hover:bg-white/[0.03] hover:text-zinc-200";
  }
  return "inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-[13px] font-medium text-amber-400/95 underline-offset-4 transition hover:text-amber-300 hover:underline";
}
