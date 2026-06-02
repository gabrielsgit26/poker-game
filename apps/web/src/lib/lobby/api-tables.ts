import { apiBase, credFetch } from "@/lib/dev-api";
import type { TableCardModel } from "@/lib/lobby/types";
import type { HoldemPublicSnapshot } from "@telegram-poker/shared/poker-engine";

export async function fetchTablesList(): Promise<TableCardModel[] | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const res = await credFetch(`${base}/tables`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as TableCardModel[];
  } catch {
    return null;
  }
}

export interface TableSeatApi {
  seatIndex: number;
  userId: string | null;
}

export type TableSocketActionApi = "check" | "fold";

export type TableLastActionSourceApi = "player" | "timeout";

export interface TableLastActionApi {
  userId: string;
  action: TableSocketActionApi;
  at: number;
  source?: TableLastActionSourceApi;
}

export interface TableActionTurnApi {
  actionSeatIndex: number | null;
  facingBet: boolean;
}

export type HoldemGameActionPayload =
  | { type: "fold" }
  | { type: "check" }
  | { type: "call" }
  | { type: "bet"; amount: number }
  | { type: "raise_to"; amount: number };

export type { HoldemPublicSnapshot };

export interface TableDetailApi {
  table: TableCardModel;
  seats: TableSeatApi[];
  viewerSeatIndex: number | null;
  /** Server action clock (Redis); null if not started or Redis unavailable. */
  turnDeadlineEpochMs: number | null;
  /** Last socket “action” (Phase 8 dev UX; not full street engine). */
  lastAction: TableLastActionApi | null;
  /** Whose turn it is (≥2 seated); `facingBet` flips each resolved action until a real street engine exists. */
  actionTurn: TableActionTurnApi;
  /** NL holdem public state when a hand is in Redis; null between hands. */
  holdem: HoldemPublicSnapshot | null;
  /** Requesting user’s hole cards when seated in the current hand. */
  viewerHoleCards: [string, string] | null;
}

export async function fetchTableDetail(
  tableId: string,
): Promise<TableDetailApi | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const res = await credFetch(`${base}/tables/${encodeURIComponent(tableId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as TableDetailApi;
  } catch {
    return null;
  }
}

export async function postCreateTable(body: {
  clubId: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  maxPlayers?: number;
  timerSeconds?: number;
  minBuyIn?: number;
}): Promise<TableCardModel | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await credFetch(`${base}/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return (await res.json()) as TableCardModel;
}

export async function postSitAtSeat(
  tableId: string,
  seatIndex: number,
): Promise<TableDetailApi | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await credFetch(
    `${base}/tables/${encodeURIComponent(tableId)}/sit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatIndex }),
    },
  );
  if (!res.ok) return null;
  return (await res.json()) as TableDetailApi;
}

export async function postLeaveSeat(
  tableId: string,
): Promise<TableDetailApi | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await credFetch(
    `${base}/tables/${encodeURIComponent(tableId)}/leave`,
    {
      method: "POST",
    },
  );
  if (!res.ok) return null;
  return (await res.json()) as TableDetailApi;
}

export async function postCloseTable(tableId: string): Promise<boolean> {
  const base = apiBase();
  if (!base) return false;
  const res = await credFetch(
    `${base}/tables/${encodeURIComponent(tableId)}/close`,
    {
      method: "POST",
    },
  );
  return res.ok;
}
