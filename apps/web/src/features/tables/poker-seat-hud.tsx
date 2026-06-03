"use client";

import type { PokerSeatUi, PokerTableBridge } from "@/features/tables/poker-table-ui-types";
import { MiniCard, OpponentCardBack } from "@/features/tables/poker-mini-card";

export type PokerSeatHudProps = {
  seatIndex: number;
  norm: { x: number; y: number };
  seat: PokerSeatUi;
  isHero: boolean;
  isAct: boolean;
  turnFrac: number;
  heroHolesDealing: boolean;
  showHoleBacksForOthers: boolean;
  live: boolean;
  viewerSeatIndex: number | null;
  sitPendingSeat: number | null;
  bridge: PokerTableBridge;
};

function GoldCoinIcon({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 via-amber-500 to-amber-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${className ?? ""}`}
      aria-hidden
    />
  );
}

function BalancePill({ amount }: { amount: number }) {
  return (
    <div className="flex min-w-[8.25rem] items-center justify-center gap-2 rounded-full border border-amber-400/90 bg-black/92 px-3.5 py-1 shadow-[0_2px_14px_rgba(0,0,0,0.55)]">
      <GoldCoinIcon />
      <span className="whitespace-nowrap text-xs font-bold tabular-nums tracking-tight text-white">
        $ {amount.toLocaleString()}
      </span>
    </div>
  );
}

export function PokerSeatHud({
  seatIndex,
  norm,
  seat,
  isHero,
  isAct,
  turnFrac,
  heroHolesDealing,
  showHoleBacksForOthers,
  live,
  viewerSeatIndex,
  sitPendingSeat,
  bridge,
}: PokerSeatHudProps) {
  const holes = seat.holeCards ?? seat.revealedHoleCards;
  const showBacks =
    Boolean(seat.userId) &&
    !seat.folded &&
    showHoleBacksForOthers &&
    !isHero &&
    !holes;

  const label = seat.userId
    ? seat.userId.length > 14
      ? `${seat.userId.slice(0, 13)}…`
      : seat.userId
    : `Seat ${seatIndex + 1}`;

  const chipTotal =
    seat.stack != null ? Math.max(0, seat.stack) + Math.max(0, seat.streetPut) : null;

  const widthClass = isHero ? "w-[min(46vw,12.5rem)]" : "w-[min(42vw,11.5rem)] max-w-[min(42vw,11.5rem)]";

  /** Seat on the right side of the table — fan cards toward center (left of avatar). */
  const cardsTowardCenter = norm.x > 0.5;

  return (
    <div
      className={`pointer-events-auto absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${widthClass}`}
      style={{ left: `${norm.x * 100}%`, top: `${norm.y * 100}%` }}
    >
      <p className="max-w-[min(100%,11rem)] truncate px-1 text-center text-[11px] font-semibold tracking-tight text-zinc-50 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
        {isHero ? "You" : label}
      </p>

      {isHero ? (
        <div className="relative mt-0.5 pt-1">
          <div
            className={`relative z-10 rounded-full p-[2px] shadow-lg ${
              isAct ? "ring-2 ring-emerald-400/90 ring-offset-2 ring-offset-transparent" : ""
            } ring-2 ring-amber-400/95`}
          >
            {isAct ? (
              <svg className="absolute inset-[-5px] h-[calc(100%+10px)] w-[calc(100%+10px)] -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(52,211,153,0.2)" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke="#34d399"
                  strokeWidth="3"
                  strokeDasharray={`${turnFrac * 94.2} 94.2`}
                  strokeLinecap="round"
                />
              </svg>
            ) : null}
            <div
              className={`flex h-[3.1rem] w-[3.1rem] items-center justify-center rounded-full text-[12px] font-bold ${
                seat.userId
                  ? seat.folded
                    ? "bg-zinc-800/85 text-zinc-500"
                    : "bg-gradient-to-b from-zinc-600 to-zinc-900 text-zinc-50"
                  : "bg-zinc-950 text-zinc-600"
              }`}
            >
              {seat.userId ? seat.userId.slice(0, 2).toUpperCase() : seatIndex + 1}
            </div>
          </div>
          {seat.userId && chipTotal != null ? (
            <div className="absolute bottom-0 left-1/2 z-20 -translate-x-1/2 translate-y-[58%]">
              <BalancePill amount={chipTotal} />
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className={`mt-1 flex items-start justify-center gap-2.5 pt-0.5 ${cardsTowardCenter ? "flex-row-reverse" : "flex-row"}`}
        >
          <div className="relative flex shrink-0 flex-col items-center">
            <div
              className={`relative z-10 rounded-full p-[2px] shadow-lg ${
                isAct ? "ring-2 ring-emerald-400/90 ring-offset-2 ring-offset-transparent" : ""
              } ring-[1.5px] ring-amber-500/80`}
            >
              {isAct ? (
                <svg className="absolute inset-[-5px] h-[calc(100%+10px)] w-[calc(100%+10px)] -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(52,211,153,0.2)" strokeWidth="3" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="3"
                    strokeDasharray={`${turnFrac * 94.2} 94.2`}
                    strokeLinecap="round"
                  />
                </svg>
              ) : null}
              <div
                className={`flex h-[3.1rem] w-[3.1rem] items-center justify-center rounded-full text-[12px] font-bold ${
                  seat.userId
                    ? seat.folded
                      ? "bg-zinc-800/85 text-zinc-500"
                      : "bg-gradient-to-b from-zinc-600 to-zinc-900 text-zinc-50"
                    : "bg-zinc-950 text-zinc-600"
                }`}
              >
                {seat.userId ? seat.userId.slice(0, 2).toUpperCase() : seatIndex + 1}
              </div>
            </div>
            {seat.userId && chipTotal != null ? (
              <div className="mt-2">
                <BalancePill amount={chipTotal} />
              </div>
            ) : null}
          </div>

          {showBacks || holes ? (
            <div
              className="pointer-events-none flex shrink-0 items-start -space-x-2.5 pt-1"
              aria-hidden
            >
              {holes ? (
                <>
                  <MiniCard code={holes[0]} size="sm" className="rotate-[7deg] shadow-lg ring-1 ring-black/20" />
                  <MiniCard code={holes[1]} size="sm" className="-rotate-[5deg] translate-y-1 shadow-lg ring-1 ring-black/20" />
                </>
              ) : (
                <>
                  <OpponentCardBack className="rotate-[9deg] ring-1 ring-black/25" />
                  <OpponentCardBack className="-rotate-[5deg] translate-y-1 ring-1 ring-black/25" />
                </>
              )}
            </div>
          ) : null}
        </div>
      )}

      {isHero ? (
        <div
          className={`relative z-[5] mt-5 flex items-center justify-center gap-1 ${heroHolesDealing && holes ? "poker-hole-deal-wrap" : ""}`}
        >
          {holes ? (
            <>
              <MiniCard code={holes[0]} size="hero" />
              <MiniCard code={holes[1]} size="hero" />
            </>
          ) : showBacks ? (
            <>
              <MiniCard faceDown size="hero" />
              <MiniCard faceDown size="hero" />
            </>
          ) : null}
        </div>
      ) : null}

      {seat.streetPut > 0 && seat.userId && !isHero ? (
        <div className="mt-3 text-[9px] font-semibold text-sky-200/95">Bet ${seat.streetPut}</div>
      ) : isHero && seat.streetPut > 0 ? (
        <div className="mt-1 text-[8px] font-semibold text-sky-200/90">Street ${seat.streetPut}</div>
      ) : null}

      <div className="mt-1 flex flex-wrap justify-center gap-0.5">
        {seat.isButton ? (
          <span className="rounded bg-zinc-100 px-1 text-[8px] font-black text-zinc-900">D</span>
        ) : null}
        {seat.isSb ? (
          <span className="rounded bg-sky-300 px-1 text-[8px] font-black text-zinc-900">SB</span>
        ) : null}
        {seat.isBb ? (
          <span className="rounded bg-amber-300 px-1 text-[8px] font-black text-zinc-900">BB</span>
        ) : null}
        {seat.folded && seat.userId ? (
          <span className="text-[8px] font-bold text-rose-300">FOLD</span>
        ) : null}
      </div>

      {!seat.userId && live && viewerSeatIndex === null ? (
        <button
          type="button"
          disabled={sitPendingSeat !== null}
          onClick={() => bridge.onSit(seatIndex)}
          className="mt-1 rounded-md border border-amber-600/50 bg-emerald-900/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-amber-100 shadow-md active:scale-95 disabled:opacity-40"
        >
          {sitPendingSeat === seatIndex ? "…" : "Sit"}
        </button>
      ) : null}
    </div>
  );
}
