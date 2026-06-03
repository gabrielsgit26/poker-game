# Development status vs `telegram_poker_platform_development_plan.md` (§12 roadmap)

This file tracks **MVP roadmap phases** (plan §12). “Done” means good enough for local MVP / demo; production hardening is called out separately.

| Phase | Topic | Status | Notes |
|------|--------|--------|--------|
| **1** | Foundation (Next, Nest, Mongo, Redis, env, shared, layout, bottom nav) | **Done** | Inter font aligned with plan §11.2. Use `API_PROXY_TARGET` + `NEXT_PUBLIC_API_URL=/api` for first-party cookies (Phase 2). |
| **2** | Telegram auth (initData, cookie session, `/auth/me`, protected routes) | **Mostly done** | **Done:** Redis `poker_sid`, `GET /auth/me`, `POST /auth/dev-login`, `POST /auth/logout`, **`POST /auth/telegram`** (Mini App `initData` HMAC + `tg_<id>` users), `verifyTelegramWebAppInitData` + Jest, middleware, **`/login`**, **`MainAuthGate`**, `hasAuthApi()`, table/club **API error surfaces** + toasts. **Todo:** optional JWT for sockets, production Mini App URL docs. |
| **3** | Lobby UI | **Mostly done** | Header, clubs/tables, filters, skeletons, nav — refine filters/empty states vs plan §6.2 as needed. |
| **4** | Profile & settings | **Mostly done** | Mock/stub data where no wallet; theme + forms. |
| **5** | Club system | **Done** | Create, join request, approve, detail, roles. |
| **6** | Table management | **Done** | Create, list, sit, leave, close; timers + Redis. |
| **7** | Poker engine | **Done** | `packages/shared/poker-engine` — NL MVP (side pots / full all-in tree: partial). |
| **8** | Realtime gameplay | **Done** | Socket.IO, `gameAction`, `tableState`, holdem snapshot, clock + engine timeout path. Event names differ from plan §8 (optional rename later). |
| **9** | Wallet / credits | **Done (MVP)** | Club chip wallet, buy-in/leave + **`chip_ledger`**, manager adjust, cash-out requests, CSV export, **`PLATFORM_ADJUST`** via **`POST /admin/clubs/:clubId/members/:userId/chip-grant`** (env **`PLATFORM_ADMIN_USER_IDS`**), **`isPlatformAdmin`** on **`GET /auth/me`**. |
| **10** | Dashboards | **In progress** | **`/manager`** / **`/admin`** — professional **console** layout (ambient background, executive header, segmented tabs, KPI tiles with locale numbers, section headers, data rows with hover affordance, shared footer). Admin grants use a responsive form grid. **Todo:** charts, server reports, pagination (plan §6.7–6.8). |
| **11** | Security / anti-cheat | **Partial** | Private club socket gate; **Todo:** rate limits, IP block, suspension, audit logs. |
| **12** | Polish | **In progress** | **Live table:** SVG oval + HTML `PokerSeatHud`, CSS chip flights, outcome ticker, post-hand dwell. **Todo:** sounds, side-pot UI, optional Pixi layer, walkthrough. |

## Recommended local env (auth + API proxy)

See root `.env.example`: set `NEXT_PUBLIC_API_URL=/api` and `API_PROXY_TARGET=http://localhost:3001` so the browser talks only to the Next origin; session cookies work with `credentials: 'include'`.

## Next steps (strictly one phase at a time)

1. **Phase 10:** reports/charts + pagination for admin/manager lists (plan §6.7–6.8); optional shared tab UI component.  
2. **Phase 11** hardening, then **Phase 12** polish.  
3. **Phase 9 optional:** paginated ledger export on server.
