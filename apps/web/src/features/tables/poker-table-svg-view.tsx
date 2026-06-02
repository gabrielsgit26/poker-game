"use client";

import {
  type CSSProperties,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildPokerTableUiState } from "@/features/tables/build-poker-table-ui-state";
import type { PokerAllowedAction, PokerTableBridge } from "@/features/tables/poker-table-ui-types";
import type { TableDetailApi } from "@/lib/lobby/api-tables";

/** Chip animation target: pot center in normalized table coords (vertical felt). */
const POT_NORM = { x: 0.5, y: 0.4 } as const;

/** Portrait-first 6-max: seats hug a taller (vertical) oval (wide ring → larger on screen). */
const LAYOUT_6: { x: number; y: number }[] = [
  { x: 0.5, y: 0.91 },
  { x: 0.05, y: 0.74 },
  { x: 0.05, y: 0.26 },
  { x: 0.5, y: 0.09 },
  { x: 0.95, y: 0.26 },
  { x: 0.95, y: 0.74 },
];

function seatNorm(i: number, n: number): { x: number; y: number } {
  if (n === 6 && i < 6) return LAYOUT_6[i]!;
  const cx = 0.5;
  const cy = 0.5;
  /** Vertical ellipse, slightly wide so the felt fills more of the view. */
  const rx = 0.36;
  const ry = 0.39;
  const ang = -Math.PI / 2 + (i * (2 * Math.PI)) / Math.max(n, 1);
  return {
    x: cx + Math.cos(ang) * rx * 0.94,
    y: cy + Math.sin(ang) * ry * 0.94,
  };
}

function formatCard(code: string): string {
  if (code.length !== 2) return code;
  const r = code[0]!.toUpperCase();
  const rank = r === "T" ? "10" : r;
  const s = code[1]!.toLowerCase();
  const suit = s === "h" ? "♥" : s === "d" ? "♦" : s === "c" ? "♣" : s === "s" ? "♠" : s;
  return `${rank}${suit}`;
}

function isRedSuit(code: string): boolean {
  const s = code[1]?.toLowerCase();
  return s === "h" || s === "d";
}

/** Visual chip count in the center pile (log-scaled vs pot; capped for perf). */
function potChipDiscCount(pot: number, bigBlind: number): number {
  if (pot <= 0) return 0;
  const bb = Math.max(1, bigBlind);
  const ratio = pot / bb;
  return Math.min(58, Math.max(4, Math.round(4 + Math.log2(ratio + 1) * 6 + Math.sqrt(pot / (bb * 2)) * 3)));
}

/** Stacked chips at felt center — reflects live `pot` during play; clears when hand completes (payout flight carries the story). */
function PotChipPile({ pot, bigBlind }: { pot: number; bigBlind: number }) {
  const n = potChipDiscCount(pot, bigBlind);
  const ring = 9;
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-[41%] -translate-x-1/2 -translate-y-1/2"
      style={{ width: "5rem", height: "4.25rem" }}
      aria-hidden
    >
      {Array.from({ length: n }, (_, i) => {
        const layer = Math.floor(i / ring);
        const slot = i % ring;
        const ang = (slot / ring) * Math.PI * 2 + layer * 0.4;
        const rad = 2.2 + layer * 2.6 + slot * 0.12;
        const x = Math.cos(ang) * rad;
        const y = Math.sin(ang) * rad * 0.58;
        return (
          <div
            key={i}
            className="absolute rounded-full border border-black/35 shadow-[0_1px_2px_rgba(0,0,0,0.45)]"
            style={{
              width: "clamp(7px,2.15vw,11px)",
              height: "clamp(7px,2.15vw,11px)",
              left: `calc(50% + ${x}px - clamp(3.5px,1.07vw,5.5px))`,
              top: `calc(50% + ${y}px - clamp(3.5px,1.07vw,5.5px))`,
              transform: `rotate(${layer * 9 + slot * 5}deg)`,
              background: `linear-gradient(145deg,hsl(${32 + (i % 8) * 5} 80% 54%),hsl(${32 + (i % 8) * 5} 86% 30%))`,
              zIndex: i,
            }}
          />
        );
      })}
    </div>
  );
}

function MiniCard({
  code,
  faceDown,
  className,
}: {
  code?: string;
  faceDown?: boolean;
  className?: string;
}) {
  const base =
    "poker-hole-deal-item flex h-9 w-6 shrink-0 items-center justify-center rounded border shadow";
  if (faceDown) {
    return (
      <div
        className={`${base} border-amber-600/60 bg-slate-900 text-[10px] text-amber-400 ${className ?? ""}`}
      >
        ♠
      </div>
    );
  }
  if (!code) return null;
  return (
    <div
      className={`${base} border-slate-400 bg-white text-[9px] font-bold ${
        isRedSuit(code) ? "text-rose-600" : "text-slate-900"
      } ${className ?? ""}`}
    >
      {formatCard(code)}
    </div>
  );
}

export type PokerTableSvgViewProps = {
  data: TableDetailApi;
  live: boolean;
  liveReady: boolean;
  sitPendingSeat: number | null;
  defaultRaiseTo: number;
  viewerUserId: string | null;
  bridge: PokerTableBridge;
};

export function PokerTableSvgView({
  data,
  live,
  liveReady,
  sitPendingSeat,
  defaultRaiseTo,
  viewerUserId,
  bridge,
}: PokerTableSvgViewProps) {
  const feltGradId = useId().replace(/:/g, "");
  const wrapRef = useRef<HTMLDivElement>(null);
  /** Latest table payload for deferred blind flights (holdem can lag one frame behind handSeq). */
  const tableDataRef = useRef(data);
  tableDataRef.current = data;
  const [dims, setDims] = useState({ width: 360, height: 520 });

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setDims({
        width: Math.max(200, Math.floor(r.width)),
        height: Math.max(280, Math.floor(r.height)),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const ui = useMemo(
    () =>
      buildPokerTableUiState(data, dims, {
        live,
        liveReady,
        sitPendingSeat,
        viewerUserId,
        defaultRaiseTo,
      }),
    [data, dims, live, liveReady, sitPendingSeat, viewerUserId, defaultRaiseTo],
  );

  const latestUiPotRef = useRef(ui.pot);
  latestUiPotRef.current = ui.pot;

  const [raiseOpen, setRaiseOpen] = useState(false);
  const [raiseMode, setRaiseMode] = useState<"raise_to" | "bet">("raise_to");
  const [raiseAmt, setRaiseAmt] = useState(ui.defaultRaiseTo);
  const [, setTimerTick] = useState(0);

  useEffect(() => {
    if (raiseOpen) return;
    setRaiseAmt((a) => {
      const next = ui.defaultRaiseTo;
      return Number.isFinite(next) ? next : a;
    });
  }, [ui.defaultRaiseTo, data.holdem?.handSeq, data.holdem?.toActSeat, raiseOpen]);

  useEffect(() => {
    if (!ui.turnDeadlineMs || ui.activeSeatIndex == null) return;
    const id = window.setInterval(() => setTimerTick((t) => t + 1), 120);
    return () => window.clearInterval(id);
  }, [ui.turnDeadlineMs, ui.activeSeatIndex]);

  const dispatch = useCallback(
    (a: PokerAllowedAction) => {
      if (!ui.useEngineActions) {
        if (a.id === "fold") bridge.onTableAction("fold");
        if (a.id === "check") bridge.onTableAction("check");
        return;
      }
      if (a.id === "fold") bridge.onEngineAction({ type: "fold" });
      if (a.id === "check") bridge.onEngineAction({ type: "check" });
      if (a.id === "call") bridge.onEngineAction({ type: "call" });
      if (a.id === "allin" && a.amount != null) bridge.onEngineAction({ type: "raise_to", amount: a.amount });
      if (a.id === "bet") {
        setRaiseMode("bet");
        setRaiseAmt(
          Math.min(
            Math.max(a.amount ?? ui.bigBlind, ui.raisePanelMin),
            ui.raisePanelMax,
          ),
        );
        setRaiseOpen(true);
        return;
      }
      if (a.id === "raise") {
        setRaiseMode("raise_to");
        setRaiseAmt(
          Math.min(
            Math.max(a.amount ?? ui.defaultRaiseTo, ui.raisePanelMin),
            ui.raisePanelMax,
          ),
        );
        setRaiseOpen(true);
      }
    },
    [bridge, ui],
  );

  const confirmRaise = useCallback(() => {
    const n = Math.min(
      ui.raisePanelMax,
      Math.max(ui.raisePanelMin, Math.floor(Number(raiseAmt)) || ui.raisePanelMin),
    );
    if (raiseMode === "bet") bridge.onEngineAction({ type: "bet", amount: n });
    else bridge.onEngineAction({ type: "raise_to", amount: n });
    setRaiseOpen(false);
  }, [bridge, raiseAmt, raiseMode, ui.raisePanelMax, ui.raisePanelMin]);

  const turnFrac =
    ui.turnDeadlineMs && ui.activeSeatIndex != null && ui.turnTimerTotalMs > 0
      ? Math.max(0, Math.min(1, (ui.turnDeadlineMs - Date.now()) / ui.turnTimerTotalMs))
      : 0;

  type ChipParticle = {
    id: string;
    from: { x: number; y: number };
    to: { x: number; y: number };
    staggerMs: number;
    hue: number;
  };

  const [chipParticles, setChipParticles] = useState<ChipParticle[]>([]);
  /** Chips shown in the center pile — only after they “arrive” from seats (not full server pot at hand start). */
  const [visualPotForPile, setVisualPotForPile] = useState(0);
  const prevStreetPutsRef = useRef<number[] | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const prevHandSeqRef = useRef<number | null>(null);
  const chipSeqRef = useRef(0);
  /** Prevents duplicate blind chip bursts when multiple deferred retries overlap. */
  const blindIntroDoneForHandSeqRef = useRef<number | null>(null);

  useEffect(() => {
    const handSeq = ui.handSeq;
    const phase = ui.phase;
    const seats = ui.seats;
    const n = ui.maxPlayers;
    const bb = Math.max(1, data.table.bigBlind);

    const pushBetBurst = (arr: ChipParticle[], from: { x: number; y: number }, betSize: number) => {
      const scale = betSize / bb;
      const count = Math.min(12, Math.max(3, Math.round(2 + Math.log2(scale + 1) * 2)));
      for (let k = 0; k < count; k++) {
        chipSeqRef.current += 1;
        const jitterX = (Math.random() - 0.5) * 0.035;
        const jitterY = (Math.random() - 0.5) * 0.035;
        arr.push({
          id: `bet-${chipSeqRef.current}-${k}-${arr.length}`,
          from: { x: from.x + jitterX * 0.4, y: from.y + jitterY * 0.4 },
          to: {
            x: POT_NORM.x + (Math.random() - 0.5) * 0.028,
            y: POT_NORM.y + (Math.random() - 0.5) * 0.022,
          },
          staggerMs: k * 26,
          hue: 36 + Math.floor(Math.random() * 22),
        });
      }
    };

    if (prevHandSeqRef.current !== handSeq) {
      const hadPriorHand = prevHandSeqRef.current !== null;
      prevHandSeqRef.current = handSeq;
      prevStreetPutsRef.current = seats.map((s) => s.streetPut);
      prevPhaseRef.current = phase;
      setVisualPotForPile(0);

      const nMax = Math.max(2, Math.min(9, data.table.maxPlayers));
      const attemptBlindFlights = (attempt: number) => {
        if (blindIntroDoneForHandSeqRef.current === handSeq) return;

        const d = tableDataRef.current;
        const h = d.holdem;

        if (attempt >= 15) {
          if (blindIntroDoneForHandSeqRef.current === handSeq) return;
          blindIntroDoneForHandSeqRef.current = handSeq;
          const h2 = tableDataRef.current.holdem;
          const pot =
            h2 && h2.handSeq === handSeq && h2.phase === "betting" ? h2.pot : latestUiPotRef.current;
          setVisualPotForPile(pot);
          return;
        }

        if (!h || h.handSeq !== handSeq || h.phase !== "betting") {
          window.setTimeout(() => attemptBlindFlights(attempt + 1), 45);
          return;
        }

        /** Join mid-hand (past preflop): show pot pile immediately — no blind replay. */
        if (!hadPriorHand && (h.board.length > 0 || h.street !== "preflop")) {
          blindIntroDoneForHandSeqRef.current = handSeq;
          setVisualPotForPile(h.pot);
          return;
        }

        const blindSpawn: ChipParticle[] = [];
        const sbPut = h.seats[String(h.sbSeat)]?.streetPut ?? 0;
        const bbPut = h.seats[String(h.bbSeat)]?.streetPut ?? 0;
        if (sbPut > 0) pushBetBurst(blindSpawn, seatNorm(h.sbSeat, nMax), sbPut);
        if (bbPut > 0) pushBetBurst(blindSpawn, seatNorm(h.bbSeat, nMax), bbPut);

        if (!blindSpawn.length) {
          window.setTimeout(() => attemptBlindFlights(attempt + 1), 45);
          return;
        }

        blindIntroDoneForHandSeqRef.current = handSeq;
        const potSnap = h.pot;
        setChipParticles((p) => [...p, ...blindSpawn]);
        const rm = new Set(blindSpawn.map((s) => s.id));
        window.setTimeout(() => setChipParticles((p) => p.filter((x) => !rm.has(x.id))), 680);
        window.setTimeout(() => setVisualPotForPile(potSnap), 520);
      };

      attemptBlindFlights(0);
      return;
    }

    if (prevStreetPutsRef.current === null) {
      prevStreetPutsRef.current = seats.map((s) => s.streetPut);
      prevPhaseRef.current = phase;
      return;
    }

    const prevStreet = prevStreetPutsRef.current;
    const prevPhase = prevPhaseRef.current;
    const spawned: ChipParticle[] = [];
    let addedToPot = 0;

    if (phase === "betting") {
      for (let i = 0; i < seats.length; i++) {
        const delta = seats[i]!.streetPut - (prevStreet[i] ?? 0);
        if (delta > 0 && seats[i]!.userId) {
          pushBetBurst(spawned, seatNorm(i, n), delta);
          addedToPot += delta;
        }
      }
    }

    if (phase === "complete" && prevPhase !== "complete" && ui.payouts && ui.payouts.length > 0) {
      setVisualPotForPile(0);
      const totalPay = ui.payouts.reduce((a, p) => a + p.amount, 0);
      for (const pay of ui.payouts) {
        const to = seatNorm(pay.seatIndex, n);
        const share = totalPay > 0 ? pay.amount / totalPay : 1 / ui.payouts.length;
        const scale = Math.max(1, pay.amount / bb);
        const count = Math.min(
          22,
          Math.max(5, Math.round((3 + Math.log2(scale + 1) * 2.5) * (0.55 + share))),
        );
        for (let k = 0; k < count; k++) {
          chipSeqRef.current += 1;
          spawned.push({
            id: `win-${chipSeqRef.current}-${pay.seatIndex}-${k}`,
            from: {
              x: POT_NORM.x + (Math.random() - 0.5) * 0.042,
              y: POT_NORM.y + (Math.random() - 0.5) * 0.032,
            },
            to: {
              x: to.x + (Math.random() - 0.5) * 0.048,
              y: to.y + (Math.random() - 0.5) * 0.048,
            },
            staggerMs: k * 20 + pay.seatIndex * 36,
            hue: 40 + (pay.seatIndex % 6) * 7,
          });
        }
      }
    }

    prevStreetPutsRef.current = seats.map((s) => s.streetPut);
    prevPhaseRef.current = phase;

    if (addedToPot > 0) {
      const snapPot = ui.pot;
      window.setTimeout(() => {
        setVisualPotForPile((v) => Math.min(v + addedToPot, snapPot));
      }, 520);
    }

    if (!spawned.length) return;

    const removeIds = new Set(spawned.map((s) => s.id));
    setChipParticles((prev) => [...prev, ...spawned]);
    window.setTimeout(() => {
      setChipParticles((prev) => prev.filter((p) => !removeIds.has(p.id)));
    }, 680);
  }, [
    ui.handSeq,
    ui.phase,
    ui.seats,
    ui.maxPlayers,
    ui.payouts,
    ui.pot,
    data.table.bigBlind,
    data.table.maxPlayers,
    data.holdem,
  ]);

  /** New community cards this street → staggered SVG deal animation. */
  const [boardDealFromIdx, setBoardDealFromIdx] = useState<number | null>(null);
  const prevBoardLenRef = useRef(0);
  const prevHandForBoardRef = useRef<number | null>(null);

  useEffect(() => {
    const hs = ui.handSeq;
    const b = ui.board;
    if (prevHandForBoardRef.current !== hs) {
      prevHandForBoardRef.current = hs;
      prevBoardLenRef.current = b.length;
      setBoardDealFromIdx(null);
      return;
    }
    if (b.length > prevBoardLenRef.current) {
      const from = prevBoardLenRef.current;
      prevBoardLenRef.current = b.length;
      setBoardDealFromIdx(from);
      const t = window.setTimeout(() => setBoardDealFromIdx(null), 900);
      return () => window.clearTimeout(t);
    }
    prevBoardLenRef.current = b.length;
  }, [ui.handSeq, ui.board]);

  /** Hero hole cards first appear this hand → HTML deal animation. */
  const [heroHolesDealing, setHeroHolesDealing] = useState(false);
  const dealtHeroHandRef = useRef<number | null>(null);

  useEffect(() => {
    const hs = ui.handSeq;
    if (hs == null) return;
    const idx = ui.viewerSeatIndex;
    if (idx == null) return;
    const hc = ui.seats[idx]?.holeCards;
    if (!hc?.[0] || !hc[1]) return;
    if (dealtHeroHandRef.current === hs) return;
    dealtHeroHandRef.current = hs;
    setHeroHolesDealing(true);
    const t = window.setTimeout(() => setHeroHolesDealing(false), 700);
    return () => window.clearTimeout(t);
  }, [ui.handSeq, ui.viewerSeatIndex, ui.seats]);

  const handResultOpen = ui.phase === "complete" && ui.payouts && ui.payouts.length > 0;
  const revealedRows = useMemo(
    () => ui.seats.filter((s) => s.revealedHoleCards && s.userId),
    [ui.seats],
  );

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden bg-[#140608] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      {/* Top bar */}
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-black/40 bg-black/50 px-2 py-2">
        <details className="relative">
          <summary className="cursor-pointer list-none rounded-full border border-amber-500/40 bg-zinc-950 px-3 py-2 text-xs font-semibold text-amber-100 [&::-webkit-details-marker]:hidden">
            Menu
          </summary>
          <div className="absolute left-0 top-10 z-20 w-44 rounded-xl border border-amber-500/25 bg-zinc-950/98 p-2 text-sm shadow-xl">
            <button
              type="button"
              className="block w-full rounded-lg px-2 py-2 text-left text-zinc-200 hover:bg-white/5"
              onClick={() => bridge.onNavigate("lobby")}
            >
              Lobby
            </button>
            <button
              type="button"
              className="block w-full rounded-lg px-2 py-2 text-left text-zinc-200 hover:bg-white/5"
              onClick={() => bridge.onNavigate("tables")}
            >
              All tables
            </button>
            <button
              type="button"
              className="block w-full rounded-lg px-2 py-2 text-left text-zinc-200 hover:bg-white/5"
              onClick={() => bridge.onNavigate("play")}
            >
              Practice
            </button>
            <button
              type="button"
              className="block w-full rounded-lg px-2 py-2 text-left text-zinc-200 hover:bg-white/5"
              onClick={() => bridge.onNavigate("settings")}
            >
              Settings
            </button>
            <button
              type="button"
              className="mt-1 block w-full rounded-lg px-2 py-2 text-left text-rose-300 hover:bg-rose-950/40"
              onClick={() => bridge.onCloseTable()}
            >
              Close table
            </button>
          </div>
        </details>
        <div className="min-w-0 flex-1 text-center text-[10px] leading-tight text-zinc-200">
          <div className="truncate font-semibold">{ui.tableName}</div>
          <div className="text-zinc-500">
            {ui.handSeq != null ? `Hand #${ui.handSeq}` : "—"} · {ui.blindsLabel}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span
            className={`rounded-full px-2 py-1 text-[9px] font-bold ${
              ui.liveReady ? "bg-emerald-950 text-emerald-200" : ui.live ? "bg-amber-950 text-amber-200" : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {ui.liveReady ? "Live" : ui.live ? "…" : "Off"}
          </span>
          <button
            type="button"
            onClick={() => bridge.onBack()}
            className="rounded-full border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-200"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => bridge.onLeave()}
            className="rounded-full border border-rose-500/50 bg-rose-950/80 px-2 py-1.5 text-xs font-semibold text-rose-100"
          >
            Leave
          </button>
        </div>
      </header>

      {ui.banner ? (
        <p className="shrink-0 bg-black/30 px-2 py-1 text-center text-[11px] text-amber-100/90">{ui.banner}</p>
      ) : null}

      {/* Table: fills space between header/footer; felt size scales with dvh/dvw + safe areas. */}
      <div className="flex min-h-0 min-w-0 flex-1 items-stretch justify-center px-0.5">
        <div
          ref={wrapRef}
          className="relative aspect-[10/16] h-full min-h-0 w-auto min-w-[180px] max-w-[min(96dvw,100%)] max-h-[min(calc(100dvh-10.25rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)),calc(96dvw*16/10))] self-center"
        >
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          <defs>
            <radialGradient id={`feltG-${feltGradId}`} cx="50%" cy="42%" r="72%">
              <stop offset="0%" stopColor="#0f5c3e" />
              <stop offset="100%" stopColor="#082f1f" />
            </radialGradient>
          </defs>
          {/* Vertical felt: taller oval, widened so it reads larger after slice scaling. */}
          <ellipse cx="50" cy="50" rx="34" ry="42" fill="#061a12" stroke="#b8860b" strokeWidth="0.35" opacity="0.9" />
          <ellipse
            cx="50"
            cy="50"
            rx="33"
            ry="41"
            fill={`url(#feltG-${feltGradId})`}
            stroke="#d4a84b"
            strokeWidth="0.25"
            opacity="0.95"
          />
          {/* Community cards */}
          <g transform="translate(50, 52)">
            {ui.board.map((code, idx) => {
              const w = 6.2;
              const gap = 1.8;
              const startX = (-(ui.board.length * w - (ui.board.length - 1) * gap)) / 2;
              const x = startX + idx * (w - gap);
              const red = isRedSuit(code);
              const dealing = boardDealFromIdx != null && idx >= boardDealFromIdx;
              const dealStart = boardDealFromIdx ?? 0;
              return (
                <g key={`${ui.handSeq ?? 0}-${idx}-${code}`} transform={`translate(${x}, ${-w * 0.65})`}>
                  <g
                    className={dealing ? "poker-board-card-deal" : undefined}
                    style={
                      dealing
                        ? ({
                            animationDelay: `${(idx - dealStart) * 88}ms`,
                          } as CSSProperties)
                        : undefined
                    }
                  >
                    <rect width={w} height={w * 1.35} rx="0.6" fill="#fdfcfa" stroke="#64748b" strokeWidth="0.15" />
                    <text
                      x={w / 2}
                      y={w * 0.72}
                      textAnchor="middle"
                      fontSize="2.4"
                      fontWeight="700"
                      fill={red ? "#dc2626" : "#0f172a"}
                    >
                      {formatCard(code)}
                    </text>
                  </g>
                </g>
              );
            })}
          </g>
          <text x="50" y="33" textAnchor="middle" fill="#fef3c7" fontSize="2.8" fontWeight="700">
            {`Pot $${ui.potDisplay.toLocaleString()}`}
          </text>
          <text x="50" y="29" textAnchor="middle" fill="#94a3b8" fontSize="2">
            {ui.streetLabel ?? ""}
          </text>
        </svg>

        <div className="pointer-events-none absolute inset-0 z-[4] overflow-visible" aria-hidden>
          <PotChipPile
            pot={ui.phase === "complete" ? 0 : Math.min(visualPotForPile, ui.pot)}
            bigBlind={data.table.bigBlind}
          />
        </div>

        <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden" aria-hidden>
          {chipParticles.map((c) => (
            <span
              key={c.id}
              className="poker-chip-flight"
              style={
                {
                  ["--from-x" as string]: `${c.from.x * 100}%`,
                  ["--from-y" as string]: `${c.from.y * 100}%`,
                  ["--to-x" as string]: `${c.to.x * 100}%`,
                  ["--to-y" as string]: `${c.to.y * 100}%`,
                  animationDelay: `${c.staggerMs}ms`,
                  background: `linear-gradient(180deg,hsl(${c.hue} 78% 52%),hsl(${c.hue} 85% 32%))`,
                } as CSSProperties
              }
            />
          ))}
        </div>

        {/* HTML seats */}
        {ui.seats.map((seat, idx) => {
          const p = seatNorm(idx, ui.maxPlayers);
          const isHero = ui.viewerSeatIndex === idx;
          const isAct = ui.activeSeatIndex === idx && ui.phase === "betting";
          const holes = seat.holeCards ?? seat.revealedHoleCards;
          const showBacks =
            seat.userId &&
            !seat.folded &&
            ui.showHoleBacksForOthers &&
            !isHero &&
            !holes;

          return (
            <div
              key={idx}
              className="absolute flex w-[min(28vw,7.5rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
              style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
            >
              <div
                className={`relative rounded-full border-2 p-0.5 ${
                  isAct ? "border-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.5)]" : ""
                } ${isHero ? "border-amber-400/90" : "border-slate-600/80"}`}
              >
                {isAct && ui.turnDeadlineMs ? (
                  <svg className="absolute inset-[-4px] h-[calc(100%+8px)] w-[calc(100%+8px)] -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      stroke="rgba(52,211,153,0.25)"
                      strokeWidth="3"
                    />
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
                  className={`flex h-11 w-11 items-center justify-center rounded-full text-[10px] font-bold ${
                    seat.userId ? (seat.folded ? "bg-slate-800/60 text-slate-500" : "bg-slate-700 text-zinc-100") : "bg-slate-900 text-zinc-500"
                  }`}
                >
                  {seat.userId ? seat.userId.slice(0, 2).toUpperCase() : idx + 1}
                </div>
              </div>
              <div className="max-w-full truncate text-center text-[9px] font-semibold text-zinc-200">
                {seat.userId ? (seat.userId.length > 12 ? `${seat.userId.slice(0, 11)}…` : seat.userId) : `Seat ${idx + 1}`}
              </div>
              {seat.stack != null ? (
                <div className="text-[9px] font-bold text-amber-200">${seat.stack.toLocaleString()}</div>
              ) : null}
              {seat.streetPut > 0 && seat.userId ? (
                <div className="text-[8px] text-sky-200">Bet ${seat.streetPut}</div>
              ) : null}
              <div
                className={`flex gap-0.5 ${
                  isHero && heroHolesDealing && holes ? "poker-hole-deal-wrap" : ""
                }`}
              >
                {holes ? (
                  <>
                    <MiniCard code={holes[0]} />
                    <MiniCard code={holes[1]} />
                  </>
                ) : showBacks ? (
                  <>
                    <MiniCard faceDown />
                    <MiniCard faceDown />
                  </>
                ) : null}
              </div>
              <div className="flex gap-0.5">
                {seat.isButton ? (
                  <span className="rounded bg-zinc-100 px-1 text-[8px] font-black text-zinc-900">D</span>
                ) : null}
                {seat.isSb ? <span className="rounded bg-sky-300 px-1 text-[8px] font-black text-zinc-900">SB</span> : null}
                {seat.isBb ? <span className="rounded bg-amber-300 px-1 text-[8px] font-black text-zinc-900">BB</span> : null}
                {seat.folded && seat.userId ? (
                  <span className="text-[8px] font-bold text-rose-300">FOLD</span>
                ) : null}
              </div>
              {!seat.userId && ui.live && ui.viewerSeatIndex === null ? (
                <button
                  type="button"
                  disabled={ui.sitPendingSeat !== null}
                  onClick={() => bridge.onSit(idx)}
                  className="mt-0.5 rounded-md bg-emerald-700 px-2 py-1 text-[10px] font-black text-white shadow active:scale-95 disabled:opacity-50"
                >
                  {ui.sitPendingSeat === idx ? "…" : "SIT"}
                </button>
              ) : null}
            </div>
          );
        })}

        {handResultOpen ? (
          <div
            className="pointer-events-none absolute inset-0 z-[25] flex items-center justify-center p-2 sm:p-4"
            role="status"
            aria-live="polite"
          >
            <div className="pointer-events-auto max-h-[72%] w-[min(22rem,92%)] overflow-y-auto rounded-2xl border border-emerald-500/45 bg-zinc-950/94 p-3 shadow-2xl backdrop-blur-md ring-1 ring-black/50">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300/95">
                Hand complete
              </p>
              {ui.payouts!.length > 1 ? (
                <p className="mt-1 text-center text-[9px] text-zinc-400">Split pot — same winning hand</p>
              ) : null}
              <div className="mt-2 space-y-1.5">
                {ui.payouts!.map((p) => (
                  <div
                    key={`${p.seatIndex}-${p.userId}-${p.amount}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-black/45 px-2.5 py-1.5 ring-1 ring-emerald-500/25"
                  >
                    <span className="min-w-0 truncate text-[11px] text-zinc-200">
                      <span className="font-bold text-emerald-200">Seat {p.seatIndex + 1}</span>
                      <span className="text-zinc-500"> · </span>
                      <span className="font-mono text-[10px] text-zinc-400">
                        {p.userId.length > 14 ? `${p.userId.slice(0, 13)}…` : p.userId}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-black text-amber-300 tabular-nums">
                      +${p.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              {viewerUserId && ui.payouts!.some((p) => p.userId === viewerUserId) ? (
                <p className="mt-2 text-center text-[11px] font-semibold text-amber-200/95">
                  You won{" "}
                  <span className="font-black text-amber-300 tabular-nums">
                    $
                    {ui
                      .payouts!.filter((p) => p.userId === viewerUserId)
                      .reduce((a, p) => a + p.amount, 0)
                      .toLocaleString()}
                  </span>
                </p>
              ) : null}
              {revealedRows.length > 0 ? (
                <div className="mt-3 border-t border-emerald-800/40 pt-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">Shown at showdown</p>
                  <div className="mt-1.5 space-y-2">
                    {revealedRows.map((s) => (
                      <div key={s.seatIndex} className="flex items-center justify-between gap-2">
                        <span className="truncate text-[10px] text-zinc-400">
                          Seat {s.seatIndex + 1}
                          <span className="text-zinc-600"> · </span>
                          {s.userId && s.userId.length > 12 ? `${s.userId.slice(0, 11)}…` : s.userId}
                        </span>
                        <div className="flex shrink-0 gap-0.5">
                          <MiniCard code={s.revealedHoleCards![0]} />
                          <MiniCard code={s.revealedHoleCards![1]} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
        </div>
      </div>

      {/* Action bar */}
      <footer className="shrink-0 border-t border-black/50 bg-black/60 px-2 py-2">
        {ui.allowedActions.length > 0 ? (
          <div className="mx-auto flex max-w-lg flex-wrap justify-center gap-2">
            {ui.allowedActions.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => dispatch(a)}
                className={`min-h-[48px] min-w-[5.5rem] rounded-xl px-3 py-2 text-sm font-black text-white shadow-lg active:scale-[0.98] ${
                  a.id === "fold"
                    ? "bg-gradient-to-b from-rose-600 to-rose-900"
                    : a.id === "check" || a.id === "call"
                      ? "bg-gradient-to-b from-emerald-600 to-emerald-900"
                      : "bg-gradient-to-b from-sky-600 to-sky-900"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="py-3 text-center text-[11px] text-zinc-500">
            {!ui.live && ui.viewerSeatIndex !== null
              ? "Offline — set NEXT_PUBLIC_API_URL for live play"
              : ui.live && !ui.liveReady && ui.viewerSeatIndex !== null
                ? "Connecting to live table…"
                : "\u00a0"}
          </p>
        )}
      </footer>

      {/* Raise / bet sheet */}
      {raiseOpen ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-amber-500/30 bg-zinc-950/98 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
          <div className="mx-auto max-w-lg space-y-3">
            <p className="text-center text-sm font-bold text-amber-100">
              {raiseMode === "bet" ? "Bet amount" : "Raise to"}
            </p>
            <input
              type="number"
              className="w-full rounded-lg border border-white/15 bg-black/70 px-3 py-2 text-right font-mono text-lg text-zinc-100"
              value={raiseAmt}
              onChange={(e) => setRaiseAmt(Number(e.target.value))}
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-lg bg-zinc-800 py-2 text-xs font-bold text-zinc-200"
                onClick={() => setRaiseAmt(ui.raisePanelMin)}
              >
                Min
              </button>
              <button
                type="button"
                className="rounded-lg bg-zinc-800 py-2 text-xs font-bold text-zinc-200"
                onClick={() =>
                  setRaiseAmt(
                    Math.min(ui.raisePanelMax, Math.max(ui.raisePanelMin, Math.floor(ui.pot / 2))),
                  )
                }
              >
                ½ Pot
              </button>
              <button
                type="button"
                className="rounded-lg bg-zinc-800 py-2 text-xs font-bold text-zinc-200"
                onClick={() =>
                  setRaiseAmt(Math.min(ui.raisePanelMax, Math.max(ui.raisePanelMin, ui.pot)))
                }
              >
                Pot
              </button>
              <button
                type="button"
                className="rounded-lg bg-zinc-800 py-2 text-xs font-bold text-zinc-200"
                onClick={() => {
                  const my = ui.viewerSeatIndex != null ? ui.seats[ui.viewerSeatIndex] : null;
                  if (my?.stack != null) {
                    const v = my.stack + (my.streetPut ?? 0);
                    setRaiseAmt(Math.min(ui.raisePanelMax, Math.max(ui.raisePanelMin, v)));
                  }
                }}
              >
                All-in
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="flex-1 rounded-xl bg-amber-500 py-3 text-sm font-black text-zinc-950"
                onClick={confirmRaise}
              >
                {raiseMode === "bet" ? "Confirm bet" : "Confirm raise"}
              </button>
              <button
                type="button"
                className="flex-1 rounded-xl border border-zinc-600 py-3 text-sm font-semibold text-zinc-300"
                onClick={() => setRaiseOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
