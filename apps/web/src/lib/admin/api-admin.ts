import { apiBase, credFetch } from "../dev-api";

export interface AdminOverviewApi {
  userCount: number;
  clubCount: number;
  activeClubMembers: number;
  nonClosedTables: number;
}

export async function fetchAdminOverview(): Promise<AdminOverviewApi | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const res = await credFetch(`${base}/admin/overview`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AdminOverviewApi;
  } catch {
    return null;
  }
}

export async function postAdminChipGrant(
  clubId: string,
  targetUserId: string,
  body: { delta: number; note?: string },
): Promise<{ ok: true; targetUserId: string; newBalance: number; delta: number } | null> {
  const base = apiBase();
  if (!base) return null;
  const res = await credFetch(
    `${base}/admin/clubs/${encodeURIComponent(clubId)}/members/${encodeURIComponent(targetUserId)}/chip-grant`,
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
