import {
  Body,
  Controller,
  BadRequestException,
  ForbiddenException,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, POKER_SESSION_COOKIE } from './auth.service';
import { verifyTelegramWebAppInitData } from './telegram-web-app-init-data';
import { UsersService } from './users.service';

function allowDevLogin(): boolean {
  if (process.env.AUTH_ALLOW_DEV_LOGIN === 'true') return true;
  return process.env.NODE_ENV !== 'production';
}

function sanitizeUserId(raw: string): string {
  const v = raw.trim().slice(0, 80);
  if (!/^[a-zA-Z0-9._-]+$/.test(v)) {
    throw new BadRequestException(
      'userId may only contain letters, digits, dot, underscore, hyphen.',
    );
  }
  return v;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
  ) {}

  @Get('me')
  async me(@Req() req: Request) {
    const user = await this.users.findByUserId(req.pokerUserId);
    if (!user) {
      return {
        authenticated: false as const,
        userId: req.pokerUserId,
      };
    }
    const o = user.toObject();
    const createdAt = user.get('createdAt') as Date | undefined;
    const updatedAt = user.get('updatedAt') as Date | undefined;
    return {
      authenticated: true as const,
      user: {
        userId: o.userId,
        displayName: o.displayName ?? null,
        createdAt: createdAt ? createdAt.toISOString() : null,
        updatedAt: updatedAt ? updatedAt.toISOString() : null,
      },
      isPlatformAdmin: this.auth.isPlatformAdminUserId(o.userId),
    };
  }

  /** Local / browser dev: establishes HTTP-only session (plan §9 Phase 2). Not for production unless gated. */
  @Post('dev-login')
  @HttpCode(200)
  async devLogin(
    @Body() body: { userId?: string; displayName?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!allowDevLogin()) {
      throw new ForbiddenException('Dev login is disabled in this environment.');
    }
    const userId = sanitizeUserId(body?.userId?.length ? body.userId : 'local-player');
    const displayName =
      typeof body?.displayName === 'string' ? body.displayName.trim().slice(0, 120) : undefined;
    await this.users.findOrCreate(userId, displayName);
    const token = await this.auth.createSession(userId);
    const secure = process.env.NODE_ENV === 'production';
    res.cookie(POKER_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 1000 * 60 * 60 * 24 * 14,
      path: '/',
    });
    return { ok: true as const, userId };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const sid = req.cookies?.[POKER_SESSION_COOKIE];
    if (typeof sid === 'string') await this.auth.revokeSession(sid);
    res.clearCookie(POKER_SESSION_COOKIE, { path: '/' });
    return { ok: true as const };
  }

  /**
   * Telegram Mini App: validate `Telegram.WebApp.initData` (HMAC), upsert user, set `poker_sid`.
   * Requires `TELEGRAM_BOT_TOKEN` in server env.
   */
  @Post('telegram')
  @HttpCode(200)
  async telegram(
    @Body() body: { initData?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const raw = body?.initData;
    if (typeof raw !== 'string' || !raw.trim()) {
      throw new BadRequestException('initData is required.');
    }
    const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
    if (!botToken) {
      throw new HttpException(
        {
          message:
            'Telegram login is not configured. Set TELEGRAM_BOT_TOKEN on the API, or use POST /auth/dev-login in development.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    const parsed = verifyTelegramWebAppInitData(raw, botToken);
    if (!parsed) {
      throw new UnauthorizedException('Invalid or expired Telegram initData.');
    }
    const userId = `tg_${parsed.telegramUserId}`;
    await this.users.findOrCreate(userId, parsed.displayName);
    const token = await this.auth.createSession(userId);
    const secure = process.env.NODE_ENV === 'production';
    res.cookie(POKER_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 1000 * 60 * 60 * 24 * 14,
      path: '/',
    });
    return { ok: true as const, userId };
  }
}
