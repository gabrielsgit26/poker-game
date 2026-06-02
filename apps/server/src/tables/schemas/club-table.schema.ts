import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ClubTableDocument = HydratedDocument<ClubTable>;

@Schema({ _id: false, collection: 'club_tables', timestamps: true })
export class ClubTable {
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  clubId!: string;

  @Prop({ required: true, maxlength: 80 })
  name!: string;

  @Prop({ required: true, min: 0 })
  smallBlind!: number;

  @Prop({ required: true, min: 0 })
  bigBlind!: number;

  @Prop({ default: 6, min: 2, max: 9 })
  maxPlayers!: number;

  @Prop({ default: 15, min: 5 })
  timerSeconds!: number;

  @Prop({ default: 100, min: 1 })
  minBuyIn!: number;

  @Prop({
    type: String,
    enum: ['WAITING', 'PLAYING', 'PAUSED', 'CLOSED'],
    default: 'WAITING',
  })
  status!: 'WAITING' | 'PLAYING' | 'PAUSED' | 'CLOSED';

  @Prop({ type: String, required: true })
  createdByUserId!: string;
}

export const ClubTableSchema = SchemaFactory.createForClass(ClubTable);
