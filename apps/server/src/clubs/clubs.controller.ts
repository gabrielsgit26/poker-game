import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ClubsService } from './clubs.service';

function devUserId(header?: string): string {
  const v = header?.trim();
  return v && v.length > 0 ? v : 'local-player';
}

@Controller('clubs')
export class ClubsController {
  constructor(private readonly clubsService: ClubsService) {}

  @Get()
  list(@Headers('x-dev-user-id') xDevUserId?: string) {
    return this.clubsService.listForUser(devUserId(xDevUserId));
  }

  @Post()
  create(
    @Headers('x-dev-user-id') xDevUserId: string | undefined,
    @Body() body: { name?: string; isPrivate?: boolean },
  ) {
    const name = body?.name;
    if (typeof name !== 'string') {
      throw new BadRequestException('Field "name" is required.');
    }
    const isPrivate = Boolean(body?.isPrivate);
    return this.clubsService.createClub(devUserId(xDevUserId), name, isPrivate);
  }

  /** List pending join requests (club OWNER / MANAGER only). */
  @Get(':clubId/join-requests')
  joinRequests(
    @Param('clubId') clubId: string,
    @Headers('x-dev-user-id') xDevUserId?: string,
  ) {
    return this.clubsService.listJoinRequests(clubId, devUserId(xDevUserId));
  }

  @Patch(':clubId/join-requests/:requestId')
  async decideRequest(
    @Param('clubId') clubId: string,
    @Param('requestId') requestId: string,
    @Headers('x-dev-user-id') xDevUserId: string | undefined,
    @Body() body: { approve?: boolean },
  ) {
    if (typeof body?.approve !== 'boolean') {
      throw new BadRequestException('Field "approve" (boolean) is required.');
    }
    await this.clubsService.decideJoinRequest(
      clubId,
      requestId,
      devUserId(xDevUserId),
      body.approve,
    );
    return { ok: true };
  }

  @Post(':clubId/join')
  joinClub(
    @Param('clubId') clubId: string,
    @Headers('x-dev-user-id') xDevUserId?: string,
  ) {
    return this.clubsService.joinClub(clubId, devUserId(xDevUserId));
  }

  @Get(':clubId')
  detail(
    @Param('clubId') clubId: string,
    @Headers('x-dev-user-id') xDevUserId?: string,
  ) {
    return this.clubsService.getDetail(clubId, devUserId(xDevUserId));
  }
}
