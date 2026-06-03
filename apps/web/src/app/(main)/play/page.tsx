"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { headsUpRunoutAllIn, type HeadsUpRunout } from "@/lib/poker-engine";
import { CardFace } from "@/components/card-face";

/**
 * `/play` — **offline lab**: heads-up all-in runout in the browser only (plan §3-day demo / engine QA).
 * **Real multiplayer** with clubs, seats, and Socket.IO is **`/tables/[tableId]`** (SVG/HTML table UI + Nest + Redis).
 */
export default function PlayPage() {
  const [run, setRun] = useState<HeadsUpRunout | null>(null);

  const deal = useCallback(() => {
    setRun(headsUpRunoutAllIn());
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-400/90">
          Offline lab — no API
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50">Heads-up runout</h1>
        <p className="mt-2 text-sm text-zinc-400">
          This route is intentionally <strong>not</strong> the live club table. It runs a
          two-player all-in preflop runout entirely in your browser to exercise the local
          deck + evaluator. For real tables (SVG seat HUD + Nest + Redis), open a table from the
          lobby under <strong>/tables/[tableId]</strong>.
        </p>
        <Link
          href="/tables"
          className="mt-3 inline-block text-sm font-medium text-amber-300 underline-offset-4 hover:underline"
        >
          Go to tables →
        </Link>
      </header>

      <button
        type="button"
        onClick={deal}
        className="mb-6 w-full rounded-xl bg-amber-500/90 py-3 text-sm font-semibold text-zinc-950 shadow-lg shadow-amber-900/30 transition hover:bg-amber-400"
      >
        {run ? "Deal again" : "Deal hand"}
      </button>

      {run && (
        <div className="space-y-6 rounded-2xl border border-white/10 bg-zinc-900/50 p-5">
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Seat 0
            </h2>
            <div className="flex flex-wrap gap-2">
              <CardFace code={run.holes[0][0]} />
              <CardFace code={run.holes[0][1]} />
            </div>
            <p className="mt-2 text-sm text-zinc-300">{run.summary0}</p>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Board
            </h2>
            <div className="flex flex-wrap gap-2">
              {run.board.map((c) => (
                <CardFace key={c} code={c} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">
              Seat 1
            </h2>
            <div className="flex flex-wrap gap-2">
              <CardFace code={run.holes[1][0]} />
              <CardFace code={run.holes[1][1]} />
            </div>
            <p className="mt-2 text-sm text-zinc-300">{run.summary1}</p>
          </section>

          <p className="border-t border-white/10 pt-4 text-center text-lg font-semibold text-amber-200">
            {run.winner === "tie"
              ? "Split pot"
              : `Seat ${run.winner} wins`}
          </p>
        </div>
      )}
    </div>
  );
}
