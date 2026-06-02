import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { TablesService } from './tables.service';

@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  list() {
    return this.tablesService.listOpenTables();
  }

  @Post()
  async create(
    @Req() req: Request,
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
    return this.tablesService.createTable(req.pokerUserId, body.clubId.trim(), {
      name: body.name,
      smallBlind: body.smallBlind,
      bigBlind: body.bigBlind,
      maxPlayers: body.maxPlayers,
      timerSeconds: body.timerSeconds,
      minBuyIn: body.minBuyIn,
    });
  }

  @Get(':tableId')
  detail(@Param('tableId') tableId: string, @Req() req: Request) {
    return this.tablesService.getDetail(tableId, req.pokerUserId);
  }

  @Post(':tableId/sit')
  sit(
    @Param('tableId') tableId: string,
    @Req() req: Request,
    @Body() body: { seatIndex?: number },
  ) {
    if (typeof body?.seatIndex !== 'number' || !Number.isInteger(body.seatIndex)) {
      throw new BadRequestException('Field "seatIndex" (integer) is required.');
    }
    return this.tablesService.sitAtSeat(tableId, req.pokerUserId, body.seatIndex);
  }

  @Post(':tableId/leave')
  leave(@Param('tableId') tableId: string, @Req() req: Request) {
    return this.tablesService.leaveSeat(tableId, req.pokerUserId);
  }

  @Post(':tableId/close')
  async close(@Param('tableId') tableId: string, @Req() req: Request) {
    await this.tablesService.closeTable(tableId, req.pokerUserId);
    return { ok: true };
  }
}
