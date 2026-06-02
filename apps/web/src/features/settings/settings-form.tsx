"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiBase } from "@/lib/dev-api";
import { useAuthActions, useAuthUserId } from "@/providers/auth-context";
import {
  CARD_STYLES,
  TABLE_THEMES,
  clearPokerPrefs,
  readPref,
  writePref,
} from "@/lib/settings/prefs";

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
      <div>
        <label htmlFor={id} className="font-medium text-zinc-100">
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
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

export function SettingsForm() {
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
    setLanguage(readPref("language", "en"));
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
    <div className="mx-auto max-w-lg space-y-6 px-4 py-2 pb-6">
      <p className="text-center text-[11px] text-zinc-500">
        Phase 4 · preferences stored in this browser only
      </p>

      <section className="space-y-3" aria-labelledby="media-pref">
        <h2
          id="media-pref"
          className="text-xs font-medium uppercase tracking-widest text-zinc-500"
        >
          Sound & haptics
        </h2>
        <ToggleRow
          id="sound"
          label="Sound effects"
          description="Table sounds when the real client is wired up."
          checked={sound}
          onChange={(v) => {
            setSound(v);
            writePref("sound", v ? "1" : "0");
          }}
        />
        <ToggleRow
          id="vibration"
          label="Vibration"
          description="Short pulse on your turn (supported devices)."
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
          Table theme
        </h2>
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
          <label htmlFor="table-theme" className="sr-only">
            Table theme
          </label>
          <select
            id="table-theme"
            value={tableTheme}
            onChange={(e) => {
              const v = e.target.value;
              setTableTheme(v);
              writePref("tableTheme", v);
            }}
            className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
          >
            {TABLE_THEMES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="card-pref">
        <h2
          id="card-pref"
          className="text-xs font-medium uppercase tracking-widest text-zinc-500"
        >
          Card style
        </h2>
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
          <select
            id="card-style"
            value={cardStyle}
            onChange={(e) => {
              const v = e.target.value;
              setCardStyle(v);
              writePref("cardStyle", v);
            }}
            className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
          >
            {CARD_STYLES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="lang-pref">
        <h2
          id="lang-pref"
          className="text-xs font-medium uppercase tracking-widest text-zinc-500"
        >
          Language
        </h2>
        <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4">
          <select
            id="language"
            value={language}
            onChange={(e) => {
              const v = e.target.value;
              setLanguage(v);
              writePref("language", v);
            }}
            className="w-full rounded-lg border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-zinc-100"
          >
            <option value="en">English</option>
            <option value="ja">日本語 (soon)</option>
          </select>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="notif-pref">
        <h2
          id="notif-pref"
          className="text-xs font-medium uppercase tracking-widest text-zinc-500"
        >
          Notifications
        </h2>
        <ToggleRow
          id="notifications"
          label="Push-style alerts in app"
          description="Uses in-app toasts when the notification layer exists."
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
            Dev session (Phase 2)
          </h2>
          <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4 text-sm text-zinc-200">
            <p className="text-xs text-zinc-500">
              Current API user:{" "}
              <span className="font-mono text-zinc-300">{authUserId}</span>
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
              For HTTP-only cookies, set{" "}
              <code className="text-emerald-200/90">NEXT_PUBLIC_API_URL=/api</code> and{" "}
              <code className="text-emerald-200/90">API_PROXY_TARGET=http://localhost:3001</code>{" "}
              in <code className="text-zinc-400">apps/web/.env.local</code> (see repo{" "}
              <code className="text-zinc-400">.env.example</code>).
            </p>
            <label className="mt-3 block text-xs text-zinc-500" htmlFor="dev-uid">
              User id (letters, digits, <code className="text-zinc-400">._-</code> only)
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
                    if (!ok) window.alert("Dev login failed (check API and proxy env).");
                  } finally {
                    setSessBusy(false);
                  }
                }}
                className="rounded-lg bg-emerald-600/85 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
              >
                {sessBusy ? "…" : "Start dev session"}
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
                Clear server session
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
          Responsible gaming
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-amber-100/80">
          Play within your means. This demo does not use real money. If you
          integrate real stakes later, add limits, self-exclusion, and support
          links here.
        </p>
      </section>

      <div className="space-y-3 pt-2">
        <button
          type="button"
          onClick={clearLocalPrefs}
          className="w-full rounded-xl border border-rose-500/40 bg-rose-950/30 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-950/50"
        >
          Clear local preferences
        </button>
        <p className="text-center text-[11px] text-zinc-600">
          Clears keys starting with <code className="text-zinc-500">poker:</code>{" "}
          and returns to the lobby. Does not clear the Nest session cookie — use
          “Clear server session” above when the API is configured.
        </p>
      </div>
    </div>
  );
}
