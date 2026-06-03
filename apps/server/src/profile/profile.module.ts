import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { Club, ClubSchema } from '../clubs/schemas/club.schema';
import { ClubMember, ClubMemberSchema } from '../clubs/schemas/club-member.schema';
import {
  ChipLedgerEntry,
  ChipLedgerEntrySchema,
} from '../clubs/schemas/chip-ledger.schema';
import {
  PlatformWalletRequest,
  PlatformWalletRequestSchema,
} from '../wallet/platform-wallet-request.schema';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Club.name, schema: ClubSchema },
      { name: ClubMember.name, schema: ClubMemberSchema },
      { name: ChipLedgerEntry.name, schema: ChipLedgerEntrySchema },
      { name: PlatformWalletRequest.name, schema: PlatformWalletRequestSchema },
    ]),
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
})
export class ProfileModule {}
