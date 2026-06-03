import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ClubsService } from './clubs.service';

@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Get()
  list(@Req() req: Request) {
    return this.clubsService.listForUser(req.pokerUserId);
  }

  @Post()
  create(
    @Req() req: Request,
    @Body() body: { name?: string; isPrivate?: boolean },
  ) {
    const name = body?.name;
    if (typeof name !== 'string') {
      throw new BadRequestException('Field "name" is required.');
    }
    const isPrivate = Boolean(body?.isPrivate);
    return this.clubsService.createClub(req.pokerUserId, name, isPrivate);
  }

  /** Owner/manager: total ACTIVE member chips per club you administer (for manager dashboard). */
  @Get('manager/chip-totals')
  managerChipTotals(@Req() req: Request) {
    return this.clubsService.getManagedClubChipTotals(req.pokerUserId);
  }

  /** List pending join requests (club OWNER / MANAGER only). */
  @Get(':clubId/join-requests')
  joinRequests(@Param('clubId') clubId: string, @Req() req: Request) {
    return this.clubsService.listJoinRequests(clubId, req.pokerUserId);
  }

  @Patch(':clubId/join-requests/:requestId')
  async decideRequest(
    @Param('clubId') clubId: string,
    @Param('requestId') requestId: string,
    @Req() req: Request,
    @Body() body: { approve?: boolean },
  ) {
    if (typeof body?.approve !== 'boolean') {
      throw new BadRequestException('Field "approve" (boolean) is required.');
    }
    await this.clubsService.decideJoinRequest(
      clubId,
      requestId,
      req.pokerUserId,
      body.approve,
    );
    return { ok: true };
  }

  /** List cash-out requests (own rows for members; club-wide for owners/managers). */
  @Get(':clubId/cash-out-requests')
  cashOutRequests(@Param('clubId') clubId: string, @Req() req: Request) {
    return this.clubsService.listCashOutRequests(clubId, req.pokerUserId);
  }

  /** Member: request debiting club wallet chips (pending until manager approves). */
  @Post(':clubId/cash-out-requests')
  createCashOutRequest(
    @Param('clubId') clubId: string,
    @Req() req: Request,
    @Body() body: { amount?: number; memberNote?: string },
  ) {
    if (typeof body?.amount !== 'number' || !Number.isFinite(body.amount)) {
      throw new BadRequestException('Field "amount" (number) is required.');
    }
    const memberNote =
      typeof body?.memberNote === 'string' ? body.memberNote : undefined;
    return this.clubsService.createCashOutRequest(
      clubId,
      req.pokerUserId,
      body.amount,
      memberNote,
    );
  }

  @Patch(':clubId/cash-out-requests/:requestId')
  async decideCashOutRequest(
    @Param('clubId') clubId: string,
    @Param('requestId') requestId: string,
    @Req() req: Request,
    @Body() body: { approve?: boolean },
  ) {
    if (typeof body?.approve !== 'boolean') {
      throw new BadRequestException('Field "approve" (boolean) is required.');
    }
    await this.clubsService.decideCashOutRequest(
      clubId,
      requestId,
      req.pokerUserId,
      body.approve,
    );
    return { ok: true };
  }

  @Post(':clubId/join')
  joinClub(@Param('clubId') clubId: string, @Req() req: Request) {
    return this.clubsService.joinClub(clubId, req.pokerUserId);
  }

  /** Chip movements: `scope=me` (default) for your wallet; `scope=club` for owners/managers (club-wide audit). */
  @Get(':clubId/chip-ledger')
  chipLedger(
    @Param('clubId') clubId: string,
    @Req() req: Request,
    @Query('scope') scope?: string,
  ) {
    const s = scope === 'club' ? 'club' : 'me';
    return this.clubsService.listChipLedger(clubId, req.pokerUserId, s);
  }

  /** Owner/manager: credit or debit a member's club chip wallet (logged to chip_ledger). */
  @Post(':clubId/members/:targetUserId/chip-adjustment')
  adjustMemberChips(
    @Param('clubId') clubId: string,
    @Param('targetUserId') targetUserId: string,
    @Req() req: Request,
    @Body() body: { delta?: number; note?: string },
  ) {
    if (typeof body?.delta !== 'number' || !Number.isFinite(body.delta)) {
      throw new BadRequestException('Field "delta" (number) is required.');
    }
    const note = typeof body?.note === 'string' ? body.note : undefined;
    return this.clubsService.adjustMemberChips(
      clubId,
      req.pokerUserId,
      targetUserId,
      body.delta,
      note,
    );
  }

  @Get(':clubId')
  detail(@Param('clubId') clubId: string, @Req() req: Request) {
    return this.clubsService.getDetail(clubId, req.pokerUserId);
  }
}
