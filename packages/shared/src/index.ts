/**
 * Cross-cutting types for web + server. Extend as features land (Phases 2+).
 */

export type UserRole = "PLAYER" | "CLUB_MANAGER" | "MASTER_ADMIN";

export type UserStatus = "ACTIVE" | "SUSPENDED";

export type ClubStatus = "ACTIVE" | "SUSPENDED";

export type ClubMemberRole = "OWNER" | "MANAGER" | "AGENT" | "MEMBER";

export type ClubMemberStatus = "ACTIVE" | "BLOCKED";

export type TableStatus = "WAITING" | "PLAYING" | "PAUSED" | "CLOSED";
