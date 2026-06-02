import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { Club, ClubDocument } from './schemas/club.schema';
import { ClubMember, ClubMemberDocument } from './schemas/club-member.schema';
import { JoinRequest, JoinRequestDocument } from './schemas/join-request.schema';

export type ClubCardMembership = 'JOINED' | 'PENDING' | 'PRIVATE' | 'OPEN';

export interface ClubListItem {
  id: string;
  name: string;
  isPrivate: boolean;
  memberCount: number;
  membership: ClubCardMembership;
}

export interface ClubMemberRow {
  userId: string;
  role: 'OWNER' | 'MANAGER' | 'MEMBER';
}

export interface JoinRequestRow {
  id: string;
  userId: string;
  status: string;
}

export interface ClubDetailPayload {
  club: {
    id: string;
    name: string;
    isPrivate: boolean;
    memberCount: number;
  };
  membership: ClubCardMembership;
  viewerRole: 'OWNER' | 'MANAGER' | 'MEMBER' | null;
  members: ClubMemberRow[];
  pendingRequests: JoinRequestRow[];
}

const SEED_USER_ID = 'local-player';

@Injectable()
export class ClubsService implements OnModuleInit {
  constructor(
    @InjectModel(Club.name) private readonly clubModel: Model<ClubDocument>,
    @InjectModel(ClubMember.name)
    private readonly memberModel: Model<ClubMemberDocument>,
    @InjectModel(JoinRequest.name)
    private readonly joinRequestModel: Model<JoinRequestDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeed();
  }

  private async ensureSeed(): Promise<void> {
    const n = await this.clubModel.countDocuments();
    if (n > 0) return;

    await this.clubModel.insertMany([
      { _id: 'c1', name: "Midnight Hold'em", isPrivate: false },
      { _id: 'c2', name: 'Tokyo Fish', isPrivate: false },
      { _id: 'c3', name: 'Monte Private', isPrivate: true },
      { _id: 'c4', name: 'River Runners', isPrivate: false },
    ]);

    await this.memberModel.insertMany([
      {
        clubId: 'c1',
        userId: SEED_USER_ID,
        role: 'MANAGER',
        status: 'ACTIVE',
      },
      {
        clubId: 'c2',
        userId: SEED_USER_ID,
        role: 'MEMBER',
        status: 'ACTIVE',
      },
      {
        clubId: 'c4',
        userId: SEED_USER_ID,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    ]);

    await this.joinRequestModel.create({
      clubId: 'c4',
      userId: 'demo-applicant',
      status: 'PENDING',
    });
  }

  private async memberCountsByClub(): Promise<Map<string, number>> {
    const rows = await this.memberModel.aggregate<{ _id: string; n: number }>([
      { $match: { status: 'ACTIVE' } },
      { $group: { _id: '$clubId', n: { $sum: 1 } } },
    ]);
    return new Map(rows.map((r) => [r._id, r.n]));
  }

  async listForUser(userId: string): Promise<ClubListItem[]> {
    const clubs = await this.clubModel.find().sort({ name: 1 }).lean();
    const counts = await this.memberCountsByClub();
    const activeMemberships = await this.memberModel
      .find({ userId, status: 'ACTIVE' })
      .lean();
    const joined = new Set(activeMemberships.map((m) => m.clubId));
    const pending = await this.joinRequestModel
      .find({ userId, status: 'PENDING' })
      .lean();
    const pendingClubIds = new Set(pending.map((p) => p.clubId));

    return clubs.map((c) => {
      const memberCount = counts.get(c._id) ?? 0;
      let membership: ClubCardMembership;
      if (joined.has(c._id)) membership = 'JOINED';
      else if (pendingClubIds.has(c._id)) membership = 'PENDING';
      else if (c.isPrivate) membership = 'PRIVATE';
      else membership = 'OPEN';
      return {
        id: c._id,
        name: c.name,
        isPrivate: c.isPrivate,
        memberCount,
        membership,
      };
    });
  }

  async createClub(
    userId: string,
    name: string,
    isPrivate: boolean,
  ): Promise<ClubListItem> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80) {
      throw new BadRequestException('Club name must be 1–80 characters.');
    }
    const id = randomUUID();
    await this.clubModel.create({
      _id: id,
      name: trimmed,
      isPrivate,
    });
    await this.memberModel.create({
      clubId: id,
      userId,
      role: 'OWNER',
      status: 'ACTIVE',
    });
    return {
      id,
      name: trimmed,
      isPrivate,
      memberCount: 1,
      membership: 'JOINED',
    };
  }

  private async resolveMembership(
    clubId: string,
    userId: string,
    isPrivate: boolean,
  ): Promise<ClubCardMembership> {
    const m = await this.memberModel.findOne({
      clubId,
      userId,
      status: 'ACTIVE',
    });
    if (m) return 'JOINED';
    const p = await this.joinRequestModel.findOne({
      clubId,
      userId,
      status: 'PENDING',
    });
    if (p) return 'PENDING';
    if (isPrivate) return 'PRIVATE';
    return 'OPEN';
  }

  async getDetail(clubId: string, userId: string): Promise<ClubDetailPayload> {
    const club = await this.clubModel.findById(clubId).lean();
    if (!club) throw new NotFoundException('Club not found');

    const memberCount = await this.memberModel.countDocuments({
      clubId: club._id,
      status: 'ACTIVE',
    });

    const self = await this.memberModel
      .findOne({ clubId: club._id, userId, status: 'ACTIVE' })
      .lean();

    const membership = await this.resolveMembership(
      club._id,
      userId,
      club.isPrivate,
    );

    const viewerRole = self?.role ?? null;
    const canSeeRoster = !!self || !club.isPrivate;

    let members: ClubMemberRow[] = [];
    if (canSeeRoster) {
      const rows = await this.memberModel
        .find({ clubId: club._id, status: 'ACTIVE' })
        .select({ userId: 1, role: 1 })
        .lean();
      members = rows.map((m) => ({
        userId: m.userId,
        role: m.role as ClubMemberRow['role'],
      }));
    }

    let pendingRequests: JoinRequestRow[] = [];
    if (viewerRole === 'OWNER' || viewerRole === 'MANAGER') {
      const pr = await this.joinRequestModel
        .find({ clubId: club._id, status: 'PENDING' })
        .sort({ createdAt: -1 })
        .lean();
      pendingRequests = pr.map((r) => ({
        id: String(r._id),
        userId: r.userId,
        status: r.status,
      }));
    }

    return {
      club: {
        id: club._id,
        name: club.name,
        isPrivate: club.isPrivate,
        memberCount,
      },
      membership,
      viewerRole,
      members,
      pendingRequests,
    };
  }

  async joinClub(clubId: string, userId: string): Promise<{ status: string }> {
    const club = await this.clubModel.findById(clubId);
    if (!club) throw new NotFoundException('Club not found');

    const existing = await this.memberModel.findOne({
      clubId,
      userId,
      status: 'ACTIVE',
    });
    if (existing) return { status: 'already_member' };

    if (club.isPrivate) {
      const dup = await this.joinRequestModel.findOne({
        clubId,
        userId,
        status: 'PENDING',
      });
      if (dup) return { status: 'request_pending' };
      await this.joinRequestModel.create({
        clubId,
        userId,
        status: 'PENDING',
      });
      return { status: 'request_created' };
    }

    await this.memberModel.create({
      clubId,
      userId,
      role: 'MEMBER',
      status: 'ACTIVE',
    });
    return { status: 'joined' };
  }

  async listJoinRequests(
    clubId: string,
    actorUserId: string,
  ): Promise<JoinRequestRow[]> {
    const detail = await this.getDetail(clubId, actorUserId);
    if (detail.viewerRole !== 'OWNER' && detail.viewerRole !== 'MANAGER') {
      throw new ForbiddenException('Manager access required');
    }
    return detail.pendingRequests;
  }

  async decideJoinRequest(
    clubId: string,
    requestId: string,
    actorUserId: string,
    approve: boolean,
  ): Promise<void> {
    const actor = await this.memberModel.findOne({
      clubId,
      userId: actorUserId,
      status: 'ACTIVE',
    });
    if (!actor || (actor.role !== 'OWNER' && actor.role !== 'MANAGER')) {
      throw new ForbiddenException('Manager access required');
    }

    const req = await this.joinRequestModel.findById(requestId);
    if (!req || req.clubId !== clubId) {
      throw new NotFoundException('Join request not found');
    }
    if (req.status !== 'PENDING') {
      throw new BadRequestException('Request is no longer pending');
    }

    if (approve) {
      const existing = await this.memberModel.findOne({
        clubId,
        userId: req.userId,
        status: 'ACTIVE',
      });
      if (!existing) {
        await this.memberModel.create({
          clubId,
          userId: req.userId,
          role: 'MEMBER',
          status: 'ACTIVE',
        });
      }
      req.status = 'APPROVED';
    } else {
      req.status = 'REJECTED';
    }
    await req.save();
  }
}
