import Link from "next/link";
import { CreateClubForm } from "@/features/clubs/create-club-form";

export default function NewClubPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <Link
        href="/lobby"
        className="text-sm text-amber-300 underline-offset-4 hover:underline"
      >
        ← Lobby
      </Link>
      <h1 className="mt-4 text-2xl font-semibold text-zinc-50">Create a club</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Phase 5 — you become the club owner. Dev identity:{" "}
        <code className="text-zinc-400">X-Dev-User-Id: local-player</code>.
      </p>
      <div className="mt-8">
        <CreateClubForm />
      </div>
    </div>
  );
}
