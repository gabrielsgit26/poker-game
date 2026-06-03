import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TableSeatDocument = HydratedDocument<TableSeat>;

@Schema({ collection: 'table_seats', timestamps: true })
export class TableSeat {
  @Prop({ type: String, required: true, index: true })
  tableId!: string;

  @Prop({ type: Number, required: true, min: 0 })
  seatIndex!: number;

  @Prop({ type: String, required: true })
  userId!: string;

  /** Chips taken from club wallet when first dealt in (defaults to table minBuyIn on server). */
  @Prop({ type: Number, min: 0 })
  buyInChips?: number;

  /**
   * When true, `buyInChips` was already debited from the member's club wallet at sit time.
   * Holdem hand start must not debit again for this seat.
   */
  @Prop({ type: Boolean })
  buyInDebitedAtSit?: boolean;
}

export const TableSeatSchema = SchemaFactory.createForClass(TableSeat);

TableSeatSchema.index({ tableId: 1, seatIndex: 1 }, { unique: true });
TableSeatSchema.index({ tableId: 1, userId: 1 }, { unique: true });
