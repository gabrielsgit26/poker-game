"use client";

import Link from "next/link";
import Script from "next/script";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuthActions, useAuthSession } from "@/providers/auth-context";

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
  const [tgScriptLoaded, setTgScriptLoaded] = useState(false);

  const nextPath = safeNextPath(searchParams.get("next"));

  const tryTelegram = useCallback(async () => {
    const initData =
      typeof window !== "undefined" ? window.Telegram?.WebApp?.initData ?? "" : "";
    if (!initData.trim()) return false;
    setStatus("tg");
    setErrMsg(null);
    const ok = await telegramLogin(initData);
    if (!ok) {
      setStatus("err");
      setErrMsg("Telegram sign-in failed. Try again or contact support.");
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

  useEffect(() => {
    if (skipGate || !ready || !tgScriptLoaded) return;
    if (me?.authenticated) return;
    void tryTelegram();
  }, [skipGate, ready, me, tgScriptLoaded, tryTelegram]);

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onLoad={() => {
          window.Telegram?.WebApp?.ready();
          window.Telegram?.WebApp?.expand?.();
          setTgScriptLoaded(true);
        }}
      />
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
            <Link href="/play" className="font-medium text-amber-300 underline-offset-2 hover:underline">
              Practice
            </Link>{" "}
            for an offline runout.
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
