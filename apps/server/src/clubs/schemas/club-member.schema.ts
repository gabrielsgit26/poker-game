import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ClubMemberDocument = HydratedDocument<ClubMember>;

@Schema({ collection: 'club_members', timestamps: true })
export class ClubMember {
  @Prop({ type: String, required: true, index: true })
  clubId!: string;

  @Prop({ type: String, required: true, index: true })
  userId!: string;

  @Prop({ type: String, required: true, enum: ['OWNER', 'MANAGER', 'MEMBER'] })
  role!: 'OWNER' | 'MANAGER' | 'MEMBER';

  @Prop({ type: String, default: 'ACTIVE', enum: ['ACTIVE', 'BLOCKED'] })
  status!: 'ACTIVE' | 'BLOCKED';
}

export const ClubMemberSchema = SchemaFactory.createForClass(ClubMember);

ClubMemberSchema.index({ clubId: 1, userId: 1 }, { unique: true });
