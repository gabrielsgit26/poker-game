import { apiBase, credFetch } from "../dev-api";

export type WalletRequestKind = "DEPOSIT" | "WITHDRAWAL";
export type WalletRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface WalletRequestRow {
  id: string;
  userId: string;
  kind: WalletRequestKind;
  amount: number;
  status: WalletRequestStatus;
  memberNote: string | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
  adminNote: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface WalletRequestsPage {
  items: WalletRequestRow[];
  total: number;
  skip: number;
  limit: number;
}

/** Matches `GET /wallet/balance` (includes pending request exposure). */
export interface WalletBalancePayload {
  balanceChips: number;
  pendingWithdrawalChips: number;
  availableForWithdrawalChips: number;
  pendingDepositChips: number;
  maxPlatformWalletChips: number;
  availableDepositHeadroomChips: number;
}

async function readApiErrorMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { message?: unknown };
    const m = j.message;
    if (Array.isArray(m)) return m.map(String).join("; ");
    if (typeof m === "string" && m.trim()) return m.trim();
  } catch {
    /* ignore */
  }
  return res.statusText || `Request failed (${res.status})`;
}

function normalizeWalletBalance(j: Record<string, unknown>): WalletBalancePayload {
  const balanceChips = Math.max(0, Math.floor(Number(j.balanceChips) || 0));
  const pendingWithdrawalChips = Math.max(0, Math.floor(Number(j.pendingWithdrawalChips) || 0));
  const pendingDepositChips = Math.max(0, Math.floor(Number(j.pendingDepositChips) || 0));
  const maxPlatformWalletChips = Math.max(
    1,
    Math.floor(Number(j.maxPlatformWalletChips) || 1_000_000_000),
  );
  const availableForWithdrawalChips =
    j.availableForWithdrawalChips != null
      ? Math.max(0, Math.floor(Number(j.availableForWithdrawalChips)))
      : Math.max(0, balanceChips - pendingWithdrawalChips);
  const availableDepositHeadroomChips =
    j.availableDepositHeadroomChips != null
      ? Math.max(0, Math.floor(Number(j.availableDepositHeadroomChips)))
      : Math.max(0, maxPlatformWalletChips - balanceChips - pendingDepositChips);
  return {
    balanceChips,
    pendingWithdrawalChips,
    availableForWithdrawalChips,
    pendingDepositChips,
    maxPlatformWalletChips,
    availableDepositHeadroomChips,
  };
}

export async function fetchWalletBalance(): Promise<WalletBalancePayload | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const res = await credFetch(`${base}/wallet/balance`, { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    return normalizeWalletBalance(j);
  } catch {
    return null;
  }
}

export async function fetchWalletRequests(skip = 0, limit = 30): Promise<WalletRequestsPage | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    const res = await credFetch(`${base}/wallet/requests?${params}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as WalletRequestsPage;
  } catch {
    return null;
  }
}

export async function postWalletDeposit(amount: number, note?: string): Promise<WalletRequestRow> {
  const base = apiBase();
  if (!base) throw new Error("Offline.");
  const res = await credFetch(`${base}/wallet/deposit-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, note }),
  });
  if (!res.ok) throw new Error(await readApiErrorMessage(res));
  return (await res.json()) as WalletRequestRow;
}

export async function postWalletWithdrawal(amount: number, note?: string): Promise<WalletRequestRow> {
  const base = apiBase();
  if (!base) throw new Error("Offline.");
  const res = await credFetch(`${base}/wallet/withdrawal-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, note }),
  });
  if (!res.ok) throw new Error(await readApiErrorMessage(res));
  return (await res.json()) as WalletRequestRow;
}

export async function patchWalletCancelRequest(requestId: string): Promise<WalletRequestRow | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await credFetch(
    `${base}/wallet/requests/${encodeURIComponent(requestId)}/cancel`,
    { method: "PATCH" },
  );
  if (!res.ok) return null;
  return (await res.json()) as WalletRequestRow;
}
