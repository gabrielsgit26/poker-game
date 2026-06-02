import type { UserRole } from "@telegram-poker/shared";

export default function LobbyPage() {
  const demoRoles: UserRole[] = ["PLAYER"];

  return (
    <div className="mx-auto max-w-lg px-4">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-amber-400/90">
          Phase 1 — shell
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-zinc-50">Lobby</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Home screen placeholder. Open{" "}
          <a href="/play" className="text-amber-300 underline underline-offset-2">
            Play
          </a>{" "}
          to try heads-up runouts in the browser (no Telegram, no backend).
        </p>
        <p className="mt-3 text-xs text-zinc-500">
          Shared types check: default role is{" "}
          <code className="rounded bg-white/10 px-1.5 py-0.5 text-zinc-300">
            {demoRoles[0]}
          </code>
        </p>
      </header>
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-950/40 to-zinc-900/60 p-6 shadow-lg shadow-black/40">
        <p className="text-sm text-zinc-300">
          Casino-style layout and bottom navigation are wired. Hook up API data
          in Phase 3.
        </p>
      </section>
    </div>
  );
}
