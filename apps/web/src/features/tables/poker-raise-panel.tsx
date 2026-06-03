"use client";

import { useCallback, useMemo } from "react";

export type PokerRaisePanelProps = {
  mode: "raise_to" | "bet";
  amount: number;
  onAmountChange: (n: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  raisePanelMin: number;
  raisePanelMax: number;
  pot: number;
  callAmount: number;
  /** Hero chips already in pot this street */
  committed: number;
  bigBlind: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.floor(n)));
}

const presets = [
  { id: "allin" as const, label: "ALL IN" },
  { id: "pot" as const, label: "Pot" },
  { id: "pot34" as const, label: "3/4 Pot" },
  { id: "pot12" as const, label: "1/2 Pot" },
  { id: "x4" as const, label: "4x" },
  { id: "x2" as const, label: "2x" },
];

export function PokerRaisePanel({
  mode,
  amount,
  onAmountChange,
  onConfirm,
  onClose,
  raisePanelMin,
  raisePanelMax,
  pot,
  callAmount,
  committed,
  bigBlind,
}: PokerRaisePanelProps) {
  const bb = Math.max(1, bigBlind);

  const applyPreset = useCallback(
    (id: (typeof presets)[number]["id"]) => {
      const min = raisePanelMin;
      const max = raisePanelMax;
      const C = committed;
      const T = callAmount;
      const P = Math.max(0, pot);
      let r = min;
      switch (id) {
        case "allin":
          r = max;
          break;
        case "pot":
          r = C + T + P;
          break;
        case "pot34":
          r = C + T + Math.floor((P * 3) / 4);
          break;
        case "pot12":
          r = C + T + Math.floor(P / 2);
          break;
        case "x4":
          r = C + T + 4 * bb;
          break;
        case "x2":
          r = C + T + 2 * bb;
          break;
        default:
          r = min;
      }
      onAmountChange(clamp(r, min, max));
    },
    [bb, callAmount, committed, onAmountChange, pot, raisePanelMax, raisePanelMin],
  );

  const moneyLabel = useMemo(
    () => `$ ${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    [amount],
  );

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[44] bg-black/60 backdrop-blur-[2px]"
        aria-label="Close raise panel"
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 z-[45] w-[min(92vw,17.5rem)] -translate-x-1/2"
        style={{
          bottom: "calc(4.85rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        <div className="overflow-hidden rounded-2xl border border-zinc-600/70 bg-[#0c0e12]/98 shadow-[0_12px_40px_rgba(0,0,0,0.65)]">
          <div className="flex gap-3 p-3 pb-2">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className="rounded-full border border-zinc-600/60 bg-zinc-900/90 py-2.5 text-center text-[11px] font-bold uppercase tracking-wide text-zinc-100 shadow-inner transition hover:border-teal-500/50 hover:bg-zinc-800 active:scale-[0.98]"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex w-10 shrink-0 flex-col items-center justify-center py-1">
              <div className="relative flex h-[11.5rem] w-8 items-center justify-center">
                <input
                  type="range"
                  min={raisePanelMin}
                  max={raisePanelMax}
                  step={1}
                  value={Math.min(raisePanelMax, Math.max(raisePanelMin, amount))}
                  onChange={(e) => onAmountChange(Number(e.target.value))}
                  className="raise-vertical-slider h-[11.5rem] w-10 cursor-pointer appearance-none bg-transparent"
                  aria-valuemin={raisePanelMin}
                  aria-valuemax={raisePanelMax}
                  aria-valuenow={amount}
                  aria-label="Raise amount"
                />
              </div>
            </div>
          </div>
          <div className="border-t border-zinc-800/90 p-3 pt-2">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full rounded-2xl bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 py-3.5 text-sm font-black tracking-tight text-zinc-950 shadow-[0_4px_0_rgba(120,53,15,0.55),inset_0_1px_0_rgba(255,255,255,0.35)] transition active:translate-y-px active:shadow-none"
            >
              {mode === "bet" ? "Bet" : "Raise"} {moneyLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
