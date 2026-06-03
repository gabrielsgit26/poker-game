import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { User, UserDocument } from '../auth/user.schema';
import { Club, ClubDocument } from '../clubs/schemas/club.schema';
import {
  ChipLedgerEntry,
  ChipLedgerDocument,
} from '../clubs/schemas/chip-ledger.schema';
import { ClubMember, ClubMemberDocument } from '../clubs/schemas/club-member.schema';
import { ClubTable, ClubTableDocument } from '../tables/schemas/club-table.schema';

export interface AdminOverviewDto {
  userCount: number;
  clubCount: number;
  activeClubMembers: number;
  nonClosedTables: number;
  /** Users with `updatedAt` in the last 24 hours (proxy for recent activity). */
  dailyActiveUsers24h: number;
  /** Sum of `chipBalance` across ACTIVE club memberships (play-money in club wallets). */
  circulatingClubChips: number;
}

export interface AdminClubRowDto {
  id: string;
  name: string;
  isPrivate: boolean;
  memberCount: number;
  /** ISO 8601 — last document update (Mongoose `timestamps`). */
  updatedAt: string | null;
}

export interface AdminUserRowDto {
  userId: string;
  displayName: string | null;
  /** ISO 8601 — last profile activity (`updatedAt`, sort key for this list). */
  updatedAt: string | null;
}

export interface AdminTableRowDto {
  id: string;
  clubId: string;
  clubName: string;
  name: string;
  status: string;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxPlayers: number;
  timerSeconds: number;
  updatedAt: string | null;
}

export interface AdminPagedDto<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

export interface AdminSignupDayDto {
  /** UTC calendar date `YYYY-MM-DD`. */
  day: string;
  newUsers: number;
  newClubs: number;
}

export interface AdminSignupReportDto {
  days: AdminSignupDayDto[];
  rangeStart: string;
  rangeEnd: string;
}

export interface AdminLedgerDayDto {
  day: string;
  entries: number;
  netDelta: number;
}

export interface AdminLedgerReportDto {
  days: AdminLedgerDayDto[];
  rangeStart: string;
  rangeEnd: string;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildUtcDayLabels(dayCount: number): { labels: string[]; rangeStart: Date } {
  const n = Math.min(90, Math.max(1, Math.floor(dayCount)));
  const end = new Date();
  const utcMidnight = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const labels: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const ms = utcMidnight - i * 86400000;
    labels.push(new Date(ms).toISOString().slice(0, 10));
  }
  const rangeStart = new Date(`${labels[0]}T00:00:00.000Z`);
  return { labels, rangeStart };
}

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Club.name) private readonly clubModel: Model<ClubDocument>,
    @InjectModel(ClubMember.name)
    private readonly memberModel: Model<ClubMemberDocument>,
    @InjectModel(ClubTable.name) private readonly tableModel: Model<ClubTableDocument>,
    @InjectModel(ChipLedgerEntry.name)
    private readonly chipLedgerModel: Model<ChipLedgerDocument>,
  ) {}

  async getOverview(): Promise<AdminOverviewDto> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      userCount,
      clubCount,
      activeClubMembers,
      nonClosedTables,
      dailyActiveUsers24h,
      circulatingAgg,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.clubModel.countDocuments(),
      this.memberModel.countDocuments({ status: 'ACTIVE' }),
      this.tableModel.countDocuments({ status: { $ne: 'CLOSED' } }),
      this.userModel.countDocuments({ updatedAt: { $gte: since24h } }),
      this.memberModel.aggregate<{ s: number }>([
        { $match: { status: 'ACTIVE' } },
        { $group: { _id: null, s: { $sum: '$chipBalance' } } },
      ]),
    ]);
    const circulatingClubChips = Math.max(0, Math.floor(Number(circulatingAgg[0]?.s) || 0));
    return {
      userCount,
      clubCount,
      activeClubMembers,
      nonClosedTables,
      dailyActiveUsers24h,
      circulatingClubChips,
    };
  }

  async listClubs(
    limit = 50,
    skip = 0,
    search?: string,
  ): Promise<AdminPagedDto<AdminClubRowDto>> {
    const cap = Math.min(200, Math.max(1, Math.floor(limit)));
    const sk = Math.max(0, Math.floor(skip));
    const q = search?.trim();
    const filter: FilterQuery<ClubDocument> = q
      ? {
          $or: [
            { name: { $regex: escapeRegex(q), $options: 'i' } },
            { _id: { $regex: escapeRegex(q), $options: 'i' } },
          ],
        }
      : {};
    const total = await this.clubModel.countDocuments(filter);
    const clubs = await this.clubModel
      .find(filter)
      .sort({ name: 1 })
      .skip(sk)
      .limit(cap)
      .lean();
    const clubIds = clubs.map((c) => c._id);
    const agg =
      clubIds.length === 0
        ? []
        : await this.memberModel.aggregate<{ _id: string; n: number }>([
            { $match: { status: 'ACTIVE', clubId: { $in: clubIds } } },
            { $group: { _id: '$clubId', n: { $sum: 1 } } },
          ]);
    const byClub = new Map(agg.map((r) => [r._id, r.n]));
    const items = clubs.map((c) => {
      const u = (c as { updatedAt?: Date }).updatedAt;
      return {
        id: c._id,
        name: c.name,
        isPrivate: Boolean(c.isPrivate),
        memberCount: byClub.get(c._id) ?? 0,
        updatedAt: u instanceof Date ? u.toISOString() : null,
      };
    });
    return { items, total, skip: sk, limit: cap };
  }

  async listUsers(
    limit = 50,
    skip = 0,
    search?: string,
  ): Promise<AdminPagedDto<AdminUserRowDto>> {
    const cap = Math.min(200, Math.max(1, Math.floor(limit)));
    const sk = Math.max(0, Math.floor(skip));
    const q = search?.trim();
    const filter: FilterQuery<UserDocument> = q
      ? {
          $or: [
            { userId: { $regex: escapeRegex(q), $options: 'i' } },
            { displayName: { $regex: escapeRegex(q), $options: 'i' } },
          ],
        }
      : {};
    const total = await this.userModel.countDocuments(filter);
    const rows = await this.userModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .skip(sk)
      .limit(cap)
      .select({ userId: 1, displayName: 1, updatedAt: 1 })
      .lean();
    const items = rows.map((r) => {
      const u = (r as { updatedAt?: Date }).updatedAt;
      return {
        userId: r.userId,
        displayName:
          typeof r.displayName === 'string' && r.displayName.trim() ? r.displayName.trim() : null,
        updatedAt: u instanceof Date ? u.toISOString() : null,
      };
    });
    return { items, total, skip: sk, limit: cap };
  }

  async listTables(limit = 50, skip = 0): Promise<AdminPagedDto<AdminTableRowDto>> {
    const cap = Math.min(200, Math.max(1, Math.floor(limit)));
    const sk = Math.max(0, Math.floor(skip));
    const total = await this.tableModel.countDocuments();
    const tables = await this.tableModel
      .find()
      .sort({ updatedAt: -1 })
      .skip(sk)
      .limit(cap)
      .lean();
    const clubIds = [...new Set(tables.map((t) => t.clubId))];
    const clubs =
      clubIds.length === 0
        ? []
        : await this.clubModel.find({ _id: { $in: clubIds } }).select({ name: 1 }).lean();
    const nameBy = new Map(clubs.map((c) => [c._id, c.name]));
    const items: AdminTableRowDto[] = tables.map((t) => {
      const u = (t as { updatedAt?: Date }).updatedAt;
      return {
        id: t._id,
        clubId: t.clubId,
        clubName: String(nameBy.get(t.clubId) ?? t.clubId),
        name: t.name,
        status: t.status,
        smallBlind: t.smallBlind,
        bigBlind: t.bigBlind,
        minBuyIn: t.minBuyIn,
        maxPlayers: t.maxPlayers,
        timerSeconds: t.timerSeconds,
        updatedAt: u instanceof Date ? u.toISOString() : null,
      };
    });
    return { items, total, skip: sk, limit: cap };
  }

  /** Daily new users & clubs by `createdAt` (UTC day buckets). */
  async getSignupActivity(dayCount = 14): Promise<AdminSignupReportDto> {
    const { labels, rangeStart } = buildUtcDayLabels(dayCount);
    const [userBuckets, clubBuckets] = await Promise.all([
      this.userModel.aggregate<{ _id: string; c: number }>([
        { $match: { createdAt: { $gte: rangeStart } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' },
            },
            c: { $sum: 1 },
          },
        },
      ]),
      this.clubModel.aggregate<{ _id: string; c: number }>([
        { $match: { createdAt: { $gte: rangeStart } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' },
            },
            c: { $sum: 1 },
          },
        },
      ]),
    ]);
    const um = new Map(userBuckets.map((b) => [b._id, b.c]));
    const cm = new Map(clubBuckets.map((b) => [b._id, b.c]));
    const days: AdminSignupDayDto[] = labels.map((day) => ({
      day,
      newUsers: um.get(day) ?? 0,
      newClubs: cm.get(day) ?? 0,
    }));
    return {
      days,
      rangeStart: labels[0],
      rangeEnd: labels[labels.length - 1],
    };
  }

  /** Daily chip ledger volume (UTC): entry count + net delta sum per day. */
  async getLedgerActivity(dayCount = 14): Promise<AdminLedgerReportDto> {
    const { labels, rangeStart } = buildUtcDayLabels(dayCount);
    const buckets = await this.chipLedgerModel.aggregate<{ _id: string; n: number; net: number }>([
      { $match: { createdAt: { $gte: rangeStart } } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' },
          },
          n: { $sum: 1 },
          net: { $sum: '$delta' },
        },
      },
    ]);
    const bm = new Map(buckets.map((b) => [b._id, { n: b.n, net: b.net }]));
    const days: AdminLedgerDayDto[] = labels.map((day) => {
      const b = bm.get(day);
      return {
        day,
        entries: b?.n ?? 0,
        netDelta: b?.net ?? 0,
      };
    });
    return {
      days,
      rangeStart: labels[0],
      rangeEnd: labels[labels.length - 1],
    };
  }
}
