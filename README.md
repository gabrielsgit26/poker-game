# Telegram Mini App Poker Platform

Monorepo aligned with `telegram_poker_platform_development_plan.md`.

## Structure

| Path | Purpose |
|------|---------|
| `apps/web` | Next.js — lobby, **`/play`**, profile, settings, **`/clubs/*`**, **`/tables/*`**, Socket.IO client on table detail (Phase 8), TanStack Query, `src/lib/poker-engine` |
| `apps/server` | NestJS — **`GET /health`**, **`/clubs`**, **`/tables`**, **Socket.IO** (table rooms, `tableState` / `tableClosed`), future full game gateway |
| `packages/shared` | Shared TypeScript types |

## Developing without Telegram

- Open the web app in a normal browser at `/` (redirects to `/lobby`).
- Use **`/play`** for a local heads-up hand runout (deck + hand evaluation in the browser). No Mini App and no API session required.
- Telegram login can be added later without changing that flow.

## Phase 1–8 (partial)

- **Phases 1–6:** As before (shell, lobby, profile, settings, clubs, tables with seats + HTTP sit/leave/close).
- **Phase 8 (realtime — started):** Socket.IO on the **same port** as the REST API (`/socket.io`). **`joinTable`** / **`leaveTable`** / **`tableAction`** (`check` | `fold`, seated players only); handshake **`auth.userId`** (or `query.userId`) sets the dev identity; **private-club** tables require an **active club member** before joining the socket room. **`tableState`** + HTTP detail include **`turnDeadlineEpochMs`** (Redis `poker:table:{id}:turnDeadline`, refreshed on sit/leave/create/socket action; cleared on close) and **`lastAction`** (`poker:table:{id}:lastAction`). Web **`useTableSocket`** sends **`auth: { userId }`**, merges socket payloads into the table query, **`emitTableAction`**, **`TurnCountdown`**, and seat **Check** / **Fold** when live. Still TODO: real street/turn engine, auto-check/fold, JWT auth.

## Prerequisites

- Node.js 20+
- **MongoDB** and **Redis** only when you run the Nest API (`npm run dev:server`); configure `apps/server/.env`. The **`/play`** route is client-only and does not use the API or databases.

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

Work proceeds phase-by-phase. Telegram auth is optional for local work. Next: **Phase 8** (in-game socket actions, auto-check/fold), **Phase 7** server-side engine alignment, **Phase 2** Telegram auth, **Phase 9** wallet, … through **12** polish.
