/** localStorage keys for client-only settings (Phase 4). */
export const PREF_KEYS = {
  sound: "poker:pref:sound",
  vibration: "poker:pref:vibration",
  tableTheme: "poker:pref:tableTheme",
  cardStyle: "poker:pref:cardStyle",
  language: "poker:pref:language",
  notifications: "poker:pref:notifications",
} as const;

export const TABLE_THEMES = [
  { id: "classic-green", label: "Classic green" },
  { id: "royal-blue", label: "Royal blue" },
  { id: "midnight-black", label: "Midnight black" },
  { id: "gold-room", label: "Gold room" },
] as const;

export const CARD_STYLES = [
  { id: "standard", label: "Standard" },
  { id: "four-color", label: "Four-color deck" },
] as const;

export function readPref(key: keyof typeof PREF_KEYS, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(PREF_KEYS[key]) ?? fallback;
}

export function writePref(key: keyof typeof PREF_KEYS, value: string): void {
  localStorage.setItem(PREF_KEYS[key], value);
  window.dispatchEvent(new Event("poker-pref-change"));
}

export function clearPokerPrefs(): void {
  if (typeof window === "undefined") return;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith("poker:")) toRemove.push(k);
  }
  toRemove.forEach((k) => localStorage.removeItem(k));
  window.dispatchEvent(new Event("poker-pref-change"));
}
