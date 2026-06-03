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

export function devHeaders(): HeadersInit {
  return { "X-Dev-User-Id": currentDevUserId() };
}

export function credFetch(input: string, init?: RequestInit): Promise<Response> {
  const h = new Headers(devHeaders());
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
