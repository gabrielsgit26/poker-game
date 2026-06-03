/** Felt + rail colors keyed by `poker:pref:tableTheme` (matches `TABLE_THEMES` ids). */
export type FeltPreset = {
  /** SVG radial gradient stops (center, mid, edge). */
  feltStops: [string, string, string];
  feltStroke: string;
  feltInsetRing: string;
  /** Full-screen chrome behind the oval (CSS colors). */
  outerBg: [string, string, string];
  /** Radial tint over outer bg (rgba string). */
  ambientTint: string;
};

export const FELT_PRESETS: Record<string, FeltPreset> = {
  "classic-green": {
    feltStops: ["#158050", "#0d5a38", "#052818"],
    feltStroke: "#0a3220",
    feltInsetRing: "#2d6b48",
    outerBg: ["#1a0c10", "#120608", "#0a0406"],
    ambientTint: "rgba(22,120,72,0.22)",
  },
  "royal-blue": {
    feltStops: ["#1e4a8a", "#153a70", "#0a1f3d"],
    feltStroke: "#0c2744",
    feltInsetRing: "#3b6fb5",
    outerBg: ["#0a0f1a", "#070c14", "#04060c"],
    ambientTint: "rgba(59,130,246,0.2)",
  },
  "midnight-black": {
    feltStops: ["#1a1d24", "#12141a", "#07080b"],
    feltStroke: "#020203",
    feltInsetRing: "#3f3f46",
    outerBg: ["#050506", "#030304", "#000000"],
    ambientTint: "rgba(113,113,122,0.12)",
  },
  "gold-room": {
    feltStops: ["#14532d", "#0f3d22", "#082814"],
    feltStroke: "#422006",
    feltInsetRing: "#b45309",
    outerBg: ["#1a1208", "#120c05", "#0a0603"],
    ambientTint: "rgba(212,168,83,0.18)",
  },
};

export function resolveFeltPreset(themeId: string): FeltPreset {
  return FELT_PRESETS[themeId] ?? FELT_PRESETS["classic-green"]!;
}
