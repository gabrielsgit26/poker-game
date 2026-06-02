import type { HoldemGameActionPayload } from "@/lib/lobby/api-tables";

export type PokerActionId = "fold" | "check" | "call" | "bet" | "raise" | "allin";

export interface PokerAllowedAction {
  id: PokerActionId;
  label: string;
  /** For call — chips to add. For raise/bet — suggested or min amount. */
  amount?: number;
}

export interface PokerSeatUi {
  seatIndex: number;
  userId: string | null;
  stack: number | null;
  streetPut: number;
  folded: boolean;
  isButton: boolean;
  isSb: boolean;
  isBb: boolean;
  /** Only for hero when seated (live hand). */
  holeCards: [string, string] | null;
  /** Shown when the hand is over (showdown / winners); from server `revealedHoles`. */
  revealedHoleCards: [string, string] | null;
}

export interface PokerTableUiState {
  width: number;
  height: number;
  maxPlayers: number;
  tableName: string;
  clubName: string;
  blindsLabel: string;
  handSeq: number | null;
  streetLabel: string | null;
  phase: string | null;
  pot: number;
  /** Chips in the middle during play; after award equals `awardedPot` (see engine). */
  potDisplay: number;
  board: string[];
  viewerSeatIndex: number | null;
  viewerUserId: string | null;
  seats: PokerSeatUi[];
  activeSeatIndex: number | null;
  isViewerTurn: boolean;
  useEngineActions: boolean;
  facingBet: boolean;
  /** Call amount (chips to add) when facing a bet */
  callAmount: number;
  minRaise: number;
  bigBlind: number;
  defaultRaiseTo: number;
  /** Slider / clamp range for raise-to panel */
  raisePanelMin: number;
  raisePanelMax: number;
  allowedActions: PokerAllowedAction[];
  banner: string | null;
  turnDeadlineMs: number | null;
  /** Full turn duration for progress ring (ms) */
  turnTimerTotalMs: number;
  live: boolean;
  liveReady: boolean;
  sitPendingSeat: number | null;
  playersSeated: number;
  /** True while a hand is active (not between hands). */
  inHand: boolean;
  /** Show face-down hole cards for other seated players (in hand). */
  showHoleBacksForOthers: boolean;
  /** Pot distribution after the hand; null while playing. */
  payouts: { seatIndex: number; userId: string; amount: number }[] | null;
}

export type PokerNavigateTarget = "lobby" | "tables" | "play" | "settings";

export interface PokerTableBridge {
  onSit: (seatIndex: number) => void;
  onLeave: () => void;
  /** Back to tables list (header arrow). */
  onBack: () => void;
  onNavigate: (to: PokerNavigateTarget) => void;
  onCloseTable: () => void;
  onEngineAction: (a: HoldemGameActionPayload) => void;
  onTableAction: (a: "check" | "fold") => void;
}
