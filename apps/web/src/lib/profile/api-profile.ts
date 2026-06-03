import { apiUrl, credFetch } from "@/lib/dev-api";
import type {
  ProfileSnapshot,
  ProfileTransactionsPage,
  TxRow,
} from "@/lib/profile/types";

function asNumber(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeTxRow(r: Record<string, unknown>): TxRow {
  const bal = r.balanceAfter;
  return {
    id: String(r.id ?? ""),
    type: String(r.type ?? ""),
    amount: Math.floor(asNumber(r.amount)),
    clubName:
      r.clubName === null || r.clubName === undefined
        ? null
        : String(r.clubName),
    at: String(r.at ?? new Date().toISOString()),
    balanceAfter:
      bal === null || bal === undefined ? null : Math.floor(asNumber(bal)),
  };
}

/** Normalizes `/profile` JSON so older servers do not break the UI. */
export function normalizeProfileSnapshot(raw: unknown): ProfileSnapshot {
  const o = raw as Record<string, unknown>;
  const user = (o.user ?? {}) as Record<string, unknown>;
  const stats = (o.stats ?? {}) as Record<string, unknown>;
  const clubBalances = Array.isArray(o.clubBalances) ? o.clubBalances : [];
  const transactions = Array.isArray(o.transactions) ? o.transactions : [];

  const platformChips = asNumber(user.platformChips);
  const clubChips = asNumber(user.clubChips);
  const totalChips = asNumber(
    user.totalChips,
    platformChips + clubChips,
  );

  return {
    user: {
      displayName: String(user.displayName ?? "Player").slice(0, 120),
      maskedTelegramRef: String(user.maskedTelegramRef ?? ""),
      totalChips,
      platformChips: user.platformChips != null ? platformChips : undefined,
      clubChips: user.clubChips != null ? clubChips : undefined,
      accountStatus: user.accountStatus === "SUSPENDED" ? "SUSPENDED" : "ACTIVE",
    },
    clubBalances: clubBalances.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        clubId: String(r.clubId ?? ""),
        clubName: String(r.clubName ?? ""),
        chips: Math.max(0, Math.floor(asNumber(r.chips))),
      };
    }),
    stats: {
      tracked: stats.tracked === true,
      handsPlayed: Math.max(0, Math.floor(asNumber(stats.handsPlayed))),
      winRatePct: asNumber(stats.winRatePct),
      biggestPotWon: Math.max(0, Math.floor(asNumber(stats.biggestPotWon))),
      netChips: Math.floor(asNumber(stats.netChips)),
    },
    transactions: transactions.map((row) =>
      normalizeTxRow(row as Record<string, unknown>),
    ),
  };
}

/** Normalizes `GET /profile/transactions` JSON for older servers. */
export function normalizeProfileTransactionsPage(
  raw: unknown,
): ProfileTransactionsPage {
  const o = raw as Record<string, unknown>;
  const items = Array.isArray(o.items) ? o.items : [];
  return {
    items: items.map((row) =>
      normalizeTxRow(row as Record<string, unknown>),
    ),
    total: Math.max(0, Math.floor(asNumber(o.total))),
    skip: Math.max(0, Math.floor(asNumber(o.skip))),
    limit: Math.max(1, Math.floor(asNumber(o.limit, 20))),
  };
}

export async function fetchProfileTransactionsPage(
  skip: number,
  limit: number,
): Promise<ProfileTransactionsPage> {
  const base = apiUrl("profile/transactions");
  if (!base) {
    throw new Error("NEXT_PUBLIC_API_URL is not set.");
  }
  const q = new URLSearchParams({
    skip: String(Math.max(0, Math.floor(skip))),
    limit: String(Math.max(1, Math.floor(limit))),
  });
  const res = await credFetch(`${base}?${q.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    const errText = await res.text();
    if (errText) {
      try {
        const j = JSON.parse(errText) as { message?: string | string[] };
        const m = j?.message;
        msg = Array.isArray(m) ? m.join(". ") : typeof m === "string" ? m : msg;
      } catch {
        msg = errText;
      }
    }
    throw new Error(msg);
  }
  const raw = (await res.json()) as unknown;
  return normalizeProfileTransactionsPage(raw);
}

export async function fetchProfileSnapshot(): Promise<ProfileSnapshot> {
  const url = apiUrl("profile");
  if (!url) {
    throw new Error("NEXT_PUBLIC_API_URL is not set.");
  }
  const res = await credFetch(url, { cache: "no-store" });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    const errText = await res.text();
    if (errText) {
      try {
        const j = JSON.parse(errText) as { message?: string | string[] };
        const m = j?.message;
        msg = Array.isArray(m) ? m.join(". ") : typeof m === "string" ? m : msg;
      } catch {
        msg = errText;
      }
    }
    throw new Error(msg);
  }
  const raw = (await res.json()) as unknown;
  return normalizeProfileSnapshot(raw);
}
