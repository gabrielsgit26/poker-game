import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PokerUserMiddleware } from './auth/poker-user.middleware';
import { ClubsModule } from './clubs/clubs.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { TablesModule } from './tables/tables.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri:
          process.env.MONGODB_URI ??
          'mongodb://127.0.0.1:27017/poker',
      }),
    }),
    RedisModule,
    HealthModule,
    AuthModule,
    ClubsModule,
    TablesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PokerUserMiddleware).forRoutes('*');
  }
}
