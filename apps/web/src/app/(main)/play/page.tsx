"use client";

import { useCallback, useState } from "react";
import { headsUpRunoutAllIn, type HeadsUpRunout } from "@/lib/poker-engine";
import { CardFace } from "@/components/card-face";

export default function PlayPage() {
  const [run, setRun] = useState<HeadsUpRunout | null>(null);

  const deal = useCallback(() => {
    setRun(headsUpRunoutAllIn());
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-400/90">
          Local test — no Telegram
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50">Heads-up runout</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Two players, both all-in preflop: full board is dealt and the best
          five-card hand wins. Uses the shared engine only (browser — no API
          yet).
        </p>
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
