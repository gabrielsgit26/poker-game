"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClubBalances } from "@/features/profile/club-balances";
import { ProfileHeader } from "@/features/profile/profile-header";
import { ProfileSkeleton } from "@/features/profile/profile-skeleton";
import { StatsCards } from "@/features/profile/stats-cards";
import { TransactionList } from "@/features/profile/transaction-list";
import { fetchProfileSnapshot } from "@/lib/profile/api-profile";
import { hasAuthApi } from "@/lib/dev-api";
import { useAuthSession } from "@/providers/auth-context";

export function ProfileView() {
  const { ready, me, skipGate } = useAuthSession();
  const sessionOk =
    !skipGate && ready && me !== null && me.authenticated === true;

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfileSnapshot,
    enabled: sessionOk,
  });

  if (!hasAuthApi()) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-sm font-medium text-zinc-200">Profile needs the game server</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Set <code className="rounded bg-zinc-800 px-1 py-0.5">NEXT_PUBLIC_API_URL</code>{" "}
          to your API base URL, then sign in. The profile page loads live balances, club
          wallets, and activity from MongoDB—there is no offline mock.
        </p>
      </div>
    );
  }

  if (!sessionOk) {
    return null;
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-lg px-4 py-2">
        <ProfileSkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-zinc-300">Could not load profile.</p>
        <p className="mt-2 text-xs text-zinc-500">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-zinc-950"
        >
          Retry
        </button>
      </div>
    );
  }

  const showAdminLink = me.isPlatformAdmin === true;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-2 pb-4">
      <ProfileHeader user={data.user} />
      <StatsCards stats={data.stats} />
      <ClubBalances rows={data.clubBalances} />
      <TransactionList rows={data.transactions} />
      <div className="flex flex-col gap-2">
        <Link
          href="/settings"
          className="flex w-full items-center justify-center rounded-xl border border-white/15 bg-zinc-900/50 py-3 text-sm font-semibold text-zinc-100 transition hover:border-amber-500/30 hover:bg-zinc-900"
        >
          Settings & preferences
        </Link>
        <Link
          href="/manager"
          className="flex w-full items-center justify-center rounded-xl border border-white/15 bg-zinc-900/50 py-3 text-sm font-semibold text-zinc-100 transition hover:border-amber-500/30 hover:bg-zinc-900"
        >
          Club manager dashboard
        </Link>
        {showAdminLink ? (
          <Link
            href="/admin"
            className="flex w-full items-center justify-center rounded-xl border border-amber-500/30 bg-amber-950/25 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-950/40"
          >
            Master admin
          </Link>
        ) : null}
      </div>
    </div>
  );
}
