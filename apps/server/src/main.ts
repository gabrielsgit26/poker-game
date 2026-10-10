import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { corsOrigins } from './cors-origins';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.useWebSocketAdapter(new IoAdapter(app));
  const port = Number(process.env.PORT) || 3001;
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });
  await app.listen(port);
}
bootstrap();
