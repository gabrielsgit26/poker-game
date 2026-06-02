# Development status vs `telegram_poker_platform_development_plan.md` (§12 roadmap)

This file tracks **MVP roadmap phases** (plan §12). “Done” means good enough for local MVP / demo; production hardening is called out separately.

| Phase | Topic | Status | Notes |
|------|--------|--------|--------|
| **1** | Foundation (Next, Nest, Mongo, Redis, env, shared, layout, bottom nav) | **Done** | Inter font aligned with plan §11.2. Use `API_PROXY_TARGET` + `NEXT_PUBLIC_API_URL=/api` for first-party cookies (Phase 2). |
| **2** | Telegram auth (initData, cookie session, `/auth/me`, protected routes) | **Partial** | **Done:** `User` model, Redis session + HTTP-only `poker_sid`, `GET /auth/me`, `POST /auth/dev-login`, `POST /auth/logout`, `POST /auth/telegram` (501 stub), global middleware (`pokerUserId` from cookie or `X-Dev-User-Id`). **Web:** `AuthProvider`, `credFetch`, Settings “Dev session”, Socket.IO via same-origin when using `/api` rewrites. **Todo:** validate Telegram `initData`, Mini App login page, route guards. |
| **3** | Lobby UI | **Mostly done** | Header, clubs/tables, filters, skeletons, nav — refine filters/empty states vs plan §6.2 as needed. |
| **4** | Profile & settings | **Mostly done** | Mock/stub data where no wallet; theme + forms. |
| **5** | Club system | **Done** | Create, join request, approve, detail, roles. |
| **6** | Table management | **Done** | Create, list, sit, leave, close; timers + Redis. |
| **7** | Poker engine | **Done** | `packages/shared/poker-engine` — NL MVP (side pots / full all-in tree: partial). |
| **8** | Realtime gameplay | **Done** | Socket.IO, `gameAction`, `tableState`, holdem snapshot, clock + engine timeout path. Event names differ from plan §8 (optional rename later). |
| **9** | Wallet / credits | **Not started** | Plan §12 Phase 9. |
| **10** | Dashboards | **Not started** | Club manager + admin (plan §6.7–6.8, §12 Phase 10). |
| **11** | Security / anti-cheat | **Partial** | Private club socket gate; **Todo:** rate limits, IP block, suspension, audit logs. |
| **12** | Polish | **Partial** | Plan PixiJS / Framer / shadcn — incremental. |

## Recommended local env (auth + API proxy)

See root `.env.example`: set `NEXT_PUBLIC_API_URL=/api` and `API_PROXY_TARGET=http://localhost:3001` so the browser talks only to the Next origin; session cookies work with `credentials: 'include'`.

## Next steps (strictly one phase at a time)

1. Finish **Phase 2**: Telegram `initData` verification, login page, protect routes.  
2. **Phase 9** wallet, then **Phase 10** dashboards, then **Phase 11** hardening, then **Phase 12** polish.
