import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ClubDocument = HydratedDocument<Club>;

/** String `_id` so we can seed stable ids (`c1`…) aligned with mock lobby tables. */
@Schema({ _id: false, collection: 'clubs', timestamps: true })
export class Club {
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ required: true, maxlength: 80 })
  name!: string;

  @Prop({ default: false })
  isPrivate!: boolean;
}

export const ClubSchema = SchemaFactory.createForClass(Club);
