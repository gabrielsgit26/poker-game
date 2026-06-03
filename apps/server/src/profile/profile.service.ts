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
  /** Telegram profile image URL when known (from last Mini App sign-in). */
  telegramPhotoUrl: string | null;
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

export interface ProfileTransactionsPageDto {
  items: ProfileTxDto[];
  total: number;
  skip: number;
  limit: number;
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
    const o = user.toObject() as {
      userId: string;
      displayName?: string;
      telegramPhotoUrl?: string | null;
    };
    const platformChips = Math.max(
      0,
      Math.floor(Number((o as { platformBalanceChips?: number }).platformBalanceChips) || 0),
    );
    const clubChips = await this.users.sumActiveClubChips(o.userId);
    const totalChips = platformChips + clubChips;

    const [clubBalances, netAgg] = await Promise.all([
      this.listJoinedClubBalances(userId),
      this.chipLedgerModel
        .aggregate<{ s: number }>([
          { $match: { userId } },
          { $group: { _id: null as string | null, s: { $sum: '$delta' } } },
        ])
        .exec(),
    ]);

    const netRaw = netAgg[0]?.s;
    const netChips = Math.floor(Number(netRaw) || 0);

    const photoRaw = o.telegramPhotoUrl;
    const telegramPhotoUrl =
      typeof photoRaw === 'string' && photoRaw.trim().length > 0
        ? photoRaw.trim()
        : null;

    return {
      user: {
        displayName: (o.displayName?.trim() || o.userId).slice(0, 120),
        maskedTelegramRef: maskTelegramRef(o.userId),
        telegramPhotoUrl,
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
      transactions: [],
    };
  }

  /**
   * Paginated union of club chip-ledger rows and platform wallet requests,
   * sorted by time descending (same ordering as the old snapshot merge).
   */
  async getTransactionsPage(
    userId: string,
    skip: number,
    limit: number,
  ): Promise<ProfileTransactionsPageDto> {
    const user = await this.users.findByUserId(userId);
    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const lim = Math.min(100, Math.max(1, Math.floor(limit)));
    const sk = Math.max(0, Math.floor(skip));

    const [ledgerTotal, walletTotal, clubBalances, rows] = await Promise.all([
      this.chipLedgerModel.countDocuments({ userId }),
      this.platformReqModel.countDocuments({ userId }),
      this.listJoinedClubBalances(userId),
      this.chipLedgerModel
        .aggregate<{
          __src: 'ledger' | 'wallet';
          _id: unknown;
          createdAt?: Date;
          clubId?: string;
          kind?: string;
          delta?: number;
          balanceAfter?: number;
          status?: string;
          amount?: number;
        }>([
          { $match: { userId } },
          {
            $project: {
              _id: 1,
              createdAt: 1,
              __src: { $literal: 'ledger' as const },
              clubId: 1,
              kind: 1,
              delta: 1,
              balanceAfter: 1,
            },
          },
          {
            $unionWith: {
              coll: 'platform_wallet_requests',
              pipeline: [
                { $match: { userId } },
                {
                  $project: {
                    _id: 1,
                    createdAt: 1,
                    __src: { $literal: 'wallet' as const },
                    kind: 1,
                    status: 1,
                    amount: 1,
                  },
                },
              ],
            },
          },
          { $sort: { createdAt: -1, _id: -1 } },
          { $skip: sk },
          { $limit: lim },
        ])
        .allowDiskUse(true)
        .exec(),
    ]);

    const total = ledgerTotal + walletTotal;
    const clubNameById = new Map(clubBalances.map((b) => [b.clubId, b.clubName]));
    const ledgerClubIds = [
      ...new Set(
        rows.filter((r) => r.__src === 'ledger').map((r) => String(r.clubId ?? '')),
      ),
    ].filter(Boolean);
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

    const items: ProfileTxDto[] = rows.map((r) => {
      const created = r.createdAt;
      const at =
        created instanceof Date
          ? created.toISOString()
          : new Date().toISOString();
      if (r.__src === 'ledger') {
        return {
          id: String(r._id),
          type: String(r.kind ?? ''),
          amount: Math.floor(Number(r.delta) || 0),
          clubName:
            clubNameById.get(String(r.clubId ?? '')) ?? String(r.clubId ?? ''),
          at,
          balanceAfter: Math.floor(Number(r.balanceAfter) || 0),
        };
      }
      const kind = String(r.kind ?? '');
      const status = String(r.status ?? '');
      const amount = Math.floor(Number(r.amount) || 0);
      const signed =
        kind === 'WITHDRAWAL' ? -Math.abs(amount) : Math.abs(amount);
      return {
        id: `pw-${String(r._id)}`,
        type: `PLATFORM_${kind}_${status}`,
        amount: signed,
        clubName: null,
        at,
        balanceAfter: null,
      };
    });

    return { items, total, skip: sk, limit: lim };
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
