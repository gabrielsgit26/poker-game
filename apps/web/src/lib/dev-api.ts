/** Shared client config for Nest dev API (Phases 5–6). */

export const DEV_USER_ID = "local-player";

/** Set after `GET /auth/me` so `devHeaders()` matches the session user (Phase 2). */
let resolvedUserId: string | null = null;

export function setResolvedUserId(userId: string): void {
  resolvedUserId = userId;
}

export function currentDevUserId(): string {
  return resolvedUserId ?? DEV_USER_ID;
}

export function apiBase(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return raw.replace(/\/$/, "") || "/";
  return raw.replace(/\/$/, "");
}

/** False when `NEXT_PUBLIC_API_URL` is unset — client skips session gate (offline / static demo). */
export function hasAuthApi(): boolean {
  return Boolean(apiBase());
}

/** Build `https://host/v` or `/api/v` when using Next rewrites (see `API_PROXY_TARGET`). */
export function apiUrl(versionLessPath: string): string | null {
  const base = apiBase();
  if (!base) return null;
  const p = versionLessPath.replace(/^\//, "");
  return base.startsWith("/") ? `${base}/${p}` : `${base}/${p}`;
}

/**
 * ngrok's free tier answers browser requests with an HTML "visit site" warning page
 * (no CORS headers) unless this header is present. Only sent when the API is on ngrok.
 */
export function ngrokHeaders(): Record<string, string> {
  return /\.ngrok(-free)?\.(app|dev|io)$/i.test(apiHost() ?? "")
    ? { "ngrok-skip-browser-warning": "true" }
    : {};
}

function apiHost(): string | null {
  const base = apiBase();
  if (!base || base.startsWith("/")) return null;
  try {
    return new URL(base).hostname;
  } catch {
    return null;
  }
}

export function devHeaders(): HeadersInit {
  return { "X-Dev-User-Id": currentDevUserId(), ...ngrokHeaders() };
}

const SESSION_TOKEN_KEY = "poker_session_token";
let sessionToken: string | null | undefined;

/**
 * Session token returned by `/auth/telegram` and `/auth/dev-login`, sent as a Bearer header.
 * The `poker_sid` cookie alone fails when the web app and API are on different sites
 * (Vercel + ngrok) or the Telegram webview blocks third-party cookies.
 */
export function getSessionToken(): string | null {
  if (sessionToken === undefined) {
    try {
      sessionToken = localStorage.getItem(SESSION_TOKEN_KEY);
    } catch {
      sessionToken = null;
    }
  }
  return sessionToken;
}

export function setSessionToken(token: string | null): void {
  sessionToken = token;
  try {
    if (token) localStorage.setItem(SESSION_TOKEN_KEY, token);
    else localStorage.removeItem(SESSION_TOKEN_KEY);
  } catch {
    /* storage unavailable — token still kept in memory for this page load */
  }
}

export function credFetch(input: string, init?: RequestInit): Promise<Response> {
  const h = new Headers(devHeaders());
  const token = getSessionToken();
  if (token) h.set("Authorization", `Bearer ${token}`);
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => {
      h.set(key, value);
    });
  }
  return fetch(input, {
    credentials: "include",
    ...init,
    headers: h,
  });
}
