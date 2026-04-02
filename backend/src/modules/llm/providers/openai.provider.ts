import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { BaseLLMProvider, LLMResponse, StreamChunk } from './base.provider';
import { AppConfigService } from '../../../config/config.service';

@Injectable()
export class OpenAIProvider extends BaseLLMProvider {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly logger = new Logger(OpenAIProvider.name);

  constructor(private configService: AppConfigService) {
    super();
    const apiKey = configService.openaiApiKey;
    const baseUrl = configService.openaiBaseUrl || undefined;
    this.model = configService.openaiModel;

    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
    });
  }

  private buildMessages(systemPrompt: string | undefined, messages: any[]): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }
    for (const msg of messages) {
      result.push({
        role: msg.role as any,
        content: msg.content,
      });
    }
    return result;
  }

  async chat(messages: any[], systemPrompt?: string): Promise<LLMResponse> {
    const fullMessages = this.buildMessages(systemPrompt, messages);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: fullMessages,
        stream: false,
      });

      const choice = response.choices[0];
      return {
        content: choice?.message?.content || '',
        finish_reason: choice?.finish_reason || 'stop',
        usage: response.usage
          ? {
              prompt_tokens: response.usage.prompt_tokens,
              completion_tokens: response.usage.completion_tokens,
              total_tokens: response.usage.total_tokens,
            }
          : undefined,
      };
    } catch (error) {
      this.logger.error(`OpenAI chat error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async *chatStream(messages: any[], systemPrompt?: string): AsyncGenerator<StreamChunk> {
    const fullMessages = this.buildMessages(systemPrompt, messages);

    try {
      const stream = await this.client.chat.completions.create({
        model: this.model,
        messages: fullMessages,
        stream: true,
      });

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const finishReason = chunk.choices[0]?.finish_reason;

        if (delta?.content) {
          yield {
            content: delta.content,
            finish_reason: finishReason || null,
          };
        }

        if (finishReason) {
          yield {
            content: '',
            finish_reason: finishReason,
          };
        }
      }
    } catch (error) {
      this.logger.error(`OpenAI stream error: ${error.message}`, error.stack);
      throw error;
    }
  }
}
