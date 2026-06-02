import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './user.schema';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

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
}
