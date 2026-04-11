import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage, AIMessageChunk, AIMessage } from '@langchain/core/messages';
import { AppConfigService } from '../../config/config.service';
import { MemoryService } from '../memory/memory.service';
import { buildGraph } from './graph/graph.builder';
import { memoryExtractTool } from './tools/memory-extract.tool';
import { CompiledStateGraph } from '@langchain/langgraph';

/**
 * 流式事件类型：文本内容、工具调用各阶段、步骤边界、完成信号
 */
export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; toolCallId: string; toolName: string }
  | { type: 'tool_delta'; toolCallId: string; argsDelta: string }
  | { type: 'tool_input'; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool_output'; toolCallId: string; output: string }
  | { type: 'step_start' }
  | { type: 'finish'; finishReason: string };

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
  ): AsyncGenerator<StreamEvent> {
    const langchainMessages = this.buildMessages(messages, systemPrompt);
    let sawToolOutput = false;
    const toolCalls = new Map<string, {
      name: string; argsBuffer: string; inputEmitted: boolean; outputEmitted: boolean;
    }>();
    const indexToId = new Map<number, string>();

    const stream = await this.graph.stream(
      { messages: langchainMessages },
      {
        configurable: { thread_id: sessionId },
        streamMode: 'messages',
      },
    );

    for await (const [message] of stream) {
      const msgType = (message as any)?._getType?.() || (message as any)?.constructor?.name || 'unknown';
      const isAI = message instanceof AIMessageChunk || msgType === 'ai';
      const isTool = msgType === 'tool';

      if (isAI) {
        const aiMsg = message as AIMessageChunk;
        if (sawToolOutput) {
          yield { type: 'step_start' };
          sawToolOutput = false;
        }

        if (aiMsg.content && typeof aiMsg.content === 'string') {
          yield { type: 'text', content: aiMsg.content };
        }

        if (aiMsg.tool_call_chunks && aiMsg.tool_call_chunks.length > 0) {
          for (const chunk of aiMsg.tool_call_chunks) {
            const idx = chunk.index ?? 0;
            const tcId = chunk.id || indexToId.get(idx) || `tc_${idx}`;

            if (!toolCalls.has(tcId)) {
              const tcName = chunk.name || 'unknown';
              toolCalls.set(tcId, { name: tcName, argsBuffer: '', inputEmitted: false, outputEmitted: false });
              indexToId.set(idx, tcId);
              yield { type: 'tool_start', toolCallId: tcId, toolName: tcName };
            }

            const tc = toolCalls.get(tcId)!;
            if (chunk.args) {
              tc.argsBuffer += chunk.args;
              yield { type: 'tool_delta', toolCallId: tcId, argsDelta: chunk.args };
            }
          }
        }

        // 当收到 response_metadata 时，说明 AI chunk 流结束，发送所有 tool_input
        if ((aiMsg as any).response_metadata) {
          for (const [tcId, tc] of toolCalls) {
            if (!tc.inputEmitted) {
              tc.inputEmitted = true;
              try {
                const args = JSON.parse(tc.argsBuffer);
                yield { type: 'tool_input', toolCallId: tcId, toolName: tc.name, args };
              } catch {
                yield { type: 'tool_input', toolCallId: tcId, toolName: tc.name, args: {} };
              }
            }
          }
        }
      }

      if (isTool) {
        const toolCallId = (message as any).tool_call_id || (message as any).id || '';
        const tc = toolCalls.get(toolCallId);

        if (tc && !tc.inputEmitted) {
          tc.inputEmitted = true;
          try {
            const args = JSON.parse(tc.argsBuffer);
            yield { type: 'tool_input', toolCallId, toolName: tc.name, args };
          } catch {
            yield { type: 'tool_input', toolCallId, toolName: tc.name, args: {} };
          }
        }

        if (!tc?.outputEmitted) {
          if (tc) tc.outputEmitted = true;
          const output = typeof (message as any).content === 'string'
            ? (message as any).content
            : JSON.stringify((message as any).content);
          yield { type: 'tool_output', toolCallId, output };
          sawToolOutput = true;
        }
      }
    }

    // 流结束时，为所有已发 input 但未发 output 的 tool 补发 tool_output
    for (const [tcId, tc] of toolCalls) {
      if (tc.inputEmitted && !tc.outputEmitted) {
        tc.outputEmitted = true;
        yield { type: 'tool_output', toolCallId: tcId, output: '已执行' };
        sawToolOutput = true;
      }
    }

    yield { type: 'finish', finishReason: 'stop' };
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
