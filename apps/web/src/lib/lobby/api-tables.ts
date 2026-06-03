import { apiBase, credFetch } from "@/lib/dev-api";
import type { TableCardModel } from "@/lib/lobby/types";
import type { HoldemPublicSnapshot } from "@telegram-poker/shared/poker-engine";

/** Thrown when a REST call returns a non-OK status (includes Nest `message` body when JSON). */
export class ApiRequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export function isApiRequestError(e: unknown): e is ApiRequestError {
  return e instanceof ApiRequestError;
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

async function readJsonOrThrow<T>(res: Response): Promise<T> {
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      if (!res.ok) throw new ApiRequestError(res.status, text || `HTTP ${res.status}`);
      throw new Error("Invalid response from server.");
    }
  }
  if (!res.ok) {
    const j = parsed as { message?: string | string[] } | null;
    const m = j?.message;
    const msg = Array.isArray(m) ? m.join(". ") : typeof m === "string" ? m : `Request failed (${res.status})`;
    throw new ApiRequestError(res.status, msg);
  }
  return (parsed ?? {}) as T;
}

/** List tables — throws {@link ApiRequestError} on HTTP errors (caller should catch when mixing with mocks). */
export async function fetchTablesList(): Promise<TableCardModel[]> {
  const base = apiBase();
  if (!base) {
    throw new Error("API is not configured (set NEXT_PUBLIC_API_URL).");
  }
  const res = await credFetch(`${base}/tables`, {
    cache: "no-store",
  });
  return readJsonOrThrow<TableCardModel[]>(res);
}

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
  /** Club-room wallet (debited on buy-in when dealt; returned on leave with current stack). */
  viewerClubChipBalance: number;
}

export async function fetchTableDetail(tableId: string): Promise<TableDetailApi> {
  const base = apiBase();
  if (!base) {
    throw new Error("API is not configured (set NEXT_PUBLIC_API_URL).");
  }
  const res = await credFetch(`${base}/tables/${encodeURIComponent(tableId)}`, {
    cache: "no-store",
  });
  return readJsonOrThrow<TableDetailApi>(res);
}

export async function postCreateTable(body: {
  clubId: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  maxPlayers?: number;
  timerSeconds?: number;
  minBuyIn?: number;
}): Promise<TableCardModel> {
  const base = apiBase();
  if (!base) {
    throw new Error("API is not configured (set NEXT_PUBLIC_API_URL).");
  }
  const res = await credFetch(`${base}/tables`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJsonOrThrow<TableCardModel>(res);
}

export async function postSitAtSeat(
  tableId: string,
  seatIndex: number,
  buyInAmount?: number,
): Promise<TableDetailApi> {
  const base = apiBase();
  if (!base) throw new Error("API is not configured (set NEXT_PUBLIC_API_URL).");
  const res = await credFetch(
    `${base}/tables/${encodeURIComponent(tableId)}/sit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatIndex, buyInAmount }),
    },
  );
  return readJsonOrThrow<TableDetailApi>(res);
}

export async function postLeaveSeat(tableId: string): Promise<TableDetailApi> {
  const base = apiBase();
  if (!base) throw new Error("API is not configured (set NEXT_PUBLIC_API_URL).");
  const res = await credFetch(`${base}/tables/${encodeURIComponent(tableId)}/leave`, {
    method: "POST",
  });
  return readJsonOrThrow<TableDetailApi>(res);
}

export async function postCloseTable(tableId: string): Promise<void> {
  const base = apiBase();
  if (!base) throw new Error("API is not configured (set NEXT_PUBLIC_API_URL).");
  const res = await credFetch(`${base}/tables/${encodeURIComponent(tableId)}/close`, {
    method: "POST",
  });
  await readJsonOrThrow<{ ok?: boolean }>(res);
}
