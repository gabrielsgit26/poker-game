import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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

  @Post(':clubId/join')
  joinClub(@Param('clubId') clubId: string, @Req() req: Request) {
    return this.clubsService.joinClub(clubId, req.pokerUserId);
  }

  @Get(':clubId')
  detail(@Param('clubId') clubId: string, @Req() req: Request) {
    return this.clubsService.getDetail(clubId, req.pokerUserId);
  }
}
