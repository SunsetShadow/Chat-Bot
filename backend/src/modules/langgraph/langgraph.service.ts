import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessageChunk, AIMessage } from '@langchain/core/messages';
import { AppConfigService } from '../../config/config.service';
import { MemoryService } from '../memory/memory.service';
import { buildGraph } from './graph/graph.builder';
import { memoryExtractTool } from './tools/memory-extract.tool';
import { CompiledStateGraph } from '@langchain/langgraph';

@Injectable()
export class LangGraphService implements OnModuleInit {
  private model: ChatOpenAI;
  private graph: CompiledStateGraph<any, any, any>;

  constructor(
    private configService: AppConfigService,
    private memoryService: MemoryService,
  ) {}

  onModuleInit() {
    this.model = new ChatOpenAI({
      modelName: this.configService.openaiModel,
      openAIApiKey: this.configService.openaiApiKey,
      configuration: {
        baseURL: this.configService.openaiBaseUrl || undefined,
      },
      streaming: true,
    });

    const tools = [memoryExtractTool];
    this.graph = buildGraph(this.model, tools);
  }

  async chat(
    messages: { role: string; content: string }[],
    systemPrompt: string,
    sessionId: string,
  ): Promise<{ content: string; finish_reason: string }> {
    const langchainMessages = this.buildMessages(messages, systemPrompt);

    const result = await this.graph.invoke(
      { messages: langchainMessages },
      { configurable: { thread_id: sessionId } },
    ) as any;

    const lastMsg = result.messages[result.messages.length - 1];
    return {
      content: lastMsg.content || '',
      finish_reason: 'stop',
    };
  }

  async *chatStream(
    messages: { role: string; content: string }[],
    systemPrompt: string,
    sessionId: string,
  ): AsyncGenerator<{ content: string; finish_reason: string | null }> {
    const langchainMessages = this.buildMessages(messages, systemPrompt);

    const stream = await this.graph.stream(
      { messages: langchainMessages },
      {
        configurable: { thread_id: sessionId },
        streamMode: 'messages',
      },
    );

    for await (const [message] of stream) {
      if (message instanceof AIMessageChunk) {
        if (message.content && typeof message.content === 'string') {
          yield {
            content: message.content,
            finish_reason: null,
          };
        }
        if (message.tool_call_chunks && message.tool_call_chunks.length > 0) {
          continue;
        }
      }
    }

    yield { content: '', finish_reason: 'stop' };
  }

  private buildMessages(
    messages: { role: string; content: string }[],
    systemPrompt: string,
  ) {
    const result: any[] = [];
    if (systemPrompt) {
      result.push(new SystemMessage(systemPrompt));
    }
    for (const msg of messages) {
      if (msg.role === 'user') {
        result.push(new HumanMessage(msg.content));
      } else if (msg.role === 'assistant') {
        result.push(new AIMessage(msg.content));
      }
    }
    return result;
  }
}
