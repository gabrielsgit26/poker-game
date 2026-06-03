import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { ClubsService } from '../clubs/clubs.service';
import { WalletService } from '../wallet/wallet.service';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly auth: AuthService,
    private readonly clubs: ClubsService,
    private readonly admin: AdminService,
    private readonly wallet: WalletService,
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

  /** Daily new users & clubs (`createdAt`, UTC buckets) for admin charts. */
  @Get('report/signups')
  async signupReport(@Req() req: Request, @Query('days') days?: string) {
    this.assertPlatformAdmin(req);
    const n = days != null ? Number.parseInt(days, 10) : 14;
    return this.admin.getSignupActivity(Number.isFinite(n) ? n : 14);
  }

  /** Daily chip ledger activity (UTC buckets). */
  @Get('report/ledger-daily')
  async ledgerDailyReport(@Req() req: Request, @Query('days') days?: string) {
    this.assertPlatformAdmin(req);
    const n = days != null ? Number.parseInt(days, 10) : 14;
    return this.admin.getLedgerActivity(Number.isFinite(n) ? n : 14);
  }

  /** Club directory page with active member counts (platform admin). */
  @Get('clubs')
  async clubDirectory(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
  ) {
    this.assertPlatformAdmin(req);
    const lim = limit != null ? Number.parseInt(limit, 10) : 50;
    const sk = skip != null ? Number.parseInt(skip, 10) : 0;
    return this.admin.listClubs(
      Number.isFinite(lim) ? lim : 50,
      Number.isFinite(sk) ? sk : 0,
      typeof q === 'string' ? q : undefined,
    );
  }

  /** Users page (newest `updatedAt` first). */
  @Get('users')
  async users(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('q') q?: string,
  ) {
    this.assertPlatformAdmin(req);
    const lim = limit != null ? Number.parseInt(limit, 10) : 50;
    const sk = skip != null ? Number.parseInt(skip, 10) : 0;
    return this.admin.listUsers(
      Number.isFinite(lim) ? lim : 50,
      Number.isFinite(sk) ? sk : 0,
      typeof q === 'string' ? q : undefined,
    );
  }

  /** All tables (admin directory). */
  @Get('tables')
  async tablesDirectory(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    this.assertPlatformAdmin(req);
    const lim = limit != null ? Number.parseInt(limit, 10) : 50;
    const sk = skip != null ? Number.parseInt(skip, 10) : 0;
    return this.admin.listTables(
      Number.isFinite(lim) ? lim : 50,
      Number.isFinite(sk) ? sk : 0,
    );
  }

  @Get('wallet/report/daily')
  async walletReportDaily(@Req() req: Request, @Query('days') days?: string) {
    this.assertPlatformAdmin(req);
    const n = days != null ? Number.parseInt(days, 10) : 14;
    return this.wallet.getDailyReport(Number.isFinite(n) ? n : 14);
  }

  @Get('wallet/requests')
  async walletRequests(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    this.assertPlatformAdmin(req);
    const lim = limit != null ? Number.parseInt(limit, 10) : 50;
    const sk = skip != null ? Number.parseInt(skip, 10) : 0;
    const st =
      status === 'PENDING' ||
      status === 'APPROVED' ||
      status === 'REJECTED' ||
      status === 'CANCELLED'
        ? status
        : undefined;
    return this.wallet.listAdmin(
      Number.isFinite(lim) ? lim : 50,
      Number.isFinite(sk) ? sk : 0,
      st,
      typeof q === 'string' ? q : undefined,
    );
  }

  @Patch('wallet/requests/:requestId')
  async walletDecide(
    @Req() req: Request,
    @Param('requestId') requestId: string,
    @Body() body: { decision?: string; note?: string },
  ) {
    this.assertPlatformAdmin(req);
    const d = body?.decision;
    if (d !== 'approve' && d !== 'reject' && d !== 'cancel') {
      throw new BadRequestException('Field "decision" must be approve, reject, or cancel.');
    }
    return this.wallet.adminDecide(req.pokerUserId, requestId, d, body?.note);
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
