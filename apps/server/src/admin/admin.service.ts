import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../auth/user.schema';
import { Club, ClubDocument } from '../clubs/schemas/club.schema';
import { ClubMember, ClubMemberDocument } from '../clubs/schemas/club-member.schema';
import { ClubTable, ClubTableDocument } from '../tables/schemas/club-table.schema';

export interface AdminOverviewDto {
  userCount: number;
  clubCount: number;
  activeClubMembers: number;
  nonClosedTables: number;
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

export interface AdminPagedDto<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Club.name) private readonly clubModel: Model<ClubDocument>,
    @InjectModel(ClubMember.name)
    private readonly memberModel: Model<ClubMemberDocument>,
    @InjectModel(ClubTable.name) private readonly tableModel: Model<ClubTableDocument>,
  ) {}

  async getOverview(): Promise<AdminOverviewDto> {
    const [userCount, clubCount, activeClubMembers, nonClosedTables] = await Promise.all([
      this.userModel.countDocuments(),
      this.clubModel.countDocuments(),
      this.memberModel.countDocuments({ status: 'ACTIVE' }),
      this.tableModel.countDocuments({ status: { $ne: 'CLOSED' } }),
    ]);
    return {
      userCount,
      clubCount,
      activeClubMembers,
      nonClosedTables,
    };
  }

  async listClubs(limit = 50, skip = 0): Promise<AdminPagedDto<AdminClubRowDto>> {
    const cap = Math.min(200, Math.max(1, Math.floor(limit)));
    const sk = Math.max(0, Math.floor(skip));
    const total = await this.clubModel.countDocuments();
    const clubs = await this.clubModel.find().sort({ name: 1 }).skip(sk).limit(cap).lean();
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

  async listUsers(limit = 50, skip = 0): Promise<AdminPagedDto<AdminUserRowDto>> {
    const cap = Math.min(200, Math.max(1, Math.floor(limit)));
    const sk = Math.max(0, Math.floor(skip));
    const total = await this.userModel.countDocuments();
    const rows = await this.userModel
      .find()
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
}
