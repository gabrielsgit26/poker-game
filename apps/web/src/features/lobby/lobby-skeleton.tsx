export function LobbySkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="h-28 rounded-2xl bg-zinc-800/80" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-zinc-800/60" />
        ))}
      </div>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 w-20 shrink-0 rounded-full bg-zinc-800/60" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-4 w-24 rounded bg-zinc-800/60" />
        {[1, 2].map((i) => (
          <div key={i} className="h-32 rounded-2xl bg-zinc-800/50" />
        ))}
      </div>
      <div className="space-y-3">
        <div className="h-4 w-28 rounded bg-zinc-800/60" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 rounded-2xl bg-zinc-800/50" />
        ))}
      </div>
    </div>
  );
}
