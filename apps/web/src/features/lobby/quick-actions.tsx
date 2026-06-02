import Link from "next/link";
import type { UserRole } from "@telegram-poker/shared";

const cardBase =
  "flex flex-col rounded-xl border border-white/10 bg-zinc-900/40 p-4 text-left shadow-md transition hover:border-amber-500/25 hover:bg-zinc-900/70";

export function QuickActions({ role }: { role: UserRole }) {
  const canCreateTable = role === "CLUB_MANAGER" || role === "MASTER_ADMIN";

  return (
    <section aria-labelledby="quick-actions-heading">
      <h2
        id="quick-actions-heading"
        className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500"
      >
        Quick actions
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/play" className={cardBase}>
          <span className="text-2xl" aria-hidden>
            ⚡
          </span>
          <span className="mt-2 font-semibold text-zinc-100">Quick join</span>
          <span className="mt-1 text-xs text-zinc-500">Local practice table</span>
        </Link>
        <Link href="/tables" className={cardBase}>
          <span className="text-2xl" aria-hidden>
            🎫
          </span>
          <span className="mt-2 font-semibold text-zinc-100">Join club</span>
          <span className="mt-1 text-xs text-zinc-500">Browse invites</span>
        </Link>
        <Link href="/lobby#clubs-section" className={cardBase} scroll>
          <span className="text-2xl" aria-hidden>
            🏠
          </span>
          <span className="mt-2 font-semibold text-zinc-100">My clubs</span>
          <span className="mt-1 text-xs text-zinc-500">Scroll to clubs</span>
        </Link>
        {canCreateTable ? (
          <Link href="/tables" className={cardBase}>
            <span className="text-2xl" aria-hidden>
              ➕
            </span>
            <span className="mt-2 font-semibold text-zinc-100">Create table</span>
            <span className="mt-1 text-xs text-zinc-500">Manager tools</span>
          </Link>
        ) : (
          <div
            className={`${cardBase} cursor-not-allowed opacity-50`}
            title="Club managers can create tables (Phase 5)."
          >
            <span className="text-2xl grayscale" aria-hidden>
              ➕
            </span>
            <span className="mt-2 font-semibold text-zinc-400">Create table</span>
            <span className="mt-1 text-xs text-zinc-600">Manager only</span>
          </div>
        )}
      </div>
    </section>
  );
}
