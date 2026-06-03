import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { User, UserSchema } from '../auth/user.schema';
import { PlatformWalletRequest, PlatformWalletRequestSchema } from './platform-wallet-request.schema';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: PlatformWalletRequest.name, schema: PlatformWalletRequestSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [WalletController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
