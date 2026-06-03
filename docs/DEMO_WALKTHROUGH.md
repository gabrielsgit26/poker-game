# Demo video walkthrough script (Phase 12)

Use this checklist when recording a **2–4 minute** client-ready demo. Record in **portrait** for Telegram Mini App realism, or landscape for desktop review.

## Prerequisites

- Local stack: Next + Nest + Mongo + Redis (see root `.env.example`).
- Two browser profiles or one browser + incognito: **Owner / Manager** and **Player**.
- `NEXT_PUBLIC_API_URL=/api` with proxy to API so cookies work.

## Script

1. **Open app** — Show loading, then lobby (`/lobby`). Mention club name + balance in header.
2. **Auth** — If using dev login, show `/login` briefly; prefer Telegram path in production.
3. **Club** — Open a club (`/clubs/[id]`): roster, join flow or “already joined”, chip balance.
4. **Manager** — `/manager`: Overview KPIs, **Requests** (if queue empty, note it), **Tables** link to a room.
5. **Create table** — From lobby or club: stakes, timer, min buy-in; submit and land on `/tables/[id]`.
6. **Second player** — Second profile sits with buy-in; confirm both see **Live** socket state.
7. **Play one hand** — Blinds, actions, street change, pot chip pile, **your turn** haptic/audio (if enabled in Settings).
8. **Showdown** — Board runout, chip flight to winner(s), **Pot awarded** ticker; if hero wins, note celebration styling.
9. **Admin** — `/admin` (platform admin only): Overview, quick directory peek, Reports or Credits as relevant.
10. **Settings** — `/settings`: sound toggle, table theme (shows `ThemeRoot` tint on lobby).

## Capture tips

- Keep table UI **full screen** for 10–15s during the winning moment.
- Show **Settings → Sound on** then a fold + a street for audio (viewer may need one tap first to unlock Web Audio on iOS).
- End on lobby or club card grid for a clean frame.

## Post-production

- Add lower-third: “MVP build — not production rake / KYC”.
- Optional: 1x speed, no background music so table sounds read clearly.
