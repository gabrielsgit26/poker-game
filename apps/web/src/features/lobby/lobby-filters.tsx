import type { LobbyFilterId } from "@/lib/lobby/types";

const FILTERS: { id: LobbyFilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "my_clubs", label: "My clubs" },
  { id: "waiting", label: "Waiting" },
  { id: "low", label: "Low stakes" },
  { id: "high", label: "High stakes" },
];

export function LobbyFilters({
  value,
  onChange,
}: {
  value: LobbyFilterId;
  onChange: (id: LobbyFilterId) => void;
}) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Lobby filters"
    >
      {FILTERS.map((f) => {
        const selected = value === f.id;
        return (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(f.id)}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
              selected
                ? "border-amber-400/60 bg-amber-500/15 text-amber-100"
                : "border-white/10 bg-zinc-900/40 text-zinc-400 hover:border-white/20 hover:text-zinc-200"
            }`}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}
