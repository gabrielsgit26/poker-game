import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ChipLedgerDocument = HydratedDocument<ChipLedgerEntry>;

/** Reason codes for club-room chip balance changes (Phase 9 audit trail). */
export type ChipLedgerKind =
  | 'BUYIN_DEBIT'
  | 'CASHOUT_CREDIT'
  | 'BUYIN_ROLLBACK'
  | 'MANAGER_ADJUST'
  | 'MEMBER_CASHOUT'
  | 'PLATFORM_ADJUST';

@Schema({ collection: 'chip_ledger', timestamps: true })
export class ChipLedgerEntry {
  @Prop({ type: String, required: true, index: true })
  clubId!: string;

  @Prop({ type: String, required: true, index: true })
  userId!: string;

  /** Positive = chips returned to club wallet; negative = debited from club wallet. */
  @Prop({ type: Number, required: true })
  delta!: number;

  @Prop({ type: Number, required: true })
  balanceAfter!: number;

  @Prop({
    type: String,
    required: true,
    enum: [
      'BUYIN_DEBIT',
      'CASHOUT_CREDIT',
      'BUYIN_ROLLBACK',
      'MANAGER_ADJUST',
      'MEMBER_CASHOUT',
      'PLATFORM_ADJUST',
    ],
  })
  kind!: ChipLedgerKind;

  @Prop({ type: String })
  tableId?: string | null;

  @Prop({ type: String })
  note?: string | null;
}

export const ChipLedgerEntrySchema = SchemaFactory.createForClass(ChipLedgerEntry);

ChipLedgerEntrySchema.index({ clubId: 1, userId: 1, createdAt: -1 });
