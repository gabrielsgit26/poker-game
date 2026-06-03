import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClubMember, ClubMemberDocument } from '../clubs/schemas/club-member.schema';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(ClubMember.name)
    private readonly memberModel: Model<ClubMemberDocument>,
  ) {}

  async findOrCreate(
    userId: string,
    displayName?: string,
    telegramPhotoUrl?: string | null,
  ): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ userId }).exec();
    if (existing) {
      let dirty = false;
      if (displayName && displayName !== existing.displayName) {
        existing.displayName = displayName;
        dirty = true;
      }
      if (
        typeof telegramPhotoUrl === 'string' &&
        telegramPhotoUrl.length > 0 &&
        telegramPhotoUrl !== existing.telegramPhotoUrl
      ) {
        existing.telegramPhotoUrl = telegramPhotoUrl;
        dirty = true;
      }
      if (dirty) await existing.save();
      return existing;
    }
    return this.userModel.create({
      userId,
      displayName,
      ...(typeof telegramPhotoUrl === 'string' && telegramPhotoUrl.length > 0
        ? { telegramPhotoUrl }
        : {}),
    });
  }

  async findByUserId(userId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ userId }).exec();
  }

  /** Profile photos for table / lobby UIs (batched). */
  async findTelegramPhotoUrlsByUserIds(
    userIds: string[],
  ): Promise<Map<string, string | null>> {
    const out = new Map<string, string | null>();
    if (userIds.length === 0) return out;
    const unique = [...new Set(userIds)];
    for (const id of unique) out.set(id, null);
    const rows = await this.userModel
      .find({ userId: { $in: unique } })
      .select({ userId: 1, telegramPhotoUrl: 1 })
      .lean();
    for (const r of rows) {
      const raw = r.telegramPhotoUrl;
      const url =
        typeof raw === 'string' && raw.trim().startsWith('https://')
          ? raw.trim()
          : null;
      out.set(r.userId, url);
    }
    return out;
  }

  /** Sum of ACTIVE club membership chip wallets for this user (off-table club chips). */
  async sumActiveClubChips(userId: string): Promise<number> {
    const agg = await this.memberModel
      .aggregate<{ s: number }>([
        { $match: { userId, status: 'ACTIVE' } },
        { $group: { _id: null, s: { $sum: '$chipBalance' } } },
      ])
      .exec();
    const raw = agg[0]?.s;
    return Math.max(0, Math.floor(Number(raw) || 0));
  }

  /** Credits the user's platform play-money wallet (e.g. club cash-out settled to main balance). */
  async incrementPlatformBalance(userId: string, delta: number): Promise<void> {
    const d = Math.floor(delta);
    if (!Number.isFinite(d) || d <= 0) return;
    await this.userModel.updateOne({ userId }, { $inc: { platformBalanceChips: d } });
  }
}
