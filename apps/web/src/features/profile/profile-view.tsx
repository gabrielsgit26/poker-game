"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ClubBalances } from "@/features/profile/club-balances";
import { ProfileHeader } from "@/features/profile/profile-header";
import { ProfileSkeleton } from "@/features/profile/profile-skeleton";
import { StatsCards } from "@/features/profile/stats-cards";
import { TransactionList } from "@/features/profile/transaction-list";
import { fetchProfileSnapshot } from "@/lib/profile/mock-profile";
import { useAuthSession } from "@/providers/auth-context";

export function ProfileView() {
  const { ready, me, skipGate } = useAuthSession();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfileSnapshot,
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-lg px-4 py-2">
        <p className="mb-4 text-center text-xs text-zinc-500">
          Phase 4 profile · mock API
        </p>
        <ProfileSkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-zinc-300">Could not load profile.</p>
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

  const showAdminLink =
    !skipGate && ready && me?.authenticated === true && me.isPlatformAdmin === true;

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-2 pb-4">
      <p className="text-center text-[11px] text-zinc-500">
        Phase 4 · mock data (real API in later phases)
      </p>
      <div className="flex flex-col gap-2">
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
      <ProfileHeader user={data.user} />
      <StatsCards stats={data.stats} />
      <ClubBalances rows={data.clubBalances} />
      <TransactionList rows={data.transactions} />
      <Link
        href="/settings"
        className="flex w-full items-center justify-center rounded-xl border border-white/15 bg-zinc-900/50 py-3 text-sm font-semibold text-zinc-100 transition hover:border-amber-500/30 hover:bg-zinc-900"
      >
        Settings & preferences
      </Link>
    </div>
  );
}
