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
}
