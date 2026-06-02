import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from '@nestjs/common';
import { TablesService } from './tables.service';

function devUserId(header?: string): string {
  const v = header?.trim();
  return v && v.length > 0 ? v : 'local-player';
}

@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  list() {
    return this.tablesService.listOpenTables();
  }

  @Post()
  async create(
    @Headers('x-dev-user-id') xDevUserId: string | undefined,
    @Body()
    body: {
      clubId?: string;
      name?: string;
      smallBlind?: number;
      bigBlind?: number;
      maxPlayers?: number;
      timerSeconds?: number;
      minBuyIn?: number;
    },
  ) {
    if (typeof body?.clubId !== 'string' || !body.clubId.trim()) {
      throw new BadRequestException('Field "clubId" is required.');
    }
    if (typeof body?.name !== 'string') {
      throw new BadRequestException('Field "name" is required.');
    }
    if (typeof body?.smallBlind !== 'number' || typeof body?.bigBlind !== 'number') {
      throw new BadRequestException('Fields "smallBlind" and "bigBlind" are required.');
    }
    return this.tablesService.createTable(devUserId(xDevUserId), body.clubId.trim(), {
      name: body.name,
      smallBlind: body.smallBlind,
      bigBlind: body.bigBlind,
      maxPlayers: body.maxPlayers,
      timerSeconds: body.timerSeconds,
      minBuyIn: body.minBuyIn,
    });
  }

  @Get(':tableId')
  detail(
    @Param('tableId') tableId: string,
    @Headers('x-dev-user-id') xDevUserId?: string,
  ) {
    return this.tablesService.getDetail(tableId, devUserId(xDevUserId));
  }

  @Post(':tableId/sit')
  sit(
    @Param('tableId') tableId: string,
    @Headers('x-dev-user-id') xDevUserId: string | undefined,
    @Body() body: { seatIndex?: number },
  ) {
    if (typeof body?.seatIndex !== 'number' || !Number.isInteger(body.seatIndex)) {
      throw new BadRequestException('Field "seatIndex" (integer) is required.');
    }
    return this.tablesService.sitAtSeat(
      tableId,
      devUserId(xDevUserId),
      body.seatIndex,
    );
  }

  @Post(':tableId/leave')
  leave(
    @Param('tableId') tableId: string,
    @Headers('x-dev-user-id') xDevUserId?: string,
  ) {
    return this.tablesService.leaveSeat(tableId, devUserId(xDevUserId));
  }

  @Post(':tableId/close')
  async close(
    @Param('tableId') tableId: string,
    @Headers('x-dev-user-id') xDevUserId?: string,
  ) {
    await this.tablesService.closeTable(tableId, devUserId(xDevUserId));
    return { ok: true };
  }
}
