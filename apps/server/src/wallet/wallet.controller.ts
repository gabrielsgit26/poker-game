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
import { WalletService } from './wallet.service';

@Controller('wallet')
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get('balance')
  async balance(@Req() req: Request) {
    const balanceChips = await this.wallet.getBalance(req.pokerUserId);
    return { balanceChips };
  }

  @Get('requests')
  async list(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('skip') skip?: string,
  ) {
    const lim = limit != null ? Number.parseInt(limit, 10) : 30;
    const sk = skip != null ? Number.parseInt(skip, 10) : 0;
    return this.wallet.listMine(
      req.pokerUserId,
      Number.isFinite(lim) ? lim : 30,
      Number.isFinite(sk) ? sk : 0,
    );
  }

  @Post('deposit-requests')
  async deposit(
    @Req() req: Request,
    @Body() body: { amount?: number; note?: string },
  ) {
    if (typeof body?.amount !== 'number') {
      throw new BadRequestException('Field "amount" (number) is required.');
    }
    return this.wallet.createDeposit(req.pokerUserId, body.amount, body.note);
  }

  @Post('withdrawal-requests')
  async withdrawal(
    @Req() req: Request,
    @Body() body: { amount?: number; note?: string },
  ) {
    if (typeof body?.amount !== 'number') {
      throw new BadRequestException('Field "amount" (number) is required.');
    }
    return this.wallet.createWithdrawal(req.pokerUserId, body.amount, body.note);
  }

  @Patch('requests/:requestId/cancel')
  async cancel(@Req() req: Request, @Param('requestId') requestId: string) {
    return this.wallet.cancelOwn(req.pokerUserId, requestId);
  }
}
