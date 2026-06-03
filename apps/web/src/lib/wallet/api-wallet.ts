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

export async function fetchWalletBalance(): Promise<number | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const res = await credFetch(`${base}/wallet/balance`, { cache: "no-store" });
    if (!res.ok) return null;
    const j = (await res.json()) as { balanceChips?: number };
    return Math.max(0, Math.floor(Number(j.balanceChips) || 0));
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

export async function postWalletDeposit(amount: number, note?: string): Promise<WalletRequestRow | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await credFetch(`${base}/wallet/deposit-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, note }),
  });
  if (!res.ok) return null;
  return (await res.json()) as WalletRequestRow;
}

export async function postWalletWithdrawal(amount: number, note?: string): Promise<WalletRequestRow | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await credFetch(`${base}/wallet/withdrawal-requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, note }),
  });
  if (!res.ok) return null;
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
