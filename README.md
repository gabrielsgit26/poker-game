# Telegram Mini App Poker Platform

Monorepo aligned with `telegram_poker_platform_development_plan.md`.

## Structure

| Path | Purpose |
|------|---------|
| `apps/web` | Next.js — lobby, **`/wallet`** (platform balance, deposit/withdraw requests, history), **`/tables/*`** (**SVG** oval felt + **HTML** seat HUD / actions; chip flights + deal animations in CSS), **`/clubs/*`**, Socket.IO, TanStack Query |
| `apps/server` | NestJS — **`GET /health`**, **`/auth/*`**, **`/clubs`**, **`/tables`**, **Socket.IO** (table rooms, `tableState` / `tableClosed`) |
| `packages/shared` | Shared types and **`@telegram-poker/shared/poker-engine`** (NL hold’em: deck, streets, pot, showdown) |

## Developing without Telegram

- Open the web app in a normal browser at `/` (redirects to `/lobby`).
- Use **`/tables`** to browse club tables (requires API session when auth gate is on). The NL hold’em engine lives in **`packages/shared`** and powers the live **`HoldemCoordinator`** on the API.
- Telegram login can be added later without changing that flow.

See **[docs/DEVELOPMENT_STATUS.md](docs/DEVELOPMENT_STATUS.md)** for a phase-by-phase checklist vs `telegram_poker_platform_development_plan.md` §12.

## Phase 1–8 (MVP engine + live table)

- **Phases 1–6:** As before (shell, lobby, profile, settings, clubs, tables with seats + HTTP sit/leave/close).
- **Phase 7:** **`packages/shared/src/poker-engine`** — NL-style state machine (`startHoldemHand`, `applyHoldemAction`, board runout, pot, payouts). Imported by the Nest **`HoldemCoordinator`** (Redis `poker:table:{id}:holdem` + dealer button key).
- **Phase 8:** Socket.IO **`gameAction`** with `{ type: 'fold' | 'check' | 'call' | 'bet' | 'raise_to', amount? }` during **`holdem.phase === 'betting'`**; legacy **`tableAction`** (`check` \| `fold`) remains for the synthetic turn when no engine hand is active. **`tableState`** and **`GET /tables/:id`** include **`holdem`** (public snapshot) and per-viewer **`viewerHoleCards`**; **`joinTable`** may emit **`yourHoleCards`**. The action clock applies hold’em **check**/**fold** on timeout when a betting hand is active. **Still TODO:** JWT auth, side pots / full all-in rules, production multi-node timers.

## Prerequisites

- Node.js 20+
- **MongoDB** and **Redis** only when you run the Nest API (`npm run dev:server`); configure `apps/server/.env`. Platform wallet requests and balances are stored with your Mongo user documents and **`platform_wallet_requests`** collection.

## Setup

1. Copy environment file for the API:

   ```bash
   copy .env.example apps\server\.env
   ```

   On macOS/Linux: `cp .env.example apps/server/.env`

   Adjust `MONGODB_URI` and `REDIS_URL` if your instances are not on `127.0.0.1` with the default ports.

   For **clubs + tables in the browser**, copy `apps/web/.env.example` to `apps/web/.env.local` and set `NEXT_PUBLIC_API_URL=http://localhost:3001` (or your API URL). Restart `npm run dev:web` after changing env. If you need a clean seed, drop Mongo collections `clubs`, `club_members`, `club_join_requests`, `club_tables`, and `table_seats`, then restart the API.

2. Install from the **repository root** (required so workspace packages link correctly):

   ```bash
   npm install
   ```

   Prefer **`npm run dev:web`** from the root as well. If you run `npm run dev` inside `apps/web` only, run `npm install` from the root first so `@telegram-poker/*` resolves.

   **Dev server:** `npm run dev:web` uses **`next dev` (webpack)** so hoisted `react` / TanStack / workspace packages resolve correctly. **`npm run dev:turbo`** (`next dev --turbopack`) often breaks on Windows + npm workspaces because Turbopack will not load modules outside the `apps/web` project root, even with path aliases — avoid turbo for local dev unless you move deps under `apps/web/node_modules`.

3. Run apps (two terminals):

   ```bash
   npm run dev:server
   npm run dev:web
   ```

- Web: [http://localhost:3000](http://localhost:3000) (redirects to `/lobby`)
- API + WebSocket: [http://localhost:3001](http://localhost:3001) (REST + Socket.IO path **`/socket.io`**; CORS allows `http://localhost:3000`)

## Roadmap (plan §12)

Work proceeds phase-by-phase. Telegram auth is optional for local work. Next: **Phase 2** Telegram auth, **Phase 9** wallet, … through **12** polish. Engine follow-ups: side pots, stricter validation, automated tests.
