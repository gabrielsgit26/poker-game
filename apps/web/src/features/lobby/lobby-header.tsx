import Link from "next/link";
import { formatChips } from "@/lib/format-chips";
import type { LobbyUser } from "@/lib/lobby/types";

function IconBell() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3a5 5 0 00-5 5v2.5L5 14h14l-2-3.5V8a5 5 0 00-5-5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M10 18a2 2 0 004 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82 1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LobbyHeader({ user }: { user: LobbyUser }) {
  return (
    <header className="rounded-2xl border border-white/10 bg-zinc-900/50 p-4 shadow-lg shadow-black/20 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <Link
          href="/profile"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-amber-500/40 bg-gradient-to-br from-amber-900/50 to-zinc-900 text-xl text-amber-200 transition hover:border-amber-400/60"
          aria-label="Open profile"
        >
          <span aria-hidden>{user.avatarEmoji}</span>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-zinc-400">
            Hello,{" "}
            <span className="font-medium text-zinc-100">{user.displayName}</span>
          </p>
          <Link href="/wallet" className="group block">
            <p className="mt-1 text-lg font-semibold tabular-nums text-amber-100 transition group-hover:text-amber-50">
              {formatChips(user.balanceChips)}{" "}
              <span className="text-sm font-normal text-zinc-500 group-hover:text-zinc-400">total</span>
            </p>
            {user.platformChips != null && user.clubChips != null ? (
              <p className="mt-0.5 text-[11px] tabular-nums text-zinc-500">
                Platform {formatChips(user.platformChips)} · Clubs {formatChips(user.clubChips)}
              </p>
            ) : null}
            <p className="mt-0.5 text-[10px] font-medium text-zinc-600 group-hover:text-zinc-500">
              Wallet & club balances
            </p>
          </Link>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
            aria-label="Notifications (coming soon)"
            title="Notifications (coming soon)"
          >
            <IconBell />
          </button>
          <Link
            href="/settings"
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
            aria-label="Settings"
            title="Settings"
          >
            <IconSettings />
          </Link>
        </div>
      </div>
    </header>
  );
}
