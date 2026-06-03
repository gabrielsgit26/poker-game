import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ProfileService } from './profile.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Get()
  snapshot(@Req() req: Request) {
    return this.profile.getSnapshot(req.pokerUserId);
  }
}
