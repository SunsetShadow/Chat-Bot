import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { SecurityMiddleware } from './middleware/security.middleware';
import { AppController } from './app.controller';
import { ModelService } from './modules/model/model.service';
import { ChatModule } from './modules/chat/chat.module';
import { AgentModule } from './modules/agent/agent.module';
import { RuleModule } from './modules/rule/rule.module';
import { MemoryModule } from './modules/memory/memory.module';
import { UploadModule } from './modules/upload/upload.module';
import { ModelModule } from './modules/model/model.module';
import { CronJobModule } from './modules/cron-job/cron-job.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SpeechModule } from './modules/speech/speech.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    EventEmitterModule.forRoot({ maxListeners: 200 }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'chatbot'),
        password: configService.get<string>('DB_PASSWORD', 'chatbot'),
        database: configService.get<string>('DB_DATABASE', 'chatbot'),
        autoLoadEntities: true,
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    ChatModule,
    AgentModule,
    RuleModule,
    MemoryModule,
    UploadModule,
    ModelModule,
    CronJobModule,
    SettingsModule,
    SpeechModule,
  ],
  controllers: [AppController],
  providers: [ModelService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}
