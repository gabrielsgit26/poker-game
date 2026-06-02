# Telegram Mini App Poker Platform

Monorepo aligned with `telegram_poker_platform_development_plan.md`.

## Structure

| Path | Purpose |
|------|---------|
| `apps/web` | Next.js — lobby, **`/play`**, profile, settings, **`/clubs/*`**, **`/tables/*`** (Phase 6), TanStack Query, `src/lib/poker-engine` |
| `apps/server` | NestJS — **`GET /health`**, **`/clubs`**, **`/tables`** (MongoDB tables + seats), future Socket.IO |
| `packages/shared` | Shared TypeScript types |

## Developing without Telegram

- Open the web app in a normal browser at `/` (redirects to `/lobby`).
- Use **`/play`** for a local heads-up hand runout (deck + hand evaluation in the browser). No Mini App and no API session required.
- Telegram login can be added later without changing that flow.

## Phase 1–6 (current)

- **Phase 1:** App shell, bottom navigation, Nest `GET /health`, in-browser poker engine on **`/play`**
- **Phase 3:** Lobby UI — header, balance, quick actions, **TanStack Query**, filters, club & table cards, skeletons, empty states
- **Phase 4:** **`/profile`**, **`/settings`** (client prefs + theme), bottom nav Settings
- **Phase 5 (clubs):** Nest **`/clubs`** — list, create, detail, join, join-request approve/reject. Seed `c1`–`c4`; **`local-player`** is **MANAGER** on **`c1`**, member on **`c2`**, **OWNER** on **`c4`** with a pending join request from **`demo-applicant`**. Web: **`/clubs/new`**, **`/clubs/[id]`**.
- **Phase 6 (tables):** Nest **`/tables`** — `GET` list (open tables), `POST` create (club **owner/manager** only), `GET /:id` detail with seats, `POST /:id/sit`, `POST /:id/leave`, `POST /:id/close` (creator or club owner/manager). Seed **`t1`–`t4`** with bot seats when `club_tables` is empty and clubs **`c1`/`c2`** exist. Web lobby merges **API tables** when **`NEXT_PUBLIC_API_URL`** is set (copy **`apps/web/.env.example`** → **`apps/web/.env.local`**); **`/tables`** lists + create form; **`/tables/[id]`** seat grid and close. To re-seed clubs/tables after schema changes, drop Mongo collections `clubs`, `club_members`, `club_join_requests`, **`club_tables`**, **`table_seats`** and restart the API.

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
- API: [http://localhost:3001/health](http://localhost:3001/health)

## Roadmap (plan §12)

Work proceeds phase-by-phase. Telegram auth is optional for local work. Lobby uses **API clubs + tables** when `NEXT_PUBLIC_API_URL` is set. Planned: **2** Telegram auth (optional) → **7** Engine server-side / **8** Socket.IO → … through **12** polish.
