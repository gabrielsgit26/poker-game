"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiBase } from "@/lib/dev-api";
import { useI18n } from "@/lib/i18n/i18n-context";
import { resolveFeltPreset } from "@/lib/settings/table-felt-presets";
import {
  CARD_STYLES,
  TABLE_THEMES,
  clearPokerPrefs,
  readPref,
  writePref,
} from "@/lib/settings/prefs";
import {
  playBoardStreet,
  playChipsToPot,
  playPotToWinners,
  playYourTurn,
  prefetchTableSounds,
  resumeTableAudio,
} from "@/lib/table/table-sounds";
import { useAuthActions, useAuthUserId } from "@/providers/auth-context";

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="font-medium text-zinc-100">
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{description}</p>
        ) : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
          checked ? "bg-emerald-600/90" : "bg-zinc-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function ThemeSwatch({ themeId, selected, onSelect }: { themeId: string; selected: boolean; onSelect: () => void }) {
  const felt = resolveFeltPreset(themeId);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex flex-col overflow-hidden rounded-xl border text-left transition ${
        selected
          ? "border-amber-400/70 ring-2 ring-amber-400/35"
          : "border-white/10 hover:border-white/20"
      }`}
    >
      <div
        className="h-14 w-full"
        style={{
          background: `linear-gradient(135deg, ${felt.feltStops[0]}, ${felt.feltStops[2]})`,
        }}
      />
      <div className="border-t border-white/10 bg-zinc-950/90 px-2 py-1.5 text-[10px] font-medium text-zinc-300">
        {TABLE_THEMES.find((t) => t.id === themeId)?.label}
      </div>
    </button>
  );
}

function CardPreview({ styleId }: { styleId: string }) {
  const codes = ["As", "Kh", "Td", "2c"] as const;
  return (
    <div className="flex justify-center gap-1.5 rounded-lg border border-white/10 bg-zinc-950/60 py-3">
      {codes.map((c) => (
        <div
          key={c}
          className={`flex h-11 w-8 items-center justify-center rounded border border-slate-400/90 bg-white text-[10px] font-bold leading-tight shadow ${
            styleId === "four-color"
              ? c.endsWith("h")
                ? "text-rose-600"
                : c.endsWith("d")
                  ? "text-sky-600"
                  : c.endsWith("c")
                    ? "text-emerald-700"
                    : "text-slate-900"
              : c.endsWith("h") || c.endsWith("d")
                ? "text-rose-600"
                : "text-slate-900"
          }`}
        >
          {c[0] === "T" ? "10" : c[0]}
          {c[1] === "h" ? "♥" : c[1] === "d" ? "♦" : c[1] === "c" ? "♣" : "♠"}
        </div>
      ))}
    </div>
  );
}

export function SettingsForm() {
  const { t } = useI18n();
  const router = useRouter();
  const liveApi = Boolean(apiBase());
  const authUserId = useAuthUserId();
  const { devLogin, logout: clearServerSession } = useAuthActions();
  const [devUid, setDevUid] = useState("");
  const [sessBusy, setSessBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [tableTheme, setTableTheme] = useState("classic-green");
  const [cardStyle, setCardStyle] = useState("standard");
  const [language, setLanguage] = useState("en");

  useEffect(() => {
    setDevUid(authUserId);
  }, [authUserId]);

  useEffect(() => {
    setSound(readPref("sound", "1") === "1");
    setVibration(readPref("vibration", "1") === "1");
    setNotifications(readPref("notifications", "1") === "1");
    setTableTheme(readPref("tableTheme", "classic-green"));
    setCardStyle(readPref("cardStyle", "standard"));
    setLanguage(readPref("language", "en") === "ja" ? "ja" : "en");
    setReady(true);
  }, []);

  const clearLocalPrefs = () => {
    clearPokerPrefs();
    router.push("/lobby");
    router.refresh();
  };

  const tryVibrate = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(12);
    }
  };

  const previewSound = (fn: () => void) => {
    resumeTableAudio();
    prefetchTableSounds();
    fn();
  };

  if (!ready) {
    return (
      <div className="mx-auto max-w-lg animate-pulse space-y-4 px-4 py-6">
        <div className="h-10 rounded-lg bg-zinc-800/70" />
        <div className="h-24 rounded-xl bg-zinc-800/50" />
        <div className="h-24 rounded-xl bg-zinc-800/50" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-8 px-4 py-2 pb-8">
      <header className="space-y-1 border-b border-white/10 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">{t("settings.pageTitle")}</h1>
        <p className="text-sm leading-relaxed text-zinc-500">{t("settings.pageSubtitle")}</p>
      </header>

      <section className="space-y-3" aria-labelledby="media-pref">
        <h2
          id="media-pref"
          className="text-xs font-medium uppercase tracking-widest text-zinc-500"
        >
          {t("settings.section.sound")}
        </h2>
        <ToggleRow
          id="sound"
          label={t("settings.sound.label")}
          description={t("settings.sound.hint")}
          checked={sound}
          onChange={(v) => {
            setSound(v);
            writePref("sound", v ? "1" : "0");
          }}
        />
        {sound ? (
          <div className="flex flex-wrap gap-2 rounded-xl border border-white/10 bg-zinc-900/30 px-3 py-3">
            <span className="w-full text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              Preview
            </span>
            <button
              type="button"
              className="rounded-lg border border-white/15 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-amber-500/40 hover:text-amber-100"
              onClick={() => previewSound(playBoardStreet)}
            >
              {t("settings.sound.testStreet")}
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/15 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-amber-500/40 hover:text-amber-100"
              onClick={() => previewSound(playChipsToPot)}
            >
              {t("settings.sound.testChips")}
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/15 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-amber-500/40 hover:text-amber-100"
              onClick={() => previewSound(playYourTurn)}
            >
              {t("settings.sound.testTurn")}
            </button>
            <button
              type="button"
              className="rounded-lg border border-white/15 bg-zinc-950 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-amber-500/40 hover:text-amber-100"
              onClick={() => previewSound(playPotToWinners)}
            >
              {t("settings.sound.testWin")}
            </button>
          </div>
        ) : null}
        <ToggleRow
          id="vibration"
          label={t("settings.vibration.label")}
          description={t("settings.vibration.hint")}
          checked={vibration}
          onChange={(v) => {
            setVibration(v);
            writePref("vibration", v ? "1" : "0");
            if (v) tryVibrate();
          }}
        />
      </section>

      <section className="space-y-3" aria-labelledby="theme-pref">
        <h2
          id="theme-pref"
          className="text-xs font-medium uppercase tracking-widest text-zinc-500"
        >
          {t("settings.section.theme")}
        </h2>
        <p className="text-xs leading-relaxed text-zinc-500">{t("settings.theme.hint")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TABLE_THEMES.map((th) => (
            <ThemeSwatch
              key={th.id}
              themeId={th.id}
              selected={tableTheme === th.id}
              onSelect={() => {
                setTableTheme(th.id);
                writePref("tableTheme", th.id);
              }}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="card-pref">
        <h2
          id="card-pref"
          className="text-xs font-medium uppercase tracking-widest text-zinc-500"
        >
          {t("settings.section.cards")}
        </h2>
        <p className="text-xs leading-relaxed text-zinc-500">{t("settings.cards.hint")}</p>
        <CardPreview styleId={cardStyle} />
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-1">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {CARD_STYLES.map((c) => {
              const active = cardStyle === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setCardStyle(c.id);
                    writePref("cardStyle", c.id);
                  }}
                  className={`rounded-lg px-3 py-3 text-left text-sm font-medium transition ${
                    active
                      ? "bg-amber-500/15 text-amber-100 ring-1 ring-amber-500/40"
                      : "text-zinc-300 hover:bg-white/[0.04]"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="lang-pref">
        <h2
          id="lang-pref"
          className="text-xs font-medium uppercase tracking-widest text-zinc-500"
        >
          {t("settings.section.lang")}
        </h2>
        <p className="text-xs leading-relaxed text-zinc-500">{t("settings.lang.hint")}</p>
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-1">
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setLanguage("en");
                writePref("language", "en");
              }}
              className={`rounded-lg px-3 py-3 text-left text-sm font-medium transition ${
                language === "en"
                  ? "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/35"
                  : "text-zinc-300 hover:bg-white/[0.04]"
              }`}
            >
              English
            </button>
            <button
              type="button"
              onClick={() => {
                setLanguage("ja");
                writePref("language", "ja");
              }}
              className={`rounded-lg px-3 py-3 text-left text-sm font-medium transition ${
                language === "ja"
                  ? "bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-500/35"
                  : "text-zinc-300 hover:bg-white/[0.04]"
              }`}
            >
              日本語
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="notif-pref">
        <h2
          id="notif-pref"
          className="text-xs font-medium uppercase tracking-widest text-zinc-500"
        >
          {t("settings.section.notify")}
        </h2>
        <ToggleRow
          id="notifications"
          label={t("settings.notify.label")}
          description={t("settings.notify.hint")}
          checked={notifications}
          onChange={(v) => {
            setNotifications(v);
            writePref("notifications", v ? "1" : "0");
          }}
        />
      </section>

      {liveApi ? (
        <section className="space-y-3" aria-labelledby="dev-session">
          <h2
            id="dev-session"
            className="text-xs font-medium uppercase tracking-widest text-zinc-500"
          >
            {t("settings.section.dev")}
          </h2>
          <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4 text-sm text-zinc-200">
            <p className="text-xs text-zinc-500">
              {t("settings.dev.currentUser")}:{" "}
              <span className="font-mono text-zinc-300">{authUserId}</span>
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
              {t("settings.dev.bodyBefore")}{" "}
              <a href="/login" className="text-amber-300 underline-offset-2 hover:underline">
                {t("settings.link.login")}
              </a>
              {t("settings.dev.bodyAfter")}
            </p>
            <label className="mt-3 block text-xs text-zinc-500" htmlFor="dev-uid">
              {t("settings.dev.userIdLabel")}
            </label>
            <input
              id="dev-uid"
              value={devUid}
              onChange={(e) => setDevUid(e.target.value)}
              className="mt-1 w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100"
              autoComplete="off"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={sessBusy}
                onClick={async () => {
                  setSessBusy(true);
                  try {
                    const ok = await devLogin(devUid.trim() || undefined);
                    if (!ok) window.alert(t("settings.dev.signInFail"));
                  } finally {
                    setSessBusy(false);
                  }
                }}
                className="rounded-lg bg-emerald-600/85 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {sessBusy ? "…" : t("settings.dev.signIn")}
              </button>
              <button
                type="button"
                disabled={sessBusy}
                onClick={async () => {
                  setSessBusy(true);
                  try {
                    await clearServerSession();
                  } finally {
                    setSessBusy(false);
                  }
                }}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-zinc-300"
              >
                {t("settings.dev.clear")}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section
        className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 text-sm text-amber-100/90"
        aria-labelledby="rg-heading"
      >
        <h2 id="rg-heading" className="font-semibold text-amber-200">
          {t("settings.rg.title")}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-amber-100/80">{t("settings.rg.body")}</p>
      </section>

      <div className="space-y-3 pt-2">
        <button
          type="button"
          onClick={clearLocalPrefs}
          className="w-full rounded-xl border border-rose-500/40 bg-rose-950/30 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-950/50"
        >
          {t("settings.clearPrefs")}
        </button>
        <p className="text-center text-[11px] leading-relaxed text-zinc-600">{t("settings.clearPrefsHint")}</p>
      </div>
    </div>
  );
}
