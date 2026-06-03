import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type CashOutRequestDocument = HydratedDocument<CashOutRequest>;

@Schema({ collection: 'club_cash_out_requests', timestamps: true })
export class CashOutRequest {
  @Prop({ type: String, required: true, index: true })
  clubId!: string;

  @Prop({ type: String, required: true, index: true })
  userId!: string;

  /** Positive chips requested to debit from club wallet on approval. */
  @Prop({ type: Number, required: true })
  amount!: number;

  @Prop({
    type: String,
    required: true,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  })
  status!: 'PENDING' | 'APPROVED' | 'REJECTED';

  @Prop({ type: String })
  memberNote?: string | null;

  @Prop({ type: String })
  decidedByUserId?: string | null;

  @Prop({ type: Date })
  decidedAt?: Date | null;
}

export const CashOutRequestSchema = SchemaFactory.createForClass(CashOutRequest);

CashOutRequestSchema.index({ clubId: 1, userId: 1, status: 1 });
CashOutRequestSchema.index({ clubId: 1, status: 1, createdAt: -1 });
