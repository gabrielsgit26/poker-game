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

export interface AdminClubRowApi {
  id: string;
  name: string;
  isPrivate: boolean;
  memberCount: number;
  updatedAt: string | null;
}

export interface AdminUserRowApi {
  userId: string;
  displayName: string | null;
  updatedAt: string | null;
}

export interface AdminPagedApi<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

export interface AdminSignupDayApi {
  day: string;
  newUsers: number;
  newClubs: number;
}

export interface AdminSignupReportApi {
  days: AdminSignupDayApi[];
  rangeStart: string;
  rangeEnd: string;
}

export async function fetchAdminSignupReport(days = 14): Promise<AdminSignupReportApi | null> {
  const base = apiBase();
  if (!base) return null;
  const d = Math.min(90, Math.max(1, Math.floor(days)));
  try {
    const res = await credFetch(
      `${base}/admin/report/signups?days=${encodeURIComponent(String(d))}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return (await res.json()) as AdminSignupReportApi;
  } catch {
    return null;
  }
}

export async function fetchAdminClubs(
  skip = 0,
  limit = 50,
): Promise<AdminPagedApi<AdminClubRowApi> | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const q = new URLSearchParams({
      skip: String(skip),
      limit: String(limit),
    });
    const res = await credFetch(`${base}/admin/clubs?${q}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AdminPagedApi<AdminClubRowApi>;
  } catch {
    return null;
  }
}

export async function fetchAdminUsers(
  skip = 0,
  limit = 50,
): Promise<AdminPagedApi<AdminUserRowApi> | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const q = new URLSearchParams({
      skip: String(skip),
      limit: String(limit),
    });
    const res = await credFetch(`${base}/admin/users?${q}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AdminPagedApi<AdminUserRowApi>;
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
