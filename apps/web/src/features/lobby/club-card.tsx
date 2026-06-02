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
    case "OPEN":
      return "border-sky-500/35 bg-sky-950/40 text-sky-200";
    default:
      return "border-white/10 bg-zinc-800 text-zinc-300";
  }
}

function membershipLabel(m: ClubCardModel["membership"]) {
  switch (m) {
    case "JOINED":
      return "Joined";
    case "PENDING":
      return "Pending";
    case "PRIVATE":
      return "Private";
    case "OPEN":
      return "Open";
    default:
      return "";
  }
}

export function ClubCard({
  club,
  onJoin,
  joinBusy,
}: {
  club: ClubCardModel;
  onJoin?: (clubId: string) => void;
  joinBusy?: boolean;
}) {
  const href = `/clubs/${club.id}`;

  const cta =
    club.membership === "JOINED" ? (
      <Link
        href={href}
        className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-center text-xs font-semibold text-zinc-950 transition hover:bg-amber-400"
      >
        Open
      </Link>
    ) : club.membership === "PENDING" ? (
      <span className="rounded-lg border border-white/10 bg-zinc-800/60 px-3 py-1.5 text-center text-xs font-medium text-zinc-400">
        Awaiting approval
      </span>
    ) : (
      <button
        type="button"
        disabled={joinBusy || !onJoin}
        title={
          !onJoin
            ? "Set NEXT_PUBLIC_API_URL and run the API to join clubs from the app."
            : undefined
        }
        onClick={() => onJoin?.(club.id)}
        className="rounded-lg border border-amber-500/50 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-950/60 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {joinBusy ? "…" : "Request / join"}
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
          {membershipLabel(club.membership)}
        </span>
      </div>
      <div className="mt-4 flex justify-end">{cta}</div>
    </article>
  );
}
