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
import { formatCard, isRedSuit } from "@/features/tables/poker-mini-card";
import { PokerRaisePanel } from "@/features/tables/poker-raise-panel";
import {
  IconChipMeta,
  IconCloseTable,
  IconLeaveSeat,
  IconLiveDot,
  IconLobby,
  IconPlayingCards,
  IconSettings,
  IconTableBack,
  IconTableMenu,
  IconTablesGrid,
  IconWallet,
} from "@/features/tables/poker-table-header-icons";
import type { PokerAllowedAction, PokerTableBridge } from "@/features/tables/poker-table-ui-types";
import { PokerSeatHud } from "@/features/tables/poker-seat-hud";
import type { TableDetailApi } from "@/lib/lobby/api-tables";
import { hapticYourTurn } from "@/lib/table/table-haptics";
import {
  playBoardStreet,
  playChipsToPot,
  playFold,
  playHeroHoleDeal,
  playPotToWinners,
  playYourTurn,
  resumeTableAudio,
} from "@/lib/table/table-sounds";

/** Chip animation target: pot center in normalized table coords (vertical pill felt). */
const POT_NORM = { x: 0.5, y: 0.43 } as const;

/** Must match `poker-chip-fly` duration in globals.css */
const CHIP_FLIGHT_MS = 520;
/** Extra time after the last chip lands before the outcome ticker appears (read pot / breathe). */
const PAYOUT_RESULT_AFTER_CHIPS_MS = 380;

/**
 * Portrait 6-max: seats hug the felt rail (reference apps keep avatars tight to the oval).
 */
const LAYOUT_6: { x: number; y: number }[] = [
  { x: 0.5, y: 0.84 },
  { x: 0.075, y: 0.695 },
  { x: 0.075, y: 0.305 },
  { x: 0.5, y: 0.145 },
  { x: 0.925, y: 0.305 },
  { x: 0.925, y: 0.695 },
];

function seatNorm(i: number, n: number): { x: number; y: number } {
  if (n === 6 && i < 6) return LAYOUT_6[i]!;
  const cx = 0.5;
  const cy = 0.5;
  const rx = 0.37;
  const ry = 0.41;
  const ang = -Math.PI / 2 + (i * (2 * Math.PI)) / Math.max(n, 1);
  return {
    x: cx + Math.cos(ang) * rx * 0.98,
    y: cy + Math.sin(ang) * ry * 0.98,
  };
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
      className="pointer-events-none absolute left-1/2 top-[43%] -translate-x-1/2 -translate-y-1/2"
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
  const tableMenuRef = useRef<HTMLDetailsElement>(null);
  /** Latest table payload for deferred blind flights (holdem can lag one frame behind handSeq). */
  const tableDataRef = useRef(data);
  tableDataRef.current = data;
  const [dims, setDims] = useState({ width: 360, height: 520 });

  useEffect(() => {
    const unlock = () => {
      resumeTableAudio();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

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
      if (a.id === "fold") playFold();
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

  const closeTableMenu = useCallback(() => {
    tableMenuRef.current?.removeAttribute("open");
  }, []);

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
  /** Hand outcome ticker — only after pot→seat chip flights finish (see payout reveal timer). */
  const [payoutSummaryVisible, setPayoutSummaryVisible] = useState(false);
  const prevStreetPutsRef = useRef<number[] | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const prevHandSeqRef = useRef<number | null>(null);
  const chipSeqRef = useRef(0);
  /** Prevents duplicate blind chip bursts when multiple deferred retries overlap. */
  const blindIntroDoneForHandSeqRef = useRef<number | null>(null);
  const payoutRevealTimerRef = useRef<number | null>(null);
  /** True once we schedule delayed reveal for this hand’s payout chip run (fallback skips). */
  const payoutRevealScheduledRef = useRef(false);

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
      if (payoutRevealTimerRef.current != null) {
        window.clearTimeout(payoutRevealTimerRef.current);
        payoutRevealTimerRef.current = null;
      }
      payoutRevealScheduledRef.current = false;
      setPayoutSummaryVisible(false);
      const hadPriorHand = prevHandSeqRef.current !== null;
      prevHandSeqRef.current = handSeq;
      /** Prefer engine street chips so baseline matches blinds before UI catches up (fixes first actor chip flight). */
      const hInit = tableDataRef.current.holdem;
      if (
        handSeq != null &&
        hInit &&
        hInit.handSeq === handSeq &&
        hInit.phase === "betting"
      ) {
        prevStreetPutsRef.current = Array.from({ length: seats.length }, (_, i) => {
          return hInit.seats[String(i)]?.streetPut ?? 0;
        });
      } else {
        prevStreetPutsRef.current = seats.map((s) => s.streetPut);
      }
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

    if (phase !== "complete") {
      if (payoutRevealTimerRef.current != null) {
        window.clearTimeout(payoutRevealTimerRef.current);
        payoutRevealTimerRef.current = null;
      }
      payoutRevealScheduledRef.current = false;
      setPayoutSummaryVisible(false);
    }

    if (prevStreetPutsRef.current === null) {
      prevStreetPutsRef.current = seats.map((s) => s.streetPut);
      prevPhaseRef.current = phase;
      return;
    }

    /**
     * If we started the hand with streetPut baseline 0 (UI lag) but blinds were already animated,
     * align baseline to SB+BB only — so the first voluntary bet (e.g. UTG call) still produces a
     * positive delta and chip flight to the pot without duplicating blind bursts.
     */
    let prevStreet = prevStreetPutsRef.current;
    if (
      phase === "betting" &&
      handSeq != null &&
      data.holdem?.handSeq === handSeq &&
      data.holdem.phase === "betting" &&
      data.holdem.street === "preflop"
    ) {
      const eng = data.holdem;
      const synced = Array.from({ length: n }, (_, i) => eng.seats[String(i)]?.streetPut ?? 0);
      const prevSum = prevStreet.reduce((a, b) => a + b, 0);
      const engSum = synced.reduce((a, b) => a + b, 0);
      const seatsSum = seats.reduce((a, s) => a + s.streetPut, 0);
      const blindTotal =
        (eng.seats[String(eng.sbSeat)]?.streetPut ?? 0) +
        (eng.seats[String(eng.bbSeat)]?.streetPut ?? 0);
      if (
        prevSum === 0 &&
        engSum > 0 &&
        engSum === blindTotal &&
        seatsSum === engSum &&
        blindIntroDoneForHandSeqRef.current === handSeq
      ) {
        prevStreetPutsRef.current = [...synced];
        prevStreet = prevStreetPutsRef.current;
      }
    }

    const prevPhase = prevPhaseRef.current;
    const spawned: ChipParticle[] = [];
    let payoutChipSpawn = false;
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
      payoutChipSpawn = true;
      playPotToWinners();
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
      playChipsToPot();
      const snapPot = ui.pot;
      window.setTimeout(() => {
        setVisualPotForPile((v) => Math.min(v + addedToPot, snapPot));
      }, 520);
    }

    if (!spawned.length) return;

    const removeIds = new Set(spawned.map((s) => s.id));
    const maxStagger = spawned.reduce((m, p) => Math.max(m, p.staggerMs), 0);
    const removeAfterMs = payoutChipSpawn ? maxStagger + CHIP_FLIGHT_MS + 120 : 680;

    setChipParticles((prev) => [...prev, ...spawned]);
    window.setTimeout(() => {
      setChipParticles((prev) => prev.filter((p) => !removeIds.has(p.id)));
    }, removeAfterMs);

    if (payoutChipSpawn) {
      payoutRevealScheduledRef.current = true;
      if (payoutRevealTimerRef.current != null) {
        window.clearTimeout(payoutRevealTimerRef.current);
      }
      const delayMs = maxStagger + CHIP_FLIGHT_MS + PAYOUT_RESULT_AFTER_CHIPS_MS;
      payoutRevealTimerRef.current = window.setTimeout(() => {
        payoutRevealTimerRef.current = null;
        payoutRevealScheduledRef.current = false;
        setPayoutSummaryVisible(true);
      }, delayMs);
    }
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

  useEffect(() => {
    return () => {
      if (payoutRevealTimerRef.current != null) {
        window.clearTimeout(payoutRevealTimerRef.current);
        payoutRevealTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Open outcome ticker immediately when we’re already on a completed hand but no payout chip burst ran
   * (e.g. first paint on table detail). When chips did run, `payoutRevealScheduledRef` blocks this.
   */
  useEffect(() => {
    const ok = ui.phase === "complete" && ui.payouts && ui.payouts.length > 0;
    if (!ok) return;
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        if (payoutRevealScheduledRef.current) return;
        setPayoutSummaryVisible(true);
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      window.cancelAnimationFrame(raf2);
    };
  }, [ui.phase, ui.handSeq, ui.payouts]);

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

  useEffect(() => {
    if (boardDealFromIdx != null) {
      playBoardStreet();
    }
  }, [boardDealFromIdx]);

  const prevHeroDealingSound = useRef(false);
  useEffect(() => {
    if (heroHolesDealing && !prevHeroDealingSound.current) {
      playHeroHoleDeal();
    }
    prevHeroDealingSound.current = heroHolesDealing;
  }, [heroHolesDealing]);

  const wasViewerTurnRef = useRef(false);
  useEffect(() => {
    const on = ui.isViewerTurn && ui.phase === "betting";
    if (on && !wasViewerTurnRef.current) {
      hapticYourTurn();
      playYourTurn();
    }
    wasViewerTurnRef.current = on;
  }, [ui.isViewerTurn, ui.phase]);

  const handResultOpen =
    ui.phase === "complete" && ui.payouts && ui.payouts.length > 0 && payoutSummaryVisible;

  const viewerPayoutTotal = useMemo(() => {
    if (!viewerUserId || !ui.payouts?.length) return 0;
    return ui.payouts.filter((p) => p.userId === viewerUserId).reduce((a, p) => a + p.amount, 0);
  }, [viewerUserId, ui.payouts]);

  return (
    <div className="relative h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] overflow-hidden bg-gradient-to-b from-[#1a0c10] via-[#120608] to-[#0a0406]">
      {/* Full-screen felt tint behind the oval */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_70%_at_50%_42%,rgba(22,120,72,0.22),transparent_65%)]"
        aria-hidden
      />

      {/* Centered oval table — padded so seats aren’t hidden under overlay chrome */}
      <div className="absolute inset-0 z-10 flex flex-col pt-[calc(3.25rem+env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <div className="flex min-h-0 flex-1 items-center justify-center px-1">
          <div
            ref={wrapRef}
            className="relative mx-auto max-h-full shrink-0"
            style={{
              width:
                "min(calc(100dvw - max(6px, env(safe-area-inset-left) + env(safe-area-inset-right))), calc(100% - 2px), calc((100dvh - 9.25rem - env(safe-area-inset-top) - env(safe-area-inset-bottom)) * 13 / 20))",
              aspectRatio: "13 / 20",
              height: "auto",
              maxWidth: "100%",
            }}
          >
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 65 100"
              preserveAspectRatio="xMidYMid meet"
              aria-hidden
            >
              <defs>
                <radialGradient id={`feltG-${feltGradId}`} cx="50%" cy="40%" r="78%">
                  <stop offset="0%" stopColor="#158050" />
                  <stop offset="55%" stopColor="#0d5a38" />
                  <stop offset="100%" stopColor="#052818" />
                </radialGradient>
              </defs>
              {/*
                ViewBox 65×100 = 13:20 wide pill. Rail/felt use legacy proportions (×0.65 on x only).
                Labels and board cards stay in true user space so glyphs and card aspect are not squashed.
              */}
              {/* Cushioned outer rail (dark “bumper”) — vertical pill. */}
                <ellipse cx="32.5" cy="50" rx="24.7" ry="48.5" fill="#141416" stroke="#0a0a0b" strokeWidth="0.45" />
                <ellipse cx="32.5" cy="50" rx="23.53" ry="47" fill="#1c1c1f" stroke="#2a2a2e" strokeWidth="0.2" />
                {/* Inner felt oval + subtle inner ring (reference: green + thin inset line). */}
                <ellipse
                  cx="32.5"
                  cy="50"
                  rx="20.28"
                  ry="44.2"
                  fill={`url(#feltG-${feltGradId})`}
                  stroke="#0a3220"
                  strokeWidth="0.22"
                />
                <ellipse
                  cx="32.5"
                  cy="50"
                  rx="19.175"
                  ry="42.6"
                  fill="none"
                  stroke="#2d6b48"
                  strokeWidth="0.12"
                  opacity="0.85"
                />
                <text x="32.5" y="24.5" textAnchor="middle" fill="#94a3b8" fontSize="1.85">
                  {ui.streetLabel ?? ""}
                </text>
                <text x="32.5" y="29" textAnchor="middle" fill="#cbd5e1" fontSize="2.15" fontWeight="600">
                  Pot Amt.
                </text>
                <text x="32.5" y="33.5" textAnchor="middle" fill="#fef9c3" fontSize="2.85" fontWeight="800">
                  {`💰 $${ui.potDisplay.toLocaleString()}`}
                </text>
                {/* Community cards (above pot line in paint order = visually on felt below labels). */}
                <g transform="translate(32.5, 53.5)">
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
              return (
                <PokerSeatHud
                  key={idx}
                  seatIndex={idx}
                  norm={p}
                  seat={seat}
                  isHero={isHero}
                  isAct={isAct}
                  turnFrac={turnFrac}
                  heroHolesDealing={heroHolesDealing}
                  showHoleBacksForOthers={ui.showHoleBacksForOthers}
                  live={ui.live}
                  viewerSeatIndex={ui.viewerSeatIndex}
                  sitPendingSeat={sitPendingSeat}
                  bridge={bridge}
                />
              );
            })}

            {handResultOpen ? (
              <div
                className="pointer-events-none absolute inset-x-0 bottom-[10%] z-[20] flex justify-center px-2 sm:bottom-[11%]"
                role="status"
                aria-live="polite"
                aria-label="Hand result"
              >
                <div className="poker-hand-outcome-ticker pointer-events-none w-full max-w-[min(24rem,96%)]">
                  <div
                  className={`rounded-xl border px-3 py-2 shadow-[0_12px_40px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md sm:px-4 sm:py-2.5 ${
                    viewerPayoutTotal > 0
                      ? "poker-hand-outcome-ticker--hero-win border-emerald-500/35 bg-gradient-to-b from-emerald-950/88 via-zinc-950/90 to-black/90"
                      : "border-amber-500/[0.22] bg-gradient-to-b from-zinc-950/92 via-zinc-950/88 to-black/90"
                  }`}
                >
                    <p className="text-center text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                      Pot awarded
                    </p>
                    {ui.payouts!.length === 1 ? (
                      <p className="mt-1 text-center text-[13px] font-semibold leading-snug tracking-tight text-zinc-100 sm:text-sm">
                        <span className="text-amber-200/95">Seat {ui.payouts![0]!.seatIndex + 1}</span>
                        <span className="text-zinc-500"> wins </span>
                        <span className="tabular-nums text-amber-300">
                          ${ui.payouts![0]!.amount.toLocaleString()}
                        </span>
                      </p>
                    ) : (
                      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[12px] font-medium leading-snug text-zinc-200 sm:text-[13px]">
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-amber-200/90">
                          Split pot
                        </span>
                        {ui.payouts!.map((p, i) => (
                          <span key={`${p.seatIndex}-${p.userId}`} className="inline-flex items-center gap-1 tabular-nums">
                            {i > 0 ? <span className="text-zinc-600" aria-hidden>·</span> : null}
                            <span className="text-zinc-400">Seat {p.seatIndex + 1}</span>
                            <span className="font-semibold text-amber-300">${p.amount.toLocaleString()}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {viewerPayoutTotal > 0 ? (
                      <p className="mt-1.5 border-t border-white/[0.06] pt-1.5 text-center text-[11px] font-medium text-amber-100/95">
                        You collected{" "}
                        <span className="font-bold tabular-nums text-amber-300">
                          ${viewerPayoutTotal.toLocaleString()}
                        </span>
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Menu / table title — overlaid on top of full-screen table */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-50 pt-[env(safe-area-inset-top)]">
        <header className="pointer-events-auto flex items-center justify-between gap-2 border-b border-white/10 bg-black/50 px-2 py-2 backdrop-blur-md">
          <details ref={tableMenuRef} className="relative">
            <summary className="flex min-h-[44px] min-w-[44px] cursor-pointer list-none items-center justify-center rounded-full border border-amber-500/35 bg-zinc-950/95 text-amber-100 shadow-md transition hover:border-amber-400/55 hover:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400/60 [&::-webkit-details-marker]:hidden">
              <span className="sr-only">Table menu</span>
              <IconTableMenu className="h-5 w-5" strokeWidth={2} />
            </summary>
            <div className="absolute left-0 top-11 z-[60] w-52 rounded-xl border border-amber-500/20 bg-zinc-950/[0.98] p-1.5 shadow-[0_16px_48px_rgba(0,0,0,0.55)] ring-1 ring-black/40">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-zinc-100 transition hover:bg-white/[0.06]"
                onClick={() => {
                  closeTableMenu();
                  bridge.onNavigate("lobby");
                }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-900/90 text-amber-400/95">
                  <IconLobby className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 font-medium leading-tight">Lobby</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-zinc-100 transition hover:bg-white/[0.06]"
                onClick={() => {
                  closeTableMenu();
                  bridge.onNavigate("tables");
                }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-900/90 text-amber-400/95">
                  <IconTablesGrid className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 font-medium leading-tight">All tables</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-zinc-100 transition hover:bg-white/[0.06]"
                onClick={() => {
                  closeTableMenu();
                  bridge.onNavigate("wallet");
                }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-900/90 text-violet-300/95">
                  <IconWallet className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 font-medium leading-tight">Wallet</span>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-zinc-100 transition hover:bg-white/[0.06]"
                onClick={() => {
                  closeTableMenu();
                  bridge.onNavigate("settings");
                }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-900/90 text-zinc-300">
                  <IconSettings className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 font-medium leading-tight">Settings</span>
              </button>
              <div className="my-1 h-px bg-white/[0.08]" />
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm text-rose-200 transition hover:bg-rose-950/45"
                onClick={() => {
                  closeTableMenu();
                  bridge.onCloseTable();
                }}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-500/35 bg-rose-950/50 text-rose-300">
                  <IconCloseTable className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 font-semibold leading-tight">Close table</span>
              </button>
            </div>
          </details>
          <div className="min-w-0 flex-1 px-1 text-center text-[10px] leading-tight text-zinc-200">
            <div className="flex items-center justify-center gap-1.5 truncate">
              <IconPlayingCards className="h-3.5 w-3.5 shrink-0 text-amber-400/90" aria-hidden />
              <span className="truncate font-semibold tracking-tight">{ui.tableName}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-center gap-1.5 text-zinc-500">
              <IconChipMeta className="h-3 w-3 shrink-0 text-zinc-500" aria-hidden />
              <span className="tabular-nums">
                {ui.handSeq != null ? `Hand #${ui.handSeq}` : "—"} · {ui.blindsLabel}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1.5 text-[9px] font-bold tracking-wide ${ui.liveReady
                  ? "border-emerald-500/30 bg-emerald-950/85 text-emerald-100"
                  : ui.live
                    ? "border-amber-500/25 bg-amber-950/80 text-amber-100"
                    : "border-zinc-600/50 bg-zinc-900/90 text-zinc-400"
                }`}
            >
              <IconLiveDot live={ui.liveReady} connecting={ui.live && !ui.liveReady} />
              {ui.liveReady ? "Live" : ui.live ? "…" : "Off"}
            </span>
            <button
              type="button"
              onClick={() => bridge.onBack()}
              aria-label="Back to tables"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-zinc-600/70 bg-zinc-900/95 text-zinc-100 shadow-sm transition hover:border-zinc-500 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400"
            >
              <IconTableBack className="h-5 w-5" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={() => bridge.onLeave()}
              className="flex min-h-[44px] items-center gap-1.5 rounded-full border border-rose-500/45 bg-gradient-to-b from-rose-900/95 to-rose-950/95 px-3 pl-2.5 text-rose-50 shadow-sm transition hover:border-rose-400/60 hover:from-rose-800/95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-400/70"
            >
              <IconLeaveSeat className="h-[18px] w-[18px] shrink-0 text-rose-100" strokeWidth={2} />
              <span className="pr-0.5 text-[11px] font-bold tracking-wide">Leave</span>
            </button>
          </div>
        </header>
        {/* {ui.banner ? (
          <p className="pointer-events-auto border-b border-white/5 bg-black/35 px-2 py-1 text-center text-[11px] text-amber-100/90 backdrop-blur-sm">
            {ui.banner}
          </p>
        ) : null} */}
      </div>

      {/* Action bar — overlaid on bottom of full-screen table */}
      <footer className="pointer-events-none absolute bottom-0 left-0 right-0 z-40 px-2 pt-3 pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto mx-auto max-w-lg">
          {ui.allowedActions.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-2">
              {ui.allowedActions.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => dispatch(a)}
                  className={`min-h-[48px] min-w-[5.5rem] rounded-xl px-3 py-2 text-sm font-black text-white shadow-lg active:scale-[0.98] ${a.id === "fold"
                      ? "bg-gradient-to-b from-rose-600 to-rose-900"
                      : a.id === "check" || a.id === "call"
                        ? "bg-gradient-to-b from-emerald-600 to-emerald-900"
                        : "bg-gradient-to-b from-cyan-500 to-sky-800"
                    }`}
                >
                  {a.id === "raise" || a.id === "bet" ? (
                    <span className="flex flex-col items-center justify-center gap-0.5 leading-none">
                      <span>{a.label}</span>
                      <span className="text-[11px] font-bold text-white/85" aria-hidden>
                        ▾
                      </span>
                    </span>
                  ) : (
                    a.label
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="py-2 text-center text-[11px] text-zinc-400">
              {!ui.live && ui.viewerSeatIndex !== null
                ? "Live play unavailable — check connection"
                : ui.live && !ui.liveReady && ui.viewerSeatIndex !== null
                  ? "Connecting to live table…"
                  : "\u00a0"}
            </p>
          )}
        </div>
      </footer>

      {/* Raise / bet panel — vertical presets + slider (reference: mobile club apps) */}
      {raiseOpen ? (
        <PokerRaisePanel
          mode={raiseMode}
          amount={raiseAmt}
          onAmountChange={(n) => setRaiseAmt(n)}
          onConfirm={confirmRaise}
          onClose={() => setRaiseOpen(false)}
          raisePanelMin={ui.raisePanelMin}
          raisePanelMax={ui.raisePanelMax}
          pot={ui.pot}
          callAmount={ui.callAmount}
          committed={
            ui.viewerSeatIndex != null ? (ui.seats[ui.viewerSeatIndex]?.streetPut ?? 0) : 0
          }
          bigBlind={ui.bigBlind}
        />
      ) : null}
    </div>
  );
}
