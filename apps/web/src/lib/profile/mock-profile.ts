import type { ProfileSnapshot } from "./types";

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const MOCK: ProfileSnapshot = {
  user: {
    displayName: "Local Player",
    maskedTelegramRef: "Dev session · no Telegram ID",
    totalChips: 12_500,
    accountStatus: "ACTIVE",
  },
  clubBalances: [
    { clubId: "c1", clubName: "Midnight Hold'em", chips: 8200 },
    { clubId: "c2", clubName: "Tokyo Fish", chips: 4300 },
  ],
  stats: {
    handsPlayed: 1842,
    winRatePct: 52.4,
    biggestPotWon: 2400,
    netChips: 3100,
  },
  transactions: [
    {
      id: "tx1",
      type: "HAND_WIN",
      amount: 420,
      clubName: "Midnight Hold'em",
      at: "2026-06-01T18:22:00.000Z",
      balanceAfter: 12_500,
    },
    {
      id: "tx2",
      type: "BUY_IN",
      amount: -1000,
      clubName: "Tokyo Fish",
      at: "2026-06-01T14:05:00.000Z",
      balanceAfter: 12_080,
    },
    {
      id: "tx3",
      type: "HAND_LOSS",
      amount: -180,
      clubName: "Midnight Hold'em",
      at: "2026-05-31T21:40:00.000Z",
      balanceAfter: 13_080,
    },
    {
      id: "tx4",
      type: "ADMIN_CREDIT_ADD",
      amount: 5000,
      clubName: null,
      at: "2026-05-30T09:00:00.000Z",
      balanceAfter: 13_260,
    },
  ],
};

export async function fetchProfileSnapshot(): Promise<ProfileSnapshot> {
  await delay(500 + Math.floor(Math.random() * 350));
  return {
    user: { ...MOCK.user },
    clubBalances: MOCK.clubBalances.map((c) => ({ ...c })),
    stats: { ...MOCK.stats },
    transactions: MOCK.transactions.map((t) => ({ ...t })),
  };
}
