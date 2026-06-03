"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthSession } from "@/providers/auth-context";

function isPublicMainRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/login";
}

/**
 * When the API is configured, require a real Mongo user + `poker_sid` (dev-login or Telegram)
 * for all `(main)` routes except `/login`.
 */
export function MainAuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { skipGate, ready, me } = useAuthSession();

  useEffect(() => {
    if (skipGate || !ready) return;
    if (isPublicMainRoute(pathname)) return;
    if (me && me.authenticated) return;
    if (me === null) return;
    const next = pathname && pathname !== "/" ? pathname : "/lobby";
    const q = new URLSearchParams();
    q.set("next", next);
    router.replace(`/login?${q.toString()}`);
  }, [skipGate, ready, me, pathname, router]);

  if (skipGate) {
    return <>{children}</>;
  }

  if (!ready) {
    return (
      <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 px-6 text-center">
        <div
          className="h-9 w-9 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400"
          aria-hidden
        />
        <p className="text-sm text-zinc-500">Loading session…</p>
      </div>
    );
  }

  if (me === null && !isPublicMainRoute(pathname)) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <p className="text-sm font-medium text-zinc-200">Could not reach the server</p>
        <p className="mt-2 text-xs leading-relaxed text-zinc-500">
          Try again in a moment, or return to{" "}
          <button
            type="button"
            className="text-amber-300 underline-offset-2 hover:underline"
            onClick={() => router.push("/login")}
          >
            sign-in
          </button>
          .
        </p>
      </div>
    );
  }

  if (!isPublicMainRoute(pathname) && me && !me.authenticated) {
    return (
      <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-3 px-6">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400"
          aria-hidden
        />
        <p className="text-xs text-zinc-500">Redirecting to sign-in…</p>
      </div>
    );
  }

  return <>{children}</>;
}
