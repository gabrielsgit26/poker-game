"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  fetchClubDetail,
  patchJoinRequest,
  postJoinClub,
} from "@/lib/lobby/api-clubs";

export function ClubDetailView({ clubId }: { clubId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["club", clubId],
    queryFn: async () => {
      const d = await fetchClubDetail(clubId);
      if (!d) throw new Error("offline");
      return d;
    },
    retry: false,
  });

  const joinMut = useMutation({
    mutationFn: () => postJoinClub(clubId),
    onSuccess: (result) => {
      if (result) {
        void queryClient.invalidateQueries({ queryKey: ["club", clubId] });
        void queryClient.invalidateQueries({ queryKey: ["lobby"] });
      }
    },
  });

  const decideMut = useMutation({
    mutationFn: async ({
      requestId,
      approve,
    }: {
      requestId: string;
      approve: boolean;
    }) => {
      const ok = await patchJoinRequest(clubId, requestId, approve);
      if (!ok) throw new Error("failed");
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["club", clubId] });
      void queryClient.invalidateQueries({ queryKey: ["lobby"] });
    },
  });

  if (isPending) {
    return (
      <div className="mx-auto max-w-lg animate-pulse space-y-4 px-4 py-8">
        <div className="h-8 w-2/3 rounded bg-zinc-800" />
        <div className="h-24 rounded-xl bg-zinc-800/70" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-zinc-300">
          Club details need the API. Set{" "}
          <code className="text-amber-200/90">NEXT_PUBLIC_API_URL</code> and run
          MongoDB + <code className="text-amber-200/90">npm run dev:server</code>.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 rounded-lg bg-amber-500/90 px-4 py-2 text-sm font-semibold text-zinc-950"
        >
          Retry
        </button>
        <Link
          href="/lobby"
          className="mt-6 block text-sm text-amber-300 underline-offset-4 hover:underline"
        >
          ← Back to lobby
        </Link>
      </div>
    );
  }

  const { club, membership, viewerRole, members, pendingRequests } = data;
  const canManage = viewerRole === "OWNER" || viewerRole === "MANAGER";

  const joinLabel =
    club.isPrivate && membership !== "JOINED"
      ? "Request to join"
      : "Join club";

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-amber-400/90">
          Club
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50">{club.name}</h1>
        <p className="mt-2 text-sm text-zinc-500">
          {club.memberCount} members
          {club.isPrivate ? " · Private" : " · Public"}
          {viewerRole ? ` · Your role: ${viewerRole}` : null}
        </p>
      </div>

      {membership !== "JOINED" && membership !== "PENDING" ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={joinMut.isPending}
            onClick={() => joinMut.mutate()}
            className="rounded-xl bg-amber-500/90 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:opacity-60"
          >
            {joinMut.isPending ? "Working…" : joinLabel}
          </button>
        </div>
      ) : null}

      {membership === "PENDING" ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
          Your join request is pending manager approval.
        </p>
      ) : null}

      {members.length > 0 ? (
        <section aria-labelledby="members-h">
          <h2
            id="members-h"
            className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-500"
          >
            Members
          </h2>
          <ul className="divide-y divide-white/10 rounded-xl border border-white/10 bg-zinc-900/40">
            {members.map((m) => (
              <li
                key={`${m.userId}-${m.role}`}
                className="flex justify-between px-4 py-2.5 text-sm"
              >
                <span className="font-mono text-zinc-200">{m.userId}</span>
                <span className="text-zinc-500">{m.role}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-zinc-500">
          {club.isPrivate && membership !== "JOINED"
            ? "Member list is visible after you join."
            : "No members loaded."}
        </p>
      )}

      {canManage && pendingRequests.length > 0 ? (
        <section aria-labelledby="req-h">
          <h2
            id="req-h"
            className="mb-2 text-xs font-medium uppercase tracking-widest text-zinc-500"
          >
            Pending join requests
          </h2>
          <ul className="space-y-2">
            {pendingRequests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-3"
              >
                <span className="font-mono text-sm text-zinc-200">
                  {r.userId}
                </span>
                <span className="flex gap-2">
                  <button
                    type="button"
                    disabled={decideMut.isPending}
                    onClick={() =>
                      decideMut.mutate({ requestId: r.id, approve: true })
                    }
                    className="rounded-lg bg-emerald-600/90 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={decideMut.isPending}
                    onClick={() =>
                      decideMut.mutate({ requestId: r.id, approve: false })
                    }
                    className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-zinc-300"
                  >
                    Reject
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex gap-3 pt-4">
        <Link
          href="/lobby"
          className="text-sm font-medium text-amber-300 underline-offset-4 hover:underline"
        >
          ← Lobby
        </Link>
        <button
          type="button"
          onClick={() => router.push("/tables")}
          className="text-sm text-zinc-500 hover:text-zinc-300"
        >
          Tables (stub)
        </button>
      </div>
    </div>
  );
}
