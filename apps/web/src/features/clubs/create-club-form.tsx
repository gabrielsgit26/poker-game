"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { postCreateClub } from "@/lib/lobby/api-clubs";

export function CreateClubForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  const create = useMutation({
    mutationFn: () =>
      postCreateClub({ name: name.trim(), isPrivate }),
    onSuccess: (row) => {
      if (row) {
        void queryClient.invalidateQueries({ queryKey: ["lobby"] });
        router.push(`/clubs/${row.id}`);
      }
    },
  });

  const hasApi = Boolean(process.env.NEXT_PUBLIC_API_URL?.trim());

  if (!hasApi) {
    return (
      <p className="rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-3 text-sm text-amber-100/90">
        Set <code className="text-amber-200">NEXT_PUBLIC_API_URL</code> in{" "}
        <code className="text-amber-200">apps/web/.env.local</code>, run MongoDB
        and the Nest server, then reload this page.
      </p>
    );
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        create.mutate();
      }}
    >
      <div>
        <label htmlFor="club-name" className="text-sm font-medium text-zinc-200">
          Club name
        </label>
        <input
          id="club-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
          placeholder="e.g. Friday Home Game"
          className="mt-1.5 w-full rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600"
        />
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-zinc-900/40 px-4 py-3">
        <input
          type="checkbox"
          checked={isPrivate}
          onChange={(e) => setIsPrivate(e.target.checked)}
          className="mt-1"
        />
        <span>
          <span className="block text-sm font-medium text-zinc-100">
            Private club
          </span>
          <span className="mt-0.5 block text-xs text-zinc-500">
            New members must be approved by an owner or manager.
          </span>
        </span>
      </label>
      {create.isError ? (
        <p className="text-sm text-rose-300">Could not create club. Try again.</p>
      ) : null}
      <button
        type="submit"
        disabled={create.isPending || !name.trim()}
        className="w-full rounded-xl bg-amber-500/90 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {create.isPending ? "Creating…" : "Create club"}
      </button>
    </form>
  );
}
