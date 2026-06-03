import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { ClubsController } from './clubs.controller';
import { ClubsService } from './clubs.service';
import { Club, ClubSchema } from './schemas/club.schema';
import { ClubMember, ClubMemberSchema } from './schemas/club-member.schema';
import { JoinRequest, JoinRequestSchema } from './schemas/join-request.schema';
import {
  ChipLedgerEntry,
  ChipLedgerEntrySchema,
} from './schemas/chip-ledger.schema';
import {
  CashOutRequest,
  CashOutRequestSchema,
} from './schemas/cash-out-request.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Club.name, schema: ClubSchema },
      { name: ClubMember.name, schema: ClubMemberSchema },
      { name: JoinRequest.name, schema: JoinRequestSchema },
      { name: ChipLedgerEntry.name, schema: ChipLedgerEntrySchema },
      { name: CashOutRequest.name, schema: CashOutRequestSchema },
    ]),
  ],
  controllers: [ClubsController],
  providers: [ClubsService],
  exports: [ClubsService],
})
export class ClubsModule {}
