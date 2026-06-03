import { formatChips } from "@/lib/format-chips";
import { UserAvatar } from "@/components/user-avatar";
import type { ProfileUser } from "@/lib/profile/types";

function statusBadge(status: ProfileUser["accountStatus"]) {
  if (status === "ACTIVE") {
    return "border-emerald-500/40 bg-emerald-950/50 text-emerald-200";
  }
  return "border-rose-500/40 bg-rose-950/50 text-rose-200";
}

export function ProfileHeader({ user }: { user: ProfileUser }) {
  return (
    <header className="rounded-2xl border border-white/10 bg-zinc-900/50 p-5 shadow-lg shadow-black/20">
      <div className="flex items-start gap-4">
        <UserAvatar
          photoUrl={user.telegramPhotoUrl}
          fallbackEmoji="♠"
          label={user.displayName}
          className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-900/40 to-zinc-900 text-2xl text-amber-100"
        />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-zinc-50">
            {user.displayName}
          </h1>
          <p className="mt-1 text-xs text-zinc-500">{user.maskedTelegramRef}</p>
          <div className="mt-3">
            <p className="text-lg font-semibold tabular-nums text-amber-100">
              {formatChips(user.totalChips)}{" "}
              <span className="text-sm font-normal text-zinc-500">total</span>
            </p>
            {user.platformChips != null && user.clubChips != null ? (
              <p className="mt-0.5 text-[11px] tabular-nums text-zinc-500">
                Platform {formatChips(user.platformChips)} · Clubs{" "}
                {formatChips(user.clubChips)}
              </p>
            ) : null}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusBadge(user.accountStatus)}`}
        >
          {user.accountStatus}
        </span>
      </div>
    </header>
  );
}
