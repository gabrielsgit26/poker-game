import type { ClubCardMembership } from "./types";
import { apiBase, credFetch } from "../dev-api";

export interface ClubListApiItem {
  id: string;
  name: string;
  isPrivate: boolean;
  memberCount: number;
  membership: ClubCardMembership;
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
  members: { userId: string; role: string }[];
  pendingRequests: {
    id: string;
    userId: string;
    status: string;
  }[];
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
