"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuthActions, useAuthSession } from "@/providers/auth-context";

/** Module-level so it survives the login page unmounting/remounting during a session refresh. */
let autoTelegramAttempted = false;

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/lobby";
  return raw;
}

export function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { telegramLogin } = useAuthActions();
  const { ready, me, skipGate } = useAuthSession();
  const [status, setStatus] = useState<"idle" | "tg" | "err">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const nextPath = safeNextPath(searchParams.get("next"));

  const tryTelegram = useCallback(async () => {
    const webApp = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
    const initData = webApp?.initData ?? "";
    if (!initData.trim()) {
      // Inside Telegram but no initData: opened via a plain URL/link, not the bot's Web App button.
      if (webApp?.platform && webApp.platform !== "unknown") {
        setStatus("err");
        setErrMsg("Telegram didn't provide login data. Open the app from the bot's menu button.");
      }
      return false;
    }
    setStatus("tg");
    setErrMsg(null);
    const result = await telegramLogin(initData);
    if (result !== "ok") {
      setStatus("err");
      setErrMsg(
        result === "rejected"
          ? "Telegram sign-in failed. Try again or contact support."
          : "Signed in, but the server didn't keep the session. Try again or contact support.",
      );
      return false;
    }
    router.replace(nextPath);
    router.refresh();
    return true;
  }, [telegramLogin, router, nextPath]);

  useEffect(() => {
    if (skipGate || !ready) return;
    if (me?.authenticated) {
      router.replace(nextPath);
    }
  }, [skipGate, ready, me, router, nextPath]);

  // telegram-web-app.js is loaded beforeInteractive in the root layout, so it's ready here.
  // Auto-attempt once per page load. Each attempt refreshes the session, which briefly sets
  // `ready=false` and the auth gate unmounts this page — so a per-mount guard would reset and
  // loop forever if the session doesn't stick. Retry after that is manual.
  useEffect(() => {
    if (skipGate || !ready || autoTelegramAttempted) return;
    if (me?.authenticated) return;
    autoTelegramAttempted = true;
    void tryTelegram();
  }, [skipGate, ready, me, tryTelegram]);

  return (
    <>
      <div className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-2xl font-semibold text-zinc-50">Sign in</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          In the <strong className="text-zinc-300">Telegram Mini App</strong>, you are signed in
          automatically when this page loads. In a normal browser, use a dev session from
          Settings.
        </p>

        {skipGate ? (
          <p className="mt-6 rounded-xl border border-amber-500/25 bg-amber-950/25 p-4 text-sm text-amber-100/90">
            Session protection is off in this build. Configure your deployment for sign-in, or open{" "}
            <Link href="/tables" className="font-medium text-amber-300 underline-offset-2 hover:underline">
              Tables
            </Link>{" "}
            to browse rooms once the API is available.
          </p>
        ) : null}

        {status === "tg" ? (
          <p className="mt-6 text-center text-sm text-zinc-500">Signing in with Telegram…</p>
        ) : null}

        {errMsg ? (
          <p
            className="mt-6 rounded-lg border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-sm text-rose-100"
            role="alert"
          >
            {errMsg}
          </p>
        ) : null}

        <div className="mt-8 space-y-3">
          <Link
            href="/settings"
            className="block w-full rounded-xl bg-emerald-600/90 py-3 text-center text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            Open Settings
          </Link>
          <button
            type="button"
            className="w-full rounded-xl border border-white/15 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/5"
            onClick={() => void tryTelegram()}
          >
            Retry Telegram sign-in
          </button>
          <Link
            href={nextPath}
            className="block w-full py-2 text-center text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            Continue to app (if already signed in)
          </Link>
        </div>
      </div>
    </>
  );
}
