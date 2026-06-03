import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PokerUserMiddleware } from './poker-user.middleware';
import { ClubMember, ClubMemberSchema } from '../clubs/schemas/club-member.schema';
import { User, UserSchema } from './user.schema';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ClubMember.name, schema: ClubMemberSchema },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersService, PokerUserMiddleware],
  exports: [AuthService, UsersService, PokerUserMiddleware],
})
export class AuthModule {}
