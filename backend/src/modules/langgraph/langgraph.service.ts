import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  SystemMessage,
  AIMessageChunk,
  AIMessage,
} from '@langchain/core/messages';
import { AppConfigService } from '../../config/config.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { AgentService } from '../agent/agent.service';
import { buildGraph } from './graph/graph.builder';
import { buildSupervisorGraph, AgentDefinition } from './graph/supervisor.builder';
import { CompiledStateGraph } from '@langchain/langgraph';

/**
 * 流式事件类型：文本内容、工具调用各阶段、步骤边界、完成信号
 */
export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; toolCallId: string; toolName: string }
  | { type: 'tool_delta'; toolCallId: string; argsDelta: string }
  | {
      type: 'tool_input';
      toolCallId: string;
      toolName: string;
      args: Record<string, unknown>;
    }
  | { type: 'tool_output'; toolCallId: string; output: string }
  | { type: 'step_start' }
  | { type: 'agent_switched'; fromAgent: string; toAgent: string }
  | { type: 'finish'; finishReason: string };

@Injectable()
export class LangGraphService implements OnModuleInit {
  private model: ChatOpenAI;
  private singleAgentGraph: CompiledStateGraph<any, any, any>;
  private supervisorGraph: CompiledStateGraph<any, any, any> | null = null;
  private graphVersion = 0;
  private rebuildNeeded = false;

  constructor(
    private configService: AppConfigService,
    private toolRegistry: ToolRegistryService,
    private agentService: AgentService,
  ) {}

  async onModuleInit() {
    this.model = new ChatOpenAI({
      modelName: this.configService.openaiModel,
      openAIApiKey: this.configService.openaiApiKey,
      configuration: {
        baseURL: this.configService.openaiBaseUrl || undefined,
      },
      streaming: true,
    });

    // 构建单 Agent 后备图
    const tools = this.toolRegistry.getAll();
    this.singleAgentGraph = buildGraph(this.model, tools);

    // 构建多 Agent Supervisor 图
    await this.rebuildSupervisorGraph();
  }

  /**
   * 重建 Supervisor 图（当 agents 变更时调用）
   */
  async rebuildSupervisorGraph() {
    const agents = await this.agentService.findAll();
    if (agents.length < 2) {
      this.supervisorGraph = null;
      return;
    }

    const definitions: AgentDefinition[] = agents.map((a) => ({
      id: a.id,
      name: a.name,
      system_prompt: a.system_prompt,
      capabilities: a.capabilities || a.description,
      tools: a.tools || [],
      model_name: a.model_name || undefined,
      temperature: a.temperature ?? undefined,
      enabled: a.enabled !== false,
    }));

    this.supervisorGraph = buildSupervisorGraph(
      this.model,
      definitions,
      (name) => this.toolRegistry.get(name),
      (modelName) => this.createModel(modelName),
    );
    this.graphVersion++;
  }

  /**
   * 为指定模型名创建独立的 ChatOpenAI 实例
   */
  private createModel(modelName: string): ChatOpenAI {
    return new ChatOpenAI({
      modelName,
      openAIApiKey: this.configService.openaiApiKey,
      configuration: {
        baseURL: this.configService.openaiBaseUrl || undefined,
      },
      streaming: true,
    });
  }

  /**
   * 标记需要重建 Supervisor 图（由 AgentService 在 agent 变更时调用）
   */
  scheduleRebuild() {
    this.rebuildNeeded = true;
  }

  /**
   * 获取当前使用的图（supervisor 优先，否则 single-agent）
   * 如果标记了需要重建，先重建再返回
   */
  private async getGraph(): Promise<CompiledStateGraph<any, any, any>> {
    if (this.rebuildNeeded) {
      this.rebuildNeeded = false;
      await this.rebuildSupervisorGraph();
    }
    return this.supervisorGraph || this.singleAgentGraph;
  }

  /**
   * 是否处于多 Agent 模式
   */
  isMultiAgentMode(): boolean {
    return this.supervisorGraph !== null;
  }

  async chat(
    messages: { role: string; content: string }[],
    systemPrompt: string,
    sessionId: string,
    preferredAgent?: string,
  ): Promise<{ content: string; finish_reason: string }> {
    const langchainMessages = this.buildMessages(messages, systemPrompt);
    const graph = await this.getGraph();

    const result = (await graph.invoke(
      { messages: langchainMessages },
      { configurable: { thread_id: sessionId } },
    )) as any;

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
    preferredAgent?: string,
  ): AsyncGenerator<StreamEvent> {
    const langchainMessages = this.buildMessages(messages, systemPrompt);
    const graph = await this.getGraph();

    let sawToolOutput = false;
    let currentAgent = '';
    const toolCalls = new Map<
      string,
      {
        name: string;
        argsBuffer: string;
        inputEmitted: boolean;
        outputEmitted: boolean;
      }
    >();
    const indexToId = new Map<number, string>();

    const stream = await graph.stream(
      { messages: langchainMessages },
      {
        configurable: { thread_id: sessionId },
        streamMode: 'messages',
      },
    );

    for await (const [message] of stream) {
      const msgType =
        (message as any)?._getType?.() ||
        (message as any)?.constructor?.name ||
        'unknown';
      const isAI = message instanceof AIMessageChunk || msgType === 'ai';
      const isTool = msgType === 'tool';

      if (isAI) {
        const aiMsg = message as AIMessageChunk;

        // 检测 agent 切换（supervisor 模式下通过 message name 判断）
        const agentName = (aiMsg as any).name || '';
        if (
          agentName &&
          currentAgent &&
          agentName !== currentAgent &&
          agentName !== 'supervisor'
        ) {
          yield {
            type: 'agent_switched',
            fromAgent: currentAgent,
            toAgent: agentName,
          };
        }
        if (agentName && agentName !== 'supervisor') {
          currentAgent = agentName;
        }

        if (sawToolOutput) {
          yield { type: 'step_start' };
          sawToolOutput = false;
        }

        if (aiMsg.content && typeof aiMsg.content === 'string') {
          yield { type: 'text', content: aiMsg.content };
        }

        if (
          aiMsg.tool_call_chunks &&
          aiMsg.tool_call_chunks.length > 0
        ) {
          for (const chunk of aiMsg.tool_call_chunks) {
            const idx = chunk.index ?? 0;
            const tcId = chunk.id || indexToId.get(idx) || `tc_${idx}`;

            if (!toolCalls.has(tcId)) {
              const tcName = chunk.name || 'unknown';
              toolCalls.set(tcId, {
                name: tcName,
                argsBuffer: '',
                inputEmitted: false,
                outputEmitted: false,
              });
              indexToId.set(idx, tcId);
              yield {
                type: 'tool_start',
                toolCallId: tcId,
                toolName: tcName,
              };
            }

            const tc = toolCalls.get(tcId)!;
            if (chunk.args) {
              tc.argsBuffer += chunk.args;
              yield {
                type: 'tool_delta',
                toolCallId: tcId,
                argsDelta: chunk.args,
              };
            }
          }
        }

        // response_metadata 表示 AI chunk 流结束，发送所有 tool_input
        if ((aiMsg as any).response_metadata) {
          for (const [tcId, tc] of toolCalls) {
            if (!tc.inputEmitted) {
              tc.inputEmitted = true;
              try {
                const args = JSON.parse(tc.argsBuffer);
                yield {
                  type: 'tool_input',
                  toolCallId: tcId,
                  toolName: tc.name,
                  args,
                };
              } catch (e) {
                console.warn('[LangGraph] Failed to parse tool args:', tcId, e);
                yield {
                  type: 'tool_input',
                  toolCallId: tcId,
                  toolName: tc.name,
                  args: {},
                };
              }
            }
          }
        }
      }

      if (isTool) {
        const toolCallId =
          (message as any).tool_call_id || (message as any).id || '';
        const tc = toolCalls.get(toolCallId);

        if (tc && !tc.inputEmitted) {
          tc.inputEmitted = true;
          try {
            const args = JSON.parse(tc.argsBuffer);
            yield {
              type: 'tool_input',
              toolCallId,
              toolName: tc.name,
              args,
            };
          } catch (e) {
            console.warn('[LangGraph] Failed to parse tool args:', toolCallId, e);
            yield {
              type: 'tool_input',
              toolCallId,
              toolName: tc.name,
              args: {},
            };
          }
        }

        if (!tc?.outputEmitted) {
          if (tc) tc.outputEmitted = true;
          const output =
            typeof (message as any).content === 'string'
              ? (message as any).content
              : JSON.stringify((message as any).content);
          yield { type: 'tool_output', toolCallId, output };
          sawToolOutput = true;
        }
      }
    }

    // 补发未完成的 tool_output
    for (const [tcId, tc] of toolCalls) {
      if (tc.inputEmitted && !tc.outputEmitted) {
        tc.outputEmitted = true;
        yield {
          type: 'tool_output',
          toolCallId: tcId,
          output: '已执行',
        };
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
