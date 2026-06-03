import type { ClubCardMembership } from "./types";
import { apiBase, credFetch } from "../dev-api";

export interface ClubListApiItem {
  id: string;
  name: string;
  isPrivate: boolean;
  memberCount: number;
  membership: ClubCardMembership;
  /** When `membership === "JOINED"`, the server sends your club role. */
  viewerRole?: "OWNER" | "MANAGER" | "MEMBER";
}

export async function fetchClubsList(): Promise<ClubListApiItem[] | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const res = await credFetch(`${base}/clubs`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as ClubListApiItem[];
  } catch {
    return null;
  }
}

export interface ClubDetailApi {
  club: {
    id: string;
    name: string;
    isPrivate: boolean;
    memberCount: number;
  };
  membership: ClubCardMembership;
  viewerRole: "OWNER" | "MANAGER" | "MEMBER" | null;
  /** Club wallet balance when joined; null if not a member. */
  viewerClubChipBalance: number | null;
  members: { userId: string; role: string }[];
  pendingRequests: {
    id: string;
    userId: string;
    status: string;
  }[];
}

export interface ChipLedgerApiRow {
  id: string;
  userId: string;
  createdAt: string;
  delta: number;
  balanceAfter: number;
  kind: string;
  tableId: string | null;
  note: string | null;
}

export interface CashOutRequestApiRow {
  id: string;
  userId: string;
  amount: number;
  status: string;
  memberNote: string | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export async function fetchClubChipLedger(
  clubId: string,
  scope: "me" | "club" = "me",
): Promise<ChipLedgerApiRow[] | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const q = scope === "club" ? "?scope=club" : "";
    const res = await credFetch(
      `${base}/clubs/${encodeURIComponent(clubId)}/chip-ledger${q}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as ChipLedgerApiRow[];
  } catch {
    return null;
  }
}

export async function postManagerChipAdjustment(
  clubId: string,
  targetUserId: string,
  body: { delta: number; note?: string },
): Promise<{ ok: true; targetUserId: string; newBalance: number; delta: number } | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await credFetch(
    `${base}/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(targetUserId)}/chip-adjustment`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    let msg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      const m = j?.message;
      msg = Array.isArray(m) ? m.join(". ") : typeof m === "string" ? m : msg;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return (await res.json()) as {
    ok: true;
    targetUserId: string;
    newBalance: number;
    delta: number;
  };
}

export async function fetchClubDetail(
  clubId: string,
): Promise<ClubDetailApi | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const res = await credFetch(`${base}/clubs/${encodeURIComponent(clubId)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as ClubDetailApi;
  } catch {
    return null;
  }
}

export async function postJoinClub(
  clubId: string,
): Promise<{ status: string } | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await credFetch(
    `${base}/clubs/${encodeURIComponent(clubId)}/join`,
    {
      method: "POST",
    },
  );
  if (!res.ok) return null;
  return (await res.json()) as { status: string };
}

export async function postCreateClub(body: {
  name: string;
  isPrivate: boolean;
}): Promise<ClubListApiItem | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await credFetch(`${base}/clubs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return (await res.json()) as ClubListApiItem;
}

export async function patchJoinRequest(
  clubId: string,
  requestId: string,
  approve: boolean,
): Promise<boolean> {
  const base = apiBase();
  if (!base) return false;
  const res = await credFetch(
    `${base}/clubs/${encodeURIComponent(clubId)}/join-requests/${encodeURIComponent(requestId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve }),
    },
  );
  return res.ok;
}

export async function fetchCashOutRequests(
  clubId: string,
): Promise<CashOutRequestApiRow[] | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const res = await credFetch(
      `${base}/clubs/${encodeURIComponent(clubId)}/cash-out-requests`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as CashOutRequestApiRow[];
  } catch {
    return null;
  }
}

export async function postCashOutRequest(
  clubId: string,
  body: { amount: number; memberNote?: string },
): Promise<CashOutRequestApiRow | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await credFetch(
    `${base}/clubs/${encodeURIComponent(clubId)}/cash-out-requests`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    let msg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      const m = j?.message;
      msg = Array.isArray(m) ? m.join(". ") : typeof m === "string" ? m : msg;
    } catch {
      if (text) msg = text;
    }
    throw new Error(msg);
  }
  return (await res.json()) as CashOutRequestApiRow;
}

export async function patchCashOutRequest(
  clubId: string,
  requestId: string,
  approve: boolean,
): Promise<boolean> {
  const base = apiBase();
  if (!base) return false;
  const res = await credFetch(
    `${base}/clubs/${encodeURIComponent(clubId)}/cash-out-requests/${encodeURIComponent(requestId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approve }),
    },
  );
  return res.ok;
}
