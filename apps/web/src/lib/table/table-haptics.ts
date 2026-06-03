/**
 * Light haptics for live table — Phase 12. Respects Settings → Vibration.
 */
import { readPref } from "@/lib/settings/prefs";

export function hapticYourTurn(): void {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  if (readPref("vibration", "1") !== "1") return;
  try {
    navigator.vibrate(16);
  } catch {
    /* ignore */
  }
}
