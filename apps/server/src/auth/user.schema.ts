import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: 'users', timestamps: true })
export class User {
  /** External id: Telegram user id string, or dev id (e.g. local-player). */
  @Prop({ required: true, unique: true, maxlength: 80 })
  userId!: string;

  @Prop({ maxlength: 120 })
  displayName?: string;

  /** Last known Telegram profile photo URL from validated WebApp initData (`user.photo_url`). */
  @Prop({ type: String, maxlength: 2048, default: null })
  telegramPhotoUrl!: string | null;

  /** Play-money platform wallet (deposits / withdrawals approved by admin). */
  @Prop({ default: 0 })
  platformBalanceChips!: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
