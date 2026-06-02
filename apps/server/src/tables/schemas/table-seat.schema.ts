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
}

export const TableSeatSchema = SchemaFactory.createForClass(TableSeat);

TableSeatSchema.index({ tableId: 1, seatIndex: 1 }, { unique: true });
TableSeatSchema.index({ tableId: 1, userId: 1 }, { unique: true });
