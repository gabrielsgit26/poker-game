# Telegram Mini App Poker Platform

Monorepo aligned with `telegram_poker_platform_development_plan.md`.

## Structure

| Path | Purpose |
|------|---------|
| `apps/web` | Next.js — lobby (Phase 3), **`/play`**, TanStack Query, `src/lib/poker-engine`, `src/features/lobby` |
| `apps/server` | NestJS — API + future Socket.IO |
| `packages/shared` | Shared TypeScript types |

## Developing without Telegram

- Open the web app in a normal browser at `/` (redirects to `/lobby`).
- Use **`/play`** for a local heads-up hand runout (deck + hand evaluation in the browser). No Mini App and no API session required.
- Telegram login can be added later without changing that flow.

## Phase 1–3 (current)

- **Phase 1:** App shell, bottom navigation, Nest `GET /health`, in-browser poker engine on **`/play`**
- **Phase 3:** Lobby UI — header, balance, quick actions, **TanStack Query** + mock API, filters, club & table cards, skeletons, empty states, placeholder **`/clubs/[clubId]`**

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

Work proceeds phase-by-phase. Telegram auth is optional for local work. **Phase 3** lobby uses mock data until the API exists. Planned: **2** Telegram auth (optional) → **4** Profile → **5** Clubs (replace mocks) → … through **12** polish.
