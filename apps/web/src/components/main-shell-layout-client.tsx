"use client";

import { usePathname } from "next/navigation";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

/** Live hand at `/tables/:id` — fullscreen table (hide bottom tab bar like ClubGG). */
function isTableHandRoute(pathname: string | null): boolean {
  if (!pathname) return false;
  return /^\/tables\/[^/]+$/.test(pathname);
}

export function MainShellLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const immersiveTable = isTableHandRoute(pathname);

  return (
    <div className="flex min-h-dvh flex-col">
      <main
        className={
          immersiveTable
            ? "flex min-h-0 flex-1 flex-col pt-0 pb-0"
            : "flex-1 pb-28 pt-4"
        }
      >
        {children}
      </main>
      {immersiveTable ? null : <MobileBottomNav />}
    </div>
  );
}
