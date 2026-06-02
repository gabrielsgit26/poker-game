import Link from "next/link";
import { formatChips } from "@/lib/format-chips";
import type { TableCardModel } from "@/lib/lobby/types";

function statusStyles(s: TableCardModel["playStatus"]) {
  switch (s) {
    case "WAITING":
      return "border-sky-500/35 bg-sky-950/40 text-sky-200";
    case "PLAYING":
      return "border-emerald-500/35 bg-emerald-950/40 text-emerald-200";
    case "FULL":
      return "border-rose-500/35 bg-rose-950/40 text-rose-200";
    default:
      return "border-white/10 bg-zinc-800 text-zinc-300";
  }
}

function statusLabel(s: TableCardModel["playStatus"]) {
  switch (s) {
    case "WAITING":
      return "Waiting";
    case "PLAYING":
      return "Playing";
    case "FULL":
      return "Full";
    default:
      return s;
  }
}

export function TableCard({ table }: { table: TableCardModel }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-zinc-900/45 p-4 shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            {table.clubName}
          </p>
          <h3 className="truncate text-base font-semibold text-zinc-50">
            {table.name}
          </h3>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusStyles(table.playStatus)}`}
        >
          {statusLabel(table.playStatus)}
        </span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-400">
        <div>
          <dt className="text-zinc-600">Stakes</dt>
          <dd className="font-mono text-zinc-200">
            {table.smallBlind} / {table.bigBlind}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600">Players</dt>
          <dd className="tabular-nums text-zinc-200">
            {table.players} / {table.maxPlayers}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-600">Timer</dt>
          <dd className="tabular-nums text-zinc-200">{table.timerSeconds}s</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Min buy-in</dt>
          <dd className="tabular-nums text-zinc-200">
            {formatChips(table.minBuyIn)}
          </dd>
        </div>
      </dl>
      <div className="mt-4 flex justify-end">
        <Link
          href="/play"
          className="rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500"
        >
          Join
        </Link>
      </div>
    </article>
  );
}
