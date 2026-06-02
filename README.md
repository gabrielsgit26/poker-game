# Telegram Mini App Poker Platform

Monorepo aligned with `telegram_poker_platform_development_plan.md`.

## Structure

| Path | Purpose |
|------|---------|
| `apps/web` | Next.js (App Router) — Mini App UI |
| `apps/server` | NestJS — API + future Socket.IO |
| `packages/shared` | Shared TypeScript types |
| `packages/poker-engine` | Deck, hand evaluation, local heads-up runout |

## Developing without Telegram

- Open the web app in a normal browser at `/` (redirects to `/lobby`).
- Use **`/play`** for a local heads-up hand runout (deck + hand evaluation in the browser). No Mini App and no API session required.
- Telegram login can be added later without changing that flow.

## Phase 1 (current)

- App shell with bottom navigation (Lobby / Play / Tables / Profile)
- NestJS with MongoDB + Redis wiring and `GET /health`

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

2. Install from the **repository root** (required so workspace packages link correctly):

   ```bash
   npm install
   ```

   Prefer **`npm run dev:web`** from the root as well. If you run `npm run dev` inside `apps/web` only, run `npm install` from the root first so `@telegram-poker/*` resolves (or rely on the `tsconfig` path aliases added for the web app).

3. Run apps (two terminals):

   ```bash
   npm run dev:server
   npm run dev:web
   ```

- Web: [http://localhost:3000](http://localhost:3000) (redirects to `/lobby`)
- API: [http://localhost:3001/health](http://localhost:3001/health)

## Roadmap (plan §12)

Work proceeds phase-by-phase. Telegram Mini App auth is optional for local work — use `/play` in the browser first. Planned order: **2** Telegram auth (when you want it) → **3** Lobby data → … through **12** polish.
