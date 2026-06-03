"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function IconLobby({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} {...rest}>
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" strokeLinejoin="round" />
      <polyline points="9 22 9 12 15 12 15 22" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconWallet({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} {...rest}>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 12a2 2 0 1 0 0 4h3v-4Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconTables({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} {...rest}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  );
}

function IconUser({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} {...rest}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconSettings({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} {...rest}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
    </svg>
  );
}

const links = [
  { href: "/lobby", label: "Lobby", Icon: IconLobby },
  { href: "/wallet", label: "Wallet", Icon: IconWallet },
  { href: "/tables", label: "Tables", Icon: IconTables },
  { href: "/profile", label: "Profile", Icon: IconUser },
  { href: "/settings", label: "Settings", Icon: IconSettings },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-[#0d1117]/95 backdrop-blur-md pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2"
      aria-label="Main"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5 items-stretch gap-0.5 px-1 sm:px-2">
        {links.map(({ href, label, Icon }) => {
          const active =
            pathname === href || (href !== "/lobby" && pathname.startsWith(`${href}/`));
          return (
            <li key={href} className="min-w-0">
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 rounded-lg py-1.5 text-[10px] font-semibold leading-tight transition-colors sm:text-[11px] ${
                  active ? "text-amber-300" : "text-zinc-500 hover:text-zinc-200"
                }`}
              >
                <Icon
                  className={`h-5 w-5 shrink-0 sm:h-[22px] sm:w-[22px] ${active ? "text-amber-400" : "text-zinc-500"}`}
                  aria-hidden
                />
                <span
                  className={`h-0.5 w-6 rounded-full ${active ? "bg-amber-400/90" : "bg-transparent"}`}
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
