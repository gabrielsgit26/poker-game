"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { TableCard } from "@/features/lobby/table-card";
import { fetchClubsList } from "@/lib/lobby/api-clubs";
import { fetchTablesList, postCreateTable } from "@/lib/lobby/api-tables";
import { MOCK_TABLES } from "@/lib/lobby/mock-lobby";
import type { TableCardModel } from "@/lib/lobby/types";

export function TablesView() {
  const queryClient = useQueryClient();
  const hasApi = Boolean(process.env.NEXT_PUBLIC_API_URL?.trim());

  const { data: tables, isPending } = useQuery({
    queryKey: ["tables"],
    queryFn: async (): Promise<TableCardModel[]> => {
      const t = await fetchTablesList();
      if (t) return t;
      return MOCK_TABLES;
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
      }),
    onSuccess: (row) => {
      if (row) {
        void queryClient.invalidateQueries({ queryKey: ["tables"] });
        void queryClient.invalidateQueries({ queryKey: ["lobby"] });
        setName("");
      }
    },
  });

  if (isPending || !tables) {
    return (
      <div className="mx-auto max-w-lg animate-pulse px-4 py-10 text-center text-sm text-zinc-500">
        Loading tables…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-50">Tables</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Phase 6 — list, create, sit, leave, and close via the Nest API when{" "}
          <code className="text-zinc-600">NEXT_PUBLIC_API_URL</code> is set. Otherwise
          you see the static mock list.
        </p>
      </div>

      {hasApi && joinedClubs.length > 0 ? (
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
            Requires club <strong className="text-zinc-400">owner or manager</strong>{" "}
            role on the API.
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
            {createMut.isError ? (
              <p className="text-xs text-rose-300">
                Create failed — you may need manager rights on that club.
              </p>
            ) : null}
            <button
              type="button"
              disabled={createMut.isPending || !name.trim() || !clubId}
              onClick={() => createMut.mutate()}
              className="w-full rounded-xl bg-amber-500/90 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-50"
            >
              {createMut.isPending ? "Creating…" : "Create table"}
            </button>
          </div>
        </section>
      ) : hasApi ? (
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
