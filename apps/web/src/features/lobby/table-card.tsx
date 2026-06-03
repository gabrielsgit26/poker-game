import Link from "next/link";
import { formatChips } from "@/lib/format-chips";
import type { TableCardModel } from "@/lib/lobby/types";

function statusStyles(s: TableCardModel["playStatus"]) {
  switch (s) {
    case "WAITING":
      return "bg-sky-500/15 text-sky-200 ring-1 ring-sky-500/30";
    case "PLAYING":
      return "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30";
    case "FULL":
      return "bg-rose-500/15 text-rose-200 ring-1 ring-rose-500/30";
    default:
      return "bg-zinc-700/40 text-zinc-300 ring-1 ring-white/10";
  }
}

function statusLabel(s: TableCardModel["playStatus"]) {
  switch (s) {
    case "WAITING":
      return "Waiting for players";
    case "PLAYING":
      return "Hand in progress";
    case "FULL":
      return "Table full";
    default:
      return s;
  }
}

export function TableCard({ table }: { table: TableCardModel }) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-zinc-800/50 to-zinc-950/80 shadow-lg shadow-black/25 ring-1 ring-white/[0.04] transition hover:border-amber-500/20 hover:ring-amber-500/10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(800px_circle_at_100%_0%,rgba(245,158,11,0.06),transparent_55%)]" />
      <div className="relative flex flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">{table.clubName}</p>
            <h3 className="mt-1 truncate text-lg font-semibold tracking-tight text-zinc-50 sm:text-xl">{table.name}</h3>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusStyles(table.playStatus)}`}
          >
            {statusLabel(table.playStatus)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <div className="rounded-xl border border-white/[0.06] bg-zinc-950/40 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Stakes</p>
            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-zinc-100">
              {table.smallBlind} / {table.bigBlind}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-zinc-950/40 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Seats</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-100">
              {table.players} / {table.maxPlayers}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-zinc-950/40 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Timer</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-100">{table.timerSeconds}s</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-zinc-950/40 px-3 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Min buy-in</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-amber-100/95">{formatChips(table.minBuyIn)}</p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          <p className="text-[11px] leading-snug text-zinc-500">Club table · live when you take a seat</p>
          <Link
            href={`/tables/${table.id}`}
            className="shrink-0 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-4 py-2.5 text-sm font-bold text-zinc-950 shadow-md shadow-amber-900/30 transition hover:from-amber-400 hover:to-amber-500 active:scale-[0.98]"
          >
            Open table
          </Link>
        </div>
      </div>
    </article>
  );
}
