# Development status vs `telegram_poker_platform_development_plan.md` (§12 roadmap)

This file tracks **MVP roadmap phases** (plan §12). “Done” means good enough for local MVP / demo; production hardening is called out separately.

| Phase | Topic | Status | Notes |
|------|--------|--------|--------|
| **1** | Foundation (Next, Nest, Mongo, Redis, env, shared, layout, bottom nav) | **Done** | Inter font aligned with plan §11.2. Use `API_PROXY_TARGET` + `NEXT_PUBLIC_API_URL=/api` for first-party cookies (Phase 2). |
| **2** | Telegram auth (initData, cookie session, `/auth/me`, protected routes) | **Mostly done** | **Done:** Redis `poker_sid`, `GET /auth/me`, `POST /auth/dev-login`, `POST /auth/logout`, **`POST /auth/telegram`** (Mini App `initData` HMAC + `tg_<id>` users), `verifyTelegramWebAppInitData` + Jest, middleware, **`/login`**, **`MainAuthGate`**, `hasAuthApi()`, table/club **API error surfaces** + toasts. **Todo:** optional JWT for sockets, production Mini App URL docs. |
| **3** | Lobby UI | **Mostly done** | Header, clubs/tables, filters, skeletons, nav — refine filters/empty states vs plan §6.2 as needed. |
| **4** | Profile & settings | **Mostly done** | **Profile:** **`GET /profile`** (Nest) returns live **`users`** + **`club_members`** balances, merged **`chip_ledger`** + **`platform_wallet_requests`** (newest 60 rows), **`stats.netChips`** from ledger sums; **`stats.tracked`** false until hand-history aggregates exist (UI shows “—” for hands / win rate / biggest pot). Web profile requires **`NEXT_PUBLIC_API_URL`** + session (no offline mock). Header shows total + platform / club split like the lobby. **Wallet** entry removed from profile (use lobby / bottom nav **`/wallet`**). **Settings:** theme + sound/vibration + forms (see plan §6.6). |
| **5** | Club system | **Done** | Create, join request, approve, detail, roles. |
| **6** | Table management | **Done** | Create, list, sit, leave, close; timers + Redis. |
| **7** | Poker engine | **Done** | `packages/poker-engine` (`@telegram-poker/poker-engine`) — NL MVP (side pots / full all-in tree: partial). |
| **8** | Realtime gameplay | **Done** | Socket.IO, `gameAction`, `tableState`, holdem snapshot, clock + engine timeout path. Event names differ from plan §8 (optional rename later). |
| **9** | Wallet / credits | **Done (MVP)** | Club chip wallet, buy-in/leave + **`chip_ledger`**, manager adjust, cash-out requests, CSV export, **`PLATFORM_ADJUST`** via **`POST /admin/clubs/:clubId/members/:userId/chip-grant`** (env **`PLATFORM_ADMIN_USER_IDS`**), **`isPlatformAdmin`** on **`GET /auth/me`**. **Platform wallet:** **`platformBalanceChips`** on user, **`platform_wallet_requests`** schema uses explicit **`@Prop({ type: String })`** / **`Date`** for nullable fields (NestJS/Mongoose). **`/wallet/*`** (balance, list, deposit/withdraw requests, player cancel), **`/admin/wallet/*`** (queue, approve/reject/cancel, daily UTC report). Web **`/wallet`**, lobby balance → wallet, bottom nav **Wallet** tab; profile **`/profile`** surfaces the same balances via **`GET /profile`** (no separate wallet CTA on profile). |
| **10** | Dashboards | **Done (MVP)** | **`/admin`:** tabbed console (Overview KPIs, searchable Users/Clubs, paged Tables, Reports = signups + **`GET /admin/report/ledger-daily`** chart, **Wallet** = platform deposit/withdraw queue + daily approved-volume chart, Credits / platform club grant). **`/manager`:** Overview (clubs, members, circulating chips via **`GET /clubs/manager/chip-totals`**, live tables, queues), **Requests** tab (approve/reject join + cash-out via existing PATCH APIs), Clubs, paged Tables. **Post-MVP:** DAU/MAU beyond heuristics, suspend users/clubs, immutable admin audit log UI, global rake policy UI, manager analytics (hand volume / rake / top players) from dedicated aggregates. |
| **11** | Security / anti-cheat | **Partial** | Private club socket gate; **Todo:** rate limits, IP block, suspension, audit logs. |
| **12** | Polish | **Done (MVP)** | **Table:** Web Audio cues (`table-sounds.ts`) for street, hole deal, chips→pot, pot→winners, your turn, fold — gated by Settings → Sound; **haptics** on your turn (Settings → Vibration). **Winner:** hero payout ticker gets emerald pulse (`poker-hand-outcome-ticker--hero-win`). **`prefers-reduced-motion`:** shorter chip/board animations; outcome ticker animation disabled. **Mobile:** 44px min touch targets on table header controls; safe-area padding on chrome. **Docs:** `docs/DEMO_WALKTHROUGH.md` for recording. **Post-MVP:** Pixi layer, richer SFX library, optional music, full non-table motion pass. |

## Recommended local env (auth + API proxy)

See root `.env.example`: set `NEXT_PUBLIC_API_URL=/api` and `API_PROXY_TARGET=http://localhost:3001` so the browser talks only to the Next origin; session cookies work with `credentials: 'include'`.

## Next steps (strictly one phase at a time)

1. **Phase 11** hardening (rate limits, suspension, audit logs), then **Phase 12+** product polish as needed.  
2. **Phase 10 optional / post-MVP:** manager & admin volume/rake reports once hand history aggregates exist.  
3. **Phase 9 optional:** paginated ledger export on server.  
4. **Phase 4 optional:** persist hand-level KPIs server-side and set **`stats.tracked`** on **`GET /profile`** when aggregates exist.
