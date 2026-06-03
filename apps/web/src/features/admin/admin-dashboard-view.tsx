"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { fetchAdminOverview, postAdminChipGrant } from "@/lib/admin/api-admin";
import { formatChips } from "@/lib/format-chips";
import { useAuthSession } from "@/providers/auth-context";

export function AdminDashboardView() {
  const queryClient = useQueryClient();
  const { skipGate, ready, me } = useAuthSession();
  const isAdmin = me?.authenticated === true && me.isPlatformAdmin === true;

  const { data: overview, isPending } = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => {
      const o = await fetchAdminOverview();
      if (!o) throw new Error("offline");
      return o;
    },
    enabled: ready && isAdmin,
  });

  const [clubId, setClubId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");

  const grantMut = useMutation({
    mutationFn: async (p: {
      clubId: string;
      targetUserId: string;
      delta: number;
      note?: string;
    }) => {
      const r = await postAdminChipGrant(p.clubId, p.targetUserId, {
        delta: p.delta,
        note: p.note,
      });
      if (!r) throw new Error("API is not configured.");
      return r;
    },
    onSuccess: (r) => {
      toast.success("Platform grant applied", {
        description: `${r.targetUserId} balance now ${formatChips(r.newBalance)}.`,
      });
      setDelta("");
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      void queryClient.invalidateQueries({ queryKey: ["club"] });
      void queryClient.invalidateQueries({ queryKey: ["lobby"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Grant failed.");
    },
  });

  if (skipGate) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-zinc-400">
        Admin tools need <code className="text-amber-200/90">NEXT_PUBLIC_API_URL</code> and a
        signed-in session.
      </div>
    );
  }

  if (ready && me?.authenticated && !isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <h1 className="text-lg font-semibold text-zinc-100">Admin</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Your account is not listed in the API&apos;s{" "}
          <code className="text-amber-200/90">PLATFORM_ADMIN_USER_IDS</code> env var.
        </p>
        <Link href="/profile" className="mt-6 inline-block text-sm text-amber-300 underline-offset-4 hover:underline">
          ← Profile
        </Link>
      </div>
    );
  }

  if (!ready || !me?.authenticated) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center text-sm text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 px-4 py-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-amber-400/90">Platform</p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50">Master admin</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Plan §6.8 — MVP: live counts + audited club chip grants.
        </p>
      </div>

      {isPending || !overview ? (
        <p className="text-sm text-zinc-500">Loading overview…</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {(
            [
              ["Users", overview.userCount],
              ["Clubs", overview.clubCount],
              ["Active members", overview.activeClubMembers],
              ["Open tables", overview.nonClosedTables],
            ] as const
          ).map(([label, n]) => (
            <li
              key={label}
              className="rounded-xl border border-white/10 bg-zinc-900/50 px-4 py-3 text-center"
            >
              <p className="text-2xl font-bold tabular-nums text-zinc-100">{n}</p>
              <p className="text-[11px] uppercase tracking-wide text-zinc-500">{label}</p>
            </li>
          ))}
        </ul>
      )}

      <section className="rounded-2xl border border-amber-500/25 bg-amber-950/15 p-4">
        <h2 className="text-xs font-medium uppercase tracking-widest text-amber-200/90">
          Club chip grant
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
          Credits or debits any member&apos;s club wallet. Logged as{" "}
          <span className="font-mono text-zinc-400">PLATFORM_ADJUST</span> (same limits as manager
          tools).
        </p>
        <div className="mt-3 space-y-3">
          <label className="block text-sm text-zinc-300">
            Club ID
            <input
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
              placeholder="Mongo club _id"
            />
          </label>
          <label className="block text-sm text-zinc-300">
            Member user ID
            <input
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
            />
          </label>
          <label className="block text-sm text-zinc-300">
            Delta
            <input
              type="number"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
              placeholder="e.g. 50000 or -10000"
            />
          </label>
          <label className="block text-sm text-zinc-300">
            Note (optional)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            />
          </label>
          <button
            type="button"
            disabled={
              grantMut.isPending ||
              !clubId.trim() ||
              !targetUserId.trim() ||
              !delta.trim() ||
              Number.isNaN(parseInt(delta, 10)) ||
              parseInt(delta, 10) === 0
            }
            onClick={() => {
              const d = parseInt(delta, 10);
              grantMut.mutate({
                clubId: clubId.trim(),
                targetUserId: targetUserId.trim(),
                delta: d,
                note: note.trim() || undefined,
              });
            }}
            className="w-full rounded-xl bg-amber-500/90 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50"
          >
            {grantMut.isPending ? "Applying…" : "Apply platform grant"}
          </button>
        </div>
      </section>

      <Link href="/profile" className="text-sm text-amber-300 underline-offset-4 hover:underline">
        ← Profile
      </Link>
    </div>
  );
}
