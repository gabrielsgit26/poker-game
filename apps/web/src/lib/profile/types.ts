export type AccountStatus = "ACTIVE" | "SUSPENDED";

export interface ProfileUser {
  displayName: string;
  /** Shown instead of raw Telegram ID until auth exists. */
  maskedTelegramRef: string;
  /** Total spendable chips (platform vault + clubs), same meaning as lobby `balanceChips`. */
  totalChips: number;
  /** When known (e.g. from `/auth/me`), shown under total like the lobby header. */
  platformChips?: number;
  clubChips?: number;
  accountStatus: AccountStatus;
}

export interface ClubBalanceRow {
  clubId: string;
  clubName: string;
  chips: number;
}

export interface ProfileStats {
  /** When false, hands / win rate / biggest pot are not stored yet (show placeholders). */
  tracked: boolean;
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
  /** Club chip balance after entry; omitted or null for platform wallet rows. */
  balanceAfter?: number | null;
}

export interface ProfileSnapshot {
  user: ProfileUser;
  clubBalances: ClubBalanceRow[];
  stats: ProfileStats;
  /** Legacy: snapshot may omit rows; use `GET /profile/transactions` for paging. */
  transactions: TxRow[];
}

export interface ProfileTransactionsPage {
  items: TxRow[];
  total: number;
  skip: number;
  limit: number;
}
