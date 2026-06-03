/**
 * Normalized seat positions on the portrait oval table (0–1 in each axis).
 * Seat **0** is always **bottom center** (hero-friendly); indices increase **counter-clockwise**
 * when viewed from above, matching the 6-max polygon used in production.
 *
 * Tweak coordinates here for all table sizes — `poker-table-svg-view` reads this map only.
 */
export type TableSeatNorm = { x: number; y: number };

/** Supported table capacities from the API / UI (see `build-poker-table-ui-state`). */
export const TABLE_SEAT_COUNTS = [2, 3, 4, 5, 6, 7, 8, 9] as const;
export type TableSeatCount = (typeof TABLE_SEAT_COUNTS)[number];

/** Portrait rail layouts: same visual language as legacy 6-max (corners hug x≈0.06–0.94, y≈0.06–0.94). */
export const PORTRAIT_TABLE_SEAT_LAYOUTS: Record<TableSeatCount, TableSeatNorm[]> = {
  2: [
    { x: 0.5, y: 0.92 },
    { x: 0.5, y: 0.08 },
  ],
  3: [
    { x: 0.5, y: 0.92 },
    { x: 0.1, y: 0.36 },
    { x: 0.9, y: 0.36 },
  ],
  4: [
    { x: 0.5, y: 0.92 },
    { x: 0.065, y: 0.5 },
    { x: 0.5, y: 0.07 },
    { x: 0.935, y: 0.5 },
  ],
  5: [
    { x: 0.5, y: 0.92 },
    { x: 0.09, y: 0.72 },
    { x: 0.1, y: 0.28 },
    { x: 0.9, y: 0.28 },
    { x: 0.91, y: 0.72 },
  ],
  6: [
    { x: 0.5, y: 0.94 },
    { x: 0.075, y: 0.695 },
    { x: 0.075, y: 0.305 },
    { x: 0.5, y: 0.07 },
    { x: 0.925, y: 0.305 },
    { x: 0.925, y: 0.695 },
  ],
  /** 6-max rail + mid-right between top-right and bottom-right. */
  7: [
    { x: 0.5, y: 0.94 },
    { x: 0.07, y: 0.7 },
    { x: 0.07, y: 0.3 },
    { x: 0.5, y: 0.065 },
    { x: 0.90, y: 0.2 },
    { x: 0.96, y: 0.5 },
    { x: 0.90, y: 0.8 },
  ],
  /** Adds mid-left between top-left and bottom-left. */
  8: [
    { x: 0.5, y: 0.94 },
    { x: 0.07, y: 0.76 },
    { x: 0.065, y: 0.5 },
    { x: 0.07, y: 0.24 },
    { x: 0.5, y: 0.065 },
    { x: 0.93, y: 0.24 },
    { x: 0.935, y: 0.5 },
    { x: 0.93, y: 0.76 },
  ],
  /** Nine seats on the same oval rail (no center seat). */
  9: [
    { x: 0.5, y: 1.05 },
    { x: 0.16, y: 0.86 },
    { x: 0.07, y: 0.62 },
    { x: 0.07, y: 0.34 },
    { x: 0.2, y: 0.06 },
    { x: 0.8, y: 0.06 },
    { x: 0.93, y: 0.34 },
    { x: 0.93, y: 0.62 },
    { x: 0.86, y: 0.86 },
  ],
};

function clampSeatCount(n: number): TableSeatCount | null {
  if (!Number.isFinite(n)) return null;
  const k = Math.floor(n);
  if (k < 2 || k > 9) return null;
  return k as TableSeatCount;
}

/** Ellipse fallback when `n` is outside the configured map (should not happen in normal play). */
function seatNormEllipse(i: number, n: number): TableSeatNorm {
  const cx = 0.5;
  const cy = 0.5;
  const rx = 0.4;
  const ry = 0.45;
  const ang = -Math.PI / 2 + (i * (2 * Math.PI)) / Math.max(n, 1);
  return {
    x: cx + Math.cos(ang) * rx,
    y: cy + Math.sin(ang) * ry,
  };
}

/**
 * Normalized coordinates for seat `i` at a table with `maxPlayers` seats.
 * Uses `PORTRAIT_TABLE_SEAT_LAYOUTS` for n = 2…9; otherwise falls back to a uniform ellipse.
 */
export function seatNormForTable(i: number, maxPlayers: number): TableSeatNorm {
  const floorN = Math.floor(Number(maxPlayers));
  const n = clampSeatCount(floorN);
  if (n == null) return seatNormEllipse(i, Math.max(2, Math.min(9, floorN || 6)));
  const layout = PORTRAIT_TABLE_SEAT_LAYOUTS[n];
  if (i >= 0 && i < layout.length) return layout[i]!;
  return seatNormEllipse(i, n);
}
