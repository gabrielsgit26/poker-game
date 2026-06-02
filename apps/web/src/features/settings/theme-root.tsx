"use client";

import { useEffect } from "react";
import { readPref } from "@/lib/settings/prefs";

/** Applies `data-table-theme` on `<html>` from localStorage (see `globals.css`). */
export function ThemeRoot() {
  useEffect(() => {
    const apply = () => {
      const t = readPref("tableTheme", "classic-green");
      document.documentElement.dataset.tableTheme = t;
    };
    apply();
    window.addEventListener("storage", apply);
    window.addEventListener("poker-pref-change", apply);
    return () => {
      window.removeEventListener("storage", apply);
      window.removeEventListener("poker-pref-change", apply);
    };
  }, []);

  return null;
}
