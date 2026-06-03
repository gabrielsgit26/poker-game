import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomUUID } from 'node:crypto';
import Redis from 'ioredis';
import { Club, ClubDocument } from '../clubs/schemas/club.schema';
import {
  ClubMember,
  ClubMemberDocument,
} from '../clubs/schemas/club-member.schema';
import { ClubTable, ClubTableDocument } from './schemas/club-table.schema';
import { TableSeat, TableSeatDocument } from './schemas/table-seat.schema';
import type {
  HoldemClientAction,
  HoldemPublicSnapshot,
} from '@telegram-poker/shared/poker-engine';
import { TableGateway } from './table.gateway';
import { HoldemCoordinator } from './holdem-coordinator';
import { REDIS_CLIENT } from '../redis/redis.module';

function parseHoldemClientAction(raw: unknown): HoldemClientAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const t = o.type;
  if (t === 'fold') return { type: 'fold' };
  if (t === 'check') return { type: 'check' };
  if (t === 'call') return { type: 'call' };
  if (t === 'bet' && typeof o.amount === 'number' && Number.isFinite(o.amount)) {
    const n = Math.floor(o.amount);
    if (n > 0) return { type: 'bet', amount: n };
  }
  if (t === 'raise_to' && typeof o.amount === 'number' && Number.isFinite(o.amount)) {
    const n = Math.floor(o.amount);
    if (n > 0) return { type: 'raise_to', amount: n };
  }
  return null;
}

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

export type TableSocketAction = 'check' | 'fold';

/** `timeout` = action clock fired (Phase 8; no full street engine yet). */
export type TableLastActionSource = 'player' | 'timeout';

export interface TableLastActionDto {
  userId: string;
  action: TableSocketAction;
  at: number;
  source?: TableLastActionSource;
}

/** Synthetic actor if seat data is missing during a timeout (should not happen). */
const CLOCK_ACTOR_USER_ID = '__clock__';

/**
 * Who must act next (Phase 8). `facingBet` flips after each resolved action so clients can
 * exercise “free check” vs “must fold on clock” before a real betting street exists.
 */
export interface TableActionTurnDto {
  actionSeatIndex: number | null;
  facingBet: boolean;
}

export interface TableDetailPayload {
  table: TableListRow;
  seats: TableSeatRow[];
  viewerSeatIndex: number | null;
  /** Monotonic ms since epoch when the current table action clock expires (Redis). */
  turnDeadlineEpochMs: number | null;
  /** Last dev “poker” action over the socket (Phase 8; not full hand engine yet). */
  lastAction: TableLastActionDto | null;
  /** Seat index whose turn it is; null when fewer than two seated players. */
  actionTurn: TableActionTurnDto;
  /** NL holdem engine snapshot when a hand is loaded in Redis; null between hands. */
  holdem: HoldemPublicSnapshot | null;
  /** Hole cards for the requesting user when seated in the current hand. */
  viewerHoleCards: [string, string] | null;
  /** Member's club-room chip balance (off-table wallet; table stacks are separate). */
  viewerClubChipBalance: number;
}

/** Public snapshot for HTTP + Socket.IO (no per-viewer fields). */
export interface TableBroadcastPayload {
  table: TableListRow;
  seats: TableSeatRow[];
  turnDeadlineEpochMs: number | null;
  lastAction: TableLastActionDto | null;
  actionTurn: TableActionTurnDto;
  holdem: HoldemPublicSnapshot | null;
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

/**
 * The engine only includes players dealt into the current hand. Seated users who are sitting
 * out (e.g. zero chips) have no `holdem.seats` row — clients would show a blank stack. Fill
 * those seats with a neutral shell so chip totals stay in sync with who is actually in the hand.
 */
function withHoldemShellSeatsForOccupied(
  holdem: HoldemPublicSnapshot | null,
  seats: TableSeatRow[],
): HoldemPublicSnapshot | null {
  if (!holdem) return null;
  let added = false;
  const nextSeats: HoldemPublicSnapshot['seats'] = { ...holdem.seats };
  for (const s of seats) {
    if (s.userId == null) continue;
    const k = String(s.seatIndex);
    if (nextSeats[k] === undefined) {
      nextSeats[k] = {
        stack: 0,
        folded: false,
        streetPut: 0,
        handInvested: 0,
      };
      added = true;
    }
  }
  return added ? { ...holdem, seats: nextSeats } : holdem;
}

/** Next occupied seat clockwise (ascending indices, wrap to lowest). */
function nextOccupiedSeatClockwise(
  occupiedSortedAsc: readonly number[],
  fromSeat: number,
): number {
  if (occupiedSortedAsc.length === 0) {
    throw new Error('nextOccupiedSeatClockwise: empty');
  }
  const after = occupiedSortedAsc.filter((s) => s > fromSeat);
  if (after.length > 0) return after[0]!;
  return occupiedSortedAsc[0]!;
}

@Injectable()
export class TablesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TablesService.name);

  /** One in-process timer per open table (single-node; use a job queue if you scale horizontally). */
  private readonly turnDeadlineTimers = new Map<string, NodeJS.Timeout>();

  /** Mirrors Redis action-turn JSON when Redis is unavailable (local dev). */
  private readonly actionTurnMemory = new Map<string, TableActionTurnDto>();

  constructor(
    @InjectModel(ClubTable.name) private readonly tableModel: Model<ClubTableDocument>,
    @InjectModel(TableSeat.name) private readonly seatModel: Model<TableSeatDocument>,
    @InjectModel(Club.name) private readonly clubModel: Model<ClubDocument>,
    @InjectModel(ClubMember.name)
    private readonly memberModel: Model<ClubMemberDocument>,
    @Inject(forwardRef(() => TableGateway))
    private readonly tableGateway: TableGateway,
    @Inject(forwardRef(() => HoldemCoordinator))
    private readonly holdem: HoldemCoordinator,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeedTables();
    await this.restoreTurnDeadlineTimersFromRedis();
  }

  onModuleDestroy(): void {
    for (const tableId of this.turnDeadlineTimers.keys()) {
      this.cancelTurnDeadlineTimer(tableId);
    }
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

  private async buildSeats(
    tableId: string,
    maxPlayers: number,
  ): Promise<TableSeatRow[]> {
    const seatsTaken = await this.seatModel
      .find({ tableId })
      .sort({ seatIndex: 1 })
      .lean();
    const bySeat = new Map<number, string>();
    for (const s of seatsTaken) {
      bySeat.set(s.seatIndex, s.userId);
    }
    const seats: TableSeatRow[] = [];
    for (let i = 0; i < maxPlayers; i++) {
      seats.push({
        seatIndex: i,
        userId: bySeat.get(i) ?? null,
      });
    }
    return seats;
  }

  private turnDeadlineKey(tableId: string): string {
    return `poker:table:${tableId}:turnDeadline`;
  }

  private lastActionKey(tableId: string): string {
    return `poker:table:${tableId}:lastAction`;
  }

  private actionTurnKey(tableId: string): string {
    return `poker:table:${tableId}:actionTurn`;
  }

  private async listOccupiedSeatIndices(tableId: string): Promise<number[]> {
    const seats = await this.seatModel.find({ tableId }).sort({ seatIndex: 1 }).lean();
    return seats.map((s) => s.seatIndex);
  }

  private normalizeActionTurnJson(
    parsed: Partial<TableActionTurnDto>,
  ): TableActionTurnDto | null {
    if (typeof parsed.facingBet !== 'boolean') return null;
    const raw = parsed.actionSeatIndex as unknown;
    if (raw === undefined || raw === null) {
      return { actionSeatIndex: null, facingBet: parsed.facingBet };
    }
    if (typeof raw !== 'number' || !Number.isInteger(raw) || raw < 0) return null;
    return { actionSeatIndex: raw, facingBet: parsed.facingBet };
  }

  private async readActionTurn(tableId: string): Promise<TableActionTurnDto | null> {
    try {
      const raw = await this.redis.get(this.actionTurnKey(tableId));
      if (raw != null && raw !== '') {
        const parsed = JSON.parse(raw) as Partial<TableActionTurnDto>;
        const dto = this.normalizeActionTurnJson(parsed);
        if (dto) {
          this.actionTurnMemory.set(tableId, dto);
          return dto;
        }
      }
    } catch {
      /* fall through */
    }
    return this.actionTurnMemory.get(tableId) ?? null;
  }

  private async writeActionTurn(tableId: string, dto: TableActionTurnDto): Promise<void> {
    this.actionTurnMemory.set(tableId, dto);
    try {
      await this.redis.set(
        this.actionTurnKey(tableId),
        JSON.stringify(dto),
        'EX',
        86400,
      );
    } catch {
      /* Redis optional */
    }
  }

  private async getActionTurnSnapshot(tableId: string): Promise<TableActionTurnDto> {
    const holdemSnap = await this.holdem.getPublicSnapshot(tableId);
    if (holdemSnap && holdemSnap.phase === 'betting') {
      if (holdemSnap.toActSeat !== null) {
        const row = holdemSnap.seats[String(holdemSnap.toActSeat)];
        const toCall = holdemSnap.maxStreetBet - (row?.streetPut ?? 0);
        return {
          actionSeatIndex: holdemSnap.toActSeat,
          facingBet: toCall > 0,
        };
      }
      // Engine has no actor (e.g. all-in runout) — clear stale Redis turn so UI doesn't assign a fake seat.
      const cur = await this.readActionTurn(tableId);
      if (cur?.actionSeatIndex != null) {
        await this.writeActionTurn(tableId, { actionSeatIndex: null, facingBet: false });
      }
      return { actionSeatIndex: null, facingBet: false };
    }
    if (holdemSnap && holdemSnap.phase !== 'betting') {
      return { actionSeatIndex: null, facingBet: false };
    }

    await this.ensureActionTurn(tableId);
    const cur = await this.readActionTurn(tableId);
    return cur ?? { actionSeatIndex: null, facingBet: false };
  }

  /** Picks a valid actor when ≥2 occupied seats; clears turn when fewer than two. */
  private async ensureActionTurn(tableId: string): Promise<void> {
    const occupied = await this.listOccupiedSeatIndices(tableId);
    if (occupied.length < 2) {
      await this.writeActionTurn(tableId, { actionSeatIndex: null, facingBet: false });
      return;
    }
    const cur = await this.readActionTurn(tableId);
    const valid =
      cur?.actionSeatIndex !== undefined &&
      cur?.actionSeatIndex !== null &&
      occupied.includes(cur.actionSeatIndex);
    if (!valid) {
      await this.writeActionTurn(tableId, {
        actionSeatIndex: occupied[0]!,
        facingBet: false,
      });
    }
  }

  private async reconcileActionTurnAfterLeave(
    tableId: string,
    vacatedSeatIndex: number,
  ): Promise<void> {
    const occupied = await this.listOccupiedSeatIndices(tableId);
    if (occupied.length < 2) {
      await this.writeActionTurn(tableId, { actionSeatIndex: null, facingBet: false });
      return;
    }
    const cur = await this.readActionTurn(tableId);
    const facing = cur?.facingBet ?? false;
    if (cur?.actionSeatIndex === vacatedSeatIndex) {
      const next = nextOccupiedSeatClockwise(occupied, vacatedSeatIndex);
      await this.writeActionTurn(tableId, { actionSeatIndex: next, facingBet: facing });
    } else {
      await this.ensureActionTurn(tableId);
    }
  }

  private async advanceAfterResolvedAction(
    tableId: string,
    actorSeatIndex: number,
    facingBetDuringAction: boolean,
  ): Promise<void> {
    const occupied = await this.listOccupiedSeatIndices(tableId);
    if (occupied.length < 2) {
      await this.writeActionTurn(tableId, { actionSeatIndex: null, facingBet: false });
      return;
    }
    const nextSeat = nextOccupiedSeatClockwise(occupied, actorSeatIndex);
    await this.writeActionTurn(tableId, {
      actionSeatIndex: nextSeat,
      facingBet: !facingBetDuringAction,
    });
  }

  private async readTurnDeadlineEpochMs(tableId: string): Promise<number | null> {
    try {
      const raw = await this.redis.get(this.turnDeadlineKey(tableId));
      if (raw == null || raw === '') return null;
      const n = parseInt(raw, 10);
      return Number.isFinite(n) ? n : null;
    } catch {
      return null;
    }
  }

  private cancelTurnDeadlineTimer(tableId: string): void {
    const id = this.turnDeadlineTimers.get(tableId);
    if (id !== undefined) {
      clearTimeout(id);
      this.turnDeadlineTimers.delete(tableId);
    }
  }

  /**
   * Schedules auto-check / auto-fold when the action clock elapses (Phase 8).
   * `expectedDeadlineEpochMs` must match the value clients read from Redis for this window.
   */
  private scheduleTurnDeadlineTimer(
    tableId: string,
    expectedDeadlineEpochMs: number,
  ): void {
    this.cancelTurnDeadlineTimer(tableId);
    const delayMs = Math.max(0, expectedDeadlineEpochMs - Date.now());
    const id = setTimeout(() => {
      void this.handleTurnDeadlineElapsed(tableId, expectedDeadlineEpochMs).catch(
        (err: unknown) => {
          this.logger.warn(
            `turn deadline handler failed table=${tableId}: ${String(err)}`,
          );
        },
      );
    }, delayMs) as unknown as NodeJS.Timeout;
    this.turnDeadlineTimers.set(tableId, id);
  }

  /** After restart: re-arm timers from Redis so auto-check still fires. */
  private async restoreTurnDeadlineTimersFromRedis(): Promise<void> {
    try {
      const rows = await this.tableModel
        .find({ status: { $ne: 'CLOSED' } })
        .select('_id')
        .lean();
      for (const row of rows) {
        const tableId = String(row._id);
        const deadline = await this.readTurnDeadlineEpochMs(tableId);
        if (deadline == null) continue;
        const remaining = deadline - Date.now();
        if (remaining > 750) {
          this.scheduleTurnDeadlineTimer(tableId, deadline);
        } else {
          void this.handleTurnDeadlineElapsed(tableId, deadline).catch((err: unknown) => {
            this.logger.warn(
              `restore deadline handler failed table=${tableId}: ${String(err)}`,
            );
          });
        }
      }
    } catch (err: unknown) {
      this.logger.warn(`restoreTurnDeadlineTimersFromRedis: ${String(err)}`);
    }
  }

  /**
   * When the clock lapses: apply auto-check or auto-fold for the current action seat,
   * advance turn (toggles `facingBet` for the next actor). No-op spam when 0–1 players.
   */
  private async handleTurnDeadlineElapsed(
    tableId: string,
    expectedDeadlineEpochMs: number,
  ): Promise<void> {
    this.turnDeadlineTimers.delete(tableId);

    const t = await this.tableModel.findById(tableId);
    if (!t || t.status === 'CLOSED') return;

    const current = await this.readTurnDeadlineEpochMs(tableId);
    if (
      current !== null &&
      current !== expectedDeadlineEpochMs
    ) {
      return;
    }

    if (Date.now() < expectedDeadlineEpochMs - 750) {
      this.scheduleTurnDeadlineTimer(tableId, expectedDeadlineEpochMs);
      return;
    }

    const occupied = await this.occupiedCount(tableId);
    if (occupied < 2) {
      await this.clearTurnDeadlineRedisOnly(tableId);
      await this.tableGateway.broadcastState(tableId);
      return;
    }

    const holdemSnap = await this.holdem.getPublicSnapshot(tableId);
    if (holdemSnap?.phase === 'betting' && holdemSnap.toActSeat !== null) {
      const row = holdemSnap.seats[String(holdemSnap.toActSeat)];
      const toCall = holdemSnap.maxStreetBet - (row?.streetPut ?? 0);
      const facingBet = toCall > 0;
      const actorDoc = await this.seatModel
        .findOne({ tableId, seatIndex: holdemSnap.toActSeat })
        .lean();
      const actorUserId = actorDoc?.userId ?? CLOCK_ACTOR_USER_ID;
      const holdemAction: HoldemClientAction = facingBet
        ? { type: 'fold' }
        : { type: 'check' };
      const r = await this.holdem.applyAction(tableId, actorUserId, holdemAction);
      if (r.ok) {
        const timeoutAction: TableSocketAction = facingBet ? 'fold' : 'check';
        const rowDto: TableLastActionDto = {
          userId: actorUserId,
          action: timeoutAction,
          at: Date.now(),
          source: 'timeout',
        };
        await this.writeLastActionToRedis(tableId, rowDto);
      }
      await this.refreshTurnDeadline(tableId);
      if (!r.ok) {
        await this.pingBroadcast(tableId);
      }
      return;
    }

    await this.ensureActionTurn(tableId);
    const turn = await this.readActionTurn(tableId);
    if (turn?.actionSeatIndex == null) {
      await this.clearTurnDeadlineRedisOnly(tableId);
      await this.tableGateway.broadcastState(tableId);
      return;
    }

    const actorDoc = await this.seatModel
      .findOne({ tableId, seatIndex: turn.actionSeatIndex })
      .lean();
    const actorUserId = actorDoc?.userId ?? CLOCK_ACTOR_USER_ID;
    const timeoutAction: TableSocketAction = turn.facingBet ? 'fold' : 'check';
    const row: TableLastActionDto = {
      userId: actorUserId,
      action: timeoutAction,
      at: Date.now(),
      source: 'timeout',
    };
    await this.writeLastActionToRedis(tableId, row);
    await this.advanceAfterResolvedAction(
      tableId,
      turn.actionSeatIndex,
      turn.facingBet,
    );
    await this.refreshTurnDeadline(tableId);
    await this.tableGateway.broadcastState(tableId);
  }

  /** Called by HoldemCoordinator after Redis state changes (avoids injecting the gateway there). */
  async pingBroadcast(tableId: string): Promise<void> {
    await this.tableGateway.broadcastState(tableId);
  }

  async applyHoldemGameAction(
    tableId: string,
    userId: string,
    rawAction: unknown,
  ): Promise<void> {
    const t = await this.tableModel.findById(tableId);
    if (!t || t.status === 'CLOSED') {
      throw new NotFoundException('Table not found');
    }
    const seated = await this.seatModel.findOne({ tableId, userId });
    if (!seated) {
      throw new ForbiddenException('Sit at the table before sending actions.');
    }
    const action = parseHoldemClientAction(rawAction);
    if (!action) {
      throw new BadRequestException('Invalid game action payload.');
    }
    const r = await this.holdem.applyAction(tableId, userId, action);
    if (!r.ok) throw new BadRequestException(r.error);
    await this.refreshTurnDeadline(tableId);
  }

  async getViewerHoleCardsForUser(
    tableId: string,
    userId: string,
  ): Promise<[string, string] | null> {
    return this.holdem.getViewerHoleCards(tableId, userId);
  }

  private async clearTurnDeadlineRedisOnly(tableId: string): Promise<void> {
    try {
      await this.redis.del(this.turnDeadlineKey(tableId));
    } catch {
      /* ignore */
    }
  }

  /** Resets the “action clock” used for Phase 8 turn timer UX (not full poker yet). */
  async refreshTurnDeadline(tableId: string): Promise<void> {
    const t = await this.tableModel.findById(tableId);
    if (!t || t.status === 'CLOSED') return;
    const sec = Math.min(120, Math.max(5, t.timerSeconds));
    const deadline = Date.now() + sec * 1000;
    try {
      await this.redis.set(
        this.turnDeadlineKey(tableId),
        String(deadline),
        'EX',
        sec,
      );
    } catch {
      /* Redis optional for local dev without Redis — skip timer */
    }
    this.scheduleTurnDeadlineTimer(tableId, deadline);
  }

  private async writeLastActionToRedis(
    tableId: string,
    row: TableLastActionDto,
  ): Promise<void> {
    try {
      await this.redis.set(
        this.lastActionKey(tableId),
        JSON.stringify(row),
        'EX',
        86400,
      );
    } catch {
      /* Redis optional */
    }
  }

  private async readLastAction(
    tableId: string,
  ): Promise<TableLastActionDto | null> {
    try {
      const raw = await this.redis.get(this.lastActionKey(tableId));
      if (raw == null || raw === '') return null;
      const parsed = JSON.parse(raw) as Partial<TableLastActionDto>;
      if (
        typeof parsed.userId !== 'string' ||
        (parsed.action !== 'check' && parsed.action !== 'fold') ||
        typeof parsed.at !== 'number'
      ) {
        return null;
      }
      if (
        parsed.source !== undefined &&
        parsed.source !== 'player' &&
        parsed.source !== 'timeout'
      ) {
        return null;
      }
      return {
        userId: parsed.userId,
        action: parsed.action,
        at: parsed.at,
        source: parsed.source,
      };
    } catch {
      return null;
    }
  }

  private async clearTableRealtimeKeys(tableId: string): Promise<void> {
    this.holdem.clear(tableId);
    this.cancelTurnDeadlineTimer(tableId);
    this.actionTurnMemory.delete(tableId);
    try {
      await this.redis.del(
        this.turnDeadlineKey(tableId),
        this.lastActionKey(tableId),
        this.actionTurnKey(tableId),
      );
    } catch {
      /* ignore */
    }
  }

  /**
   * Private-club tables: only active members may subscribe via Socket.IO.
   * Public clubs allow spectators.
   */
  async assertCanWatchTable(tableId: string, userId: string): Promise<void> {
    const t = await this.tableModel.findById(tableId).lean();
    if (!t || t.status === 'CLOSED') {
      throw new NotFoundException('Table not found');
    }
    const club = await this.clubModel.findById(t.clubId).lean();
    if (!club) throw new NotFoundException('Club not found');
    if (!club.isPrivate) return;
    const m = await this.memberModel.findOne({
      clubId: t.clubId,
      userId,
      status: 'ACTIVE',
    });
    if (!m) {
      throw new ForbiddenException(
        'Join this private club before watching its tables over the socket.',
      );
    }
  }

  /**
   * Validated “player action” for Phase 8: must be seated, must be your turn,
   * cannot check while `facingBet` is true (use fold or wait for clock auto-fold).
   */
  async applySocketTableAction(
    tableId: string,
    userId: string,
    action: TableSocketAction,
  ): Promise<void> {
    const t = await this.tableModel.findById(tableId);
    if (!t || t.status === 'CLOSED') {
      throw new NotFoundException('Table not found');
    }
    const seated = await this.seatModel.findOne({ tableId, userId });
    if (!seated) {
      throw new ForbiddenException('Sit at the table before sending actions.');
    }

    const holdemSnap = await this.holdem.getPublicSnapshot(tableId);
    if (holdemSnap?.phase === 'betting') {
      throw new BadRequestException(
        'Use gameAction with fold/check/call/bet/raise_to during an active holdem hand.',
      );
    }

    await this.ensureActionTurn(tableId);
    const turn = await this.readActionTurn(tableId);
    if (turn?.actionSeatIndex == null) {
      throw new BadRequestException(
        'At least two seated players are required before actions rotate.',
      );
    }
    if (seated.seatIndex !== turn.actionSeatIndex) {
      throw new ForbiddenException('Not your turn.');
    }
    if (turn.facingBet && action === 'check') {
      throw new BadRequestException('Cannot check while facing a bet — fold or wait.');
    }

    const row: TableLastActionDto = {
      userId,
      action,
      at: Date.now(),
      source: 'player',
    };
    await this.writeLastActionToRedis(tableId, row);
    await this.advanceAfterResolvedAction(
      tableId,
      turn.actionSeatIndex,
      turn.facingBet,
    );
    await this.refreshTurnDeadline(tableId);
    await this.tableGateway.broadcastState(tableId);
  }

  /** Snapshot for lobby cards / sockets (no viewer seat index). */
  async getBroadcastPayload(
    tableId: string,
  ): Promise<TableBroadcastPayload | null> {
    const t = await this.tableModel.findById(tableId);
    if (!t || t.status === 'CLOSED') return null;
    const seats = await this.buildSeats(t._id, t.maxPlayers);
    const table = await this.toListRow(t);
    const turnDeadlineEpochMs = await this.readTurnDeadlineEpochMs(tableId);
    const lastAction = await this.readLastAction(tableId);
    const actionTurn = await this.getActionTurnSnapshot(tableId);
    const holdem = withHoldemShellSeatsForOccupied(
      await this.holdem.getPublicSnapshot(tableId),
      seats,
    );
    return { table, seats, turnDeadlineEpochMs, lastAction, actionTurn, holdem };
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

  async getMemberChipBalance(clubId: string, userId: string): Promise<number> {
    const m = await this.memberModel
      .findOne({ clubId, userId, status: 'ACTIVE' })
      .select({ chipBalance: 1 })
      .lean();
    const n = m?.chipBalance;
    return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  }

  async assertMemberChipBalanceGte(
    clubId: string,
    userId: string,
    atLeast: number,
  ): Promise<void> {
    const need = Math.max(0, Math.floor(atLeast));
    if (need === 0) return;
    const bal = await this.getMemberChipBalance(clubId, userId);
    if (bal < need) {
      throw new BadRequestException(
        `Not enough club chips to sit at this table (need at least ${need} for the buy-in). You have ${bal}.`,
      );
    }
  }

  /** Credits club-room chips (e.g. cash-out from table stack). */
  async creditMemberChips(clubId: string, userId: string, amount: number): Promise<void> {
    const n = Math.max(0, Math.floor(amount));
    if (n === 0) return;
    await this.memberModel.updateOne(
      { clubId, userId, status: 'ACTIVE' },
      { $inc: { chipBalance: n } },
    );
  }

  /**
   * Debits club chips for fresh buy-ins when a new hand is dealt. Rolls back partial debits on failure.
   */
  async debitBuyInsForHand(
    clubId: string,
    rows: { userId: string; amount: number }[],
  ): Promise<void> {
    const done: { userId: string; amount: number }[] = [];
    try {
      for (const r of rows) {
        const amt = Math.max(0, Math.floor(r.amount));
        if (amt <= 0) continue;
        const res = await this.memberModel.updateOne(
          {
            clubId,
            userId: r.userId,
            status: 'ACTIVE',
            chipBalance: { $gte: amt },
          },
          { $inc: { chipBalance: -amt } },
        );
        if (res.modifiedCount !== 1) {
          throw new BadRequestException(
            `Insufficient club chips for buy-in (need ${amt} for this hand).`,
          );
        }
        done.push({ userId: r.userId, amount: amt });
      }
    } catch (e) {
      for (const d of done) {
        await this.memberModel.updateOne(
          { clubId, userId: d.userId, status: 'ACTIVE' },
          { $inc: { chipBalance: d.amount } },
        );
      }
      throw e;
    }
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
    await this.ensureActionTurn(id);
    await this.refreshTurnDeadline(id);
    const row = await this.toListRow(doc);
    await this.tableGateway.broadcastState(id);
    return row;
  }

  async getDetail(tableId: string, userId: string): Promise<TableDetailPayload> {
    const t = await this.tableModel.findById(tableId);
    if (!t) throw new NotFoundException('Table not found');
    if (t.status === 'CLOSED') throw new NotFoundException('Table is closed');

    const seats = await this.buildSeats(tableId, t.maxPlayers);

    let viewerSeatIndex: number | null = null;
    for (const s of seats) {
      if (s.userId === userId) viewerSeatIndex = s.seatIndex;
    }

    const row = await this.toListRow(t);
    const turnDeadlineEpochMs = await this.readTurnDeadlineEpochMs(tableId);
    const lastAction = await this.readLastAction(tableId);
    const actionTurn = await this.getActionTurnSnapshot(tableId);
    const holdem = withHoldemShellSeatsForOccupied(
      await this.holdem.getPublicSnapshot(tableId),
      seats,
    );
    let viewerHoleCards: [string, string] | null = null;
    if (viewerSeatIndex !== null && holdem && holdem.phase !== 'complete') {
      viewerHoleCards = await this.holdem.getViewerHoleCards(tableId, userId);
    }
    const viewerClubChipBalance = await this.getMemberChipBalance(t.clubId, userId);
    return {
      table: row,
      seats,
      viewerSeatIndex,
      turnDeadlineEpochMs,
      lastAction,
      actionTurn,
      holdem,
      viewerHoleCards,
      viewerClubChipBalance,
    };
  }

  async sitAtSeat(
    tableId: string,
    userId: string,
    seatIndex: number,
    buyInAmount?: number,
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

    const balance = await this.getMemberChipBalance(t.clubId, userId);
    const minBuyIn = t.minBuyIn;
    const maxCap = Math.min(
      balance,
      Math.max(minBuyIn * 200, minBuyIn, t.bigBlind * 100),
    );
    const raw =
      typeof buyInAmount === 'number' && Number.isFinite(buyInAmount)
        ? Math.floor(buyInAmount)
        : minBuyIn;
    const buyIn = Math.min(Math.max(raw, minBuyIn), maxCap);

    await this.assertMemberChipBalanceGte(t.clubId, userId, buyIn);

    await this.seatModel.create({
      tableId,
      seatIndex,
      userId,
      buyInChips: buyIn,
    });
    try {
      await this.ensureActionTurn(tableId);
      await this.refreshTurnDeadline(tableId);
      await this.holdem.tryStartHand(tableId);
    } catch (err) {
      await this.seatModel.deleteOne({ tableId, userId });
      await this.reconcileActionTurnAfterLeave(tableId, seatIndex);
      await this.refreshTurnDeadline(tableId);
      throw err;
    }
    const detail = await this.getDetail(tableId, userId);
    await this.tableGateway.broadcastState(tableId);
    return detail;
  }

  async leaveSeat(tableId: string, userId: string): Promise<TableDetailPayload> {
    const t = await this.tableModel.findById(tableId);
    if (!t) throw new NotFoundException('Table not found');
    const leaving = await this.seatModel.findOne({ tableId, userId });
    if (!leaving) {
      throw new BadRequestException('You are not seated at this table.');
    }
    const vacatedSeatIndex = leaving.seatIndex;
    const cashOutStack = await this.holdem.peekPlayerStackForCashOut(tableId, userId);
    await this.holdem.onPlayerLeft(tableId, userId);
    await this.seatModel.deleteOne({ tableId, userId });
    await this.reconcileActionTurnAfterLeave(tableId, vacatedSeatIndex);
    await this.refreshTurnDeadline(tableId);
    await this.holdem.tryStartHand(tableId);
    if (cashOutStack > 0) {
      await this.creditMemberChips(t.clubId, userId, cashOutStack);
    }
    const detail = await this.getDetail(tableId, userId);
    await this.tableGateway.broadcastState(tableId);
    return detail;
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

    await this.clearTableRealtimeKeys(tableId);
    t.status = 'CLOSED';
    await t.save();
    this.tableGateway.emitTableClosed(tableId);
    await this.seatModel.deleteMany({ tableId });
  }
}
