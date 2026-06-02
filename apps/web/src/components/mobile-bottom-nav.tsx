"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/lobby", label: "Lobby" },
  { href: "/play", label: "Play" },
  { href: "/tables", label: "Tables" },
  { href: "/profile", label: "Profile" },
  { href: "/settings", label: "Settings" },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0d1117]/95 backdrop-blur-md pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2"
      aria-label="Main"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-stretch gap-0.5 px-1 sm:px-2">
        {links.map(({ href, label }) => {
          const active =
            pathname === href ||
            (href !== "/lobby" && pathname.startsWith(`${href}/`));
          return (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 rounded-lg py-2 text-[10px] font-medium leading-tight transition-colors sm:text-xs ${
                  active
                    ? "text-amber-300"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <span
                  className={`h-1 w-8 rounded-full ${
                    active ? "bg-amber-400/90" : "bg-transparent"
                  }`}
                  aria-hidden
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
