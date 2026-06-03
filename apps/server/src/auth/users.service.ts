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

  async findOrCreate(userId: string, displayName?: string): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ userId }).exec();
    if (existing) {
      if (displayName && displayName !== existing.displayName) {
        existing.displayName = displayName;
        await existing.save();
      }
      return existing;
    }
    return this.userModel.create({ userId, displayName });
  }

  async findByUserId(userId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ userId }).exec();
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
