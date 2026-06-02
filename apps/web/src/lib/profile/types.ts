export type AccountStatus = "ACTIVE" | "SUSPENDED";

export interface ProfileUser {
  displayName: string;
  /** Shown instead of raw Telegram ID until auth exists. */
  maskedTelegramRef: string;
  totalChips: number;
  accountStatus: AccountStatus;
}

export interface ClubBalanceRow {
  clubId: string;
  clubName: string;
  chips: number;
}

export interface ProfileStats {
  handsPlayed: number;
  winRatePct: number;
  biggestPotWon: number;
  netChips: number;
}

export interface TxRow {
  id: string;
  type: string;
  amount: number;
  clubName: string | null;
  at: string;
  balanceAfter: number;
}

export interface ProfileSnapshot {
  user: ProfileUser;
  clubBalances: ClubBalanceRow[];
  stats: ProfileStats;
  transactions: TxRow[];
}
