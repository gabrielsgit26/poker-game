import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../auth/users.service';
import { Club, ClubDocument } from '../clubs/schemas/club.schema';
import { ClubMember, ClubMemberDocument } from '../clubs/schemas/club-member.schema';
import {
  ChipLedgerEntry,
  ChipLedgerDocument,
} from '../clubs/schemas/chip-ledger.schema';
import {
  PlatformWalletRequest,
  PlatformWalletRequestDocument,
} from '../wallet/platform-wallet-request.schema';

export interface ProfileClubBalanceDto {
  clubId: string;
  clubName: string;
  chips: number;
}

export interface ProfileStatsDto {
  /** When false, hands / win rate / biggest pot are not persisted yet (UI shows placeholders). */
  tracked: boolean;
  handsPlayed: number;
  winRatePct: number;
  biggestPotWon: number;
  /** Sum of your club chip-ledger deltas (buy-ins, cash-outs, manager adjustments, etc.). */
  netChips: number;
}

export interface ProfileTxDto {
  id: string;
  type: string;
  amount: number;
  clubName: string | null;
  at: string;
  /** Club chip balance after the entry; null for platform wallet request rows. */
  balanceAfter: number | null;
}

export interface ProfileUserDto {
  displayName: string;
  maskedTelegramRef: string;
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  totalChips: number;
  platformChips: number;
  clubChips: number;
}

export interface ProfileSnapshotDto {
  user: ProfileUserDto;
  clubBalances: ProfileClubBalanceDto[];
  stats: ProfileStatsDto;
  transactions: ProfileTxDto[];
}

function maskTelegramRef(userId: string): string {
  if (userId.startsWith('tg_')) {
    const rest = userId.slice(3);
    const tail = rest.length <= 4 ? rest : `…${rest.slice(-4)}`;
    return `Telegram · ${tail}`;
  }
  return `Player · ${userId}`;
}

@Injectable()
export class ProfileService {
  constructor(
    private readonly users: UsersService,
    @InjectModel(ClubMember.name)
    private readonly memberModel: Model<ClubMemberDocument>,
    @InjectModel(Club.name) private readonly clubModel: Model<ClubDocument>,
    @InjectModel(ChipLedgerEntry.name)
    private readonly chipLedgerModel: Model<ChipLedgerDocument>,
    @InjectModel(PlatformWalletRequest.name)
    private readonly platformReqModel: Model<PlatformWalletRequestDocument>,
  ) {}

  async getSnapshot(userId: string): Promise<ProfileSnapshotDto> {
    const user = await this.users.findByUserId(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }
    const o = user.toObject() as { userId: string; displayName?: string };
    const platformChips = Math.max(
      0,
      Math.floor(Number((o as { platformBalanceChips?: number }).platformBalanceChips) || 0),
    );
    const clubChips = await this.users.sumActiveClubChips(o.userId);
    const totalChips = platformChips + clubChips;

    const [clubBalances, netAgg, ledgerRows, walletRows] = await Promise.all([
      this.listJoinedClubBalances(userId),
      this.chipLedgerModel
        .aggregate<{ s: number }>([
          { $match: { userId } },
          { $group: { _id: null as string | null, s: { $sum: '$delta' } } },
        ])
        .exec(),
      this.chipLedgerModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(80)
        .lean(),
      this.platformReqModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .limit(40)
        .lean(),
    ]);

    const netRaw = netAgg[0]?.s;
    const netChips = Math.floor(Number(netRaw) || 0);

    const clubNameById = new Map(clubBalances.map((b) => [b.clubId, b.clubName]));
    const ledgerClubIds = [...new Set(ledgerRows.map((r) => String(r.clubId)))];
    const missingNames = ledgerClubIds.filter((id) => !clubNameById.has(id));
    if (missingNames.length > 0) {
      const extras = await this.clubModel
        .find({ _id: { $in: missingNames } })
        .select({ _id: 1, name: 1 })
        .lean();
      for (const c of extras) {
        clubNameById.set(String(c._id), (c.name as string) ?? String(c._id));
      }
    }

    const ledgerTx: ProfileTxDto[] = ledgerRows.map((r) => {
      const created = (r as { createdAt?: Date }).createdAt;
      return {
        id: String((r as { _id: { toString: () => string } })._id),
        type: r.kind,
        amount: Math.floor(Number(r.delta) || 0),
        clubName: clubNameById.get(r.clubId as string) ?? r.clubId,
        at: created instanceof Date ? created.toISOString() : new Date().toISOString(),
        balanceAfter: Math.floor(Number(r.balanceAfter) || 0),
      };
    });

    const walletTx: ProfileTxDto[] = walletRows.map((r) => {
      const row = r as Record<string, unknown>;
      const id = String((row._id as { toString: () => string })?.toString?.() ?? row._id);
      const kind = row.kind as string;
      const status = row.status as string;
      const amount = Math.floor(Number(row.amount) || 0);
      const signed =
        kind === 'WITHDRAWAL' ? -Math.abs(amount) : Math.abs(amount);
      const created = row.createdAt as Date | undefined;
      const at =
        created instanceof Date
          ? created.toISOString()
          : new Date().toISOString();
      return {
        id: `pw-${id}`,
        type: `PLATFORM_${kind}_${status}`,
        amount: signed,
        clubName: null,
        at,
        balanceAfter: null,
      };
    });

    const merged = [...ledgerTx, ...walletTx].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
    const transactions = merged.slice(0, 60);

    return {
      user: {
        displayName: (o.displayName?.trim() || o.userId).slice(0, 120),
        maskedTelegramRef: maskTelegramRef(o.userId),
        accountStatus: 'ACTIVE',
        totalChips,
        platformChips,
        clubChips,
      },
      clubBalances,
      stats: {
        tracked: false,
        handsPlayed: 0,
        winRatePct: 0,
        biggestPotWon: 0,
        netChips,
      },
      transactions,
    };
  }

  private async listJoinedClubBalances(
    userId: string,
  ): Promise<ProfileClubBalanceDto[]> {
    const rows = await this.memberModel
      .find({ userId, status: 'ACTIVE' })
      .sort({ clubId: 1 })
      .lean();
    if (rows.length === 0) return [];
    const ids = [...new Set(rows.map((m) => m.clubId))];
    const clubs = await this.clubModel
      .find({ _id: { $in: ids } })
      .select({ _id: 1, name: 1 })
      .lean();
    const nameById = new Map(clubs.map((c) => [c._id, c.name as string]));
    return rows.map((m) => ({
      clubId: m.clubId,
      clubName: nameById.get(m.clubId) ?? m.clubId,
      chips: Math.max(0, Math.floor(Number(m.chipBalance) || 0)),
    }));
  }
}
