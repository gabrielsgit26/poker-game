import { apiUrl, credFetch, setSessionToken } from "@/lib/dev-api";

type LoginResponse = { ok: true; userId: string; token?: string };

async function readLogin(res: Response): Promise<{ ok: true; userId: string } | null> {
  if (!res.ok) return null;
  const body = (await res.json()) as LoginResponse;
  if (body.token) setSessionToken(body.token);
  return { ok: true, userId: body.userId };
}

export type AuthMeResponse =
  | {
      authenticated: true;
      user: {
        userId: string;
        displayName: string | null;
        /** HTTPS URL from Telegram Mini App when the server has stored it. */
        telegramPhotoUrl?: string | null;
        createdAt: string | null;
        updatedAt: string | null;
        /** Platform play-money wallet (admin-approved deposits / withdrawals). */
        platformBalanceChips?: number;
        /** Sum of club-room chip wallets (ACTIVE memberships). */
        clubChipsTotal?: number;
        /** platformBalanceChips + clubChipsTotal — total spendable chips across vault + clubs. */
        totalChips?: number;
      };
      /** True when `userId` is listed in server `PLATFORM_ADMIN_USER_IDS`. */
      isPlatformAdmin: boolean;
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
  return readLogin(res);
}

export async function postLogout(): Promise<boolean> {
  const url = apiUrl("auth/logout");
  if (!url) return false;
  // Send the token so the server revokes it, then forget it locally either way.
  const res = await credFetch(url, { method: "POST" }).catch(() => null);
  setSessionToken(null);
  return res?.ok ?? false;
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
  return readLogin(res);
}
