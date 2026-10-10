"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { ThemeRoot } from "@/features/settings/theme-root";
import { I18nProvider } from "@/lib/i18n/i18n-context";
import { AuthProvider } from "@/providers/auth-context";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  // Tell Telegram the Mini App is ready (hides its loading screen) on whichever page opens first.
  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand?.();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <I18nProvider>
          <ThemeRoot />
          <Toaster
            theme="dark"
            richColors
            position="top-center"
            closeButton
            toastOptions={{
              classNames: {
                toast:
                  "border border-zinc-600/80 bg-zinc-950/95 text-zinc-100 shadow-xl backdrop-blur-md",
                title: "text-sm font-semibold",
                description: "text-xs text-zinc-400",
                error: "border-rose-500/40",
                success: "border-emerald-500/40",
              },
            }}
          />
          {children}
        </I18nProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
