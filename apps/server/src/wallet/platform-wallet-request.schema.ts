import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PlatformWalletRequestDocument = HydratedDocument<PlatformWalletRequest>;

export type PlatformWalletKind = 'DEPOSIT' | 'WITHDRAWAL';
export type PlatformWalletRequestStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

@Schema({ collection: 'platform_wallet_requests', timestamps: true })
export class PlatformWalletRequest {
  @Prop({ required: true, maxlength: 80 })
  userId!: string;

  @Prop({ required: true, enum: ['DEPOSIT', 'WITHDRAWAL'] })
  kind!: PlatformWalletKind;

  @Prop({ required: true, min: 1 })
  amount!: number;

  @Prop({
    required: true,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
    default: 'PENDING',
  })
  status!: PlatformWalletRequestStatus;

  @Prop({ type: String, maxlength: 500, default: null })
  memberNote?: string | null;

  @Prop({ type: String, maxlength: 80, default: null })
  decidedByUserId?: string | null;

  @Prop({ type: Date, default: null })
  decidedAt?: Date | null;

  @Prop({ type: String, maxlength: 500, default: null })
  adminNote?: string | null;
}

export const PlatformWalletRequestSchema = SchemaFactory.createForClass(
  PlatformWalletRequest,
);
PlatformWalletRequestSchema.index({ userId: 1, createdAt: -1 });
PlatformWalletRequestSchema.index({ status: 1, createdAt: -1 });
