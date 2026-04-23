import { Injectable, OnModuleInit } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import {
  HumanMessage,
  SystemMessage,
  AIMessageChunk,
  AIMessage,
} from '@langchain/core/messages';
import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { AppConfigService } from '../../config/config.service';
import { ToolRegistryService } from './tools/tool-registry.service';
import { AgentService } from '../agent/agent.service';
import { AgentEntity } from '../../common/entities/agent.entity';
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
  | { type: 'avatar_action'; payload: { action: string; [key: string]: unknown } }
  | { type: 'finish'; finishReason: string };

@Injectable()
export class LangGraphService implements OnModuleInit {
  private model: ChatOpenAI;
  private singleAgentGraph: CompiledStateGraph<any, any, any>;
  private supervisorGraph: CompiledStateGraph<any, any, any> | null = null;
  private executorGraph: CompiledStateGraph<any, any, any> | null = null;
  private standaloneGraphs = new Map<string, CompiledStateGraph<any, any, any>>();
  private graphVersion = 0;
  private rebuildNeeded = false;

  /** 不参与 supervisor 路由的 agent ID（仅供内部执行调用） */
  private static readonly HIDDEN_AGENTS = ['builtin-job-executor'];

  /** Ani 超级助手的固定 ID */
  private static readonly ANI_ID = 'ani';

  /** 默认最大 handoff 次数，防止 Agent 间无限乒乓 */
  private static readonly DEFAULT_MAX_HANDOFFS = 5;

  constructor(
    private configService: AppConfigService,
    private toolRegistry: ToolRegistryService,
    private agentService: AgentService,
  ) {}

  async onModuleInit() {
    this.model = this.createModel(this.configService.openaiModel);
    // 图构建延迟到 LangGraphModule.onModuleInit 注册完工具后调用 initGraph()
  }

  /** 由 LangGraphModule.onModuleInit 在工具注册完成后调用 */
  async initGraph() {
    const tools = this.toolRegistry.getAll();
    console.log(`[LangGraphService] initGraph: ${tools.length} tools registered: ${tools.map(t => t.name)}`);
    this.singleAgentGraph = buildGraph(this.model, tools);
    await this.rebuildSupervisorGraph();
    await this.rebuildExecutorGraph();
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

    const allTools = this.toolRegistry.getAll();

    const definitions: AgentDefinition[] = agents
      .filter((a) => !LangGraphService.HIDDEN_AGENTS.includes(a.id))
      .map((a) => {
        const hintTools = this.getHintTools(a);
        return {
          id: a.id,
          name: a.name,
          system_prompt: this.buildPromptWithToolHints(a.system_prompt, hintTools),
          capabilities: a.capabilities || a.description,
          tools: a.tools || [],
          model_name: a.model_name || undefined,
          temperature: a.temperature ?? undefined,
          enabled: a.enabled !== false,
          is_system: a.is_system,
        };
      });

    this.supervisorGraph = buildSupervisorGraph(
      this.model,
      definitions,
      (name) => this.toolRegistry.get(name),
      (modelName) => this.createModel(modelName),
      allTools,
    );
    this.graphVersion++;
  }

  /**
   * 构建定时任务执行器的独立图（不经过 supervisor）
   */
  async rebuildExecutorGraph() {
    const agents = await this.agentService.findAll();
    const executorDef = agents.find((a) => a.id === 'builtin-job-executor');
    if (!executorDef) return;

    const agentTools = (executorDef.tools || [])
      .map((name) => this.toolRegistry.get(name))
      .filter((t): t is DynamicStructuredTool => t !== undefined);

    const hintTools = this.getHintTools(executorDef);
    const agent = createReactAgent({
      llm: this.model as any,
      tools: agentTools as any,
      prompt: this.buildPromptWithToolHints(executorDef.system_prompt, hintTools),
      name: executorDef.id,
    });

    this.executorGraph = agent as any;
  }

  /**
   * 以指定 Agent 身份执行指令（供 CronJobService 调用）
   * @param allowedTools 可选工具白名单，仅使用指定的工具子集
   */
  async executeAsAgent(instruction: string, sessionId: string, allowedTools?: string[]): Promise<string> {
    // 有白名单时按白名单动态构建执行图，否则用默认图
    let graph = this.executorGraph;

    if (allowedTools && allowedTools.length > 0) {
      graph = await this.buildFilteredExecutorGraph(allowedTools);
    } else {
      if (!graph) {
        await this.rebuildExecutorGraph();
        graph = this.executorGraph;
      }
    }

    if (!graph) return '[错误] 执行器 Agent 不可用';

    const result = (await graph.invoke(
      { messages: [{ role: 'user', content: instruction }] },
      { configurable: { thread_id: sessionId } },
    )) as any;

    const lastMsg = result.messages[result.messages.length - 1];
    return lastMsg?.content || '';
  }

  /**
   * 按白名单过滤工具，动态构建执行器图
   */
  private async buildFilteredExecutorGraph(allowedTools: string[]): Promise<CompiledStateGraph<any, any, any>> {
    const agents = await this.agentService.findAll();
    const executorDef = agents.find((a) => a.id === 'builtin-job-executor');
    if (!executorDef) throw new Error('执行器 Agent 不存在');

    const agentTools = allowedTools
      .map((name) => this.toolRegistry.get(name))
      .filter((t): t is DynamicStructuredTool => t !== undefined);

    const agent = createReactAgent({
      llm: this.model as any,
      tools: agentTools as any,
      prompt: this.buildPromptWithToolHints(executorDef.system_prompt, allowedTools),
      name: executorDef.id,
    });

    return agent as any;
  }

  private stripLegacyToolHints(prompt: string): string {
    const markers = ['\n\n【可用工具】\n', '\n\n可用工具：\n'];
    for (const marker of markers) {
      const idx = prompt.lastIndexOf(marker);
      if (idx !== -1) return prompt.slice(0, idx);
    }
    return prompt;
  }

  private buildPromptWithToolHints(systemPrompt: string, tools?: string[]): string {
    const prompt = this.stripLegacyToolHints(systemPrompt || '');
    if (!tools || tools.length === 0) return prompt;

    const lines = tools
      .map((name, i) => {
        const meta = this.toolRegistry.getMetadata(name);
        return meta ? `(${i + 1}) ${name}：${meta.description}。` : null;
      })
      .filter(Boolean);

    if (lines.length === 0) return prompt;

    return prompt + '\n\n【可用工具】\n' + lines.join('\n');
  }

  private getHintTools(agent: AgentEntity): string[] {
    return agent.is_system ? this.toolRegistry.getAllNames() : (agent.tools || []);
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
    this.standaloneGraphs.clear();
  }

  /**
   * 根据选择的 Agent 获取合适的图：
   * - standalone Agent → 该 Agent 的独立图
   * - 否则 → supervisorGraph || singleAgentGraph
   */
  private async getGraph(
    preferredAgent?: string,
  ): Promise<CompiledStateGraph<any, any, any>> {
    if (this.rebuildNeeded) {
      this.rebuildNeeded = false;
      await this.rebuildSupervisorGraph();
    }

    if (preferredAgent) {
      try {
        const agent = await this.agentService.findOne(preferredAgent);
        if (agent.standalone) {
          return this.buildStandaloneGraph(agent);
        }
      } catch {
        // Agent 不存在，回退到默认逻辑
      }
    }

    return this.supervisorGraph || this.singleAgentGraph;
  }

  /**
   * 为指定 Agent 构建独立图（不经过 Supervisor）
   */
  private buildStandaloneGraph(agent: AgentEntity): CompiledStateGraph<any, any, any> {
    const cached = this.standaloneGraphs.get(agent.id);
    if (cached) return cached;

    const agentTools = (agent.tools || [])
      .map((name) => this.toolRegistry.get(name))
      .filter((t): t is DynamicStructuredTool => t !== undefined);

    let agentModel: ChatOpenAI = this.model;
    if (agent.model_name) {
      agentModel = this.createModel(agent.model_name);
    }
    if (agent.temperature !== undefined && agent.temperature !== null) {
      agentModel = new ChatOpenAI({
        modelName: (agentModel as any).modelName || (agentModel as any).lc_kwargs?.modelName,
        openAIApiKey: (agentModel as any).lc_kwargs?.openAIApiKey,
        configuration: (agentModel as any).lc_kwargs?.configuration,
        streaming: true,
        temperature: agent.temperature,
      });
    }

    const agentIdHint = `\n\n[Agent 身份] 你的 Agent ID 是 "${agent.id}"。调用 extract_memory 或 knowledge_query 工具时，请传入 agent_id="${agent.id}" 以确保记忆隔离。`;

    const graph = createReactAgent({
      llm: agentModel,
      tools: agentTools,
      prompt: this.buildPromptWithToolHints(agent.system_prompt, agent.tools) + agentIdHint,
      name: agent.id,
      checkpointer: new MemorySaver(),
    }) as unknown as CompiledStateGraph<any, any, any>;

    this.standaloneGraphs.set(agent.id, graph);
    return graph;
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
    const langchainMessages = this.buildMessages(messages, systemPrompt, preferredAgent);
    const graph = await this.getGraph(preferredAgent);

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
    const langchainMessages = this.buildMessages(messages, systemPrompt, preferredAgent);
    const graph = await this.getGraph(preferredAgent);

    // 确定 handoff 上限
    let maxHandoffs = LangGraphService.DEFAULT_MAX_HANDOFFS;
    if (preferredAgent) {
      try {
        const agent = await this.agentService.findOne(preferredAgent);
        if (agent.max_turns && agent.max_turns > 0) {
          maxHandoffs = agent.max_turns;
        }
      } catch {
        // 使用默认值
      }
    }

    const isHandoffTool = (name: string) =>
      name.startsWith('transfer_to_') || name === 'transfer_back_to_supervisor';

    let sawToolOutput = false;
    let currentAgent = '';
    let handoffCount = 0;
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
          handoffCount++;
          if (handoffCount > maxHandoffs) {
            yield {
              type: 'text',
              content: `[系统提示] 检测到过多的 Agent 切换（${handoffCount} 次），为避免循环已终止流转。请简化问题或指定特定助手。`,
            };
            yield { type: 'finish', finishReason: 'max_handoffs_exceeded' };
            return;
          }
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
          // 过滤 Supervisor 内部文本：handoff 提示 + 路由推理
          const content = aiMsg.content;
          const isFromSupervisor = agentName === 'supervisor';
          if (isFromSupervisor) {
            // Supervisor 的文本输出属于内部路由决策，不展示给用户
            continue;
          }
          if (content !== 'Transferring back to supervisor') {
            yield { type: 'text', content };
          }
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
              const isFromSupervisor = agentName === 'supervisor';
              // Supervisor 只应使用 handoff 工具，过滤其所有工具调用（含非 handoff 的错误调用）
              if (isHandoffTool(tcName) || isFromSupervisor) {
                toolCalls.set(tcId, {
                  name: tcName,
                  argsBuffer: '',
                  inputEmitted: true,   // 标记已处理，避免补发
                  outputEmitted: true,  // 标记已完成，避免补发
                });
                indexToId.set(idx, tcId);
                continue;
              }
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
            if (tc && (isHandoffTool(tc.name) || tc.inputEmitted)) continue;
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
              yield* emitToolInput(tcId, tc);
            }
          }
        }
      }

      if (isTool) {
        const toolCallId =
          (message as any).tool_call_id || (message as any).id || '';
        const tc = toolCalls.get(toolCallId);
        const rawContent = (message as any).content;
        const outputStr = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent);

        // 跳过已知 handoff 工具和已标记的 Supervisor 工具调用输出
        if (tc && (isHandoffTool(tc.name) || tc.outputEmitted)) {
          tc.outputEmitted = true;
          continue;
        }

        // 内容过滤：Supervisor 的 ToolNode 错误（ID 不一致时 tc 查找失败）
        if (isToolNodeError(outputStr)) {
          if (tc) tc.outputEmitted = true;
          continue;
        }

        // 兜底：框架内部创建的 handoff 工具
        if (!tc && outputStr.includes('transferred back to supervisor')) {
          continue;
        }

        if (tc && !tc.inputEmitted) {
          tc.inputEmitted = true;
          yield* emitToolInput(toolCallId, tc);
        }

        if (!tc?.outputEmitted) {
          if (tc) tc.outputEmitted = true;
          yield { type: 'tool_output', toolCallId, output: outputStr };
          sawToolOutput = true;

          // Avatar 工具拦截：解析工具输出并发射 avatar_action 事件
          if (tc && (tc.name === 'express_emotion' || tc.name === 'play_motion')) {
            try {
              const payload = JSON.parse(outputStr);
              yield { type: 'avatar_action', payload };
            } catch {
              // 解析失败静默忽略
            }
          }
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
      }
    }

    yield { type: 'finish', finishReason: 'stop' };
  }

  private buildMessages(
    messages: { role: string; content: string }[],
    systemPrompt: string,
    preferredAgent?: string,
  ) {
    const result: any[] = [];
    if (systemPrompt) {
      result.push(new SystemMessage(systemPrompt));
    }
    // 注入 preferredAgent 偏好提示，让 supervisor 在路由时感知用户选择
    if (preferredAgent) {
      result.push(new SystemMessage(
        `[路由偏好] 用户当前选择了助手 "${preferredAgent}"。对于该助手能力范围内的简单请求，请优先路由到该助手。对于需要多助手协作的复杂任务，请按照编排规则自由调度最合适的助手组合，不必局限于偏好助手。`,
      ));
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

/** 检测 ToolNode 内部错误（Supervisor 错误调用 worker 工具时产生） */
function isToolNodeError(output: string): boolean {
  return (
    (output.includes('Tool "') && output.includes('not found')) ||
    output.includes('Please fix your mistakes') ||
    output.includes('Received tool input did not match expected schema')
  );
}

/** 从 tool call buffer 解析并 emit tool_input 事件 */
function* emitToolInput(
  tcId: string,
  tc: { name: string; argsBuffer: string },
): Generator<StreamEvent> {
  try {
    const args = JSON.parse(tc.argsBuffer);
    yield { type: 'tool_input', toolCallId: tcId, toolName: tc.name, args };
  } catch (e) {
    console.warn('[LangGraph] Failed to parse tool args:', tcId, e);
    yield { type: 'tool_input', toolCallId: tcId, toolName: tc.name, args: {} };
  }
}
