import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { User, UserDocument } from '../auth/user.schema';
import { UsersService } from '../auth/users.service';
import {
  PlatformWalletKind,
  PlatformWalletRequest,
  PlatformWalletRequestDocument,
  PlatformWalletRequestStatus,
} from './platform-wallet-request.schema';

/** Max chips the platform wallet may hold after approved deposits (aligned with per-request cap). */
export const MAX_PLATFORM_WALLET_CHIPS = 1_000_000_000;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function floorBalance(u: UserDocument | Record<string, unknown> | null): number {
  if (!u) return 0;
  const raw = (u as { platformBalanceChips?: number }).platformBalanceChips;
  return Math.max(0, Math.floor(Number(raw) || 0));
}

@Injectable()
export class WalletService {
  constructor(
    @InjectModel(PlatformWalletRequest.name)
    private readonly reqModel: Model<PlatformWalletRequestDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly users: UsersService,
  ) {}

  async getBalance(userId: string): Promise<number> {
    const u = await this.userModel.findOne({ userId }).lean();
    return floorBalance(u);
  }

  /** Balance plus pending request exposure for deposit/withdraw forms. */
  async getWalletSummary(userId: string) {
    const [bal, pendingWithdrawalChips, pendingDepositChips] = await Promise.all([
      this.getBalance(userId),
      this.sumPendingAmount(userId, 'WITHDRAWAL'),
      this.sumPendingAmount(userId, 'DEPOSIT'),
    ]);
    const availableForWithdrawalChips = Math.max(0, bal - pendingWithdrawalChips);
    const availableDepositHeadroomChips = Math.max(
      0,
      MAX_PLATFORM_WALLET_CHIPS - bal - pendingDepositChips,
    );
    return {
      balanceChips: bal,
      pendingWithdrawalChips,
      availableForWithdrawalChips,
      pendingDepositChips,
      maxPlatformWalletChips: MAX_PLATFORM_WALLET_CHIPS,
      availableDepositHeadroomChips,
    };
  }

  private async sumPendingAmount(userId: string, kind: PlatformWalletKind): Promise<number> {
    const agg = await this.reqModel
      .aggregate<{ total: number }>([
        { $match: { userId, status: 'PENDING', kind } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ])
      .exec();
    const raw = agg[0]?.total;
    return Math.max(0, Math.floor(Number(raw) || 0));
  }

  async listMine(userId: string, limit: number, skip: number) {
    const lim = Math.min(100, Math.max(1, limit));
    const sk = Math.max(0, skip);
    const [items, total] = await Promise.all([
      this.reqModel
        .find({ userId })
        .sort({ createdAt: -1 })
        .skip(sk)
        .limit(lim)
        .lean(),
      this.reqModel.countDocuments({ userId }),
    ]);
    return {
      items: items.map((r) => this.toRow(r as Record<string, unknown>)),
      total,
      skip: sk,
      limit: lim,
    };
  }

  async createDeposit(userId: string, amount: number, memberNote?: string) {
    const a = this.parseAmount(amount);
    const bal = await this.getBalance(userId);
    const pendingDeposits = await this.sumPendingAmount(userId, 'DEPOSIT');
    const headroom = Math.max(0, MAX_PLATFORM_WALLET_CHIPS - bal - pendingDeposits);
    if (a > headroom) {
      throw new BadRequestException(
        `This deposit would exceed the platform wallet cap (${MAX_PLATFORM_WALLET_CHIPS.toLocaleString()} chips). You can request at most ${headroom} chips right now.`,
      );
    }
    const doc = await this.reqModel.create({
      userId,
      kind: 'DEPOSIT',
      amount: a,
      status: 'PENDING',
      memberNote: memberNote?.trim().slice(0, 500) || null,
    });
    return this.toRow(doc.toObject() as unknown as Record<string, unknown>);
  }

  async createWithdrawal(userId: string, amount: number, memberNote?: string) {
    const a = this.parseAmount(amount);
    const bal = await this.getBalance(userId);
    const pendingWithdrawals = await this.sumPendingAmount(userId, 'WITHDRAWAL');
    const available = Math.max(0, bal - pendingWithdrawals);
    if (a > available) {
      throw new BadRequestException(
        `Insufficient available balance for withdrawal. You can request at most ${available} chips right now (wallet ${bal}; ${pendingWithdrawals} chips already reserved by pending withdrawals).`,
      );
    }
    const doc = await this.reqModel.create({
      userId,
      kind: 'WITHDRAWAL',
      amount: a,
      status: 'PENDING',
      memberNote: memberNote?.trim().slice(0, 500) || null,
    });
    return this.toRow(doc.toObject() as unknown as Record<string, unknown>);
  }

  async cancelOwn(userId: string, id: string) {
    const row = await this.reqModel.findById(id).exec();
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Request not found.');
    }
    if (row.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be cancelled.');
    }
    row.status = 'CANCELLED';
    row.decidedAt = new Date();
    row.decidedByUserId = userId;
    row.adminNote = 'Cancelled by player.';
    await row.save();
    return this.toRow(row.toObject() as unknown as Record<string, unknown>);
  }

  async listAdmin(
    limit: number,
    skip: number,
    status?: PlatformWalletRequestStatus,
    q?: string,
  ) {
    const lim = Math.min(100, Math.max(1, limit));
    const sk = Math.max(0, skip);
    const filter: Record<string, unknown> = {};
    if (status && ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].includes(status)) {
      filter.status = status;
    }
    if (q?.trim()) {
      const t = q.trim();
      filter.userId = { $regex: escapeRegex(t), $options: 'i' };
    }
    const [items, total] = await Promise.all([
      this.reqModel.find(filter).sort({ createdAt: -1 }).skip(sk).limit(lim).lean(),
      this.reqModel.countDocuments(filter),
    ]);
    const rows = items.map((r) => this.toRow(r as Record<string, unknown>));
    const ids = [...new Set(rows.map((x) => x.userId))];
    const photoMap = await this.users.findTelegramPhotoUrlsByUserIds(ids);
    return {
      items: rows.map((x) => ({
        ...x,
        telegramPhotoUrl: photoMap.get(x.userId) ?? null,
      })),
      total,
      skip: sk,
      limit: lim,
    };
  }

  async adminDecide(
    adminUserId: string,
    id: string,
    decision: 'approve' | 'reject' | 'cancel',
    adminNote?: string,
  ) {
    const row = await this.reqModel.findById(id).exec();
    if (!row) throw new NotFoundException('Request not found.');
    if (row.status !== 'PENDING') {
      throw new BadRequestException('Request is no longer pending.');
    }
    const note = adminNote?.trim().slice(0, 500) || null;
    const now = new Date();

    if (decision === 'reject') {
      row.status = 'REJECTED';
      row.decidedByUserId = adminUserId;
      row.decidedAt = now;
      row.adminNote = note;
      await row.save();
      return this.toRow(row.toObject() as unknown as Record<string, unknown>);
    }

    if (decision === 'cancel') {
      row.status = 'CANCELLED';
      row.decidedByUserId = adminUserId;
      row.decidedAt = now;
      row.adminNote = note ?? 'Cancelled by administrator.';
      await row.save();
      return this.toRow(row.toObject() as unknown as Record<string, unknown>);
    }

    if (row.kind === 'DEPOSIT') {
      await this.userModel.updateOne(
        { userId: row.userId },
        { $inc: { platformBalanceChips: row.amount } },
      );
      row.status = 'APPROVED';
      row.decidedByUserId = adminUserId;
      row.decidedAt = now;
      row.adminNote = note;
      await row.save();
      return this.toRow(row.toObject() as unknown as Record<string, unknown>);
    }

    const res = await this.userModel
      .findOneAndUpdate(
        { userId: row.userId, platformBalanceChips: { $gte: row.amount } },
        { $inc: { platformBalanceChips: -row.amount } },
        { new: true },
      )
      .exec();
    if (!res) {
      throw new BadRequestException(
        'Player no longer has sufficient balance to approve this withdrawal.',
      );
    }
    row.status = 'APPROVED';
    row.decidedByUserId = adminUserId;
    row.decidedAt = now;
    row.adminNote = note;
    await row.save();
    return this.toRow(row.toObject() as unknown as Record<string, unknown>);
  }

  async getDailyReport(days: number) {
    const d = Math.min(90, Math.max(1, Math.floor(days)));
    const end = new Date();
    end.setUTCHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - (d - 1));
    start.setUTCHours(0, 0, 0, 0);

    const pipeline = [
      {
        $match: {
          status: 'APPROVED',
          decidedAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$decidedAt', timezone: 'UTC' },
          },
          depositSum: {
            $sum: { $cond: [{ $eq: ['$kind', 'DEPOSIT'] }, '$amount', 0] },
          },
          withdrawalSum: {
            $sum: { $cond: [{ $eq: ['$kind', 'WITHDRAWAL'] }, '$amount', 0] },
          },
          approvedCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ] as PipelineStage[];
    const agg = await this.reqModel.aggregate(pipeline).exec();
    const pending = await this.reqModel.countDocuments({ status: 'PENDING' });
    return {
      rangeStart: start.toISOString().slice(0, 10),
      rangeEnd: end.toISOString().slice(0, 10),
      pendingCount: pending,
      days: agg.map((x) => ({
        day: x._id as string,
        approvedCount: x.approvedCount as number,
        depositSum: x.depositSum as number,
        withdrawalSum: x.withdrawalSum as number,
      })),
    };
  }

  private parseAmount(amount: unknown): number {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 1) {
      throw new BadRequestException('amount must be a positive integer.');
    }
    if (n > MAX_PLATFORM_WALLET_CHIPS) {
      throw new BadRequestException('amount exceeds maximum.');
    }
    return n;
  }

  private toRow(r: Record<string, unknown>) {
    const id = String((r._id as { toString: () => string })?.toString?.() ?? r._id);
    const createdAt = (r.createdAt as Date)?.toISOString?.() ?? null;
    const updatedAt = (r.updatedAt as Date)?.toISOString?.() ?? null;
    const decidedAt = (r.decidedAt as Date)?.toISOString?.() ?? null;
    return {
      id,
      userId: r.userId as string,
      kind: r.kind as PlatformWalletKind,
      amount: Math.floor(Number(r.amount) || 0),
      status: r.status as PlatformWalletRequestStatus,
      memberNote: (r.memberNote as string | null | undefined) ?? null,
      decidedByUserId: (r.decidedByUserId as string | null | undefined) ?? null,
      decidedAt,
      adminNote: (r.adminNote as string | null | undefined) ?? null,
      createdAt,
      updatedAt,
    };
  }
}
