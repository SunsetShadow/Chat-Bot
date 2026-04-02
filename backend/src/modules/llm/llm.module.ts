import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LlmService } from './llm.service';
import { OpenAIProvider } from './providers/openai.provider';
import { AppConfigService } from '../../config/config.service';

@Module({
  imports: [ConfigModule],
  providers: [LlmService, OpenAIProvider, AppConfigService],
  exports: [LlmService],
})
export class LlmModule {}
