import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { ClubsService } from '../clubs/clubs.service';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly auth: AuthService,
    private readonly clubs: ClubsService,
    private readonly admin: AdminService,
  ) {}

  private assertPlatformAdmin(req: Request): void {
    if (!this.auth.isPlatformAdminUserId(req.pokerUserId)) {
      throw new ForbiddenException('Platform admin access required.');
    }
  }

  @Get('overview')
  async overview(@Req() req: Request) {
    this.assertPlatformAdmin(req);
    return this.admin.getOverview();
  }

  @Post('clubs/:clubId/members/:targetUserId/chip-grant')
  chipGrant(
    @Param('clubId') clubId: string,
    @Param('targetUserId') targetUserId: string,
    @Req() req: Request,
    @Body() body: { delta?: number; note?: string },
  ) {
    this.assertPlatformAdmin(req);
    if (typeof body?.delta !== 'number' || !Number.isFinite(body.delta)) {
      throw new BadRequestException('Field "delta" (number) is required.');
    }
    const note = typeof body?.note === 'string' ? body.note : undefined;
    return this.clubs.adjustMemberChipsAsPlatform(
      clubId,
      req.pokerUserId,
      targetUserId,
      body.delta,
      note,
    );
  }
}
