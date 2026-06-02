import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AuthService } from './auth.service';

@Injectable()
export class PokerUserMiddleware implements NestMiddleware {
  constructor(private readonly auth: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    req.pokerUserId = await this.auth.resolveUserIdFromRequest(req);
    next();
  }
}
