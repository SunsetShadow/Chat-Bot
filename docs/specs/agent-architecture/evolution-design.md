# Agent 架构演进设计

> 基于前沿 Agent 设计模式研究，结合项目现状制定的完整架构演进方案。
> 日期：2026-04-11

## 设计原则

1. **从简到繁** — 每阶段独立可交付，不依赖后续阶段（Anthropic 核心建议）
2. **工具设计优先** — 投资工具接口（ACI），比 prompt 更影响 Agent 质量
3. **LangGraph 原生** — 沿用 LangGraph JS 编排，利用其 checkpointing / streaming / multi-agent 原生能力
4. **NestJS 模块化** — 工具和记忆作为 NestJS Injectable，通过 DI 注入，可测试可替换

## 当前架构

```
START → agent → [有 tool_calls?] → tools → agent → ... → END
```

- 单 Agent + 单 ToolNode（仅 memory-extract，且为空壳）
- MemorySaver 内存级 checkpoint，重启丢失
- 所有数据存内存 Map
- 无 token 管理、无错误重试、无安全防护

## 目标架构

```
START → Supervisor → [意图路由]
                      ├── handoff_to_general → GeneralAgent → [tools?] → END
                      ├── handoff_to_coder   → CoderAgent   → [tools?] → END
                      ├── handoff_to_writer  → WriterAgent  → [tools?] → END
                      └── 直接回答 → END
```

- Supervisor 路由 + 多 Worker Agent
- SQLite 持久化 + LangGraph SqliteSaver
- 三层记忆 + Token 预算管理
- 完整错误恢复 + 可观测性

---

## Phase 1：基础修复（1-2 周）

> 解决阻塞问题，让单 Agent 可靠运行。

### 1.1 Tool DI 桥接

**问题**：LangChain Tool 是纯函数，无法注入 NestJS 服务。memoryExtractTool 是空壳。

**方案**：ToolRegistry + 工厂模式。

```
ToolRegistry (NestJS Injectable)
  ├── register(name, factory: (services) => DynamicTool)
  ├── getTools(toolIds?: string[]) → DynamicTool[]
  └── 内部持有 MemoryService 等 DI 服务引用
```

```typescript
// backend/src/modules/langgraph/tools/tool-registry.ts
@Injectable()
export class ToolRegistry {
  private readonly toolFactories = new Map<string, ToolFactory>();

  constructor(private readonly memoryService: MemoryService) {
    this.register('extract_memory', (services) =>
      createMemoryExtractTool(services.memoryService)
    );
  }

  register(name: string, factory: ToolFactory) {
    this.toolFactories.set(name, factory);
  }

  getTools(toolIds?: string[]): DynamicTool[] {
    const factories = toolIds
      ? toolIds.map((id) => this.toolFactories.get(id)).filter(Boolean)
      : Array.from(this.toolFactories.values());

    return factories.map((f) =>
      f({ memoryService: this.memoryService })
    );
  }
}
```

记忆提取工具增加敏感信息过滤：

```typescript
const SENSITIVE_PATTERNS = [
  /password/i, /secret/i, /api[_-]?key/i, /token/i, /credential/i,
];

function containsSensitiveInfo(content: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.test(content));
}
```

### 1.2 递归限制 + 错误自愈

**问题**：agent→tools 循环无 recursionLimit，工具错误直接抛异常。

**方案**：

```typescript
// graph.builder.ts
const graph = builder.compile({
  checkpointer: new MemorySaver(),
});

// 调用时限制
graph.invoke(inputs, { recursion_limit: 25 });

// ToolNode 启用错误自愈
const toolNode = new ToolNode(tools, { handleToolErrors: true });
```

`handleToolErrors: true` 将工具错误包装为 ToolMessage 返回 LLM，让模型自行修正参数。

### 1.3 统一 LLM 体系

**问题**：`llm/` 模块和 `langgraph/` 模块是两套独立体系，`LlmService` 是死代码。

**方案**：移除 `llm/` 模块，其职责（模型配置、Provider 切换）合并到 `LangGraphService`。

```typescript
// langgraph.service.ts
getChatModel(modelId?: string): BaseChatModel {
  const modelName = modelId || this.appConfig.openaiModel;
  return new ChatOpenAI({
    modelName,
    openAIApiKey: this.appConfig.openaiApiKey,
    configuration: { baseURL: this.appConfig.openaiBaseUrl },
    streaming: true,
  });
}
```

### 1.4 Agent traits 融入 system prompt

```typescript
buildSystemPrompt(agent: Agent, rules: Rule[], memories: Memory[]): string {
  const parts: string[] = [agent.system_prompt];

  if (agent.traits?.length > 0) {
    parts.push(`\n## 性格特征\n${agent.traits.map((t) => `- ${t}`).join('\n')}`);
  }

  const enabledRules = rules.filter((r) => r.enabled);
  if (enabledRules.length > 0) {
    parts.push(`\n## 行为规则\n${enabledRules.map((r) => `- ${r.content}`).join('\n')}`);
  }

  if (memories.length > 0) {
    parts.push(`\n## 已知用户信息\n${memories.map((m) => `- [${m.type}] ${m.content}`).join('\n')}`);
  }

  return parts.join('\n');
}
```

### Phase 1 交付物

- [ ] `tool-registry.ts` — ToolRegistry 实现
- [ ] `memory-extract.tool.ts` — 修复为实际调用 MemoryService
- [ ] `graph.builder.ts` — 添加 recursion_limit + handleToolErrors
- [ ] 移除 `llm/` 模块，职责合并到 LangGraphService
- [ ] `chat.service.ts` — buildSystemPrompt 融入 traits

---

## Phase 2：核心能力（2-3 周）

> 数据持久化、上下文管理、记忆系统。

### 2.1 数据持久化：SQLite

使用 `better-sqlite3`，通过 NestJS 自定义 Provider 集成。

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

各 Service 从 `Map<string, T>` 迁移到 SQLite 表。同时引入 LangGraph 的 `SqliteSaver` 替换 `MemorySaver`，对话状态自动持久化。

### 2.2 Token 预算管理

按 Anthropic 推荐的优先级分层分配：

```
┌─────────────────────────────────────┐
│ Protected（不可压缩）                │
│   system prompt + 当前用户查询       │
├─────────────────────────────────────┤
│ High（~30% 剩余窗口）               │
│   当前工具调用结果 + 检索记忆         │
├─────────────────────────────────────┤
│ Medium（~25% 剩余窗口）             │
│   近 5 轮对话历史                    │
├─────────────────────────────────────┤
│ Low（剩余空间）                      │
│   压缩后的旧历史（结构化摘要）        │
└─────────────────────────────────────┘
```

```typescript
// backend/src/modules/chat/token-budget-manager.ts
export class TokenBudgetManager {
  constructor(
    private readonly contextLimit: number = 128000,
    private readonly outputReserve: number = 4000,
  ) {}

  prepareContext(parts: ContextParts): PreparedContext {
    const budget = this.contextLimit - this.outputReserve;

    // 1. Protected：始终包含
    let used = this.estimateTokens(parts.systemPrompt + parts.currentQuery);
    let remaining = budget - used;

    // 2. High：工具结果 + 记忆
    const highTokens = Math.min(remaining * 0.3, this.estimateTokens(parts.toolResults));
    remaining -= highTokens;

    // 3. Medium：近 5 轮
    // 4. Low：摘要后的旧历史
    // ...
  }

  estimateTokens(content: string): number {
    return Math.ceil(content.length / 3); // Phase 2 用估算，Phase 4 换 tiktoken
  }
}
```

超过 8-12 轮自动触发结构化摘要，80 token 的摘要替代 2000 token 的原始历史。

### 2.3 三层记忆架构

```
短期记忆 (Short-term)
  └── LangGraph SqliteSaver（thread-scoped）
      - 对话历史自动持久化
      - 按 thread_id 隔离
      - 不再需要 buildMessages() 手动重建

工作记忆 (Working)
  └── LangGraph State Annotation
      - 图节点间共享的中间状态
      - 任务计划、工具调用结果

长期记忆 (Long-term)
  └── MemoryService（SQLite memories 表）
      - 语义记忆：用户偏好、事实知识
      - 情节记忆：重要对话事件
      - 按 importance (1-10) 排序
      - 注入前 Top 10，按类型过期：
        - fact: 永不过期
        - preference: 30 天
        - event: 7 天
      - 记忆提取通过 Phase 1 修复的工具实际写入
```

### 2.4 Agent 配置扩展

```typescript
interface Agent {
  id: string;
  name: string;
  description: string;
  system_prompt: string;
  traits: string[];
  is_builtin: boolean;
  // 新增
  model_id?: string;      // 绑定模型，空则用默认
  tool_ids?: string[];    // 绑定工具集，空则全部可用
  temperature?: number;   // 温度覆盖
}
```

### 2.5 流式增强

扩展 LangGraph streaming 为多模式：

```typescript
const stream = graph.stream(inputs, {
  streamMode: ['messages', 'updates'],
  version: 'v2',
});

for await (const chunk of stream) {
  if (chunk.type === 'messages') {
    // token 级流式（已有）
  } else if (chunk.type === 'updates') {
    // 节点状态变更 → 前端可显示步骤进度
    yield { event: 'step_update', data: chunk.data };
  }
}
```

前端 `useChatTransport.ts` 增加 `step_update` 事件处理，ChatContainer 可展示当前执行步骤。

### Phase 2 交付物

- [ ] `DatabaseModule` — SQLite 集成
- [ ] 各 Service 迁移到 SQLite
- [ ] `SqliteSaver` 替换 `MemorySaver`
- [ ] `TokenBudgetManager` 实现
- [ ] 记忆过期逻辑（fact/preference/event）
- [ ] Agent 模型扩展 + CRUD 更新
- [ ] 流式增强（updates 模式）

---

## Phase 3：多 Agent 协作（3-4 周）

> 从单 Agent 演进到 Supervisor + Worker 架构。

### 3.1 架构：Supervisor + Agent-as-Tool

```
用户请求
  │
  ▼
┌─────────────┐
│  Supervisor  │ ← 轻量路由 Agent（可用小模型）
│  (路由+分发) │
└──────┬──────┘
       │ 意图识别 → handoff
       ├──► General Agent（通用聊天）
       ├──► Coder Agent（编程助手，代码工具集）
       ├──► Writer Agent（写作助手，文档工具集）
       └──► Custom Agent（用户自定义）
```

**为什么选 Supervisor**：
- Agent 角色差异明确（聊天/编程/写作），适合中央路由
- 调试简单，链路清晰
- 与单 Agent 架构演进路径自然（在现有 Agent 上加一层路由）
- 不选 Swarm：当前场景不需要 Agent 间对等协作

### 3.2 Handoff 机制

Supervisor 持有 handoff 工具，调用时通过 Command 切换到目标 Agent：

```typescript
function createHandoffTool(targetAgentName: string, description: string) {
  return tool(
    async ({ reason }: { reason: string }, config: RunnableConfig) => {
      return new Command({
        goto: targetAgentName,
        update: {
          messages: [
            { role: 'system', content: `已切换到 ${targetAgentName}。原因：${reason}` },
          ],
        },
      });
    },
    {
      name: `handoff_to_${targetAgentName}`,
      description,
      schema: z.object({
        reason: z.string().describe('切换到该 Agent 的原因'),
      }),
    }
  );
}
```

### 3.3 图拓扑

```
START → supervisor ──┬── handoff_to_general → general_agent → [tools?] → END
                     ├── handoff_to_coder   → coder_agent   → [tools?] → END
                     ├── handoff_to_writer  → writer_agent  → [tools?] → END
                     └── 直接回答 → END
```

- 每个 Worker Agent 有独立 system prompt + tool set
- 对话历史在 handoff 时通过 Command.update 传递
- Worker 需要另一个 Worker 的能力时，返回 handoff 回到 supervisor

### 3.4 动态图构建

根据数据库中的 Agent 配置，运行时动态构建图拓扑：

```typescript
// backend/src/modules/langgraph/graph/dynamic.builder.ts
export class DynamicGraphBuilder {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly llmService: LangGraphService,
  ) {}

  buildGraph(agents: Agent[]): CompiledGraph {
    const supervisorTools = agents.map((agent) =>
      createHandoffTool(agent.id, agent.description)
    );

    const builder = new StateGraph(MessagesAnnotation)
      .addNode('supervisor', createSupervisorNode(supervisorTools));

    for (const agent of agents) {
      const tools = this.toolRegistry.getTools(agent.tool_ids);
      const model = this.llmService.getChatModel(agent.model_id);
      builder
        .addNode(agent.id, createAgentNode(model, tools, agent))
        .addConditionalEdges(agent.id, routeMessage);
    }

    builder
      .addEdge(START, 'supervisor')
      .addConditionalEdges('supervisor', routeToAgent);

    return builder.compile({
      checkpointer: sqliteSaver,
    });
  }
}
```

新增/删除 Agent 时，重建图并缓存（按 Agent 列表 hash 做 cache key）。

### Phase 3 交付物

- [ ] `DynamicGraphBuilder` — 动态图构建器
- [ ] `createHandoffTool` — Handoff 工具工厂
- [ ] `supervisor.node.ts` — Supervisor 节点（路由 + 直接回答）
- [ ] 内置 Agent 定义（General / Coder / Writer）
- [ ] 前端 SSE 事件扩展（支持 agent_switched 事件）
- [ ] Agent 管理 API 扩展（支持 tool_ids / model_id 配置）

---

## Phase 4：生产化（2-3 周）

> 让系统从"能用"到"敢上线"。

### 4.1 错误恢复与重试

```
Agent 调用
  ├── 成功 → 继续
  ├── TransientError（网络/超时/限流）→ 指数退避重试（1s, 2s, 4s，最多 3 次）
  ├── PermanentError（参数错误/权限不足）→ ToolMessage(error) 给 LLM 自修正
  └── 所有重试失败 → Fallback：简化 Agent（更小模型 + 无工具 + 结构化错误回复）
```

### 4.2 安全防护

| 措施 | 当前状态 | Phase 4 目标 |
|------|---------|-------------|
| 速率限制 | 中间件已定义未注册 | 注册到路由 |
| 输入长度校验 | 无 | `@MaxLength(10000)` |
| Prompt 注入检测 | 无 | 正则模式匹配 + 可疑度评分 |
| 敏感信息过滤 | 无 | 记忆提取前检测密码/密钥/PII |
| 输出安全检查 | 无 | Guardrail 节点（独立小模型评估） |

### 4.3 可观测性

```typescript
// backend/src/common/interceptors/agent-trace.interceptor.ts
@Injectable()
export class AgentTraceInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const traceId = generateId();
    const startTime = Date.now();

    return next.handle().pipe(
      tap((result) => {
        const duration = Date.now() - startTime;
        logger.info('agent_trace', {
          traceId,
          duration,
          agentName: result?.agentName,
          toolCallCount: result?.toolCallCount,
          model: result?.model,
        });
      }),
    );
  }
}
```

结构化日志格式：
```json
{
  "level": "info",
  "traceId": "abc-123",
  "event": "agent_trace",
  "duration": 2340,
  "inputTokens": 1520,
  "outputTokens": 380,
  "toolCalls": ["extract_memory"],
  "agent": "general"
}
```

### 4.4 Token 使用追踪

```typescript
interface TokenUsage {
  sessionId: string;
  agentName: string;
  model: string;
  inputTokens: number;    // 按来源分解：system / history / tools / query
  outputTokens: number;
  toolCallCount: number;
  duration: number;       // 端到端延迟 ms
}
```

写入 SQLite `token_usage` 表，按会话和日汇总。

### Phase 4 交付物

- [ ] 错误重试中间件（TransientError / PermanentError 分类）
- [ ] Fallback Agent（简化模型 + 无工具）
- [ ] 速率限制注册到路由
- [ ] 输入长度校验 + Prompt 注入检测
- [ ] 敏感信息过滤（集成到记忆提取工具）
- [ ] AgentTraceInterceptor + 结构化日志
- [ ] Token 使用追踪 + `token_usage` 表

---

## 演进路线图

```
Phase 1 (基础修复) ─── 1-2 周 ─── 可独立交付
├── 1.1 Tool DI 桥接
├── 1.2 递归限制 + 错误自愈
├── 1.3 统一 LLM 体系
└── 1.4 Agent traits 融入

Phase 2 (核心能力) ─── 2-3 周 ─── 可独立交付
├── 2.1 SQLite 持久化
├── 2.2 Token 预算管理
├── 2.3 三层记忆
├── 2.4 Agent 配置扩展
└── 2.5 流式增强

Phase 3 (多 Agent) ─── 3-4 周 ─── 可独立交付
├── 3.1 Supervisor 路由层
├── 3.2 Handoff 机制
├── 3.3 动态图构建
└── 3.4 内置 Agent 定义

Phase 4 (生产化) ─── 2-3 周 ─── 可独立交付
├── 4.1 错误恢复 + Fallback
├── 4.2 安全防护
├── 4.3 可观测性
└── 4.4 Token 追踪
```

## 关键设计决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 编排框架 | LangGraph JS | 已有基础、原生支持 checkpointing/streaming/multi-agent |
| 多 Agent 模式 | Supervisor | 角色差异明确、调试简单、演进自然 |
| 持久化 | SQLite → PostgreSQL | SQLite 够用且简单，PostgreSQL 为未来扩展预留 |
| 记忆架构 | 三层（短期/工作/长期） | Anthropic 推荐，LangGraph 原生支持短期和工作记忆 |
| 上下文管理 | 优先级分层 + 摘要压缩 | 生产验证的模式，40-60% token 节省 |
| 工具注入 | 工厂模式 + ToolRegistry | 桥接 LangGraph Tool 和 NestJS DI |
| 错误处理 | R5 模式 + Fallback 链 | 2025 最佳实践，让 Agent 自修正 |

## 参考

- [Building Effective AI Agents - Anthropic](https://www.anthropic.com/engineering/building-effective-agents)
- [Effective Context Engineering - Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Multi-Agent Research System - Anthropic](https://www.anthropic.com/engineering/multi-agent-research-system)
- [Writing Tools for Agents - Anthropic](https://www.anthropic.com/engineering/writing-tools-for-agents)
- [LangGraph JS Docs](https://langchain-ai.github.io/langgraphjs/)
- [LangGraph Supervisor Pattern](https://langchain-ai.github.io/langgraphjs/agents/supervisor/)
- [LangGraph Memory & Persistence](https://langchain-ai.github.io/langgraphjs/concepts/persistence/)
- [Token Budget Strategies](https://tianpan.co/blog/2025-10-20-token-budget-strategies-llm-production)
- [Google ADK Multi-Agent Patterns](https://developers.googleblog.com/developers-guide-to-multi-agent-patterns-in-adk/)
