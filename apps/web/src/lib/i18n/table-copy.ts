/** Strings for table HUD / engine UI (used by `buildPokerTableUiState` + felt labels). */
export type TableUiCopy = {
  street: Record<string, string>;
  handComplete: string;
  showdownLabel: string;
  fold: string;
  check: string;
  raise: string;
  allIn: string;
  bet: (bb: number) => string;
  call: (amt: number) => string;
  waitingNextHand: string;
  waitingPlayers: string;
  connectingLive: string;
  yourTurn: string;
  seatToAct: (n: number) => string;
  potLabel: string;
  potAmountPrefix: string;
  potAwarded: string;
  wins: string;
  splitPot: string;
  seatWord: string;
  seatNumber: (n: number) => string;
  youCollected: string;
};

const EN: TableUiCopy = {
  street: {
    preflop: "Pre-flop",
    flop: "Flop",
    turn: "Turn",
    river: "River",
    showdown: "Showdown",
  },
  handComplete: "Hand complete",
  showdownLabel: "Showdown",
  fold: "Fold",
  check: "Check",
  raise: "Raise",
  allIn: "All-in",
  bet: (bb) => `Bet ${bb}`,
  call: (amt) => `Call ${amt.toLocaleString()}`,
  waitingNextHand: "Waiting for next hand",
  waitingPlayers: "Waiting for players",
  connectingLive: "Connecting to live table…",
  yourTurn: "Your turn",
  seatToAct: (n) => `Seat ${n + 1} to act`,
  potLabel: "Pot",
  potAmountPrefix: "Play chips",
  potAwarded: "Pot awarded",
  wins: "wins",
  splitPot: "Split pot",
  seatWord: "Seat",
  seatNumber: (n) => `Seat ${n + 1}`,
  youCollected: "You collected",
};

const JA: TableUiCopy = {
  street: {
    preflop: "プリフロップ",
    flop: "フロップ",
    turn: "ターン",
    river: "リバー",
    showdown: "ショーダウン",
  },
  handComplete: "ハンド終了",
  showdownLabel: "ショーダウン",
  fold: "フォールド",
  check: "チェック",
  raise: "レイズ",
  allIn: "オールイン",
  bet: (bb) => `ベット ${bb}`,
  call: (amt) => `コール ${amt.toLocaleString()}`,
  waitingNextHand: "次のハンドを待っています",
  waitingPlayers: "プレイヤーを待っています",
  connectingLive: "ライブテーブルに接続中…",
  yourTurn: "あなたの番です",
  seatToAct: (n) => `シート ${n + 1} の番`,
  potLabel: "ポット",
  potAmountPrefix: "チップ",
  potAwarded: "ポット配分",
  wins: "の勝ち",
  splitPot: "スプリットポット",
  seatWord: "シート",
  seatNumber: (n) => `シート ${n + 1}`,
  youCollected: "あなたの取り分",
};

export function getTableUiCopy(lang: string): TableUiCopy {
  return lang === "ja" ? JA : EN;
}
