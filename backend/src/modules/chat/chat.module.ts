import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionEntity } from '../../common/entities/session.entity';
import { MessageEntity } from '../../common/entities/message.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AgentModule } from '../agent/agent.module';
import { RuleModule } from '../rule/rule.module';
import { MemoryModule } from '../memory/memory.module';
import { LangGraphModule } from '../langgraph/langgraph.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SessionEntity, MessageEntity]),
    AgentModule,
    RuleModule,
    MemoryModule,
    LangGraphModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
