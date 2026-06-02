export function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden>
      <div className="h-36 rounded-2xl bg-zinc-800/80" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-zinc-800/60" />
        ))}
      </div>
      <div className="flex gap-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 w-40 shrink-0 rounded-xl bg-zinc-800/60" />
        ))}
      </div>
      <div className="h-48 rounded-xl bg-zinc-800/50" />
    </div>
  );
}
