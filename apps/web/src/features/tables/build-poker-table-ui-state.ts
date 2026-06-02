import type { TableDetailApi } from "@/lib/lobby/api-tables";
import type { PokerAllowedAction, PokerSeatUi, PokerTableUiState } from "./poker-table-ui-types";

function streetLabel(street: string): string {
  const m: Record<string, string> = {
    preflop: "Pre-flop",
    flop: "Flop",
    turn: "Turn",
    river: "River",
    showdown: "Showdown",
  };
  return m[street] ?? street;
}

export function buildPokerTableUiState(
  data: TableDetailApi,
  dims: { width: number; height: number },
  opts: {
    live: boolean;
    liveReady: boolean;
    sitPendingSeat: number | null;
    viewerUserId: string | null;
    defaultRaiseTo: number;
  },
): PokerTableUiState {
  const { table, seats, viewerSeatIndex, actionTurn: turn, holdem, viewerHoleCards } = data;
  const n = Math.max(2, Math.min(9, table.maxPlayers));

  const seatUis: PokerSeatUi[] = [];
  for (let i = 0; i < n; i++) {
    const row = seats.find((s) => s.seatIndex === i);
    const uid = row?.userId ?? null;
    const h = holdem?.seats[String(i)];
    const rev = holdem?.revealedHoles?.[String(i)] as [string, string] | undefined;
    /** Seated but not in engine hand (e.g. busted / sitting out) → show 0; server also sends shell rows. */
    const stack = h != null ? h.stack : uid != null && holdem != null ? 0 : null;
    seatUis.push({
      seatIndex: i,
      userId: uid,
      stack,
      streetPut: h?.streetPut ?? 0,
      folded: h?.folded ?? false,
      isButton: holdem ? holdem.buttonSeat === i : false,
      isSb: holdem ? holdem.sbSeat === i : false,
      isBb: holdem ? holdem.bbSeat === i : false,
      holeCards:
        viewerSeatIndex === i && viewerHoleCards ? ([...viewerHoleCards] as [string, string]) : null,
      revealedHoleCards: rev ? [...rev] as [string, string] : null,
    });
  }

  const holdemBetting = holdem?.phase === "betting";
  const useEngineActions = Boolean(holdemBetting);

  const mySeat = viewerSeatIndex !== null && holdem ? holdem.seats[String(viewerSeatIndex)] : null;
  const maxB = holdem ? holdem.maxStreetBet : 0;
  const callAmount =
    mySeat && holdem ? Math.max(0, maxB - mySeat.streetPut) : 0;

  /** Prefer engine `toActSeat` so UI matches server (stale `actionTurn` broke all-in runouts). */
  const engineActSeat =
    holdem && holdem.phase === "betting" && holdem.toActSeat != null ? holdem.toActSeat : null;
  const activeSeatIndex =
    engineActSeat != null ? engineActSeat : holdem == null ? turn.actionSeatIndex : null;
  const facingBet =
    holdem && holdem.phase === "betting" && viewerSeatIndex !== null
      ? callAmount > 0
      : turn.facingBet;

  const isViewerTurn =
    viewerSeatIndex !== null &&
    table.players >= 2 &&
    (engineActSeat != null
      ? engineActSeat === viewerSeatIndex
      : holdem == null &&
        turn.actionSeatIndex !== null &&
        turn.actionSeatIndex === viewerSeatIndex);

  const capStack = mySeat ? mySeat.streetPut + mySeat.stack : table.bigBlind;
  let raisePanelMin = Math.max(table.bigBlind, 1);
  let raisePanelMax = Math.max(capStack, raisePanelMin);
  if (holdem && mySeat) {
    raisePanelMax = capStack;
    if (maxB === 0) {
      raisePanelMin = Math.max(table.bigBlind, 1);
    } else {
      raisePanelMin = Math.max(maxB + holdem.minRaise, mySeat.streetPut + 1, table.bigBlind);
    }
    raisePanelMin = Math.min(raisePanelMin, raisePanelMax);
  }

  /** Engine + socket actions only work when the table socket is connected (see useTableSocket). */
  const socketReady = opts.live && opts.liveReady;

  const allowed: PokerAllowedAction[] = [];
  if (socketReady && isViewerTurn && holdem && useEngineActions) {
    allowed.push({ id: "fold", label: "Fold" });
    if (!facingBet) {
      allowed.push({ id: "check", label: "Check" });
      if (holdem.maxStreetBet === 0 && mySeat && mySeat.stack > 0) {
        allowed.push({
          id: "bet",
          label: `Bet ${table.bigBlind}`,
          amount: Math.max(table.bigBlind, 1),
        });
      }
    } else {
      if (callAmount > 0 && mySeat && mySeat.stack >= callAmount) {
        allowed.push({ id: "call", label: `Call ${callAmount.toLocaleString()}`, amount: callAmount });
      }
      if (holdem.minRaise > 0 && mySeat) {
        const cap = mySeat.streetPut + mySeat.stack;
        const minTo = Math.max(
          holdem.maxStreetBet + holdem.minRaise,
          mySeat.streetPut + 1,
        );
        if (minTo <= cap) {
          allowed.push({
            id: "raise",
            label: "Raise",
            amount: Math.min(opts.defaultRaiseTo, cap),
          });
        }
      }
      if (mySeat && callAmount > 0 && mySeat.stack > 0) {
        const allTo = mySeat.streetPut + mySeat.stack;
        if (allTo > maxB) {
          allowed.push({ id: "allin", label: "All-in", amount: allTo });
        }
      }
    }
  } else if (socketReady && isViewerTurn && !useEngineActions) {
    allowed.push({ id: "fold", label: "Fold" });
    if (!facingBet) allowed.push({ id: "check", label: "Check" });
  }

  let banner: string | null = null;
  if (!holdem) banner = "Waiting for next hand";
  else if (table.players < 2) banner = "Waiting for players";
  else if (isViewerTurn && opts.live && !opts.liveReady && holdem && useEngineActions) {
    banner = "Connecting to live table…";
  } else if (isViewerTurn && socketReady) banner = "Your turn";
  else if (activeSeatIndex !== null && table.players >= 2)
    banner = `Seat ${activeSeatIndex + 1} to act`;

  const inHand = Boolean(holdem && holdem.phase !== "complete");
  const showHoleBacksForOthers = Boolean(
    holdem && (holdem.phase === "betting" || holdem.phase === "showdown"),
  );
  const turnTimerTotalMs = Math.max(3000, (table.timerSeconds ?? 15) * 1000);

  const rawPot = holdem?.pot ?? 0;
  const payoutTotal =
    holdem?.phase === "complete" && holdem.payouts != null
      ? holdem.payouts.reduce((acc, p) => acc + p.amount, 0)
      : null;
  const potDisplay =
    holdem?.phase === "complete" && payoutTotal != null
      ? (holdem.awardedPot ?? payoutTotal)
      : rawPot;

  let streetLabelOut: string | null = holdem ? streetLabel(holdem.street) : null;
  if (holdem?.phase === "complete") {
    streetLabelOut = "Hand complete";
  } else if (holdem?.phase === "showdown") {
    streetLabelOut = "Showdown";
  }

  return {
    width: dims.width,
    height: dims.height,
    maxPlayers: n,
    tableName: table.name,
    clubName: table.clubName,
    blindsLabel: `${table.smallBlind}/${table.bigBlind}`,
    handSeq: holdem ? holdem.handSeq : null,
    streetLabel: streetLabelOut,
    phase: holdem ? holdem.phase : null,
    pot: rawPot,
    potDisplay,
    board: holdem ? [...holdem.board] : [],
    viewerSeatIndex,
    viewerUserId: opts.viewerUserId,
    seats: seatUis,
    activeSeatIndex,
    isViewerTurn,
    useEngineActions,
    facingBet,
    callAmount,
    minRaise: holdem?.minRaise ?? table.bigBlind,
    bigBlind: table.bigBlind,
    defaultRaiseTo: opts.defaultRaiseTo,
    raisePanelMin,
    raisePanelMax,
    allowedActions: allowed,
    banner,
    turnDeadlineMs: data.turnDeadlineEpochMs,
    turnTimerTotalMs,
    live: opts.live,
    liveReady: opts.liveReady,
    sitPendingSeat: opts.sitPendingSeat,
    playersSeated: table.players,
    inHand,
    showHoleBacksForOthers,
    payouts: holdem?.payouts ?? null,
  };
}
