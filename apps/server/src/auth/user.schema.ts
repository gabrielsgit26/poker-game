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
}

export const UserSchema = SchemaFactory.createForClass(User);
