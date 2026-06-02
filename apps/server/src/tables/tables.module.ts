import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Club, ClubSchema } from '../clubs/schemas/club.schema';
import {
  ClubMember,
  ClubMemberSchema,
} from '../clubs/schemas/club-member.schema';
import { ClubTable, ClubTableSchema } from './schemas/club-table.schema';
import { TableSeat, TableSeatSchema } from './schemas/table-seat.schema';
import { HoldemCoordinator } from './holdem-coordinator';
import { TableGateway } from './table.gateway';
import { TablesController } from './tables.controller';
import { TablesService } from './tables.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ClubTable.name, schema: ClubTableSchema },
      { name: TableSeat.name, schema: TableSeatSchema },
      { name: Club.name, schema: ClubSchema },
      { name: ClubMember.name, schema: ClubMemberSchema },
    ]),
  ],
  controllers: [TablesController],
  providers: [HoldemCoordinator, TablesService, TableGateway],
  exports: [TablesService],
})
export class TablesModule {}
