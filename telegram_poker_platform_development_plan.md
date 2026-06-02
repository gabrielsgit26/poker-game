# Telegram Mini App Poker Platform — Professional Development Plan

## 1. Product Goal

Build a professional Telegram Mini App poker platform inspired by club-based poker apps such as ClubGG / PokerBros.

The platform should support:

- Telegram Mini App login
- Player lobby
- Club-based private poker rooms
- Real-time Texas Hold’em gameplay
- Player profile and settings
- Club manager dashboard
- Master admin panel
- Credit/chip management
- Anti-cheating protections
- Push notifications
- Professional mobile-first game UI

The first target is a strong MVP/demo that looks polished, stable, and easy to understand.

---

# 2. Recommended Tech Stack

## 2.1 Frontend

Use:

```txt
Next.js App Router + TypeScript
```

This gives a clean production-ready structure for the Telegram Mini App, lobby, profile, settings, admin dashboard, and club manager dashboard.

## 2.2 UI / Styling

Use:

```txt
Tailwind CSS + shadcn/ui
```

Use `shadcn/ui` for professional app screens:

- Cards
- Buttons
- Dialogs
- Dropdown menus
- Tabs
- Tables
- Forms
- Toast messages
- Badges
- Avatars
- Skeleton loaders
- Sidebars

Use Tailwind CSS for custom game styling:

- Dark casino theme
- Poker table gradients
- Glassmorphism cards
- Mobile bottom navigation
- Responsive layouts

## 2.3 Game Rendering

Use:

```txt
PixiJS
```

PixiJS is recommended for the actual poker table because it handles 2D game rendering smoothly.

Use PixiJS for:

- Poker table canvas
- Player seats
- Cards
- Chips
- Pot animations
- Winner animation
- Turn highlight
- Card dealing animation

## 2.4 Animation

Use:

```txt
Framer Motion
```

Use for:

- Page transitions
- Modal animations
- Lobby cards
- Dashboard panels
- Profile stats
- Smooth UI feedback

## 2.5 Frontend State

Use:

```txt
Zustand
```

Use Zustand for:

- Current user state
- Current table state
- UI preferences
- Sound settings
- Socket connection state
- Selected club/table state

## 2.6 API Data Fetching

Use:

```txt
TanStack Query
```

Use for:

- User profile
- Club list
- Table list
- Transaction history
- Admin reports
- Club manager dashboard data

---

# 3. Backend Stack

## 3.1 Backend Framework

Recommended:

```txt
NestJS + TypeScript
```

NestJS is better for a serious platform because it keeps the backend organized.

Recommended backend modules:

```txt
AuthModule
UserModule
SessionModule
ClubModule
TableModule
GameModule
WalletModule
AdminModule
NotificationModule
AnalyticsModule
SocketGateway
```

Alternative:

```txt
Express + TypeScript
```

Express is faster to start, but NestJS is more professional for long-term development.

## 3.2 Realtime Engine

Use:

```txt
Socket.IO
```

Use Socket.IO for:

- Joining table
- Leaving table
- Player actions
- Real-time table state
- Turn timer
- Reconnection
- Disconnect handling
- Chat/emotes
- Spectator updates

## 3.3 Background Jobs

Use:

```txt
BullMQ
```

Use BullMQ for:

- Telegram notifications
- Daily reports
- Cleanup inactive games
- Auto cash-out processing
- Analytics aggregation
- Expired session cleanup

---

# 4. Database Choice

## 4.1 Main Database

Preferred database:

```txt
MongoDB
```

MongoDB is a good choice for this poker game because the data structure is flexible and the project will change quickly during development.

Use MongoDB for:

- Users
- Telegram accounts
- Sessions
- Clubs
- Club members
- Tables
- Wallet balances
- Transactions
- Game history
- Hand history
- Admin logs
- Rake settings
- Reports
- Notifications

Recommended ODM:

```txt
Mongoose
```

Mongoose is recommended because it gives:

- Schema validation
- TypeScript support
- Easy model structure
- Middleware/hooks
- Good ecosystem support
- Fast development speed

## 4.2 Realtime Game State Database

Use:

```txt
Redis
```

Redis should be used for live gameplay state.

Use Redis for:

- Active table state
- Current hand state
- Current turn
- Seat status
- Player socket presence
- Turn countdown timers
- Reconnection state
- Temporary locks
- Rate limits

## 4.3 Why Use MongoDB + Redis?

Poker needs two types of data.

### Permanent Data

This should be stored in MongoDB.

Examples:

```txt
User profile
Club membership
Wallet transactions
Finished hand history
Admin logs
Reports
```

### Live Temporary Data

This should be stored in Redis.

Examples:

```txt
Current cards
Current pot
Current player turn
Current betting round
Socket connection state
15-second timer
```

Recommended architecture:

```txt
MongoDB = permanent source of truth
Redis = fast live game memory
Socket.IO = real-time communication
```

## 4.4 Why MongoDB Is Good for This Project

MongoDB is useful because poker platform data can be document-based.

For example, a finished hand can be stored as one document:

```json
{
  "tableId": "table_123",
  "clubId": "club_123",
  "handNumber": 42,
  "players": [
    {
      "userId": "user_1",
      "seat": 1,
      "startingChips": 5000,
      "endingChips": 6200
    }
  ],
  "communityCards": ["Ah", "Ks", "7d", "2c", "9h"],
  "actions": [
    {
      "userId": "user_1",
      "action": "raise",
      "amount": 200,
      "street": "preflop",
      "timestamp": "2026-06-02T00:00:00.000Z"
    }
  ],
  "winners": [
    {
      "userId": "user_1",
      "amount": 1200,
      "handRank": "Two Pair"
    }
  ]
}
```

This is easier than splitting every hand action into many SQL tables during early development.

## 4.5 Important MongoDB Rule

Do not store all live table changes directly into MongoDB every second.

Bad approach:

```txt
Every bet/check/fold updates MongoDB immediately as the only game state
```

Better approach:

```txt
Redis stores active hand state
Socket.IO broadcasts live changes
MongoDB stores important final results and transaction records
```

## 4.6 Recommended Collections

Recommended MongoDB collections:

```txt
users
sessions
clubs
clubMembers
clubJoinRequests
pokerTables
wallets
walletTransactions
hands
adminLogs
rakeSettings
notifications
analyticsDaily
```

## 4.7 Example Mongoose Models

### User

```ts
const UserSchema = new Schema(
  {
    telegramId: { type: String, unique: true, required: true },
    username: String,
    firstName: String,
    lastName: String,
    avatarUrl: String,
    role: {
      type: String,
      enum: ["PLAYER", "CLUB_MANAGER", "MASTER_ADMIN"],
      default: "PLAYER",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED"],
      default: "ACTIVE",
    },
    lastLoginAt: Date,
  },
  { timestamps: true }
);
```

### Session

```ts
const SessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, unique: true, required: true },
    expiresAt: { type: Date, required: true },
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
);
```

### Club

```ts
const ClubSchema = new Schema(
  {
    name: { type: String, required: true },
    description: String,
    logoUrl: String,
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED"],
      default: "ACTIVE",
    },
    settings: {
      defaultTimerSeconds: { type: Number, default: 15 },
      minBuyIn: { type: Number, default: 1000 },
      maxBuyIn: { type: Number, default: 100000 },
      rakePercent: { type: Number, default: 5 },
      rakeCap: { type: Number, default: 100 },
    },
  },
  { timestamps: true }
);
```

### Club Member

```ts
const ClubMemberSchema = new Schema(
  {
    clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["OWNER", "MANAGER", "AGENT", "MEMBER"],
      default: "MEMBER",
    },
    status: {
      type: String,
      enum: ["ACTIVE", "BLOCKED"],
      default: "ACTIVE",
    },
    clubChips: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ClubMemberSchema.index({ clubId: 1, userId: 1 }, { unique: true });
```

### Poker Table

```ts
const PokerTableSchema = new Schema(
  {
    clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true },
    name: { type: String, required: true },
    smallBlind: { type: Number, required: true },
    bigBlind: { type: Number, required: true },
    minBuyIn: { type: Number, required: true },
    maxBuyIn: { type: Number, required: true },
    maxPlayers: { type: Number, default: 6 },
    timerSeconds: { type: Number, default: 15 },
    status: {
      type: String,
      enum: ["WAITING", "PLAYING", "PAUSED", "CLOSED"],
      default: "WAITING",
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);
```

### Wallet Transaction

```ts
const WalletTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    clubId: { type: Schema.Types.ObjectId, ref: "Club" },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: [
        "ADMIN_CREDIT_ADD",
        "ADMIN_CREDIT_REMOVE",
        "MANAGER_CREDIT_ADD",
        "MANAGER_CREDIT_REMOVE",
        "BUY_IN",
        "CASH_OUT",
        "RAKE",
        "HAND_WIN",
        "HAND_LOSS",
      ],
      required: true,
    },
    balanceBefore: Number,
    balanceAfter: Number,
    description: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
```

### Hand History

```ts
const HandSchema = new Schema(
  {
    tableId: { type: Schema.Types.ObjectId, ref: "PokerTable", required: true },
    clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true },
    handNumber: Number,
    players: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        seat: Number,
        startingChips: Number,
        endingChips: Number,
        holeCardsEncrypted: [String],
      },
    ],
    communityCards: [String],
    actions: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        action: String,
        amount: Number,
        street: String,
        timestamp: Date,
      },
    ],
    winners: [
      {
        userId: { type: Schema.Types.ObjectId, ref: "User" },
        amount: Number,
        handRank: String,
      },
    ],
    rakeAmount: Number,
    startedAt: Date,
    endedAt: Date,
  },
  { timestamps: true }
);
```

---

# 5. App Structure

Recommended monorepo:

```txt
telegram-poker-platform/
  apps/
    web/
      app/
      components/
      features/
      lib/
      stores/
      styles/
    server/
      src/
        modules/
        gateways/
        common/
        jobs/
  packages/
    shared/
      types/
      poker-engine/
      constants/
      validators/
```

---

# 6. Main Pages and Detailed UI Plan

## 6.1 Login / Loading Page

Route:

```txt
/login
```

Purpose:

Authenticate Telegram user and create a secure app session.

### UI Requirements

The page should feel premium, not like a basic loading screen.

Include:

- App logo
- Dark casino background
- Soft poker table glow
- Loading animation
- Text: “Connecting to Telegram...”
- Error state if Telegram login fails
- Retry button
- Support message if opened outside Telegram

### UI Components

- Logo
- Loading spinner
- Status message
- Error card
- Retry button

### Login Flow

```txt
1. User opens Telegram Mini App
2. Frontend reads Telegram WebApp initData
3. Frontend sends initData to backend
4. Backend validates Telegram signature
5. Backend creates/updates user
6. Backend creates secure HTTP-only session cookie
7. Frontend calls /api/auth/me
8. User redirects to /lobby
```

### Session APIs

```txt
POST /api/auth/telegram
GET  /api/auth/me
POST /api/auth/logout
```

---

## 6.2 Lobby Page

Route:

```txt
/lobby
```

Purpose:

The main home screen for players.

### Top User Header

Include:

- Player avatar
- Username
- Balance/chip amount
- Notification icon
- Settings icon
- Profile shortcut

Example:

```txt
[Avatar] Hello, Seiichi
Balance: 12,500 chips          [Bell] [Settings]
```

### Quick Actions

Cards or buttons:

- Quick Join
- Join Club
- My Clubs
- Create Table, only for club manager

### Club Cards

Each club card should show:

- Club logo
- Club name
- Member count
- Active tables count
- Status badge: Joined / Pending / Private
- Open or Join button

### Table Cards

Each table card should show:

- Table name
- Stakes: 10 / 20
- Players: 4 / 6
- Timer: 15s
- Min buy-in
- Status: Waiting / Playing / Full
- Join button

### Filters

Add:

- All
- My Clubs
- Waiting
- Low Stakes
- High Stakes

### Empty States

Example:

```txt
No active tables yet.
Create a table or join a club to start playing.
```

### Mobile Bottom Navigation

```txt
Lobby | Clubs | Profile | Settings
```

---

## 6.3 Club Details Page

Route:

```txt
/clubs/[clubId]
```

Purpose:

Show all details for a specific club.

### Header

Include:

- Club logo
- Club name
- Member count
- Owner name
- Club status
- Request join button if not member

### Tabs

```txt
Tables | Members | Requests | Transactions
```

### Tables Tab

Show:

- Active tables
- Waiting tables
- Finished tables
- Create table button for manager

### Members Tab

Show:

- Member avatar
- Username
- Role
- Club chip balance
- Last active
- Status

### Requests Tab

Manager only:

- Join request user
- Request date
- Approve button
- Reject button

### Transactions Tab

Show:

- Credit added
- Credit removed
- Buy-ins
- Cash-outs
- Rake/fees

---

## 6.4 Poker Table Page

Route (canonical in this repo):

```txt
/tables/[tableId]
```

> **Note:** The plan originally used `/table/[tableId]`. The Next.js App Router implementation uses **`/tables/[tableId]`** under `(main)` so table list and detail share the same segment. Product behaviour matches §6.4 (real-time game screen).

**Separate offline route (engine lab, not multiplayer):**

```txt
/play
```

Purpose of **`/play`**: quick **browser-only** heads-up runout (deal + evaluate) for demos and engine QA — **no** MongoDB, **no** Redis, **no** Socket.IO.  
Purpose of **`/tables/[tableId]`**: **real club table** — HTTP + Socket.IO + Nest **`HoldemCoordinator`** + **PixiJS** felt (see §2.3 Game Rendering).

### Visual Style

Recommended style:

- Dark casino theme
- Green or deep blue poker felt
- Gold chip accents
- Soft shadows
- Smooth card animations
- Clear readable player labels
- Mobile-first layout

### Main Poker Elements

Include (implementation status in repo):

- **PixiJS** oval felt + board cards + pot + seat stacks on **`/tables/[tableId]`** (WebGL canvas, resize-aware).
- Oval table (via Pixi graphics)
- 2–9 player seats (layout from `maxPlayers`)
- Player name (truncated id in MVP)
- Stack amount
- Dealer button
- Hole cards (viewer only)
- Community cards
- Pot amount
- Side pot display *(engine partial — UI TBD)*
- Turn countdown ring *(HTML clock today; ring on canvas optional polish)*
- Action buttons *(HTML below canvas)*

### PixiJS delivery checklist

```txt
[ ] Chip stacks / sprites (currently numeric labels)
[ ] Card sprites + flip animation
[ ] Turn countdown arc on felt
[ ] Side pot rows when engine supports full runout
[ ] Destroy Pixi Application on route leave (implemented in HoldemPixiStage unmount)
```

### Action Controls

Show only when it is the player’s turn:

```txt
Fold
Check
Call
Bet
Raise
All-in
```

### Raise Control

Professional raise panel:

- Slider
- Min raise button
- Half pot button
- Pot button
- All-in button
- Manual amount input

### Game State Banners

Examples:

```txt
Waiting for players...
Your turn
Opponent is thinking...
Dealing flop...
Showdown
You won 1,250 chips
```

### Reconnection UI

If socket disconnects:

```txt
Reconnecting...
Your seat is reserved for 60 seconds.
```

### Timeout Handling

If player timeout:

```txt
Auto-check if possible
Auto-fold if check is not possible
```

### Mobile Layout

Portrait mode:

- Table centered
- Player seat positions optimized for phone
- Action buttons sticky at bottom
- Pot/community cards visible without scrolling

Landscape mode:

- Wider table
- Better seat spacing
- Action panel on right side

---

## 6.5 Profile Page

Route:

```txt
/profile
```

Purpose:

Show player account details and history.

### Sections

- Avatar and username
- Telegram ID hidden or masked
- Total balance
- Club balances
- Win/loss statistics
- Hands played
- Recent hands
- Transaction history
- Account status

### Stats Cards

Examples:

```txt
Total Chips
Hands Played
Win Rate
Biggest Pot Won
```

### Transaction List

Each row:

- Type
- Amount
- Club
- Date
- Balance after transaction

---

## 6.6 Settings Page

Route:

```txt
/settings
```

Purpose:

User preferences.

### Settings Items

- Sound on/off
- Vibration on/off
- Table theme
- Card style
- Language
- Notification settings
- Responsible gaming notice
- Logout

### Table Themes

Examples:

```txt
Classic Green
Royal Blue
Midnight Black
Gold Room
```

---

## 6.7 Club Manager Dashboard

Route:

```txt
/manager
```

Purpose:

Dashboard for club owners/managers.

### Overview Cards

Show:

- Club members
- Active tables
- Total club chips
- Pending join requests
- Pending cash-out requests

### Main Tabs

```txt
Overview | Tables | Members | Credits | Requests | Reports
```

### Tables Tab

Manager can:

- Create table
- Close table
- Edit stakes
- Set max players
- Set timer seconds
- Set min/max buy-in

### Create Table Form

Fields:

```txt
Table Name
Small Blind
Big Blind
Min Buy-in
Max Buy-in
Max Players
Action Timer
Rake Percent
Rake Cap
Private/Public inside club
```

### Members Tab

Manager can:

- View members
- Search members
- Block member
- Change member role
- View member balance
- View member transactions

### Credits Tab

Manager can:

- Add chips to member
- Remove chips from member
- View transaction history
- Add reason/note for audit

### Requests Tab

Manager can:

- Approve join request
- Reject join request
- Approve cash-out
- Reject cash-out

### Reports Tab

Show:

- Volume played
- Rake collected
- Active players
- Top players
- Table activity

---

## 6.8 Master Admin Panel

Route:

```txt
/admin
```

Purpose:

Platform owner dashboard.

### Overview

Show:

- Total users
- Daily active users
- Total clubs
- Active tables
- Global chip circulation
- Total rake/fees

### Main Tabs

```txt
Users | Clubs | Tables | Credits | Rake | Reports | Logs
```

### Users Tab

Admin can:

- View all users
- Search users
- Suspend user
- Unsuspend user
- View user profile
- View user transaction history

### Clubs Tab

Admin can:

- View all clubs
- Suspend club
- View club owner
- View club reports

### Credits Tab

Admin can:

- Add system chips
- Remove chips
- View global circulation
- View suspicious transactions

### Rake Tab

Admin can:

- Set global rake percent
- Set rake cap
- Set club-specific rake
- Set table-specific rake

### Reports Tab

Show:

- Daily active users
- Total hands played
- Total volume
- Revenue from rake
- Club ranking
- Table ranking

### Logs Tab

Show:

- Admin actions
- Manager credit changes
- Suspicious activity
- IP conflict blocks

---

# 7. Game Mechanics Development Plan

## 7.1 Poker Engine

Create the poker engine as a pure TypeScript package:

```txt
packages/shared/poker-engine
```

The poker engine should not depend on React, Socket.IO, or database.

It should handle:

- Deck creation
- Secure shuffle
- Seat order
- Dealer button movement
- Blind posting
- Hole card dealing
- Community card dealing
- Betting rounds
- Check/call/bet/raise/fold/all-in
- Side pots
- Hand evaluation
- Winner detection
- Pot distribution
- Rake calculation

## 7.2 Betting Rounds

Texas Hold’em flow:

```txt
Waiting
Preflop
Flop
Turn
River
Showdown
HandComplete
```

## 7.3 Player Actions

Allowed actions:

```txt
CHECK
CALL
BET
RAISE
FOLD
ALL_IN
SIT_OUT
```

## 7.4 Backend Validation

All actions must be validated on backend:

- Is it player's turn?
- Is action allowed?
- Does player have enough chips?
- Is raise amount valid?
- Is player seated?
- Is table active?
- Is user suspended?
- Is user member of club?

Never trust frontend actions.

---

# 8. Socket.IO Events

## 8.1 Client to Server

```txt
table:join
table:leave
table:sit
table:stand
game:ready
game:action
game:chat
game:reconnect
```

## 8.2 Server to Client

```txt
table:state
table:error
game:started
game:dealt
game:turn
game:actionApplied
game:timeout
game:showdown
game:handComplete
player:joined
player:left
player:disconnected
player:reconnected
```

## 8.3 Example Action Payload

```json
{
  "tableId": "table_123",
  "action": "RAISE",
  "amount": 500
}
```

---

# 9. Security Plan

## 9.1 Telegram Auth Security

- Validate Telegram initData on backend
- Use HTTP-only secure cookies
- Use SameSite cookie policy
- Expire sessions
- Store hashed session tokens

## 9.2 Game Security

- Server owns deck and card state
- Client never receives opponent hole cards
- Server validates all actions
- Server controls timers
- Server controls winner calculation
- Server controls pot distribution

## 9.3 Anti-Cheating

MVP:

- Block same IP users from same table
- Detect multiple accounts with same device fingerprint
- Log suspicious seating behavior
- Prevent suspended users from joining
- Rate-limit socket actions

Advanced:

- Collusion detection
- Shared device detection
- Abnormal win-rate detection
- Chip dumping detection

---

# 10. Notification Plan

Use Telegram Bot API for notifications.

Notification examples:

- Turn reminder
- Club join request approved
- Cash-out request update
- Tournament starting
- Table invitation
- Admin warning

MVP notifications:

```txt
Club request approved
Cash-out request approved/rejected
Table invitation
```

Turn notifications should be used carefully because poker turns are short.

---

# 11. UI Design System

## 11.1 Brand Style

Recommended design direction:

```txt
Premium dark casino
```

Colors:

```txt
Background: #080B12
Surface: #111827
Card: #172033
Primary: emerald / green
Accent: gold
Danger: red
Text: white / gray
```

## 11.2 Typography

Use clean modern font:

```txt
Inter
```

For numbers/chips:

```txt
Tabular numbers
```

## 11.3 Component Style

- Rounded corners
- Soft shadows
- Subtle gradients
- Glass panels
- Gold accents for premium actions
- Green highlights for active table state
- Red only for destructive actions

## 11.4 UI Quality Rules

- Every loading state needs skeleton UI
- Every empty page needs helpful text
- Every dangerous action needs confirmation
- Every credit change needs reason/note
- Every form needs validation
- Every socket error needs user-friendly message

---

# 12. MVP Development Roadmap

## Phase 1 — Foundation

Build:

- Next.js app
- NestJS server
- MongoDB connection
- Redis connection
- Basic environment config
- Shared TypeScript types
- App layout
- Mobile bottom navigation

Result:

```txt
Professional app shell is ready.
```

## Phase 2 — Telegram Auth

Build:

- Telegram initData reader
- Backend validation
- User creation
- HTTP-only session cookie
- /auth/me endpoint
- Login loading page
- Protected routes

Result:

```txt
Telegram user can securely login.
```

## Phase 3 — Lobby UI

Build:

- Lobby header
- Balance display
- Club cards
- Table cards
- Filters
- Empty states
- Loading skeletons
- Bottom navigation

Result:

```txt
User can see a professional lobby.
```

## Phase 4 — Profile and Settings

Build:

- Profile page
- Stats cards
- Transaction list
- Settings page
- Sound/vibration settings
- Theme selector
- Logout

Result:

```txt
User account screens look complete.
```

## Phase 5 — Club System

Build:

- Create club
- Join club request
- Approve/reject request
- Club details page
- Club member list
- Club manager role

Result:

```txt
Club-based platform structure is working.
```

## Phase 6 — Table Management

Build:

- Create table
- Table list
- Join table
- Sit at seat
- Leave seat
- Close table
- Table settings

Result:

```txt
Players can join private poker tables.
```

## Phase 7 — Poker Engine

Build:

- Deck
- Shuffle
- Deal
- Blinds
- Betting rounds
- Actions
- Winner detection
- Pot distribution

Result:

```txt
Basic Texas Hold’em logic works.
```

## Phase 8 — Realtime Gameplay

Build:

- Socket.IO gateway
- Join table socket room
- Broadcast table state
- Player actions
- Turn timer
- Auto-check/fold
- Reconnect support

Result:

```txt
Real-time multiplayer poker works.
```

## Phase 9 — Wallet / Credit System

Build:

- User wallet
- Club chip balance
- Buy-in
- Cash-out request
- Manager credit adjustment
- Admin credit adjustment
- Transaction history

Result:

```txt
Chip system is usable and auditable.
```

## Phase 10 — Dashboards

Build:

- Club manager dashboard
- Master admin dashboard
- User management
- Club management
- Credit management
- Rake settings
- Basic reports

Result:

```txt
Platform can be managed professionally.
```

## Phase 11 — Security and Anti-Cheat

Build:

- Same IP table block
- Socket auth middleware
- Rate limiting
- Suspicious action logs
- Admin logs
- User suspension

Result:

```txt
Platform has basic anti-cheat and abuse prevention.
```

## Phase 12 — Final Polish

Build:

- UI animations
- Card dealing effects
- Chip movement effects
- Winner celebration
- Sound effects
- Error handling
- Mobile optimization
- Video walkthrough preparation

Result:

```txt
Client-ready demo.
```

---

# 13. Best 3-Day Demo Scope

For a 3-day demo, do not try to build everything.

Build this:

## Day 1

- Project setup
- Telegram login mock or real auth
- MongoDB user model
- Session system
- Lobby UI
- Profile page
- Settings page

## Day 2

- Club model
- Club creation
- Join request
- Club manager approval
- Table creation
- Table list
- Basic admin page

## Day 3

- Poker table UI
- Socket.IO table room
- Sit/leave seat
- Basic 2-player poker flow
- Basic chip balance
- Screenshots/video walkthrough

The goal for the 3-day demo is:

```txt
Show stability, flow, and professional UI.
```

Not full production poker.

---

# 14. Client Demo Screenshots to Prepare

Prepare screenshots of:

1. Login/loading screen
2. Lobby page
3. Club list
4. Club detail page
5. Poker table screen
6. Profile page
7. Settings page
8. Club manager dashboard
9. Create table modal
10. Member approval screen
11. Credit adjustment screen
12. Master admin dashboard

Prepare a video walkthrough:

```txt
1. Open Telegram Mini App
2. Login
3. Enter lobby
4. Open club
5. Manager creates table
6. Player joins table
7. Poker hand starts
8. Player action is synchronized
9. Show admin dashboard
10. Show club manager dashboard
```

---

# 15. Professional Feature Priority

## Must Have First

- Telegram login
- Lobby
- Club system
- Table creation
- Real-time table
- Basic poker rules
- User profile
- Settings
- Club manager dashboard
- Admin user list
- Credit adjustment

## Should Have Next

- Rake settings
- Transaction history
- Reports
- Push notifications
- Same IP block
- Reconnect logic
- Timeout auto-fold/check

## Later

- Tournaments
- Advanced anti-cheat
- Collusion detection
- Advanced analytics
- Multi-language support
- Advanced animations
- Full agent system
- White-label club branding

---

# 16. Final Recommended Architecture

```txt
Telegram Mini App
      ↓
Next.js Frontend
      ↓
HTTP API + Socket.IO
      ↓
NestJS Backend
      ↓
MongoDB  = permanent data
Redis    = live game state / timers
BullMQ   = background jobs
Telegram Bot API = notifications
```

---


---

# 18. Telegram Mini App Responsive UI Requirements

The UI must be designed specifically for Telegram Mini App, not just a normal responsive website.

Telegram Mini Apps run inside Telegram’s mobile webview, so the layout must work perfectly on:

- iPhone small screens
- iPhone large screens
- Android small screens
- Android large screens
- Telegram desktop webview
- Portrait mode
- Landscape mode, if supported

## 18.1 Mobile-First Rule

The main design target should be:

```txt
Mobile portrait Telegram Mini App
```

Desktop should be supported, but the product should feel perfect on mobile first.

Recommended design order:

```txt
1. Mobile portrait
2. Mobile landscape
3. Tablet
4. Desktop / staging browser
```

## 18.2 Safe Area Support

Telegram Mini Apps can be affected by:

- Top Telegram header
- Bottom system gesture area
- iPhone notch
- Android navigation bar
- Telegram bottom controls

All pages should use safe-area spacing.

Recommended CSS:

```css
.page {
  min-height: 100dvh;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

Use modern viewport units:

```css
min-height: 100dvh;
```

Avoid only using:

```css
height: 100vh;
```

because mobile webviews can calculate `100vh` incorrectly.

## 18.3 Layout Width

For Telegram Mini App mobile UI:

```txt
Main content max width: 430px to 480px
```

Recommended app shell:

```css
.app-shell {
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  min-height: 100dvh;
}
```

For desktop/staging:

```txt
Keep the mobile app centered
Do not stretch poker UI too wide
Use side panels only on larger screens
```

## 18.4 Bottom Navigation

Use bottom navigation for main player pages:

```txt
Lobby | Clubs | Profile | Settings
```

Bottom navigation should be:

- Fixed to bottom
- Safe-area aware
- Easy to tap
- Visible on player pages
- Hidden on poker table page if it reduces game space

Recommended height:

```txt
64px + safe area bottom
```

## 18.5 Touch Target Rules

Every interactive button must be finger-friendly.

Minimum touch target:

```txt
44px height
```

Recommended:

```txt
48px to 56px height
```

Important buttons like poker actions should be larger:

```txt
Fold / Check / Call / Raise: 52px to 60px height
```

Avoid small text-only links for main actions.

## 18.6 Poker Table Responsive Design

The poker table page is the most important screen.

It should not feel like a website. It should feel like a native mobile game.

### Portrait Layout

Use this structure:

```txt
Top bar:
- Table name
- Blinds
- Balance
- Leave button

Center:
- Poker table canvas
- Community cards
- Pot
- Player seats

Bottom:
- Action buttons
- Raise slider
- Bet amount controls
```

The action panel should be sticky at the bottom.

Example:

```txt
[Poker Table Area]

[Fold] [Check/Call] [Raise]
[Slider / Amount Input]
```

### Landscape Layout

If landscape is supported:

```txt
Left/center:
- Poker table

Right side:
- Action controls
- Chat/emotes
```

### Small Phone Layout

For small phones:

- Use compact player labels
- Reduce avatar size
- Hide non-essential table decorations
- Use shorter button labels
- Keep cards and action buttons clearly visible
- Avoid vertical scrolling during active turn

## 18.7 Poker Table Canvas Scaling

If using PixiJS, canvas should scale based on available container size.

Rules:

```txt
Do not use fixed canvas size only
Keep aspect ratio
Scale cards and chips proportionally
Recalculate seat positions on resize
Support devicePixelRatio for sharp rendering
```

Recommended behavior:

```txt
Canvas width = container width
Canvas height = available height between top bar and action panel
```

Seat positions should be percentage-based, not fixed pixels.

Example concept:

```txt
Seat 1: bottom center
Seat 2: bottom left
Seat 3: top left
Seat 4: top center
Seat 5: top right
Seat 6: bottom right
```

## 18.8 UI Breakpoints

Recommended Tailwind breakpoints:

```txt
default: mobile
sm: larger phone
md: tablet
lg: desktop/staging
```

Use mobile as default.

Example:

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
```

For Telegram app screens, avoid too many desktop-first layouts.

## 18.9 Page-Specific Responsive Requirements

### Login Page

Must work on all screen heights.

- Logo centered
- Loading status visible
- Error card fits small screen
- No unnecessary scrolling

### Lobby Page

Mobile:

- Single-column cards
- Sticky user balance header
- Bottom navigation

Tablet/Desktop:

- Two-column or three-column cards
- Optional side panel for profile/notifications

### Club Detail Page

Mobile:

- Tabs should be horizontally scrollable
- Member list should use cards, not wide tables
- Manager actions should be in bottom sheets/dialogs

Desktop:

- Tables can use full table layout

### Profile Page

Mobile:

- Stats in 2-column grid
- Transaction list as cards

Desktop:

- Stats in 4-column grid
- Transactions as table

### Settings Page

Mobile:

- Simple list layout
- Large toggle rows

Desktop:

- Card sections

### Club Manager Dashboard

Mobile:

- Dashboard cards
- Tabs
- Member rows as cards
- Credit adjustment in dialog/bottom sheet

Desktop:

- Sidebar layout
- Data tables
- Charts

### Master Admin Panel

Mobile:

- Limited admin actions
- Cards and simplified tables

Desktop:

- Full admin dashboard
- Wide data tables
- Charts and reports

## 18.10 Telegram Theme Support

Telegram provides theme parameters.

Use Telegram theme data where possible:

- Background color
- Text color
- Button color
- Secondary background color

But keep a custom premium poker theme as the default.

Recommended:

```txt
Use Telegram theme for basic compatibility
Use custom dark casino theme for brand identity
```

## 18.11 Avoid Bad Telegram Mini App UX

Avoid:

- Tiny buttons
- Wide desktop tables on mobile
- Horizontal overflow
- Hidden action buttons
- Fixed 100vh layout bugs
- Forms that are too long
- Poker table that requires scrolling during a hand
- Modals that exceed screen height
- Too many animations on low-end Android devices

## 18.12 Performance Rules for Mobile

Telegram Mini App should feel fast.

Rules:

```txt
Initial page should load quickly
Lazy-load heavy game canvas
Lazy-load admin dashboard charts
Compress card/chip images
Use SVG or sprites where possible
Avoid huge background videos
Use skeleton loading
Use optimistic UI carefully
```

For PixiJS:

```txt
Use spritesheets
Preload card assets before entering table
Destroy PixiJS app when leaving table
Limit particle effects on low-end devices
```

## 18.13 Professional Responsive Testing Checklist

Test these screen sizes:

```txt
iPhone SE: 375 x 667
iPhone 12/13/14: 390 x 844
iPhone Pro Max: 430 x 932
Small Android: 360 x 740
Large Android: 412 x 915
Telegram Desktop narrow webview
Desktop browser staging
```

Test these states:

```txt
Keyboard open
Low height screen
Long username
Low balance
Large balance number
6 players seated
Player disconnected
Player turn active
Raise panel open
Club list empty
Many clubs
Many tables
Pending request
Admin table with many rows
```

## 18.14 Final Responsive Quality Standard

The final UI should meet this standard:

```txt
No horizontal scrolling
No hidden buttons
No clipped cards
No broken modals
No unreadable text
Poker actions always reachable
Lobby usable with one hand
Profile/settings feel native
Dashboard still usable on mobile
Poker table feels like a mobile game, not a web page
```


# 17. Summary

Recommended professional stack:

```txt
Frontend: Next.js + TypeScript
UI: Tailwind CSS + shadcn/ui
Game UI: PixiJS
Animation: Framer Motion
State: Zustand + TanStack Query
Backend: NestJS + TypeScript
Realtime: Socket.IO
Main DB: MongoDB + Mongoose
Live State: Redis
Jobs: BullMQ
Notifications: Telegram Bot API
```

This stack is professional, scalable, and realistic for a Telegram Mini App poker platform.
