import type {
  ClubCardModel,
  LobbyFilterId,
  LobbySnapshot,
  LobbyUser,
  TableCardModel,
} from "./types";
import { apiBase } from "../dev-api";
import { fetchClubsList } from "./api-clubs";
import { fetchTablesList } from "./api-tables";

export const MOCK_USER: LobbyUser = {
  displayName: "Local Player",
  balanceChips: 12_500,
  role: "PLAYER",
  avatarEmoji: "♠",
};

export const MOCK_CLUBS: ClubCardModel[] = [
  {
    id: "c1",
    name: "Midnight Hold'em",
    memberCount: 48,
    activeTables: 3,
    membership: "JOINED",
  },
  {
    id: "c2",
    name: "Tokyo Fish",
    memberCount: 112,
    activeTables: 7,
    membership: "JOINED",
  },
  {
    id: "c3",
    name: "Monte Private",
    memberCount: 22,
    activeTables: 1,
    membership: "PRIVATE",
  },
  {
    id: "c4",
    name: "River Runners",
    memberCount: 8,
    activeTables: 0,
    membership: "JOINED",
  },
];

export const MOCK_TABLES: TableCardModel[] = [
  {
    id: "t1",
    clubId: "c1",
    clubName: "Midnight Hold'em",
    name: "Ante-Up #1",
    smallBlind: 5,
    bigBlind: 10,
    players: 4,
    maxPlayers: 6,
    timerSeconds: 15,
    minBuyIn: 500,
    playStatus: "PLAYING",
  },
  {
    id: "t2",
    clubId: "c1",
    clubName: "Midnight Hold'em",
    name: "Micro Stakes",
    smallBlind: 1,
    bigBlind: 2,
    players: 2,
    maxPlayers: 6,
    timerSeconds: 12,
    minBuyIn: 80,
    playStatus: "WAITING",
  },
  {
    id: "t3",
    clubId: "c2",
    clubName: "Tokyo Fish",
    name: "DL 50/100",
    smallBlind: 50,
    bigBlind: 100,
    players: 6,
    maxPlayers: 6,
    timerSeconds: 20,
    minBuyIn: 5000,
    playStatus: "FULL",
  },
  {
    id: "t4",
    clubId: "c2",
    clubName: "Tokyo Fish",
    name: "HU High",
    smallBlind: 25,
    bigBlind: 50,
    players: 1,
    maxPlayers: 2,
    timerSeconds: 15,
    minBuyIn: 2000,
    playStatus: "WAITING",
  },
];

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Mock table rows per club (until tables are backed by the API). */
export function mockActiveTableCountByClub(): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of MOCK_TABLES) {
    m.set(t.clubId, (m.get(t.clubId) ?? 0) + 1);
  }
  return m;
}

function tableCountByClubFromList(tables: TableCardModel[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tables) {
    m.set(t.clubId, (m.get(t.clubId) ?? 0) + 1);
  }
  return m;
}

function applyFilter(snapshot: LobbySnapshot, filter: LobbyFilterId): LobbySnapshot {
  const { user } = snapshot;
  let { clubs, tables } = snapshot;

  switch (filter) {
    case "all":
      break;
    case "my_clubs": {
      clubs = clubs.filter((c) => c.membership === "JOINED");
      const ids = new Set(clubs.map((c) => c.id));
      tables = tables.filter((t) => ids.has(t.clubId));
      break;
    }
    case "waiting": {
      tables = tables.filter((t) => t.playStatus === "WAITING");
      const clubIds = new Set(tables.map((t) => t.clubId));
      clubs = clubs.filter((c) => clubIds.has(c.id));
      break;
    }
    case "low": {
      tables = tables.filter((t) => t.smallBlind <= 5);
      const clubIds = new Set(tables.map((t) => t.clubId));
      clubs = clubs.filter((c) => clubIds.has(c.id));
      break;
    }
    case "high": {
      tables = tables.filter((t) => t.smallBlind >= 25);
      const clubIds = new Set(tables.map((t) => t.clubId));
      clubs = clubs.filter((c) => clubIds.has(c.id));
      break;
    }
    default:
      break;
  }

  return { user, clubs, tables };
}

/**
 * Mock lobby fetch — replaces `GET /lobby` until the API exists.
 * Simulates network latency so skeletons and TanStack Query are realistic.
 */
export async function fetchLobbySnapshot(
  filter: LobbyFilterId,
): Promise<LobbySnapshot> {
  await delay(550 + Math.floor(Math.random() * 450));

  let remoteTables: TableCardModel[] | null = null;
  if (apiBase()) {
    try {
      remoteTables = await fetchTablesList();
    } catch {
      remoteTables = null;
    }
  }
  const usingApiTables = remoteTables !== null;
  const tables: TableCardModel[] = usingApiTables ? [...remoteTables!] : [...MOCK_TABLES];
  const tableCountsByClub = usingApiTables
    ? tableCountByClubFromList(remoteTables!)
    : mockActiveTableCountByClub();

  const remote = await fetchClubsList();
  const clubs: ClubCardModel[] = remote
    ? remote.map((c) => ({
        id: c.id,
        name: c.name,
        memberCount: c.memberCount,
        activeTables: tableCountsByClub.get(c.id) ?? 0,
        membership: c.membership,
      }))
    : [...MOCK_CLUBS];

  const base: LobbySnapshot = {
    user: MOCK_USER,
    clubs,
    tables,
  };
  return applyFilter(base, filter);
}
