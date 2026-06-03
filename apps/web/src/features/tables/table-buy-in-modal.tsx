"use client";

import { useEffect, useState } from "react";
import { formatChips } from "@/lib/format-chips";

export type TableBuyInModalProps = {
  open: boolean;
  onClose: () => void;
  tableName: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  /** Upper cap for this sit (already clamped to balance server-side). */
  maxBuyIn: number;
  availableBalance: number;
  onConfirm: (amount: number) => void;
  isSubmitting?: boolean;
};

export function TableBuyInModal({
  open,
  onClose,
  tableName,
  smallBlind,
  bigBlind,
  minBuyIn,
  maxBuyIn,
  availableBalance,
  onConfirm,
  isSubmitting,
}: TableBuyInModalProps) {
  const hi = Math.max(minBuyIn, maxBuyIn);
  const [amount, setAmount] = useState(minBuyIn);

  useEffect(() => {
    if (!open) return;
    setAmount((a) => Math.min(Math.max(minBuyIn, a), hi));
  }, [open, minBuyIn, hi]);

  if (!open) return null;

  const step = Math.max(1, Math.round((hi - minBuyIn) / 80) || 1);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="buyin-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-sm rounded-2xl border border-zinc-500/40 bg-gradient-to-b from-zinc-900 via-zinc-950 to-black p-5 shadow-[0_24px_80px_rgba(0,0,0,0.65)] ring-1 ring-amber-900/20">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-white/10 hover:text-zinc-100"
          aria-label="Close"
        >
          ✕
        </button>

        <h2
          id="buyin-title"
          className="pr-8 text-center text-[13px] font-bold uppercase tracking-[0.22em] text-zinc-100"
        >
          Cash buy-in
        </h2>
        <p className="mt-1 text-center text-[11px] text-zinc-500">{tableName}</p>

        <div className="mt-5 grid grid-cols-2 gap-4 border-b border-zinc-700/50 pb-4 text-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Hold&apos;em</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-zinc-100">
              {formatChips(bigBlind)} / {formatChips(smallBlind)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Available balance</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-amber-200">{formatChips(availableBalance)}</p>
          </div>
        </div>

        <div className="mt-5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Buy-in amount</p>
          <p className="mt-1.5 text-[1.65rem] font-bold tabular-nums leading-tight text-white">
            {formatChips(amount)}
          </p>
        </div>

        <div className="mt-6 px-0.5">
          <input
            type="range"
            className="buyin-slider h-2 w-full cursor-pointer"
            min={minBuyIn}
            max={hi}
            step={step}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            disabled={isSubmitting}
          />
          <div className="mt-2 flex justify-between text-[10px] font-medium text-zinc-500">
            <span>
              Min. <span className="tabular-nums text-zinc-400">{formatChips(minBuyIn)}</span>
            </span>
            <span>
              Max. <span className="tabular-nums text-zinc-400">{formatChips(hi)}</span>
            </span>
          </div>
        </div>

        <button
          type="button"
          disabled={isSubmitting || availableBalance < minBuyIn}
          onClick={() => onConfirm(amount)}
          className="mt-6 w-full rounded-xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 py-3.5 text-sm font-black uppercase tracking-[0.12em] text-zinc-950 shadow-[0_4px_0_rgba(120,53,15,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] transition hover:brightness-105 active:translate-y-px active:shadow-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isSubmitting ? "…" : "OK"}
        </button>
      </div>
    </div>
  );
}
