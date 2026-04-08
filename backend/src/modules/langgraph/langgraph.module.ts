import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LangGraphService } from './langgraph.service';
import { MemoryModule } from '../memory/memory.module';
import { AppConfigService } from '../../config/config.service';

@Module({
  imports: [ConfigModule, MemoryModule],
  providers: [LangGraphService, AppConfigService],
  exports: [LangGraphService],
})
export class LangGraphModule {}
