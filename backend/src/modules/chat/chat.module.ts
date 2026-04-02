import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { LlmModule } from '../llm/llm.module';
import { AgentModule } from '../agent/agent.module';
import { RuleModule } from '../rule/rule.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [LlmModule, AgentModule, RuleModule, MemoryModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
