"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminLedgerActivitySection } from "@/features/admin/admin-ledger-activity-section";
import { AdminSignupActivitySection } from "@/features/admin/admin-signup-activity-section";
import { AdminWalletConsole } from "@/features/admin/admin-wallet-console";
import {
  DashboardEmptyState,
  DashboardFooterNav,
  DashboardListSkeleton,
  DashboardPageShell,
  DashboardPagination,
  DashboardPanel,
  DashboardQueryError,
  DashboardSearchField,
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
  fetchAdminTables,
  fetchAdminUsers,
  postAdminChipGrant,
} from "@/lib/admin/api-admin";
import { formatAbsoluteShort, formatRelativeTime } from "@/lib/format-dashboard-time";
import { formatChips } from "@/lib/format-chips";
import { useAuthSession } from "@/providers/auth-context";

type AdminTab = "overview" | "users" | "clubs" | "tables" | "reports" | "wallet" | "credits";

const DIRECTORY_PAGE_SIZE = 50;

function tableStatusBadgeClass(status: string): string {
  if (status === "PLAYING") return "bg-emerald-950/90 text-emerald-200 ring-1 ring-emerald-500/35";
  if (status === "CLOSED") return "bg-zinc-800/90 text-zinc-400 ring-1 ring-zinc-600/40";
  if (status === "PAUSED") return "bg-amber-950/80 text-amber-200 ring-1 ring-amber-500/30";
  return "bg-sky-950/80 text-sky-200 ring-1 ring-sky-500/30";
}

export function AdminDashboardView() {
  const queryClient = useQueryClient();
  const { skipGate, ready, me } = useAuthSession();
  const isAdmin = me?.authenticated === true && me.isPlatformAdmin === true;
  const [tab, setTab] = useState<AdminTab>("overview");
  const [clubsSkip, setClubsSkip] = useState(0);
  const [usersSkip, setUsersSkip] = useState(0);
  const [tablesSkip, setTablesSkip] = useState(0);

  const [clubsSearchInput, setClubsSearchInput] = useState("");
  const [clubsSearch, setClubsSearch] = useState("");
  const [usersSearchInput, setUsersSearchInput] = useState("");
  const [usersSearch, setUsersSearch] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setClubsSearch(clubsSearchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [clubsSearchInput]);

  useEffect(() => {
    const t = window.setTimeout(() => setUsersSearch(usersSearchInput.trim()), 350);
    return () => window.clearTimeout(t);
  }, [usersSearchInput]);

  useEffect(() => {
    setClubsSkip(0);
  }, [clubsSearch]);

  useEffect(() => {
    setUsersSkip(0);
  }, [usersSearch]);

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
    queryKey: ["admin", "clubs", clubsSkip, DIRECTORY_PAGE_SIZE, clubsSearch],
    queryFn: async () => {
      const r = await fetchAdminClubs(clubsSkip, DIRECTORY_PAGE_SIZE, clubsSearch || undefined);
      if (!r) throw new Error("Could not load clubs directory.");
      return r;
    },
    enabled: ready && isAdmin && tab === "clubs",
  });

  const usersQ = useQuery({
    queryKey: ["admin", "users", usersSkip, DIRECTORY_PAGE_SIZE, usersSearch],
    queryFn: async () => {
      const r = await fetchAdminUsers(usersSkip, DIRECTORY_PAGE_SIZE, usersSearch || undefined);
      if (!r) throw new Error("Could not load users.");
      return r;
    },
    enabled: ready && isAdmin && tab === "users",
  });

  const tablesQ = useQuery({
    queryKey: ["admin", "tables", tablesSkip, DIRECTORY_PAGE_SIZE],
    queryFn: async () => {
      const r = await fetchAdminTables(tablesSkip, DIRECTORY_PAGE_SIZE);
      if (!r) throw new Error("Could not load tables directory.");
      return r;
    },
    enabled: ready && isAdmin && tab === "tables",
  });

  useEffect(() => {
    const d = clubsQ.data;
    if (!d || d.total === 0 || d.items.length > 0) return;
    if (d.skip > 0) {
      const lastSkip = Math.max(0, (Math.ceil(d.total / d.limit) - 1) * d.limit);
      setClubsSkip(lastSkip);
    }
  }, [clubsQ.data]);

  useEffect(() => {
    const d = usersQ.data;
    if (!d || d.total === 0 || d.items.length > 0) return;
    if (d.skip > 0) {
      const lastSkip = Math.max(0, (Math.ceil(d.total / d.limit) - 1) * d.limit);
      setUsersSkip(lastSkip);
    }
  }, [usersQ.data]);

  useEffect(() => {
    const d = tablesQ.data;
    if (!d || d.total === 0 || d.items.length > 0) return;
    if (d.skip > 0) {
      const lastSkip = Math.max(0, (Math.ceil(d.total / d.limit) - 1) * d.limit);
      setTablesSkip(lastSkip);
    }
  }, [tablesQ.data]);

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
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "tables"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "report"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "wallet"] });
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
        label: "Active (24h)",
        value: o.dailyActiveUsers24h,
        hint: "Users with profile updated in the last 24 hours.",
        tone: "emerald" as const,
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
        hint: "Club member rows with ACTIVE status.",
        tone: "emerald" as const,
      },
      {
        label: "Open tables",
        value: o.nonClosedTables,
        hint: "Tables not in CLOSED state.",
        tone: "default" as const,
      },
      {
        label: "Circulating chips",
        value: o.circulatingClubChips,
        hint: "Sum of ACTIVE members’ club wallet balances (play money).",
        tone: "amber" as const,
      },
    ];
  }, [overviewQ.data]);

  if (skipGate) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <DashboardEmptyState
          title="Admin console unavailable"
          description="Connect this app to your server and sign in with an administrator account."
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
            Your account is not authorized for this area. Ask your operator if you need access.
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
          Users, clubs, tables, activity reports, platform wallet queue, and club chip grants — in one
          place. Some advanced controls (suspensions, rake policy, audit logs) may be added in a future
          release.
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
          id="admin-tab-users"
          aria-controls="admin-panel-users"
          active={tab === "users"}
          onClick={() => setTab("users")}
          badge={usersQ.data?.total}
        >
          Users
        </DashboardTabButton>
        <DashboardTabButton
          id="admin-tab-clubs"
          aria-controls="admin-panel-clubs"
          active={tab === "clubs"}
          onClick={() => setTab("clubs")}
          badge={clubsQ.data?.total}
        >
          Clubs
        </DashboardTabButton>
        <DashboardTabButton
          id="admin-tab-tables"
          aria-controls="admin-panel-tables"
          active={tab === "tables"}
          onClick={() => setTab("tables")}
          badge={tablesQ.data?.total}
        >
          Tables
        </DashboardTabButton>
        <DashboardTabButton
          id="admin-tab-reports"
          aria-controls="admin-panel-reports"
          active={tab === "reports"}
          onClick={() => setTab("reports")}
        >
          Reports
        </DashboardTabButton>
        <DashboardTabButton
          id="admin-tab-wallet"
          aria-controls="admin-panel-wallet"
          active={tab === "wallet"}
          onClick={() => setTab("wallet")}
        >
          Wallet
        </DashboardTabButton>
        <DashboardTabButton
          id="admin-tab-credits"
          aria-controls="admin-panel-credits"
          active={tab === "credits"}
          onClick={() => setTab("credits")}
        >
          Credits
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
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <div
                    key={i}
                    className="h-[118px] animate-pulse rounded-xl border border-white/[0.05] bg-zinc-900/40"
                  />
                ))}
              </div>
            </div>
          ) : (
            <StatMetricGrid metrics={overviewMetrics} gridClassName="grid-cols-2 md:grid-cols-3" />
          )}
        </DashboardPanel>
      ) : tab === "users" ? (
        <DashboardPanel id="admin-panel-users" role="tabpanel" aria-labelledby="admin-tab-users">
          <DashboardSectionHeader
            title="User directory"
            description="Search by user id or display name (case-insensitive). Sorted by last profile update."
            aside={
              usersQ.data ? (
                <span className="tabular-nums text-zinc-400">{usersQ.data.total} users</span>
              ) : null
            }
          />
          <div className="mb-4">
            <DashboardSearchField
              aria-label="Search users"
              placeholder="Search user id or name…"
              value={usersSearchInput}
              onChange={setUsersSearchInput}
            />
          </div>
          {usersQ.isError ? (
            <DashboardQueryError
              message={usersQ.error instanceof Error ? usersQ.error.message : "Failed to load users."}
              onRetry={() => void usersQ.refetch()}
            />
          ) : usersQ.isPending ? (
            <DashboardListSkeleton rows={8} />
          ) : usersQ.data && usersQ.data.total === 0 ? (
            <DashboardEmptyState
              title="No matching users"
              description="Try a different search or clear the filter to see recent accounts."
            />
          ) : usersQ.data ? (
            <>
              <ul className="max-h-[min(60vh,28rem)] space-y-2 overflow-y-auto overscroll-contain pr-0.5 [-webkit-overflow-scrolling:touch]">
                {usersQ.data.items.map((u) => {
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
              <DashboardPagination
                skip={usersQ.data.skip}
                limit={usersQ.data.limit}
                total={usersQ.data.total}
                noun="users"
                onSkipChange={setUsersSkip}
              />
            </>
          ) : null}
        </DashboardPanel>
      ) : tab === "clubs" ? (
        <DashboardPanel id="admin-panel-clubs" role="tabpanel" aria-labelledby="admin-tab-clubs">
          <DashboardSectionHeader
            title="Club directory"
            description="Search by club name or id. Member counts are ACTIVE memberships only."
            aside={
              !clubsQ.isPending && clubsQ.data ? (
                <span className="tabular-nums text-zinc-400">{clubsQ.data.total} clubs</span>
              ) : null
            }
          />
          <div className="mb-4">
            <DashboardSearchField
              aria-label="Search clubs"
              placeholder="Search club name or id…"
              value={clubsSearchInput}
              onChange={setClubsSearchInput}
            />
          </div>
          {clubsQ.isError ? (
            <DashboardQueryError
              message={clubsQ.error instanceof Error ? clubsQ.error.message : "Failed to load clubs."}
              onRetry={() => void clubsQ.refetch()}
            />
          ) : clubsQ.isPending ? (
            <DashboardListSkeleton rows={8} />
          ) : clubsQ.data && clubsQ.data.total === 0 ? (
            <DashboardEmptyState
              title="No matching clubs"
              description="Try another search or clear the filter to browse the full directory."
            />
          ) : clubsQ.data ? (
            <>
              <ul className="max-h-[min(60vh,28rem)] divide-y divide-white/[0.05] overflow-y-auto overscroll-contain rounded-xl border border-white/[0.06] bg-zinc-900/25 [-webkit-overflow-scrolling:touch]">
                {clubsQ.data.items.map((c) => (
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
              <DashboardPagination
                skip={clubsQ.data.skip}
                limit={clubsQ.data.limit}
                total={clubsQ.data.total}
                noun="clubs"
                onSkipChange={setClubsSkip}
              />
            </>
          ) : null}
        </DashboardPanel>
      ) : tab === "tables" ? (
        <DashboardPanel id="admin-panel-tables" role="tabpanel" aria-labelledby="admin-tab-tables">
          <DashboardSectionHeader
            title="All tables"
            description="Server-side directory (every club table row). Open a row to moderate the live room."
            aside={
              tablesQ.data ? (
                <span className="tabular-nums text-zinc-400">{tablesQ.data.total} tables</span>
              ) : null
            }
          />
          {tablesQ.isError ? (
            <DashboardQueryError
              message={tablesQ.error instanceof Error ? tablesQ.error.message : "Failed to load tables."}
              onRetry={() => void tablesQ.refetch()}
            />
          ) : tablesQ.isPending ? (
            <DashboardListSkeleton rows={8} />
          ) : tablesQ.data && tablesQ.data.total === 0 ? (
            <DashboardEmptyState title="No tables" description="No table documents exist in the database." />
          ) : tablesQ.data ? (
            <>
              <ul className="max-h-[min(60vh,28rem)] divide-y divide-white/[0.05] overflow-y-auto overscroll-contain rounded-xl border border-white/[0.06] bg-zinc-900/25 [-webkit-overflow-scrolling:touch]">
                {tablesQ.data.items.map((t) => (
                  <li
                    key={t.id}
                    className="flex min-h-[4.25rem] flex-wrap items-stretch divide-x divide-white/[0.06] sm:flex-nowrap"
                  >
                    <Link
                      href={`/tables/${encodeURIComponent(t.id)}`}
                      className="group flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-white/[0.04] sm:px-5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-zinc-100">{t.name}</p>
                        <p className="mt-1 truncate font-mono text-[11px] text-zinc-500">{t.id}</p>
                        <p className="mt-1 text-[11px] tabular-nums text-zinc-600">
                          Blinds {t.smallBlind}/{t.bigBlind} · min {formatChips(t.minBuyIn)} · {t.maxPlayers} max ·
                          timer {t.timerSeconds}s
                        </p>
                      </div>
                      <span className="text-lg text-zinc-600 transition group-hover:text-zinc-400" aria-hidden>
                        →
                      </span>
                    </Link>
                    <div className="flex shrink-0 flex-col items-stretch justify-center gap-2 px-3 py-3 sm:px-4">
                      <Link
                        href={`/clubs/${encodeURIComponent(t.clubId)}`}
                        className="text-center text-[11px] font-semibold text-amber-400/95 underline-offset-2 hover:underline"
                      >
                        {t.clubName}
                      </Link>
                      <span
                        className={`self-center rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${tableStatusBadgeClass(t.status)}`}
                      >
                        {t.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <DashboardPagination
                skip={tablesQ.data.skip}
                limit={tablesQ.data.limit}
                total={tablesQ.data.total}
                noun="tables"
                onSkipChange={setTablesSkip}
              />
            </>
          ) : null}
        </DashboardPanel>
      ) : tab === "reports" ? (
        <DashboardPanel id="admin-panel-reports" role="tabpanel" aria-labelledby="admin-tab-reports">
          <DashboardSectionHeader
            title="Platform reports"
            description="Daily new users and clubs, plus chip movement summaries."
          />
          <AdminSignupActivitySection />
          <AdminLedgerActivitySection />
        </DashboardPanel>
      ) : tab === "wallet" ? (
        <div id="admin-panel-wallet" role="tabpanel" aria-labelledby="admin-tab-wallet" className="space-y-6">
          <AdminWalletConsole />
        </div>
      ) : (
        <DashboardPanel id="admin-panel-credits" role="tabpanel" aria-labelledby="admin-tab-credits">
          <section className="rounded-xl border border-amber-500/25 bg-gradient-to-b from-amber-950/[0.22] to-zinc-950/30 p-5 sm:p-6">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200/95">
              Platform chip grant
            </h2>
            <p className="mt-2 max-w-xl text-[12px] leading-relaxed text-zinc-500">
              Adds or removes chips from a member&apos;s club wallet as an official platform adjustment.
              Totals and charts refresh after a successful grant.
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
