import { apiUrl, credFetch } from "@/lib/dev-api";

export type AuthMeResponse =
  | {
      authenticated: true;
      user: {
        userId: string;
        displayName: string | null;
        createdAt: string | null;
        updatedAt: string | null;
      };
    }
  | { authenticated: false; userId: string };

export async function fetchAuthMe(): Promise<AuthMeResponse | null> {
  const url = apiUrl("auth/me");
  if (!url) return null;
  try {
    const res = await credFetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as AuthMeResponse;
  } catch {
    return null;
  }
}

export async function postDevLogin(body: {
  userId?: string;
  displayName?: string;
}): Promise<{ ok: true; userId: string } | null> {
  const url = apiUrl("auth/dev-login");
  if (!url) return null;
  const res = await credFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return (await res.json()) as { ok: true; userId: string };
}

export async function postLogout(): Promise<boolean> {
  const url = apiUrl("auth/logout");
  if (!url) return false;
  const res = await credFetch(url, { method: "POST" });
  return res.ok;
}

/** Telegram Mini App — server validates `initData` and sets `poker_sid`. */
export async function postTelegramLogin(initData: string): Promise<{ ok: true; userId: string } | null> {
  const url = apiUrl("auth/telegram");
  if (!url) return null;
  const res = await credFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  });
  if (!res.ok) return null;
  return (await res.json()) as { ok: true; userId: string };
}
