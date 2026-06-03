"use client";

import { useEffect, useState } from "react";
import { readPref } from "@/lib/settings/prefs";

export function isRedSuit(code: string): boolean {
  const s = code[1]?.toLowerCase();
  return s === "h" || s === "d";
}

/** Face-up text / SVG fill for a two-letter card code (`Ah`, `Td`, …). */
export function suitDisplayClass(code: string, cardStyle: string): string {
  const s = code[1]?.toLowerCase();
  if (cardStyle !== "four-color") {
    return isRedSuit(code) ? "text-rose-600" : "text-slate-900";
  }
  if (s === "h") return "text-rose-600";
  if (s === "d") return "text-sky-600";
  if (s === "c") return "text-emerald-700";
  return "text-slate-900";
}

export function suitSvgFill(code: string, cardStyle: string): string {
  const s = code[1]?.toLowerCase();
  if (cardStyle !== "four-color") {
    return isRedSuit(code) ? "#dc2626" : "#0f172a";
  }
  if (s === "h") return "#dc2626";
  if (s === "d") return "#2563eb";
  if (s === "c") return "#047857";
  return "#0f172a";
}

function useCardStylePref(): string {
  const [v, setV] = useState("standard");
  useEffect(() => {
    const apply = () => setV(readPref("cardStyle", "standard"));
    apply();
    window.addEventListener("poker-pref-change", apply);
    return () => window.removeEventListener("poker-pref-change", apply);
  }, []);
  return v;
}

export function formatCard(code: string): string {
  if (code.length !== 2) return code;
  const r = code[0]!.toUpperCase();
  const rank = r === "T" ? "10" : r;
  const s = code[1]!.toLowerCase();
  const suit = s === "h" ? "♥" : s === "d" ? "♦" : s === "c" ? "♣" : s === "s" ? "♠" : s;
  return `${rank}${suit}`;
}

/** Tucked card backs for opponents — larger so they read at a glance on the felt. */
export function OpponentCardBack({ className }: { className?: string }) {
  return (
    <div
      className={`flex h-[3.35rem] w-[2.35rem] shrink-0 items-center justify-center rounded-md border-[1.5px] border-amber-400/95 bg-gradient-to-b from-[#141a22] via-[#0c1018] to-black shadow-[0_3px_12px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)] ${className ?? ""}`}
      aria-hidden
    >
      <span className="select-none text-[1.15rem] leading-none text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.45)]">
        ♔
      </span>
    </div>
  );
}

export function MiniCard({
  code,
  faceDown,
  className,
  size = "sm",
}: {
  code?: string;
  faceDown?: boolean;
  className?: string;
  size?: "sm" | "hero";
}) {
  const cardStyle = useCardStylePref();
  const dim =
    size === "hero"
      ? "h-14 w-10 min-h-14 min-w-10 rounded-md border-2 shadow-md"
      : "h-[3.1rem] w-[2.15rem] shrink-0 rounded-md border border-slate-400/90 shadow-md";
  const base = `poker-hole-deal-item flex items-center justify-center ${dim}`;
  const faceDownText = size === "hero" ? "text-sm" : "text-[10px]";
  const faceUpText = size === "hero" ? "text-sm font-bold" : "text-[10px] font-bold leading-tight";
  if (faceDown) {
    return (
      <div
        className={`${base} border-amber-600/60 bg-slate-900 ${faceDownText} text-amber-400 ${className ?? ""}`}
      >
        ♠
      </div>
    );
  }
  if (!code) return null;
  return (
    <div
      className={`${base} border-slate-400 bg-white ${faceUpText} ${suitDisplayClass(code, cardStyle)} ${className ?? ""}`}
    >
      {formatCard(code)}
    </div>
  );
}
