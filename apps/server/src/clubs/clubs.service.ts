import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import { AuthService } from '../auth/auth.service';
import { Club, ClubDocument } from './schemas/club.schema';
import { ClubMember, ClubMemberDocument } from './schemas/club-member.schema';
import {
  ChipLedgerEntry,
  ChipLedgerDocument,
  type ChipLedgerKind,
} from './schemas/chip-ledger.schema';
import { JoinRequest, JoinRequestDocument } from './schemas/join-request.schema';
import {
  CashOutRequest,
  CashOutRequestDocument,
} from './schemas/cash-out-request.schema';

export type ClubCardMembership = 'JOINED' | 'PENDING' | 'PRIVATE' | 'OPEN';

export interface ClubListItem {
  id: string;
  name: string;
  isPrivate: boolean;
  memberCount: number;
  membership: ClubCardMembership;
  /** Present when `membership === 'JOINED'`. */
  viewerRole?: 'OWNER' | 'MANAGER' | 'MEMBER';
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

export interface CashOutRequestRow {
  id: string;
  userId: string;
  amount: number;
  status: string;
  memberNote: string | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
  createdAt: string;
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
  /** Club wallet chips for the viewer when `membership === JOINED`; otherwise null. */
  viewerClubChipBalance: number | null;
  members: ClubMemberRow[];
  pendingRequests: JoinRequestRow[];
}

export interface ChipLedgerRowDto {
  id: string;
  userId: string;
  createdAt: string;
  delta: number;
  balanceAfter: number;
  kind: string;
  tableId: string | null;
  note: string | null;
}

const SEED_USER_ID = 'local-player';

@Injectable()
export class ClubsService implements OnModuleInit {
  private readonly logger = new Logger(ClubsService.name);

  constructor(
    @InjectModel(Club.name) private readonly clubModel: Model<ClubDocument>,
    @InjectModel(ClubMember.name)
    private readonly memberModel: Model<ClubMemberDocument>,
    @InjectModel(JoinRequest.name)
    private readonly joinRequestModel: Model<JoinRequestDocument>,
    @InjectModel(ChipLedgerEntry.name)
    private readonly chipLedgerModel: Model<ChipLedgerDocument>,
    @InjectModel(CashOutRequest.name)
    private readonly cashOutRequestModel: Model<CashOutRequestDocument>,
    private readonly auth: AuthService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeed();
    await this.memberModel.updateMany(
      { chipBalance: { $exists: false } },
      { $set: { chipBalance: 100_000 } },
    );
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
        chipBalance: 100_000,
      },
      {
        clubId: 'c2',
        userId: SEED_USER_ID,
        role: 'MEMBER',
        status: 'ACTIVE',
        chipBalance: 100_000,
      },
      {
        clubId: 'c4',
        userId: SEED_USER_ID,
        role: 'OWNER',
        status: 'ACTIVE',
        chipBalance: 100_000,
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
    const roleByClub = new Map(
      activeMemberships.map((m) => [
        m.clubId,
        m.role as 'OWNER' | 'MANAGER' | 'MEMBER',
      ]),
    );
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
        viewerRole: joined.has(c._id)
          ? roleByClub.get(c._id) ?? 'MEMBER'
          : undefined,
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
      viewerRole: 'OWNER',
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
      viewerClubChipBalance: self
        ? Math.max(0, Math.floor(Number(self.chipBalance) || 0))
        : null,
      members,
      pendingRequests,
    };
  }

  async listChipLedger(
    clubId: string,
    userId: string,
    scope: 'me' | 'club' = 'me',
    limit = 50,
  ): Promise<ChipLedgerRowDto[]> {
    if (scope === 'club') {
      const actor = await this.memberModel.findOne({
        clubId,
        userId,
        status: 'ACTIVE',
      });
      if (!actor || (actor.role !== 'OWNER' && actor.role !== 'MANAGER')) {
        throw new ForbiddenException(
          'Club-wide activity requires owner or manager role.',
        );
      }
      const cap = Math.min(120, Math.max(1, Math.floor(limit)));
      const rows = await this.chipLedgerModel
        .find({ clubId })
        .sort({ createdAt: -1 })
        .limit(cap)
        .lean();
      return rows.map((r) => {
        const created = (r as { createdAt?: Date }).createdAt;
        return {
          id: String(r._id),
          userId: r.userId,
          createdAt: created instanceof Date ? created.toISOString() : new Date().toISOString(),
          delta: r.delta,
          balanceAfter: r.balanceAfter,
          kind: r.kind,
          tableId: r.tableId ?? null,
          note: r.note ?? null,
        };
      });
    }

    const self = await this.memberModel.findOne({
      clubId,
      userId,
      status: 'ACTIVE',
    });
    if (!self) {
      throw new ForbiddenException(
        'You must be a club member to view chip activity.',
      );
    }
    const cap = Math.min(100, Math.max(1, Math.floor(limit)));
    const rows = await this.chipLedgerModel
      .find({ clubId, userId })
      .sort({ createdAt: -1 })
      .limit(cap)
      .lean();
    return rows.map((r) => {
      const created = (r as { createdAt?: Date }).createdAt;
      return {
        id: String(r._id),
        userId: r.userId,
        createdAt: created instanceof Date ? created.toISOString() : new Date().toISOString(),
        delta: r.delta,
        balanceAfter: r.balanceAfter,
        kind: r.kind,
        tableId: r.tableId ?? null,
        note: r.note ?? null,
      };
    });
  }

  private async readMemberChipBalance(
    clubId: string,
    userId: string,
  ): Promise<number> {
    const m = await this.memberModel
      .findOne({ clubId, userId, status: 'ACTIVE' })
      .select({ chipBalance: 1 })
      .lean();
    const n = m?.chipBalance;
    return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }

  private async appendChipLedgerEntry(
    clubId: string,
    userId: string,
    delta: number,
    balanceAfter: number,
    kind: ChipLedgerKind,
    opts?: { tableId?: string | null; note?: string | null },
  ): Promise<void> {
    try {
      await this.chipLedgerModel.create({
        clubId,
        userId,
        delta,
        balanceAfter,
        kind,
        tableId: opts?.tableId ?? undefined,
        note: opts?.note ?? undefined,
      });
    } catch (e) {
      this.logger.warn(`chip_ledger write failed: ${(e as Error).message}`);
    }
  }

  /**
   * Owner or manager adjusts a member's off-table club chip balance (audited in chip_ledger).
   * Managers cannot adjust owners or other managers.
   */
  async adjustMemberChips(
    clubId: string,
    actorUserId: string,
    targetUserId: string,
    delta: number,
    note?: string,
  ): Promise<{
    ok: true;
    targetUserId: string;
    newBalance: number;
    delta: number;
  }> {
    const d = Math.trunc(delta);
    if (d === 0) {
      throw new BadRequestException('delta must be non-zero.');
    }
    const cap = 1_000_000;
    if (Math.abs(d) > cap) {
      throw new BadRequestException(
        `Adjustment too large (limit ±${cap.toLocaleString()} per request).`,
      );
    }
    const tu = targetUserId.trim();
    if (!tu || tu.length > 80 || !/^[\w.-]+$/.test(tu)) {
      throw new BadRequestException('Invalid target user id.');
    }

    const actor = await this.memberModel.findOne({
      clubId,
      userId: actorUserId,
      status: 'ACTIVE',
    });
    if (!actor || (actor.role !== 'OWNER' && actor.role !== 'MANAGER')) {
      throw new ForbiddenException('Only club owners or managers can adjust chips.');
    }

    const target = await this.memberModel.findOne({
      clubId,
      userId: tu,
      status: 'ACTIVE',
    });
    if (!target) {
      throw new NotFoundException('Member not found in this club.');
    }

    if (actor.role === 'MANAGER') {
      if (target.role === 'OWNER' || target.role === 'MANAGER') {
        throw new ForbiddenException(
          'Managers can only adjust chip balances for regular members.',
        );
      }
    }

    if (d < 0) {
      const res = await this.memberModel.updateOne(
        {
          clubId,
          userId: tu,
          status: 'ACTIVE',
          chipBalance: { $gte: -d },
        },
        { $inc: { chipBalance: d } },
      );
      if (res.modifiedCount !== 1) {
        throw new BadRequestException(
          'Debit failed — member may not have enough club chips.',
        );
      }
    } else {
      await this.memberModel.updateOne(
        { clubId, userId: tu, status: 'ACTIVE' },
        { $inc: { chipBalance: d } },
      );
    }

    const newBalance = await this.readMemberChipBalance(clubId, tu);
    const noteTrim = typeof note === 'string' ? note.trim().slice(0, 200) : '';
    const auditNote = `by ${actorUserId}${noteTrim ? `: ${noteTrim}` : ''}`.slice(0, 240);
    await this.appendChipLedgerEntry(clubId, tu, d, newBalance, 'MANAGER_ADJUST', {
      note: auditNote,
    });

    return { ok: true, targetUserId: tu, newBalance, delta: d };
  }

  /**
   * Platform operator adjusts any member's club chip wallet (audited as PLATFORM_ADJUST).
   * Caller must verify `actorUserId` is a platform admin (see `AuthService.isPlatformAdminUserId`).
   */
  async adjustMemberChipsAsPlatform(
    clubId: string,
    actorUserId: string,
    targetUserId: string,
    delta: number,
    note?: string,
  ): Promise<{
    ok: true;
    targetUserId: string;
    newBalance: number;
    delta: number;
  }> {
    if (!this.auth.isPlatformAdminUserId(actorUserId)) {
      throw new ForbiddenException('Platform admin access required.');
    }

    const d = Math.trunc(delta);
    if (d === 0) {
      throw new BadRequestException('delta must be non-zero.');
    }
    const cap = 1_000_000;
    if (Math.abs(d) > cap) {
      throw new BadRequestException(
        `Adjustment too large (limit ±${cap.toLocaleString()} per request).`,
      );
    }
    const tu = targetUserId.trim();
    if (!tu || tu.length > 80 || !/^[\w.-]+$/.test(tu)) {
      throw new BadRequestException('Invalid target user id.');
    }

    const target = await this.memberModel.findOne({
      clubId,
      userId: tu,
      status: 'ACTIVE',
    });
    if (!target) {
      throw new NotFoundException('Member not found in this club.');
    }

    if (d < 0) {
      const res = await this.memberModel.updateOne(
        {
          clubId,
          userId: tu,
          status: 'ACTIVE',
          chipBalance: { $gte: -d },
        },
        { $inc: { chipBalance: d } },
      );
      if (res.modifiedCount !== 1) {
        throw new BadRequestException(
          'Debit failed — member may not have enough club chips.',
        );
      }
    } else {
      await this.memberModel.updateOne(
        { clubId, userId: tu, status: 'ACTIVE' },
        { $inc: { chipBalance: d } },
      );
    }

    const newBalance = await this.readMemberChipBalance(clubId, tu);
    const noteTrim = typeof note === 'string' ? note.trim().slice(0, 200) : '';
    const auditNote = `platform by ${actorUserId}${noteTrim ? `: ${noteTrim}` : ''}`.slice(
      0,
      240,
    );
    await this.appendChipLedgerEntry(clubId, tu, d, newBalance, 'PLATFORM_ADJUST', {
      note: auditNote,
    });

    return { ok: true, targetUserId: tu, newBalance, delta: d };
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

  private mapCashOutRow(r: CashOutRequestDocument): CashOutRequestRow {
    const created = (r as { createdAt?: Date }).createdAt;
    const decided = r.decidedAt;
    return {
      id: String(r._id),
      userId: r.userId,
      amount: Math.max(0, Math.floor(Number(r.amount) || 0)),
      status: r.status,
      memberNote: r.memberNote ?? null,
      decidedByUserId: r.decidedByUserId ?? null,
      decidedAt: decided instanceof Date ? decided.toISOString() : null,
      createdAt:
        created instanceof Date ? created.toISOString() : new Date().toISOString(),
    };
  }

  /** Active member requests debiting their club wallet (manager approval). */
  async createCashOutRequest(
    clubId: string,
    userId: string,
    amount: number,
    memberNote?: string,
  ): Promise<CashOutRequestRow> {
    const club = await this.clubModel.findById(clubId);
    if (!club) throw new NotFoundException('Club not found');

    const self = await this.memberModel.findOne({
      clubId,
      userId,
      status: 'ACTIVE',
    });
    if (!self) {
      throw new ForbiddenException('You must be a club member to request a cash-out.');
    }

    const amt = Math.trunc(amount);
    if (!Number.isFinite(amt) || amt < 1) {
      throw new BadRequestException('amount must be a positive integer.');
    }
    const cap = 1_000_000;
    if (amt > cap) {
      throw new BadRequestException(
        `Request too large (max ${cap.toLocaleString()} chips per request).`,
      );
    }

    const balance = await this.readMemberChipBalance(clubId, userId);
    if (amt > balance) {
      throw new BadRequestException(
        `Not enough club chips (you have ${balance}, requested ${amt}).`,
      );
    }

    const pending = await this.cashOutRequestModel.findOne({
      clubId,
      userId,
      status: 'PENDING',
    });
    if (pending) {
      throw new BadRequestException('You already have a pending cash-out request for this club.');
    }

    const noteTrim =
      typeof memberNote === 'string' ? memberNote.trim().slice(0, 200) : '';
    const doc = await this.cashOutRequestModel.create({
      clubId,
      userId,
      amount: amt,
      status: 'PENDING',
      memberNote: noteTrim || undefined,
    });
    return this.mapCashOutRow(doc);
  }

  async listCashOutRequests(
    clubId: string,
    actorUserId: string,
  ): Promise<CashOutRequestRow[]> {
    const club = await this.clubModel.findById(clubId);
    if (!club) throw new NotFoundException('Club not found');

    const actor = await this.memberModel.findOne({
      clubId,
      userId: actorUserId,
      status: 'ACTIVE',
    });
    if (!actor) {
      throw new ForbiddenException('You must be a club member to view cash-out requests.');
    }

    const isManager = actor.role === 'OWNER' || actor.role === 'MANAGER';
    const limit = isManager ? 80 : 40;
    const filter = isManager ? { clubId } : { clubId, userId: actorUserId };
    const rows = await this.cashOutRequestModel
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
    return rows.map((r) =>
      this.mapCashOutRow(r as unknown as CashOutRequestDocument),
    );
  }

  async decideCashOutRequest(
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
      throw new ForbiddenException('Only club owners or managers can decide cash-out requests.');
    }

    const req = await this.cashOutRequestModel.findById(requestId);
    if (!req || req.clubId !== clubId) {
      throw new NotFoundException('Cash-out request not found');
    }
    if (req.status !== 'PENDING') {
      throw new BadRequestException('Request is no longer pending');
    }

    const now = new Date();
    if (!approve) {
      req.status = 'REJECTED';
      req.decidedByUserId = actorUserId;
      req.decidedAt = now;
      await req.save();
      return;
    }

    const amt = Math.max(0, Math.floor(Number(req.amount) || 0));
    if (amt < 1) {
      throw new BadRequestException('Invalid request amount.');
    }

    const res = await this.memberModel.updateOne(
      {
        clubId,
        userId: req.userId,
        status: 'ACTIVE',
        chipBalance: { $gte: amt },
      },
      { $inc: { chipBalance: -amt } },
    );
    if (res.modifiedCount !== 1) {
      throw new BadRequestException(
        'Member no longer has enough club chips to approve this request.',
      );
    }

    const newBalance = await this.readMemberChipBalance(clubId, req.userId);
    const ledgerNote = `Cash-out approved by ${actorUserId} (request ${String(req._id)})`.slice(
      0,
      240,
    );
    await this.appendChipLedgerEntry(
      clubId,
      req.userId,
      -amt,
      newBalance,
      'MEMBER_CASHOUT',
      { note: ledgerNote },
    );

    req.status = 'APPROVED';
    req.decidedByUserId = actorUserId;
    req.decidedAt = now;
    await req.save();
  }

  /**
   * Per-club sum of ACTIVE member club wallets for clubs where the viewer is OWNER or MANAGER.
   */
  async getManagedClubChipTotals(
    userId: string,
  ): Promise<{ clubId: string; clubName: string; totalMemberChips: number }[]> {
    const roles = await this.memberModel
      .find({
        userId,
        status: 'ACTIVE',
        role: { $in: ['OWNER', 'MANAGER'] },
      })
      .select({ clubId: 1 })
      .lean();
    const ids = [...new Set(roles.map((r) => r.clubId))];
    if (ids.length === 0) return [];
    const clubs = await this.clubModel.find({ _id: { $in: ids } }).select({ name: 1 }).lean();
    const nameBy = new Map(clubs.map((c) => [c._id, c.name]));
    const out: { clubId: string; clubName: string; totalMemberChips: number }[] = [];
    for (const clubId of ids) {
      const agg = await this.memberModel.aggregate<{ s: number }>([
        { $match: { clubId, status: 'ACTIVE' } },
        { $group: { _id: null, s: { $sum: '$chipBalance' } } },
      ]);
      const raw = agg[0]?.s ?? 0;
      out.push({
        clubId,
        clubName: String(nameBy.get(clubId) ?? clubId),
        totalMemberChips: Math.max(0, Math.floor(Number(raw) || 0)),
      });
    }
    out.sort((a, b) => a.clubName.localeCompare(b.clubName));
    return out;
  }
}
