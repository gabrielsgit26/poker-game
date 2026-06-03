import { toast } from "sonner";
import { readPref } from "@/lib/settings/prefs";

function successEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return readPref("notifications", "1") === "1";
}

/** Success / info toasts — hidden when user disables in-app notifications. */
export function notifySuccess(
  message: string,
  options?: Parameters<typeof toast.success>[1],
): void {
  if (!successEnabled()) return;
  toast.success(message, options);
}

/** Errors always surface so failed operations are visible. */
export function notifyError(
  message: string,
  options?: Parameters<typeof toast.error>[1],
): void {
  toast.error(message, options);
}
