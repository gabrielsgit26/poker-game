import { Suspense } from "react";
import { LoginClient } from "./login-client";

function LoginFallback() {
  return (
    <div className="flex min-h-[40dvh] flex-col items-center justify-center gap-3 px-6">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500/30 border-t-amber-400"
        aria-hidden
      />
      <p className="text-xs text-zinc-500">Loading…</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginClient />
    </Suspense>
  );
}
