/** Shared client config for Nest dev API (Phases 5–6). */

export const DEV_USER_ID = "local-player";

export function apiBase(): string | null {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

export function devHeaders(): HeadersInit {
  return { "X-Dev-User-Id": DEV_USER_ID };
}
