"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { ThemeRoot } from "@/features/settings/theme-root";
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

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeRoot />
        <Toaster
          theme="dark"
          richColors
          position="top-center"
          closeButton
          toastOptions={{
            classNames: {
              toast: "border border-zinc-600/80 bg-zinc-950/95 text-zinc-100 shadow-xl backdrop-blur-md",
              title: "text-sm font-semibold",
              description: "text-xs text-zinc-400",
              error: "border-rose-500/40",
              success: "border-emerald-500/40",
            },
          }}
        />
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
