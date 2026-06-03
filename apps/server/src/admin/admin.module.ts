import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../auth/user.schema';
import { ClubsModule } from '../clubs/clubs.module';
import { Club, ClubSchema } from '../clubs/schemas/club.schema';
import { ClubMember, ClubMemberSchema } from '../clubs/schemas/club-member.schema';
import { ClubTable, ClubTableSchema } from '../tables/schemas/club-table.schema';
import {
  ChipLedgerEntry,
  ChipLedgerEntrySchema,
} from '../clubs/schemas/chip-ledger.schema';
import { WalletModule } from '../wallet/wallet.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    AuthModule,
    ClubsModule,
    WalletModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Club.name, schema: ClubSchema },
      { name: ClubMember.name, schema: ClubMemberSchema },
      { name: ClubTable.name, schema: ClubTableSchema },
      { name: ChipLedgerEntry.name, schema: ChipLedgerEntrySchema },
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
