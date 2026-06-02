"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { ClubCard } from "@/features/lobby/club-card";
import { LobbyFilters } from "@/features/lobby/lobby-filters";
import { LobbyHeader } from "@/features/lobby/lobby-header";
import { LobbySkeleton } from "@/features/lobby/lobby-skeleton";
import { QuickActions } from "@/features/lobby/quick-actions";
import { TableCard } from "@/features/lobby/table-card";
import { postJoinClub } from "@/lib/lobby/api-clubs";
import { fetchLobbySnapshot } from "@/lib/lobby/mock-lobby";
import type { LobbyFilterId } from "@/lib/lobby/types";

function filterLabel(f: LobbyFilterId): string {
  switch (f) {
    case "all":
      return "All";
    case "my_clubs":
      return "My clubs";
    case "waiting":
      return "Waiting tables";
    case "low":
      return "Low stakes";
    case "high":
      return "High stakes";
    default:
      return "";
  }
}

export function LobbyView() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<LobbyFilterId>("all");

  const joinClub = useMutation({
    mutationFn: (clubId: string) => postJoinClub(clubId),
    onSuccess: (result) => {
      if (result) {
        void queryClient.invalidateQueries({ queryKey: ["lobby"] });
      }
    },
  });

  const canApiClubs = Boolean(process.env.NEXT_PUBLIC_API_URL?.trim());

  const { data, isPending, isError, refetch, isFetching } = useQuery({
    queryKey: ["lobby", filter],
    queryFn: () => fetchLobbySnapshot(filter),
    placeholderData: keepPreviousData,
  });

  if (isPending && !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-2">
        <p className="mb-4 text-center text-xs text-zinc-500">
          Mock lobby · TanStack Query + skeletons
        </p>
        <LobbySkeleton />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 text-center">
        <p className="text-zinc-300">Could not load lobby.</p>
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

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-2 pb-4">
      <p className="text-center text-[11px] text-zinc-500">
        Phase 6 · clubs + tables from API when{" "}
        <code className="text-zinc-600">NEXT_PUBLIC_API_URL</code> is set (fallback
        mock otherwise)
        {isFetching ? (
          <span className="ml-2 text-amber-400/90">Refreshing…</span>
        ) : null}
      </p>

      <LobbyHeader user={data.user} />
      <QuickActions />

      <section aria-label="Filters">
        <LobbyFilters value={filter} onChange={setFilter} />
      </section>

      <section id="clubs-section" aria-labelledby="clubs-heading">
        <div className="mb-3 flex items-end justify-between gap-2">
          <h2
            id="clubs-heading"
            className="text-xs font-medium uppercase tracking-widest text-zinc-500"
          >
            Clubs
          </h2>
          <Link
            href="/clubs/new"
            className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-1.5 text-xs font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-950/50"
          >
            Create club
          </Link>
        </div>
        {data.clubs.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-zinc-900/30 p-8 text-center">
            <p className="text-sm font-medium text-zinc-300">
              No clubs match “{filterLabel(filter)}”.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Join a club or switch filters to see more.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.clubs.map((club) => (
              <li key={club.id}>
                <ClubCard
                  club={club}
                  joinBusy={joinClub.isPending}
                  onJoin={
                    canApiClubs
                      ? (clubId) => {
                          void joinClub.mutateAsync(clubId).catch(() => {
                            /* toast later */
                          });
                        }
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="tables-heading">
        <h2
          id="tables-heading"
          className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500"
        >
          Tables
        </h2>
        {data.tables.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-zinc-900/30 p-8 text-center">
            <p className="text-sm font-medium text-zinc-300">
              No active tables yet.
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Create a table or join a club to start playing.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {data.tables.map((table) => (
              <li key={table.id}>
                <TableCard table={table} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
