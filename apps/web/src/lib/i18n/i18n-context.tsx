"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { enMessages } from "@/lib/i18n/messages/en";
import { jaMessages } from "@/lib/i18n/messages/ja";
import { readPref } from "@/lib/settings/prefs";

export type AppLocale = "en" | "ja";

const I18nContext = createContext<{
  locale: AppLocale;
  t: (key: string) => string;
}>({
  locale: "en",
  t: (k) => k,
});

const catalogs: Record<AppLocale, Record<string, string>> = {
  en: enMessages,
  ja: jaMessages,
};

function normalizeLocale(raw: string): AppLocale {
  return raw === "ja" ? "ja" : "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>(() =>
    typeof window === "undefined" ? "en" : normalizeLocale(readPref("language", "en")),
  );

  useEffect(() => {
    const apply = () => {
      const next = normalizeLocale(readPref("language", "en"));
      setLocale(next);
      if (typeof document !== "undefined") {
        document.documentElement.lang = next === "ja" ? "ja" : "en";
      }
    };
    apply();
    window.addEventListener("poker-pref-change", apply);
    window.addEventListener("storage", apply);
    return () => {
      window.removeEventListener("poker-pref-change", apply);
      window.removeEventListener("storage", apply);
    };
  }, []);

  const t = useCallback(
    (key: string) => {
      const pack = catalogs[locale] ?? catalogs.en;
      return pack[key] ?? catalogs.en[key] ?? key;
    },
    [locale],
  );

  const value = useMemo(() => ({ locale, t }), [locale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
