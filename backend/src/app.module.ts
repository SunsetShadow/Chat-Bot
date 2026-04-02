import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecurityMiddleware } from './middleware/security.middleware';
import { AppController } from './app.controller';
import { ModelService } from './modules/model/model.service';
import { ChatModule } from './modules/chat/chat.module';
import { AgentModule } from './modules/agent/agent.module';
import { RuleModule } from './modules/rule/rule.module';
import { MemoryModule } from './modules/memory/memory.module';
import { UploadModule } from './modules/upload/upload.module';
import { ModelModule } from './modules/model/model.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ChatModule,
    AgentModule,
    RuleModule,
    MemoryModule,
    UploadModule,
    ModelModule,
  ],
  controllers: [AppController],
  providers: [ModelService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}
