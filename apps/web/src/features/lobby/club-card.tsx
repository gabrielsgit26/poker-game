import Link from "next/link";
import type { ClubCardModel } from "@/lib/lobby/types";

function membershipBadge(m: ClubCardModel["membership"]) {
  switch (m) {
    case "JOINED":
      return "border-emerald-500/40 bg-emerald-950/50 text-emerald-200";
    case "PENDING":
      return "border-amber-500/40 bg-amber-950/40 text-amber-200";
    case "PRIVATE":
      return "border-zinc-500/40 bg-zinc-800/60 text-zinc-300";
    default:
      return "border-white/10 bg-zinc-800 text-zinc-300";
  }
}

export function ClubCard({ club }: { club: ClubCardModel }) {
  const href = `/clubs/${club.id}`;
  const cta =
    club.membership === "JOINED" ? (
      <Link
        href={href}
        className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-center text-xs font-semibold text-zinc-950 transition hover:bg-amber-400"
      >
        Open
      </Link>
    ) : (
      <button
        type="button"
        className="rounded-lg border border-white/15 bg-zinc-800/80 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700"
        title="Join flow arrives in Phase 5"
      >
        Join
      </button>
    );

  return (
    <article className="flex flex-col rounded-2xl border border-white/10 bg-gradient-to-br from-zinc-900/80 to-zinc-950/90 p-4 shadow-lg shadow-black/30">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-zinc-800 text-lg"
            aria-hidden
          >
            🎰
          </div>
          <div className="min-w-0">
            <h3 className="truncate font-semibold text-zinc-50">{club.name}</h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              {club.memberCount} members · {club.activeTables} active tables
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${membershipBadge(club.membership)}`}
        >
          {club.membership === "JOINED"
            ? "Joined"
            : club.membership === "PENDING"
              ? "Pending"
              : "Private"}
        </span>
      </div>
      <div className="mt-4 flex justify-end">{cta}</div>
    </article>
  );
}
