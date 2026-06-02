import type { UserRole } from "@telegram-poker/shared";

/** Lobby filter chips (plan §6.2). */
export type LobbyFilterId = "all" | "my_clubs" | "waiting" | "low" | "high";

/** Membership for club cards (UI labels from plan). */
export type ClubCardMembership = "JOINED" | "PENDING" | "PRIVATE" | "OPEN";

export interface LobbyUser {
  displayName: string;
  balanceChips: number;
  role: UserRole;
  /** Placeholder until avatars from Telegram / uploads exist. */
  avatarEmoji: string;
}

export interface ClubCardModel {
  id: string;
  name: string;
  memberCount: number;
  activeTables: number;
  membership: ClubCardMembership;
}

export type TablePlayStatus = "WAITING" | "PLAYING" | "FULL";

export interface TableCardModel {
  id: string;
  clubId: string;
  clubName: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  players: number;
  maxPlayers: number;
  timerSeconds: number;
  minBuyIn: number;
  playStatus: TablePlayStatus;
}

export interface LobbySnapshot {
  user: LobbyUser;
  clubs: ClubCardModel[];
  tables: TableCardModel[];
}
