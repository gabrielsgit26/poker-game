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
import { Club, ClubDocument } from '../clubs/schemas/club.schema';
import {
  ClubMember,
  ClubMemberDocument,
} from '../clubs/schemas/club-member.schema';
import { ClubTable, ClubTableDocument } from './schemas/club-table.schema';
import { TableSeat, TableSeatDocument } from './schemas/table-seat.schema';

export type LobbyPlayStatus = 'WAITING' | 'PLAYING' | 'FULL';

export interface TableListRow {
  id: string;
  clubId: string;
  clubName: string;
  name: string;
  smallBlind: number;
  bigBlind: number;
  players: number;
  maxPlayers: number;
  timerSeconds: number;
  minBuyIn: number;
  playStatus: LobbyPlayStatus;
}

export interface TableSeatRow {
  seatIndex: number;
  userId: string | null;
}

export interface TableDetailPayload {
  table: TableListRow;
  seats: TableSeatRow[];
  viewerSeatIndex: number | null;
}

function lobbyPlayStatus(
  occupied: number,
  max: number,
  dbStatus: string,
): LobbyPlayStatus {
  if (dbStatus === 'CLOSED') return 'WAITING';
  if (occupied >= max) return 'FULL';
  if (occupied >= 2) return 'PLAYING';
  return 'WAITING';
}

@Injectable()
export class TablesService implements OnModuleInit {
  constructor(
    @InjectModel(ClubTable.name) private readonly tableModel: Model<ClubTableDocument>,
    @InjectModel(TableSeat.name) private readonly seatModel: Model<TableSeatDocument>,
    @InjectModel(Club.name) private readonly clubModel: Model<ClubDocument>,
    @InjectModel(ClubMember.name)
    private readonly memberModel: Model<ClubMemberDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeedTables();
  }

  private async ensureSeedTables(): Promise<void> {
    const n = await this.tableModel.countDocuments();
    if (n > 0) return;
    const c1 = await this.clubModel.findById('c1').lean();
    const c2 = await this.clubModel.findById('c2').lean();
    if (!c1 || !c2) return;

    await this.tableModel.insertMany([
      {
        _id: 't1',
        clubId: 'c1',
        name: "Ante-Up #1",
        smallBlind: 5,
        bigBlind: 10,
        maxPlayers: 6,
        timerSeconds: 15,
        minBuyIn: 500,
        status: 'PLAYING',
        createdByUserId: 'local-player',
      },
      {
        _id: 't2',
        clubId: 'c1',
        name: 'Micro Stakes',
        smallBlind: 1,
        bigBlind: 2,
        maxPlayers: 6,
        timerSeconds: 12,
        minBuyIn: 80,
        status: 'WAITING',
        createdByUserId: 'local-player',
      },
      {
        _id: 't3',
        clubId: 'c2',
        name: 'DL 50/100',
        smallBlind: 50,
        bigBlind: 100,
        maxPlayers: 6,
        timerSeconds: 20,
        minBuyIn: 5000,
        status: 'PLAYING',
        createdByUserId: 'local-player',
      },
      {
        _id: 't4',
        clubId: 'c2',
        name: 'HU High',
        smallBlind: 25,
        bigBlind: 50,
        maxPlayers: 2,
        timerSeconds: 15,
        minBuyIn: 2000,
        status: 'WAITING',
        createdByUserId: 'local-player',
      },
    ]);

    const seatRows: { tableId: string; seatIndex: number; userId: string }[] = [];
    for (let i = 0; i < 4; i++) {
      seatRows.push({ tableId: 't1', seatIndex: i, userId: `bot-t1-${i}` });
    }
    for (let i = 0; i < 2; i++) {
      seatRows.push({ tableId: 't2', seatIndex: i, userId: `bot-t2-${i}` });
    }
    for (let i = 0; i < 6; i++) {
      seatRows.push({ tableId: 't3', seatIndex: i, userId: `bot-t3-${i}` });
    }
    seatRows.push({ tableId: 't4', seatIndex: 0, userId: 'bot-t4-0' });

    await this.seatModel.insertMany(seatRows);
  }

  private async clubName(clubId: string): Promise<string> {
    const c = await this.clubModel.findById(clubId).lean();
    return c?.name ?? 'Club';
  }

  private async occupiedCount(tableId: string): Promise<number> {
    return this.seatModel.countDocuments({ tableId });
  }

  private async toListRow(t: ClubTableDocument): Promise<TableListRow> {
    const occupied = await this.occupiedCount(t._id);
    return {
      id: t._id,
      clubId: t.clubId,
      clubName: await this.clubName(t.clubId),
      name: t.name,
      smallBlind: t.smallBlind,
      bigBlind: t.bigBlind,
      players: occupied,
      maxPlayers: t.maxPlayers,
      timerSeconds: t.timerSeconds,
      minBuyIn: t.minBuyIn,
      playStatus: lobbyPlayStatus(occupied, t.maxPlayers, t.status),
    };
  }

  async listOpenTables(): Promise<TableListRow[]> {
    const rows = await this.tableModel
      .find({ status: { $ne: 'CLOSED' } })
      .sort({ clubId: 1, name: 1 })
      .lean();
    return Promise.all(rows.map((row) => this.toListRow(row as ClubTableDocument)));
  }

  async assertCanManageTables(clubId: string, userId: string): Promise<void> {
    const m = await this.memberModel.findOne({
      clubId,
      userId,
      status: 'ACTIVE',
    });
    if (!m || (m.role !== 'OWNER' && m.role !== 'MANAGER')) {
      throw new ForbiddenException('Only club owners or managers can create tables.');
    }
  }

  async assertClubMember(clubId: string, userId: string): Promise<void> {
    const m = await this.memberModel.findOne({
      clubId,
      userId,
      status: 'ACTIVE',
    });
    if (!m) throw new ForbiddenException('You must be a club member to sit at this table.');
  }

  async createTable(
    userId: string,
    clubId: string,
    body: {
      name: string;
      smallBlind: number;
      bigBlind: number;
      maxPlayers?: number;
      timerSeconds?: number;
      minBuyIn?: number;
    },
  ): Promise<TableListRow> {
    await this.assertCanManageTables(clubId, userId);
    const name = body.name.trim();
    if (!name || name.length > 80) {
      throw new BadRequestException('Table name must be 1–80 characters.');
    }
    if (body.smallBlind < 0 || body.bigBlind < 0) {
      throw new BadRequestException('Blinds must be non-negative.');
    }
    const maxPlayers = Math.min(9, Math.max(2, body.maxPlayers ?? 6));
    const timerSeconds = Math.min(120, Math.max(5, body.timerSeconds ?? 15));
    const minBuyIn = Math.max(1, body.minBuyIn ?? 100);

    const id = randomUUID();
    await this.tableModel.create({
      _id: id,
      clubId,
      name,
      smallBlind: body.smallBlind,
      bigBlind: body.bigBlind,
      maxPlayers,
      timerSeconds,
      minBuyIn,
      status: 'WAITING',
      createdByUserId: userId,
    });
    const doc = await this.tableModel.findById(id);
    if (!doc) throw new NotFoundException();
    return this.toListRow(doc);
  }

  async getDetail(tableId: string, userId: string): Promise<TableDetailPayload> {
    const t = await this.tableModel.findById(tableId);
    if (!t) throw new NotFoundException('Table not found');
    if (t.status === 'CLOSED') throw new NotFoundException('Table is closed');

    const seatsTaken = await this.seatModel.find({ tableId }).sort({ seatIndex: 1 }).lean();
    const bySeat = new Map<number, string>();
    for (const s of seatsTaken) {
      bySeat.set(s.seatIndex, s.userId);
    }

    const seats: TableSeatRow[] = [];
    for (let i = 0; i < t.maxPlayers; i++) {
      seats.push({
        seatIndex: i,
        userId: bySeat.get(i) ?? null,
      });
    }

    let viewerSeatIndex: number | null = null;
    for (const s of seatsTaken) {
      if (s.userId === userId) viewerSeatIndex = s.seatIndex;
    }

    const row = await this.toListRow(t);
    return { table: row, seats, viewerSeatIndex };
  }

  async sitAtSeat(
    tableId: string,
    userId: string,
    seatIndex: number,
  ): Promise<TableDetailPayload> {
    const t = await this.tableModel.findById(tableId);
    if (!t || t.status === 'CLOSED') {
      throw new NotFoundException('Table not found');
    }
    await this.assertClubMember(t.clubId, userId);

    if (!Number.isInteger(seatIndex) || seatIndex < 0 || seatIndex >= t.maxPlayers) {
      throw new BadRequestException('Invalid seat index.');
    }

    const existing = await this.seatModel.findOne({ tableId, userId });
    if (existing) {
      throw new BadRequestException('You are already seated at this table.');
    }

    const taken = await this.seatModel.findOne({ tableId, seatIndex });
    if (taken) throw new BadRequestException('Seat is occupied.');

    await this.seatModel.create({ tableId, seatIndex, userId });
    return this.getDetail(tableId, userId);
  }

  async leaveSeat(tableId: string, userId: string): Promise<TableDetailPayload> {
    const t = await this.tableModel.findById(tableId);
    if (!t) throw new NotFoundException('Table not found');
    const res = await this.seatModel.deleteOne({ tableId, userId });
    if (res.deletedCount === 0) {
      throw new BadRequestException('You are not seated at this table.');
    }
    return this.getDetail(tableId, userId);
  }

  async closeTable(tableId: string, userId: string): Promise<void> {
    const t = await this.tableModel.findById(tableId);
    if (!t) throw new NotFoundException('Table not found');

    const canClose =
      t.createdByUserId === userId ||
      (await this.memberModel.findOne({
        clubId: t.clubId,
        userId,
        status: 'ACTIVE',
        role: { $in: ['OWNER', 'MANAGER'] },
      }));

    if (!canClose) {
      throw new ForbiddenException('Only the creator or a club manager can close this table.');
    }

    t.status = 'CLOSED';
    await t.save();
    await this.seatModel.deleteMany({ tableId });
  }
}
