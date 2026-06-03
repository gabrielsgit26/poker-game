"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TableCard } from "@/features/lobby/table-card";
import { fetchClubsList } from "@/lib/lobby/api-clubs";
import { fetchTablesList, isApiRequestError, postCreateTable } from "@/lib/lobby/api-tables";
import { MOCK_TABLES } from "@/lib/lobby/mock-lobby";
import type { TableCardModel } from "@/lib/lobby/types";
import { useAuthSession } from "@/providers/auth-context";

export function TablesView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasApi = Boolean(process.env.NEXT_PUBLIC_API_URL?.trim());
  const { skipGate, ready, me } = useAuthSession();
  const sessionOk = skipGate || !ready || (me?.authenticated === true);

  const { data: tables, isPending, isError, error, refetch } = useQuery({
    queryKey: ["tables"],
    queryFn: async (): Promise<TableCardModel[]> => {
      if (!hasApi) return MOCK_TABLES;
      return fetchTablesList();
    },
  });

  const { data: clubs } = useQuery({
    queryKey: ["clubs", "table-create"],
    queryFn: async () => (await fetchClubsList()) ?? [],
    enabled: hasApi,
  });

  const joinedClubs = useMemo(
    () => clubs?.filter((c) => c.membership === "JOINED") ?? [],
    [clubs],
  );

  const [clubId, setClubId] = useState("");
  const [name, setName] = useState("");
  const [sb, setSb] = useState(1);
  const [bb, setBb] = useState(2);
  const [maxPlayers, setMaxPlayers] = useState(6);

  useEffect(() => {
    if (!joinedClubs.length) return;
    if (!joinedClubs.some((c) => c.id === clubId)) {
      setClubId(joinedClubs[0].id);
    }
  }, [joinedClubs, clubId]);

  const createMut = useMutation({
    mutationFn: () =>
      postCreateTable({
        clubId,
        name: name.trim(),
        smallBlind: sb,
        bigBlind: bb,
        maxPlayers,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tables"] });
      void queryClient.invalidateQueries({ queryKey: ["lobby"] });
      setName("");
      toast.success("Table created", {
        description: "It appears in the list below — open it to take a seat.",
      });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      const authIssue =
        isApiRequestError(e) && (e.status === 401 || e.status === 403);
      toast.error("Could not create table", {
        description: msg,
        duration: 9000,
        ...(authIssue
          ? {
              action: {
                label: "Sign in",
                onClick: () => router.push("/login?next=/tables"),
              },
            }
          : {}),
      });
    },
  });

  if (isPending || !tables) {
    return (
      <div className="mx-auto max-w-lg animate-pulse px-4 py-10 text-center text-sm text-zinc-500">
        Loading tables…
      </div>
    );
  }

  if (isError) {
    const msg = error instanceof Error ? error.message : "Request failed.";
    const authIssue =
      isApiRequestError(error) && (error.status === 401 || error.status === 403);
    return (
      <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
        <h1 className="text-2xl font-semibold text-zinc-50">Tables</h1>
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/25 p-5 text-left">
          <p className="text-sm font-semibold text-rose-100">Could not load tables</p>
          <p className="mt-2 text-sm leading-relaxed text-rose-200/85">{msg}</p>
          <p className="mt-3 text-xs text-zinc-500">
            Check your connection, open{" "}
            <Link href="/settings" className="text-amber-300 underline-offset-2 hover:underline">
              Settings
            </Link>{" "}
            to sign in, or use{" "}
            <Link href="/login?next=/tables" className="text-amber-300 underline-offset-2 hover:underline">
              Telegram sign-in
            </Link>
            .
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void refetch()}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950"
            >
              Retry
            </button>
            {authIssue ? (
              <Link
                href="/login?next=/tables"
                className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-zinc-100"
              >
                Sign in
              </Link>
            ) : null}
          </div>
        </div>
        <Link href="/lobby" className="inline-block text-sm text-amber-300 underline-offset-4 hover:underline">
          ← Lobby
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Tables</h1>
      </div>

      {hasApi && !sessionOk ? (
        <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-950/40 to-zinc-950/80 p-4 shadow-lg ring-1 ring-amber-500/15">
          <p className="text-sm font-semibold text-amber-100">Sign in required</p>
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
            Sign in from Settings, or open the app inside Telegram to continue.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/login?next=/tables"
              className="inline-flex items-center justify-center rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950"
            >
              Sign in
            </Link>
            <Link
              href="/settings"
              className="inline-flex items-center justify-center rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-zinc-200"
            >
              Settings
            </Link>
          </div>
        </div>
      ) : null}

      {hasApi && joinedClubs.length > 0 && sessionOk ? (
        <section
          id="create-table"
          className="rounded-2xl border border-white/10 bg-zinc-900/40 p-4"
          aria-labelledby="create-table-h"
        >
          <h2
            id="create-table-h"
            className="text-xs font-medium uppercase tracking-widest text-zinc-500"
          >
            Create table
          </h2>
          <p className="mt-1 text-xs text-zinc-600">
            You need <strong className="text-zinc-400">owner or manager</strong> access on the
            selected club. Errors appear below and in a short on-screen alert.
          </p>
          <div className="mt-4 space-y-3">
            <label className="block text-sm text-zinc-300">
              Club
              <select
                value={clubId}
                onChange={(e) => setClubId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                {joinedClubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm text-zinc-300">
              Table name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Friday NLHE"
                className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm text-zinc-300">
                Small blind
                <input
                  type="number"
                  min={0}
                  value={sb}
                  onChange={(e) => setSb(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm text-zinc-300">
                Big blind
                <input
                  type="number"
                  min={0}
                  value={bb}
                  onChange={(e) => setBb(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="block text-sm text-zinc-300">
              Max players
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              >
                {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            {createMut.isError ? (
              <p className="rounded-lg border border-rose-500/25 bg-rose-950/20 px-3 py-2 text-xs text-rose-200">
                {createMut.error instanceof Error ? createMut.error.message : "Create failed."}
              </p>
            ) : null}
            <button
              type="button"
              disabled={createMut.isPending || !name.trim() || !clubId || !sessionOk}
              onClick={() => createMut.mutate()}
              className="w-full rounded-xl bg-amber-500/90 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50"
            >
              {createMut.isPending ? "Creating…" : "Create table"}
            </button>
          </div>
        </section>
      ) : hasApi && sessionOk ? (
        <p className="rounded-xl border border-dashed border-white/15 bg-zinc-900/30 px-4 py-3 text-sm text-zinc-500">
          Join a club from the lobby to create tables here.
        </p>
      ) : null}

      <section aria-labelledby="tables-list-h">
        <h2
          id="tables-list-h"
          className="mb-3 text-xs font-medium uppercase tracking-widest text-zinc-500"
        >
          Open tables
        </h2>
        {tables.length === 0 ? (
          <p className="text-sm text-zinc-500">No open tables.</p>
        ) : (
          <ul className="space-y-3">
            {tables.map((t) => (
              <li key={t.id}>
                <TableCard table={t} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        href="/lobby"
        className="inline-block text-sm font-medium text-amber-300 underline-offset-4 hover:underline"
      >
        ← Lobby
      </Link>
    </div>
  );
}
