import Link from "next/link";

export default async function ClubDetailPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <p className="text-xs uppercase tracking-widest text-amber-400/90">
        Phase 5 preview
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-zinc-50">Club</h1>
      <p className="mt-2 font-mono text-sm text-zinc-400">{clubId}</p>
      <p className="mt-4 text-sm text-zinc-400">
        Full club details, members, and tables will ship with the club system.
      </p>
      <Link
        href="/lobby"
        className="mt-8 inline-block text-sm font-medium text-amber-300 underline-offset-4 hover:underline"
      >
        ← Back to lobby
      </Link>
    </div>
  );
}
