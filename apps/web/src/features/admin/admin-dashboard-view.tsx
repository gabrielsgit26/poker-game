"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  DashboardEmptyState,
  DashboardFooterNav,
  DashboardListSkeleton,
  DashboardPageShell,
  DashboardPanel,
  DashboardQueryError,
  DashboardSectionHeader,
  DashboardTabButton,
  DashboardTabList,
  StatMetricGrid,
  dashboardFooterLinkClass,
  dashboardInitials,
} from "@/features/dashboards/dashboard-ui";
import {
  fetchAdminClubs,
  fetchAdminOverview,
  fetchAdminUsers,
  postAdminChipGrant,
} from "@/lib/admin/api-admin";
import { formatAbsoluteShort, formatRelativeTime } from "@/lib/format-dashboard-time";
import { formatChips } from "@/lib/format-chips";
import { useAuthSession } from "@/providers/auth-context";

type AdminTab = "overview" | "clubs" | "users" | "grants";

export function AdminDashboardView() {
  const queryClient = useQueryClient();
  const { skipGate, ready, me } = useAuthSession();
  const isAdmin = me?.authenticated === true && me.isPlatformAdmin === true;
  const [tab, setTab] = useState<AdminTab>("overview");

  const overviewQ = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: async () => {
      const o = await fetchAdminOverview();
      if (!o) throw new Error("Could not load overview. Check your connection and API URL.");
      return o;
    },
    enabled: ready && isAdmin,
  });

  const clubsQ = useQuery({
    queryKey: ["admin", "clubs"],
    queryFn: async () => {
      const r = await fetchAdminClubs();
      if (!r) throw new Error("Could not load clubs directory.");
      return r;
    },
    enabled: ready && isAdmin && tab === "clubs",
  });

  const usersQ = useQuery({
    queryKey: ["admin", "users"],
    queryFn: async () => {
      const r = await fetchAdminUsers(120);
      if (!r) throw new Error("Could not load users.");
      return r;
    },
    enabled: ready && isAdmin && tab === "users",
  });

  const [clubId, setClubId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");

  const grantMut = useMutation({
    mutationFn: async (p: {
      clubId: string;
      targetUserId: string;
      delta: number;
      note?: string;
    }) => {
      const r = await postAdminChipGrant(p.clubId, p.targetUserId, {
        delta: p.delta,
        note: p.note,
      });
      if (!r) throw new Error("API is not configured.");
      return r;
    },
    onSuccess: (r) => {
      toast.success("Platform grant applied", {
        description: `${r.targetUserId} balance now ${formatChips(r.newBalance)}.`,
      });
      setDelta("");
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "clubs"] });
      void queryClient.invalidateQueries({ queryKey: ["club"] });
      void queryClient.invalidateQueries({ queryKey: ["lobby"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Grant failed.");
    },
  });

  const deltaNum = useMemo(() => {
    const t = delta.trim();
    if (!t) return null;
    const n = Math.round(Number(t));
    if (!Number.isFinite(n) || n === 0) return null;
    return n;
  }, [delta]);

  const overviewMetrics = useMemo(() => {
    const o = overviewQ.data;
    if (!o) return [];
    return [
      {
        label: "Registered users",
        value: o.userCount,
        hint: "All accounts in the database.",
        tone: "default" as const,
      },
      {
        label: "Clubs",
        value: o.clubCount,
        hint: "Total clubs on the platform.",
        tone: "amber" as const,
      },
      {
        label: "Active memberships",
        value: o.activeClubMembers,
        hint: "Club member records with ACTIVE status.",
        tone: "emerald" as const,
      },
      {
        label: "Open tables",
        value: o.nonClosedTables,
        hint: "Tables not marked CLOSED.",
        tone: "default" as const,
      },
    ];
  }, [overviewQ.data]);

  if (skipGate) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <DashboardEmptyState
          title="Admin console unavailable"
          description="Configure NEXT_PUBLIC_API_URL to your API origin and sign in. Session cookies must be sent on each request."
        />
      </div>
    );
  }

  if (ready && me?.authenticated && !isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/50 px-6 py-12 text-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:px-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-500/90">Platform</p>
          <h1 className="mt-3 text-xl font-semibold tracking-tight text-zinc-50">Access restricted</h1>
          <p className="mx-auto mt-4 max-w-md text-[13px] leading-relaxed text-zinc-500">
            Your user id is not in{" "}
            <code className="rounded-md bg-zinc-900 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300">
              PLATFORM_ADMIN_USER_IDS
            </code>
            . Add it on the server, restart, and reload.
          </p>
          <Link
            href="/profile"
            className={`${dashboardFooterLinkClass("primary")} mt-8`}
          >
            Back to profile
          </Link>
        </div>
      </div>
    );
  }

  if (!ready || !me?.authenticated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <div className="space-y-3">
          <div className="h-3 w-24 animate-pulse rounded bg-zinc-800" />
          <div className="h-9 max-w-sm animate-pulse rounded-lg bg-zinc-800" />
          <div className="h-28 animate-pulse rounded-2xl bg-zinc-900/50" />
        </div>
      </div>
    );
  }

  return (
    <DashboardPageShell
      eyebrow="Platform administration"
      title="Admin console"
      description={
        <>
          Operational overview, directories, and audited chip grants (development plan §6.8). Grants post as{" "}
          <span className="font-mono text-[12px] text-zinc-400">PLATFORM_ADJUST</span> and are persisted in the
          ledger.
        </>
      }
    >
      <DashboardTabList aria-label="Admin console sections">
        <DashboardTabButton
          id="admin-tab-overview"
          aria-controls="admin-panel-overview"
          active={tab === "overview"}
          onClick={() => setTab("overview")}
        >
          Overview
        </DashboardTabButton>
        <DashboardTabButton
          id="admin-tab-clubs"
          aria-controls="admin-panel-clubs"
          active={tab === "clubs"}
          onClick={() => setTab("clubs")}
          badge={clubsQ.data?.length}
        >
          Clubs
        </DashboardTabButton>
        <DashboardTabButton
          id="admin-tab-users"
          aria-controls="admin-panel-users"
          active={tab === "users"}
          onClick={() => setTab("users")}
          badge={usersQ.data?.length}
        >
          Users
        </DashboardTabButton>
        <DashboardTabButton
          id="admin-tab-grants"
          aria-controls="admin-panel-grants"
          active={tab === "grants"}
          onClick={() => setTab("grants")}
        >
          Grants
        </DashboardTabButton>
      </DashboardTabList>

      {tab === "overview" ? (
        <DashboardPanel
          id="admin-panel-overview"
          role="tabpanel"
          aria-labelledby="admin-tab-overview"
        >
          {overviewQ.isError ? (
            <DashboardQueryError
              message={overviewQ.error instanceof Error ? overviewQ.error.message : "Failed to load."}
              onRetry={() => void overviewQ.refetch()}
            />
          ) : overviewQ.isPending || !overviewQ.data ? (
            <div className="space-y-4">
              <p className="text-[12px] font-medium text-zinc-500">Loading metrics…</p>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <div
                    key={i}
                    className="h-[118px] animate-pulse rounded-xl border border-white/[0.05] bg-zinc-900/40"
                  />
                ))}
              </div>
            </div>
          ) : (
            <StatMetricGrid metrics={overviewMetrics} />
          )}
        </DashboardPanel>
      ) : tab === "clubs" ? (
        <DashboardPanel id="admin-panel-clubs" role="tabpanel" aria-labelledby="admin-tab-clubs">
          <DashboardSectionHeader
            title="Club directory"
            description="Alphabetical order. Member counts count only ACTIVE memberships."
            aside={
              !clubsQ.isPending && clubsQ.data ? (
                <span className="tabular-nums text-zinc-400">{clubsQ.data.length} total</span>
              ) : null
            }
          />
          {clubsQ.isError ? (
            <DashboardQueryError
              message={clubsQ.error instanceof Error ? clubsQ.error.message : "Failed to load clubs."}
              onRetry={() => void clubsQ.refetch()}
            />
          ) : clubsQ.isPending ? (
            <DashboardListSkeleton rows={8} />
          ) : !clubsQ.data?.length ? (
            <DashboardEmptyState
              title="No clubs"
              description="Clubs created from the lobby will appear here with identifiers and live member counts."
            />
          ) : (
            <ul className="max-h-[min(60vh,28rem)] divide-y divide-white/[0.05] overflow-y-auto overscroll-contain rounded-xl border border-white/[0.06] bg-zinc-900/25 [-webkit-overflow-scrolling:touch]">
              {clubsQ.data.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/clubs/${encodeURIComponent(c.id)}`}
                    className="group flex min-h-[4.25rem] items-center justify-between gap-4 px-4 py-3.5 transition hover:bg-white/[0.04] sm:px-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-[14px] font-semibold text-zinc-100">{c.name}</p>
                        {c.isPrivate ? (
                          <span className="shrink-0 rounded-md bg-amber-950/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200/90 ring-1 ring-amber-500/15">
                            Private
                          </span>
                        ) : (
                          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                            Public
                          </span>
                        )}
                      </div>
                      <p className="mt-1 truncate font-mono text-[11px] text-zinc-500">{c.id}</p>
                      <p
                        className="mt-1 text-[11px] tabular-nums text-zinc-600"
                        title={formatAbsoluteShort(c.updatedAt)}
                      >
                        Updated {formatRelativeTime(c.updatedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="text-right">
                        <p className="text-lg font-semibold tabular-nums text-zinc-100">{c.memberCount}</p>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">members</p>
                      </div>
                      <span
                        className="text-lg text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-400"
                        aria-hidden
                      >
                        →
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </DashboardPanel>
      ) : tab === "users" ? (
        <DashboardPanel id="admin-panel-users" role="tabpanel" aria-labelledby="admin-tab-users">
          <DashboardSectionHeader
            title="Recent accounts"
            description="Sorted by profile updatedAt (newest first). List capped at 120 rows per request."
            aside={<span className="text-zinc-400">Up to 120</span>}
          />
          {usersQ.isError ? (
            <DashboardQueryError
              message={usersQ.error instanceof Error ? usersQ.error.message : "Failed to load users."}
              onRetry={() => void usersQ.refetch()}
            />
          ) : usersQ.isPending ? (
            <DashboardListSkeleton rows={8} />
          ) : !usersQ.data?.length ? (
            <DashboardEmptyState title="No users" description="The users endpoint returned an empty list." />
          ) : (
            <ul className="max-h-[min(60vh,28rem)] space-y-2 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
              {usersQ.data.map((u) => {
                const initials = dashboardInitials(u.displayName, u.userId);
                return (
                  <li
                    key={u.userId}
                    className="flex min-h-[4rem] items-center gap-4 rounded-xl border border-white/[0.06] bg-zinc-900/30 px-4 py-3 sm:px-5"
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-600/30 to-zinc-800 text-[12px] font-semibold text-amber-50 ring-1 ring-white/[0.08]"
                      aria-hidden
                    >
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-zinc-100">
                        {u.displayName ?? (
                          <span className="font-normal text-zinc-500">No display name</span>
                        )}
                      </p>
                      <p className="truncate font-mono text-[11px] text-zinc-500">{u.userId}</p>
                      <p
                        className="mt-0.5 text-[11px] text-zinc-600"
                        title={formatAbsoluteShort(u.updatedAt)}
                      >
                        Last activity {formatRelativeTime(u.updatedAt)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </DashboardPanel>
      ) : (
        <DashboardPanel id="admin-panel-grants" role="tabpanel" aria-labelledby="admin-tab-grants">
          <section className="rounded-xl border border-amber-500/25 bg-gradient-to-b from-amber-950/[0.22] to-zinc-950/30 p-5 sm:p-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/95">
              Platform chip grant
            </h2>
            <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-zinc-500">
              Adjusts the member&apos;s club wallet. Verify identifiers before submitting. All successful grants
              refresh overview and club caches.
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-[12px] font-medium text-zinc-300">Club id</span>
                <input
                  value={clubId}
                  onChange={(e) => setClubId(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-zinc-950 px-3.5 py-2.5 font-mono text-[13px] text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-500/45 focus:ring-2 focus:ring-amber-500/15"
                  placeholder="Club document id"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[12px] font-medium text-zinc-300">Member user id</span>
                <input
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-zinc-950 px-3.5 py-2.5 font-mono text-[13px] text-zinc-100 outline-none transition focus:border-amber-500/45 focus:ring-2 focus:ring-amber-500/15"
                  placeholder="e.g. tg_… or dev id"
                />
              </label>
              <label className="block sm:col-span-1">
                <span className="text-[12px] font-medium text-zinc-300">Delta (chips)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={delta}
                  onChange={(e) => setDelta(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-zinc-950 px-3.5 py-2.5 font-mono text-[13px] text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-500/45 focus:ring-2 focus:ring-amber-500/15"
                  placeholder="Non-zero integer"
                />
                {delta.trim() && deltaNum === null ? (
                  <p className="mt-1.5 text-[11px] text-rose-300/90">Enter a non-zero whole number.</p>
                ) : null}
              </label>
              <label className="block sm:col-span-1">
                <span className="flex items-center justify-between gap-2 text-[12px] font-medium text-zinc-300">
                  <span>Note (optional)</span>
                  <span className="font-normal tabular-nums text-zinc-600">{note.length}/200</span>
                </span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  className="mt-1.5 w-full rounded-xl border border-white/[0.1] bg-zinc-950 px-3.5 py-2.5 text-[13px] text-zinc-100 outline-none transition focus:border-amber-500/45 focus:ring-2 focus:ring-amber-500/15"
                  placeholder="Audit note"
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  disabled={
                    grantMut.isPending ||
                    !clubId.trim() ||
                    !targetUserId.trim() ||
                    deltaNum === null
                  }
                  onClick={() => {
                    if (deltaNum === null) return;
                    grantMut.mutate({
                      clubId: clubId.trim(),
                      targetUserId: targetUserId.trim(),
                      delta: deltaNum,
                      note: note.trim() || undefined,
                    });
                  }}
                  className="w-full rounded-xl bg-amber-500 py-3 text-[13px] font-semibold text-zinc-950 shadow-md shadow-amber-950/25 transition hover:bg-amber-400 disabled:pointer-events-none disabled:opacity-40"
                >
                  {grantMut.isPending ? "Applying…" : "Apply grant"}
                </button>
              </div>
            </div>
          </section>
        </DashboardPanel>
      )}

      <DashboardFooterNav>
        <Link href="/profile" className={dashboardFooterLinkClass("primary")}>
          Profile
        </Link>
        <Link href="/lobby" className={dashboardFooterLinkClass("ghost")}>
          Lobby
        </Link>
      </DashboardFooterNav>
    </DashboardPageShell>
  );
}
