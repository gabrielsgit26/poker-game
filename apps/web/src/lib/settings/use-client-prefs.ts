"use client";

import { useCallback, useEffect, useState } from "react";
import { readPref } from "@/lib/settings/prefs";

export type ClientPrefsSnapshot = {
  tableTheme: string;
  cardStyle: string;
  language: string;
  sound: boolean;
  vibration: boolean;
  notifications: boolean;
};

function readSnapshot(): ClientPrefsSnapshot {
  return {
    tableTheme: readPref("tableTheme", "classic-green"),
    cardStyle: readPref("cardStyle", "standard"),
    language: readPref("language", "en") === "ja" ? "ja" : "en",
    sound: readPref("sound", "1") === "1",
    vibration: readPref("vibration", "1") === "1",
    notifications: readPref("notifications", "1") === "1",
  };
}

/** Subscribes to `poker-pref-change` + `storage` so table/settings stay in sync. */
export function useClientPrefs(): ClientPrefsSnapshot {
  const [snap, setSnap] = useState<ClientPrefsSnapshot>(() =>
    typeof window === "undefined"
      ? {
          tableTheme: "classic-green",
          cardStyle: "standard",
          language: "en",
          sound: true,
          vibration: true,
          notifications: true,
        }
      : readSnapshot(),
  );

  const refresh = useCallback(() => {
    setSnap(readSnapshot());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener("poker-pref-change", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("poker-pref-change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  return snap;
}
