import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type JoinRequestDocument = HydratedDocument<JoinRequest>;

@Schema({ collection: 'club_join_requests', timestamps: true })
export class JoinRequest {
  @Prop({ type: String, required: true, index: true })
  clubId!: string;

  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({
    type: String,
    required: true,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING',
  })
  status!: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export const JoinRequestSchema = SchemaFactory.createForClass(JoinRequest);

JoinRequestSchema.index({ clubId: 1, userId: 1, status: 1 });
