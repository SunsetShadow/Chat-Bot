import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { WebSocketServer } from 'ws';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AppConfigService } from './config/config.service';
import { TtsRelayService } from './modules/speech/tts-relay.service';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(AppConfigService);

  app.enableCors({
    origin: configService.corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  const port = configService.port;
  const server = await app.listen(port);

  // TTS WebSocket Server
  const ttsRelayService = app.get(TtsRelayService);
  const ttsWss = new WebSocketServer({ server, path: '/api/v1/speech/tts/ws' });
  ttsWss.on('connection', (socket, request) => {
    const reqUrl = new URL(request.url ?? '', `http://localhost:${port}`);
    const wantedSessionId = reqUrl.searchParams.get('sessionId') ?? undefined;
    const sessionId = ttsRelayService.registerClient(socket, wantedSessionId);
    socket.on('close', () => ttsRelayService.unregisterClient(sessionId));
  });

  logger.log(`Application running on http://localhost:${port}`);
  logger.log(`TTS WebSocket available at ws://localhost:${port}/api/v1/speech/tts/ws`);
}

bootstrap();
