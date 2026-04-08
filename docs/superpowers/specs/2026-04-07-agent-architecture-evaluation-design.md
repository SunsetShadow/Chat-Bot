# Agent 架构评估与改进方案

## 概述

对当前 Chat Bot 项目的 Agent 架构进行全面评估，识别与生产级多 Agent 系统之间的差距，并给出分阶段改进的技术方案。

## 当前架构

### 数据流

```
用户请求 → ChatController → ChatService → LangGraphService → LangGraph StateGraph
                                                      ↑
                                          MemoryService / AgentService / RuleService
```

### LangGraph 工作流

```
START → agent → [有 tool_calls?] → tools → agent → ... → END
```

- 使用 `@langchain/langgraph` 的 `StateGraph` + `MessagesAnnotation`
- `agent` 节点：将 LLM 模型绑定工具后调用
- `tools` 节点：`ToolNode` 预构建节点处理工具调用
- 条件路由：检查最后一条消息是否有 `tool_calls`
- 检查点：`MemorySaver`（内存级别，按 `thread_id` 隔离）

### System Prompt 组装

```
System Prompt = Agent.system_prompt + 启用的规则内容 + 记忆上下文
```

### 关键文件

| 路径 | 用途 |
|------|------|
| `backend/src/modules/langgraph/langgraph.service.ts` | LangGraph 执行引擎 |
| `backend/src/modules/langgraph/graph/graph.builder.ts` | 图拓扑定义 |
| `backend/src/modules/langgraph/graph/nodes/agent.node.ts` | Agent 推理节点 |
| `backend/src/modules/langgraph/tools/memory-extract.tool.ts` | 记忆提取工具（空壳） |
| `backend/src/modules/agent/agent.service.ts` | Agent CRUD + 内置定义 |
| `backend/src/modules/chat/chat.service.ts` | 编排层，协调所有模块 |
| `backend/src/modules/llm/llm.service.ts` | LLM Provider 抽象层（孤立） |
| `backend/src/modules/memory/memory.service.ts` | 记忆 CRUD + 上下文构建 |

## 评估结论

### P0 — 阻塞性问题

| # | 问题 | 现状 |
|---|------|------|
| 1 | 记忆提取工具是空壳 | `memoryExtractTool` 只 `return JSON.stringify(...)`，从未调用 `MemoryService` |
| 2 | Tool 无法访问 DI 容器 | LangChain Tool 是纯函数，无法注入 NestJS 服务 |
| 3 | 无最大迭代保护 | agent→tools 循环无 `recursionLimit`，可能导致无限循环 |
| 4 | 两套 LLM 体系并存 | `llm/` 模块（自研 Provider）和 `langgraph/` 模块互不关联，`LlmService` 是死代码 |

### P1 — 核心功能缺失

| # | 问题 | 现状 |
|---|------|------|
| 5 | 数据持久化 | 所有数据存储在内存 `Map` 中，服务重启后全部丢失 |
| 6 | 上下文管理 | `buildSystemPrompt()` 只做简单拼接，无 token 计算、消息截断、滑动窗口 |
| 7 | 记忆过期与数量限制 | 无过期逻辑，注入全部记忆，无数量限制 |
| 8 | Agent-Tool 动态绑定 | 所有 Agent 共享固定工具列表 `[memoryExtractTool]` |
| 9 | Agent-Model 绑定 | 所有 Agent 使用同一个 `ChatOpenAI` 实例 |
| 10 | Agent traits 未使用 | `traits[]` 字段存在于数据模型但从未融入 system prompt |

### P2 — 多 Agent 协作缺失

| # | 问题 | 现状 |
|---|------|------|
| 11 | 多 Agent 协作模式 | 单 Agent 节点图，无 Supervisor/Router |
| 12 | 动态图拓扑 | 固定线性循环，不支持条件分支、并行执行、子图嵌套 |
| 13 | Agent 间通信 | 无消息传递机制 |
| 14 | 任务分解与规划 | 无任务分解能力 |

### P3 — 生产化缺失

| # | 问题 | 现状 |
|---|------|------|
| 15 | 错误恢复与重试 | LLM 调用失败直接抛异常，无 fallback |
| 16 | Token 使用追踪 | 不记录 token 消耗 |
| 17 | 认证与授权 | 所有 API 无认证守卫 |
| 18 | 速率限制 | 无请求频率限制 |
| 19 | Prompt Injection 防护 | 用户输入直接传给 LLM |
| 20 | 结构化输出 | Agent 节点无 output parser |
| 21 | 流式工具调用反馈 | `chatStream()` 中 `tool_call_chunks` 被 `continue` 跳过 |
| 22 | 可观测性 | 无日志结构化、无 tracing |

## 技术方案

### Phase 1：基础修复

#### 1.1 修复记忆提取工具（解决 DI 集成）

**问题**：LangChain Tool 是纯函数，无法通过 NestJS 依赖注入访问 `MemoryService`。

**方案**：使用工厂模式 + 闭包捕获服务实例。

```typescript
// backend/src/modules/langgraph/tools/memory-extract.tool.ts

import { Inject } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { MemoryService } from '../../memory/memory.service';

export function createMemoryExtractTool(memoryService: MemoryService) {
  return tool(
    async ({ content, memory_type, importance }) => {
      await memoryService.create({
        content,
        type: memory_type,
        importance,
      });
      return JSON.stringify({
        status: 'ok',
        message: `已保存${memory_type}类型记忆`,
      });
    },
    {
      name: 'extract_memory',
      description: '从对话中提取重要信息并保存为长期记忆',
      schema: z.object({
        content: z.string().describe('记忆内容'),
        memory_type: z.enum(['fact', 'preference', 'event']).describe('记忆类型'),
        importance: z.number().min(1).max(10).describe('重要程度 1-10'),
      }),
    },
  );
}
```

```typescript
// backend/src/modules/langgraph/langgraph.service.ts

export class LangGraphService implements OnModuleInit {
  constructor(
    private readonly appConfig: AppConfigService,
    private readonly memoryService: MemoryService,
  ) {}

  onModuleInit() {
    const tools = [createMemoryExtractTool(this.memoryService)];
    // ...
  }
}
```

**敏感信息过滤**：在 tool 内部添加过滤逻辑。

```typescript
const SENSITIVE_PATTERNS = [
  /password/i, /secret/i, /api[_-]?key/i, /token/i, /credential/i,
];

function containsSensitiveInfo(content: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(content));
}

// 在 tool handler 中：
if (containsSensitiveInfo(content)) {
  return JSON.stringify({ status: 'rejected', message: '包含敏感信息，不予保存' });
}
```

#### 1.2 添加最大迭代保护

```typescript
// backend/src/modules/langgraph/graph/graph.builder.ts

export function buildGraph(model: BaseChatModel, tools: Tool[]) {
  const graph = new StateGraph(MessagesAnnotation)
    .addNode('agent', createAgentNode(model, tools))
    .addNode('tools', new ToolNode(tools))
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', routeMessage)
    .addEdge('tools', 'agent');

  return graph.compile({
    checkpointer: new MemorySaver(),
    // 关键：限制最大递归次数，防止无限循环
    maxIterations: 10,
  });
}
```

#### 1.3 统一 LLM 体系

**方案**：将 `llm/` 模块作为底层 Provider 抽象，`langgraph/` 模块作为上层编排，两者通过接口解耦。

```typescript
// backend/src/modules/llm/llm.service.ts

export class LlmService {
  getChatModel(modelId?: string): BaseChatModel {
    const config = modelId
      ? this.modelService.findOne(modelId)
      : this.modelService.getDefault();
    return new ChatOpenAI({
      modelName: config.name,
      openAIApiKey: this.appConfig.openaiApiKey,
      configuration: {
        baseURL: this.appConfig.openaiBaseUrl,
      },
      temperature: config.temperature ?? 0.7,
    });
  }
}
```

```typescript
// backend/src/modules/langgraph/langgraph.service.ts

export class LangGraphService {
  constructor(
    private readonly llmService: LlmService,
    // ...
  ) {}

  async chatStream(sessionId: string, messages: Message[], agentId: string) {
    const agent = this.agentService.findOne(agentId);
    const model = this.llmService.getChatModel(agent.model_id);
    const tools = this.getToolsForAgent(agent);
    const graph = buildGraph(model, tools);
    // ...
  }
}
```

#### 1.4 Agent traits 融入 system prompt

```typescript
// backend/src/modules/chat/chat.service.ts

buildSystemPrompt(agent: Agent, rules: Rule[], memories: Memory[]): string {
  const parts: string[] = [];

  // Agent 角色定义
  parts.push(agent.system_prompt);

  // Agent 性格特征
  if (agent.traits?.length > 0) {
    parts.push(`\n## 性格特征\n${agent.traits.map(t => `- ${t}`).join('\n')}`);
  }

  // 规则
  const enabledRules = rules.filter(r => r.is_enabled);
  if (enabledRules.length > 0) {
    parts.push(`\n## 行为规则\n${enabledRules.map(r => `- ${r.content}`).join('\n')}`);
  }

  // 记忆上下文（限制数量）
  const topMemories = memories
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10);
  if (topMemories.length > 0) {
    parts.push(`\n## 已知用户信息\n${topMemories.map(m => `- [${m.type}] ${m.content}`).join('\n')}`);
  }

  return parts.join('\n');
}
```

### Phase 2：核心能力

#### 2.1 数据持久化

**方案**：使用 SQLite + `better-sqlite3`，通过 NestJS 自定义 Provider 集成。

```typescript
// backend/src/common/database/database.module.ts

@Module({
  providers: [
    {
      provide: 'DATABASE',
      useFactory: () => {
        const db = new Database('./data/chatbot.db');
        db.pragma('journal_mode = WAL');
        return db;
      },
    },
  ],
  exports: ['DATABASE'],
})
export class DatabaseModule {}
```

**迁移策略**：各 Service 从 `Map<string, T>` 迁移到 SQLite 表，接口不变。

```typescript
// backend/src/modules/agent/agent.service.ts

@Injectable()
export class AgentService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  findAll(): Agent[] {
    return this.db.prepare('SELECT * FROM agents').all() as Agent[];
  }

  create(dto: CreateAgentDto): Agent {
    const id = generateId();
    this.db.prepare(
      'INSERT INTO agents (id, name, description, system_prompt, traits, is_builtin, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, dto.name, dto.description, dto.system_prompt, JSON.stringify(dto.traits ?? []), false, new Date().toISOString(), new Date().toISOString());
    return this.findOne(id);
  }
}
```

#### 2.2 上下文管理

**方案**：实现 token 计算和滑动窗口截断。

```typescript
// backend/src/modules/chat/context-manager.ts

export class ContextManager {
  private readonly maxTokens: number;
  private readonly systemPromptReserve: number;

  constructor(maxTokens = 8000, systemPromptReserve = 2000) {
    this.maxTokens = maxTokens;
    this.systemPromptReserve = systemPromptReserve;
  }

  /**
   * 估算消息的 token 数（简易方案：字符数 / 3）
   * 生产环境建议使用 tiktoken
   */
  estimateTokens(content: string): number {
    return Math.ceil(content.length / 3);
  }

  /**
   * 截断消息列表，保留系统消息 + 最近的消息
   */
  truncateMessages(messages: Message[], systemPromptTokens: number): Message[] {
    const availableTokens = this.maxTokens - this.systemPromptReserve - systemPromptTokens;
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    let usedTokens = 0;
    const kept: Message[] = [];
    // 从最新消息开始保留
    for (let i = conversationMessages.length - 1; i >= 0; i--) {
      const msg = conversationMessages[i];
      const tokens = this.estimateTokens(msg.content);
      if (usedTokens + tokens > availableTokens) break;
      kept.unshift(msg);
      usedTokens += tokens;
    }

    return [...systemMessages, ...kept];
  }
}
```

#### 2.3 记忆过期与数量限制

```typescript
// backend/src/modules/memory/memory.service.ts

interface MemoryWithExpiry extends Memory {
  expires_at?: Date;
}

// 过期策略
const EXPIRY_DAYS: Record<string, number> = {
  fact: 365,       // 事实长期有效
  preference: 30,  // 偏好 30 天过期
  event: 7,        // 事件 7 天过期
};

getActiveMemories(): Memory[] {
  const now = new Date();
  return this.memories
    .filter(m => {
      const expiresAt = newExpiryDate(m);
      return !expiresAt || expiresAt > now;
    })
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 10); // 最多注入 10 条
}

function newExpiryDate(memory: Memory): Date | null {
  const days = EXPIRY_DAYS[memory.type];
  if (!days) return null;
  const createdAt = new Date(memory.created_at);
  return new Date(createdAt.getTime() + days * 24 * 60 * 60 * 1000);
}
```

#### 2.4 Agent 配置扩展

**数据模型扩展**：

```typescript
export interface Agent {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  traits: string[];
  is_builtin: boolean;
  // 新增字段
  model_id?: string;        // 绑定的模型 ID，空则使用默认模型
  tool_ids?: string[];      // 绑定的工具 ID 列表，空则使用默认工具集
  temperature?: number;     // 温度参数覆盖
  max_tokens?: number;      // 最大输出 token
  created_at?: Date;
  updated_at?: Date;
}
```

**动态工具加载**：

```typescript
// backend/src/modules/langgraph/tool-registry.ts

@Injectable()
export class ToolRegistry {
  private readonly toolMap = new Map<string, DynamicTool>();

  constructor() {
    // 注册内置工具
    this.register(memoryExtractTool);
  }

  register(tool: DynamicTool): void {
    this.toolMap.set(tool.name, tool);
  }

  getTools(toolIds: string[]): Tool[] {
    if (!toolIds || toolIds.length === 0) {
      return Array.from(this.toolMap.values());
    }
    return toolIds
      .map(id => this.toolMap.get(id))
      .filter(Boolean) as Tool[];
  }
}
```

#### 2.5 流式工具调用反馈

```typescript
// backend/src/modules/langgraph/langgraph.service.ts

async *chatStream(sessionId: string, messages: Message[], agentId: string) {
  const stream = await this.graph.stream(
    { messages: this.buildMessages(messages) },
    { configurable: { thread_id: sessionId }, streamMode: 'messages' },
  );

  for await (const [msg, metadata] of stream) {
    if (msg instanceof AIMessageChunk) {
      // 处理内容块
      if (msg.content && msg.content.length > 0) {
        yield { type: 'content_delta', content: msg.content };
      }
      // 处理工具调用块（不再跳过）
      if (msg.tool_call_chunks?.length > 0) {
        for (const chunk of msg.tool_call_chunks) {
          yield {
            type: 'tool_call_delta',
            toolName: chunk.name,
            args: chunk.args,
          };
        }
      }
    }
  }
}
```

### Phase 3：多 Agent 协作

#### 3.1 Supervisor 模式

**架构**：引入 Supervisor Agent 负责任务分解和分发。

```
START → supervisor → [意图识别]
                      ├── 简单问答 → single_agent → END
                      ├── 编程任务 → code_agent → END
                      ├── 写作任务 → writer_agent → END
                      └── 复杂任务 → [分解子任务] → 多 Agent 并行 → 汇总 → END
```

**实现方案**：

```typescript
// backend/src/modules/langgraph/graph/supervisor.builder.ts

export function buildSupervisorGraph(agents: Map<string, CompiledGraph>) {
  const supervisorNode = createSupervisorNode(agents);
  const routerNode = createRouterNode();

  const graph = new StateGraph(SupervisorStateAnnotation)
    .addNode('supervisor', supervisorNode)
    .addNode('router', routerNode)
    // 注册各子 Agent
    .addNode('code_agent', agents.get('code')!)
    .addNode('writer_agent', agents.get('writer')!)
    .addNode('general_agent', agents.get('general')!)
    .addEdge(START, 'supervisor')
    .addConditionalEdges('supervisor', routeToAgent)
    .addEdge('code_agent', 'supervisor')
    .addEdge('writer_agent', 'supervisor')
    .addEdge('general_agent', 'supervisor');

  return graph.compile({ maxIterations: 20 });
}
```

**Supervisor State**：

```typescript
const SupervisorStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer }),
  currentAgent: Annotation<string>(),
  taskPlan: Annotation<TaskPlan>(),
  subResults: Annotation<Map<string, string>>({ reducer: mergeSubResults }),
});
```

#### 3.2 动态图构建

**方案**：根据 Agent 配置动态生成图拓扑。

```typescript
// backend/src/modules/langgraph/graph/dynamic.builder.ts

export function buildDynamicGraph(config: AgentGraphConfig): CompiledGraph {
  const model = llmService.getChatModel(config.model_id);
  const tools = toolRegistry.getTools(config.tool_ids);

  const graph = new StateGraph(MessagesAnnotation)
    .addNode('agent', createAgentNode(model, tools));

  // 根据配置决定是否添加工具节点
  if (tools.length > 0) {
    graph
      .addNode('tools', new ToolNode(tools))
      .addConditionalEdges('agent', routeMessage)
      .addEdge('tools', 'agent');
  } else {
    graph.addEdge('agent', END);
  }

  // 根据配置添加预处理节点（如输入清洗）
  if (config.preprocessing) {
    graph
      .addNode('preprocess', createPreprocessNode(config.preprocessing))
      .addEdge(START, 'preprocess')
      .addEdge('preprocess', 'agent');
  } else {
    graph.addEdge(START, 'agent');
  }

  return graph.compile({
    checkpointer: new MemorySaver(),
    maxIterations: config.maxIterations ?? 10,
  });
}
```

#### 3.3 Agent 间消息传递

```typescript
// backend/src/modules/langgraph/graph/nodes/agent-communication.ts

interface AgentMessage {
  from: string;    // 发送方 Agent ID
  to: string;      // 接收方 Agent ID
  content: string;
  metadata?: Record<string, unknown>;
}

const AgentCommunicationAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer }),
  agentMessages: Annotation<AgentMessage[]>({ reducer: appendAgentMessage }),
  currentAgent: Annotation<string>(),
});
```

### Phase 4：生产化

#### 4.1 错误恢复与重试

```typescript
// backend/src/modules/langgraph/graph/nodes/resilient-agent.node.ts

export function createResilientAgentNode(model: BaseChatModel, tools: Tool[]) {
  return async (state: typeof MessagesAnnotation.State) => {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await model.bindTools(tools).invoke(state.messages);
        return { messages: [response] };
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          // 指数退避：1s, 2s, 4s
          await new Promise(resolve =>
            setTimeout(resolve, Math.pow(2, attempt - 1) * 1000)
          );
        }
      }
    }

    // 所有重试失败，返回错误消息
    return {
      messages: [
        new AIMessage(`抱歉，处理请求时遇到错误：${lastError?.message}`),
      ],
    };
  };
}
```

#### 4.2 Token 使用追踪

```typescript
// backend/src/modules/llm/token-tracker.ts

@Injectable()
export class TokenTracker {
  private usage = new Map<string, { input: number; output: number; timestamp: Date }>();

  track(sessionId: string, inputTokens: number, outputTokens: number): void {
    this.usage.set(sessionId, {
      input: inputTokens,
      output: outputTokens,
      timestamp: new Date(),
    });
  }

  getUsage(sessionId: string): { input: number; output: number } | null {
    return this.usage.get(sessionId) ?? null;
  }

  getDailyTotal(): { input: number; output: number } {
    const today = new Date().toDateString();
    return Array.from(this.usage.values())
      .filter(u => u.timestamp.toDateString() === today)
      .reduce(
        (acc, u) => ({ input: acc.input + u.input, output: acc.output + u.output }),
        { input: 0, output: 0 },
      );
  }
}
```

#### 4.3 可观测性

```typescript
// backend/src/common/interceptors/agent-trace.interceptor.ts

@Injectable()
export class AgentTraceInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const traceId = generateId();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        logger.info('Agent trace', {
          traceId,
          duration,
          // 可扩展：记录 Agent 决策链路、工具调用次数等
        });
      }),
    );
  }
}
```

## 实施路线图

```
Phase 1 (基础修复) ← 当前
├── 1.1 修复 memoryExtractTool + DI 集成
├── 1.2 添加 recursionLimit
├── 1.3 统一 llm/ 与 langgraph/ 的关系
└── 1.4 Agent traits 融入 system prompt

Phase 2 (核心能力)
├── 2.1 数据持久化（SQLite）
├── 2.2 上下文管理（token 计算 + 消息截断）
├── 2.3 记忆过期与数量限制
├── 2.4 Agent 配置扩展（工具集 + 模型绑定）
└── 2.5 流式工具调用反馈

Phase 3 (多 Agent 协作)
├── 3.1 Supervisor 模式
├── 3.2 动态图构建
└── 3.3 Agent 间消息传递

Phase 4 (生产化)
├── 4.1 错误恢复与重试
├── 4.2 Token 使用追踪
└── 4.3 可观测性
```

## 不做的事

- 不引入新的 LLM 框架（继续使用 LangGraph）
- 不做前端 UI 改造（仅后端架构演进）
- 不引入消息队列或微服务（保持单体架构）
- 不实现认证授权（属于独立安全模块，不在本次范围内）
