import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get('transactions')
  transactions(
    @Req() req: Request,
    @Query('skip') skipRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const skip =
      skipRaw === undefined || skipRaw === ''
        ? 0
        : Number.parseInt(skipRaw, 10);
    const limit =
      limitRaw === undefined || limitRaw === ''
        ? 20
        : Number.parseInt(limitRaw, 10);
    if (!Number.isFinite(skip) || skip < 0) {
      throw new BadRequestException('skip must be a non-negative integer');
    }
    if (!Number.isFinite(limit) || limit < 1) {
      throw new BadRequestException('limit must be a positive integer');
    }
    return this.profile.getTransactionsPage(req.pokerUserId, skip, limit);
  }

  @Get()
  snapshot(@Req() req: Request) {
    return this.profile.getSnapshot(req.pokerUserId);
  }
}
