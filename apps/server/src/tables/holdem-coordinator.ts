import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import {
  applyHoldemAction,
  forceFoldPlayer,
  holdemPublicSnapshot,
  nextButtonSeat,
  startHoldemHand,
  viewerHoleCards,
  type HoldemClientAction,
  type HoldemPublicSnapshot,
  type HoldemState,
} from '@telegram-poker/shared/poker-engine';
import { ClubTable, ClubTableDocument } from './schemas/club-table.schema';
import { TableSeat, TableSeatDocument } from './schemas/table-seat.schema';
import { TablesService } from './tables.service';
import { REDIS_CLIENT } from '../redis/redis.module';

const holdemKey = (tableId: string) => `poker:table:${tableId}:holdem`;
const buttonKey = (tableId: string) => `poker:table:${tableId}:dealerButton`;

function phaseOf(st: HoldemState): HoldemState['phase'] {
  return st.phase;
}

@Injectable()
export class HoldemCoordinator {
  private readonly memory = new Map<string, HoldemState>();

  constructor(
    @InjectModel(ClubTable.name) private readonly tableModel: Model<ClubTableDocument>,
    @InjectModel(TableSeat.name) private readonly seatModel: Model<TableSeatDocument>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(forwardRef(() => TablesService))
    private readonly tablesService: TablesService,
  ) {}

  clear(tableId: string): void {
    this.memory.delete(tableId);
    void this.redis.del(holdemKey(tableId), buttonKey(tableId)).catch(() => undefined);
  }

  private async readState(tableId: string): Promise<HoldemState | null> {
    try {
      const raw = await this.redis.get(holdemKey(tableId));
      if (raw) {
        const s = JSON.parse(raw) as HoldemState;
        this.memory.set(tableId, s);
        return s;
      }
    } catch {
      /* */
    }
    return this.memory.get(tableId) ?? null;
  }

  private async writeState(tableId: string, s: HoldemState): Promise<void> {
    this.memory.set(tableId, s);
    try {
      await this.redis.set(holdemKey(tableId), JSON.stringify(s), 'EX', 86400);
    } catch {
      /* */
    }
  }

  private async readButtonSeat(
    tableId: string,
    occupiedSorted: number[],
  ): Promise<number> {
    try {
      const raw = await this.redis.get(buttonKey(tableId));
      if (raw != null && raw !== '') {
        const n = parseInt(raw, 10);
        if (Number.isFinite(n) && occupiedSorted.includes(n)) return n;
      }
    } catch {
      /* */
    }
    return occupiedSorted[0]!;
  }

  private async writeButtonSeat(tableId: string, seat: number): Promise<void> {
    try {
      await this.redis.set(buttonKey(tableId), String(seat), 'EX', 86400 * 30);
    } catch {
      /* */
    }
  }

  async getPublicSnapshot(tableId: string): Promise<HoldemPublicSnapshot | null> {
    const s = await this.readState(tableId);
    if (!s) return null;
    return holdemPublicSnapshot(s);
  }

  async getViewerHoleCards(
    tableId: string,
    userId: string,
  ): Promise<[string, string] | null> {
    const s = await this.readState(tableId);
    if (!s || s.phase === 'complete') return null;
    const seat = s.players.find((p) => p.userId === userId);
    if (!seat) return null;
    return viewerHoleCards(s, seat.seatIndex);
  }

  /**
   * Starts a new hand when ≥2 seated and no hand in progress.
   * Returns true if a new hand was started.
   */
  async tryStartHand(tableId: string): Promise<boolean> {
    const t = await this.tableModel.findById(tableId).lean();
    if (!t || t.status === 'CLOSED') return false;
    const seats = await this.seatModel
      .find({ tableId })
      .sort({ seatIndex: 1 })
      .lean();
    if (seats.length < 2) {
      this.clear(tableId);
      return false;
    }

    const prev = await this.readState(tableId);
    if (prev && prev.phase === 'betting') return false;

    const handSeq = (prev?.handSeq ?? 0) + 1;

    /**
     * Carry exact stacks from the completed hand. Do not bump busted (0) players to minBuyIn —
     * that kept them in the engine with phantom chips so payouts could credit the wrong profile
     * vs who actually contested the pot. New seat since last hand (no prior row) gets minBuyIn.
     */
    const seatConfigs = seats.map((row) => {
      let stack = t.minBuyIn;
      if (prev?.phase === 'complete') {
        const old = prev.players.find((p) => p.userId === row.userId);
        if (old) stack = old.stack;
        else stack = t.minBuyIn;
      }
      return {
        seatIndex: row.seatIndex,
        userId: row.userId,
        stack,
      };
    });

    const playingConfigs = seatConfigs.filter((c) => c.stack > 0);
    if (playingConfigs.length < 2) {
      return false;
    }

    const occupiedPlaying = playingConfigs.map((c) => c.seatIndex);
    const btn = await this.readButtonSeat(tableId, occupiedPlaying);

    const st = startHoldemHand({
      seats: playingConfigs,
      buttonSeat: btn,
      smallBlind: t.smallBlind,
      bigBlind: t.bigBlind,
      handSeq,
    });
    await this.writeState(tableId, st);
    const nextBtn = nextButtonSeat(occupiedPlaying, btn);
    await this.writeButtonSeat(tableId, nextBtn);
    void this.tablesService.pingBroadcast(tableId);
    return true;
  }

  async applyAction(
    tableId: string,
    userId: string,
    action: HoldemClientAction,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const s = await this.readState(tableId);
    if (!s) return { ok: false, error: 'No active hand.' };
    if (s.phase !== 'betting') return { ok: false, error: 'Hand is not active.' };
    const seat = s.players.find((p) => p.userId === userId);
    if (!seat) return { ok: false, error: 'You are not in this hand.' };
    const r = applyHoldemAction(s, seat.seatIndex, action);
    if (!r.ok) return r;
    await this.writeState(tableId, s);
    if (phaseOf(s) === 'complete') {
      const t = await this.tableModel.findById(tableId).lean();
      const seats = await this.seatModel.find({ tableId }).sort({ seatIndex: 1 }).lean();
      if (t && seats.length >= 2) {
        setTimeout(() => {
          void this.tryStartHand(tableId).catch(() => undefined);
        }, 2500);
      }
    }
    void this.tablesService.pingBroadcast(tableId);
    return { ok: true };
  }

  /** Fold a player if they leave mid-hand. */
  async onPlayerLeft(tableId: string, userId: string): Promise<void> {
    const s = await this.readState(tableId);
    if (!s || s.phase !== 'betting') return;
    const seat = s.players.find((p) => p.userId === userId);
    if (!seat || seat.folded) return;
    forceFoldPlayer(s, seat.seatIndex);
    await this.writeState(tableId, s);
    void this.tablesService.pingBroadcast(tableId);
  }
}
