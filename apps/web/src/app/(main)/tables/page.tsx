import Link from "next/link";

export default function TablesPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <h1 className="text-2xl font-semibold text-zinc-50">Tables</h1>
      <p className="mt-2 text-sm text-zinc-400">
        The main table list lives on the lobby for now. Dedicated routes and
        join-in-place arrive in Phases 6–8.
      </p>
      <Link
        href="/lobby"
        className="mt-6 inline-block text-sm font-medium text-amber-300 underline-offset-4 hover:underline"
      >
        Go to lobby
      </Link>
    </div>
  );
}
