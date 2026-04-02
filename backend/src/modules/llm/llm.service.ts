import { Injectable } from '@nestjs/common';
import { BaseLLMProvider, LLMResponse, StreamChunk } from './providers/base.provider';
import { OpenAIProvider } from './providers/openai.provider';

@Injectable()
export class LlmService {
  constructor(private openaiProvider: OpenAIProvider) {}

  private getProvider(): BaseLLMProvider {
    return this.openaiProvider;
  }

  async chat(messages: any[], systemPrompt?: string): Promise<LLMResponse> {
    return this.getProvider().chat(messages, systemPrompt);
  }

  async *chatStream(messages: any[], systemPrompt?: string): AsyncGenerator<StreamChunk> {
    yield* this.getProvider().chatStream(messages, systemPrompt);
  }
}
