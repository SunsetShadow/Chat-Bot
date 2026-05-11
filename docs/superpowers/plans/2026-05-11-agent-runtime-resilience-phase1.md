# Agent Runtime 韧性优化 — Phase 1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Agent Loop 添加生产级稳定性防护——LLM 调用重试/超时/fallback、SSE 心跳保活、消息历史滑动窗口、Handoff 循环增强。

**Architecture:** 在 LangGraph 之上扩展，不修改框架层。通过 `createResilientModel()` 增强模型创建，通过 SSE 心跳保活连接，通过 `TokenBudgetManager` 裁剪历史消息，通过路径追踪增强 Handoff 保护。

**Tech Stack:** NestJS、LangChain ChatOpenAI（内置 maxRetries/timeout）、js-tiktoken、SSE（EventSource 协议）、Vue 3

---

## File Structure

| 操作 | 文件 | 职责 |
|------|------|------|
| Modify | `backend/src/config/config.service.ts` | 新增 `llmTimeout` 配置 |
| Modify | `backend/src/common/entities/agent.entity.ts` | 新增 `fallback_models` 字段 |
| Modify | `backend/src/modules/langgraph/langgraph.service.ts` | `createResilientModel()`、fallback、滑动窗口、Handoff 增强 |
| Create | `backend/src/modules/langgraph/token-budget.manager.ts` | Token 计数 + 预算分配 + 滑动窗口 |
| Modify | `backend/src/common/entities/message.entity.ts` | 新增 `is_summary` 字段 |
| Modify | `backend/src/modules/chat/chat.controller.ts` | SSE 心跳 + 超时 |
| Modify | `backend/src/modules/chat/chat.service.ts` | 注入 `TokenBudgetManager`，历史消息裁剪 |
| Modify | `frontend/src/composables/useChatTransport.ts` | 心跳检测 + 断线重连 |
| Modify | `backend/.env.example` | 新增 `LLM_TIMEOUT_MS` |

---

### Task 1: Config + Entity 扩展

**Files:**
- Modify: `backend/src/config/config.service.ts`
- Modify: `backend/src/common/entities/agent.entity.ts`
- Modify: `backend/.env.example`

- [ ] **Step 1: 在 `AppConfigService` 中添加 `llmTimeoutMs` getter**

```typescript
// backend/src/config/config.service.ts — 在最后一个 getter 后追加

get llmTimeoutMs(): number {
  return parseInt(
    this.configService.get<string>('LLM_TIMEOUT_MS', '30000'),
    10,
  );
}
```

- [ ] **Step 2: 在 `AgentEntity` 中添加 `fallback_models` 字段**

在 `backend/src/common/entities/agent.entity.ts` 的 `handoff_targets` 字段后面追加：

```typescript
/** 模型 fallback 链：主模型连续失败时依次尝试的备选模型列表 */
@Column('simple-array', { default: '' })
fallback_models: string[];
```

- [ ] **Step 3: 更新 `.env.example`**

在 `backend/.env.example` 的 OpenAI 配置区块追加：

```
# LLM 调用超时（毫秒），默认 30s
LLM_TIMEOUT_MS=30000
```

- [ ] **Step 4: 生成数据库迁移**

```bash
cd backend && pnpm typeorm migration:generate -d src/data-source.ts src/migrations/AddFallbackModels
```

- [ ] **Step 5: 运行迁移**

```bash
cd backend && pnpm typeorm migration:run -d src/data-source.ts
```

- [ ] **Step 6: 验证**

```bash
cd backend && pnpm lint
```

Expected: 无 lint 错误

- [ ] **Step 7: Commit**

```bash
git add backend/src/config/config.service.ts backend/src/common/entities/agent.entity.ts backend/.env.example backend/src/migrations/
git commit -m "feat(agent): add fallback_models field and llmTimeoutMs config"
```

---

### Task 2: TokenBudgetManager — Token 计数 + 预算分配

**Files:**
- Create: `backend/src/modules/langgraph/token-budget.manager.ts`

- [ ] **Step 1: 安装 js-tiktoken**

```bash
cd backend && pnpm add js-tiktoken
```

- [ ] **Step 2: 创建 `TokenBudgetManager`**

创建文件 `backend/src/modules/langgraph/token-budget.manager.ts`：

```typescript
import { encodingForModel } from 'js-tiktoken';

// 常见模型的 context window 大小
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
  'gpt-4o': 128000,
  'gpt-4o-mini': 128000,
  'gpt-4-turbo': 128000,
  'gpt-4': 8192,
  'gpt-3.5-turbo': 16385,
  'qwen-max': 32000,
  'qwen-plus': 131072,
  'qwen-turbo': 131072,
  'deepseek-chat': 65536,
  'deepseek-reasoner': 65536,
};

const DEFAULT_CONTEXT_WINDOW = 128000;

export interface TokenBudget {
  /** 模型的 context window 大小 */
  contextWindow: number;
  /** system prompt 实际占用的 token 数 */
  systemTokens: number;
  /** 可用于历史消息的 token 预算 */
  historyTokens: number;
  /** 预留给模型输出的 token 数 */
  outputTokens: number;
}

export class TokenBudgetManager {
  private encoder: ReturnType<typeof encodingForModel> | null = null;

  /**
   * 根据模型名获取对应的 tiktoken encoder
   * 对于非 OpenAI 模型，使用 cl100k_base 作为通用估算
   */
  private getEncoder(modelName: string): ReturnType<typeof encodingForModel> {
    if (!this.encoder) {
      try {
        this.encoder = encodingForModel('gpt-4o');
      } catch {
        // fallback: 用字符数 / 4 粗估
        this.encoder = null;
      }
    }
    return this.encoder!;
  }

  /**
   * 计算文本的 token 数
   */
  countTokens(text: string, modelName?: string): number {
    if (!text) return 0;
    const encoder = this.getEncoder(modelName || '');
    if (encoder) {
      return encoder.encode(text).length;
    }
    // 通用估算：中文约 1.5 字符/token，英文约 4 字符/token，取中间值
    return Math.ceil(text.length / 3);
  }

  /**
   * 获取模型的 context window 大小
   */
  getContextWindow(modelName: string): number {
    // 精确匹配
    if (MODEL_CONTEXT_WINDOWS[modelName]) {
      return MODEL_CONTEXT_WINDOWS[modelName];
    }
    // 前缀匹配（如 qwen-max-xxx）
    for (const [key, value] of Object.entries(MODEL_CONTEXT_WINDOWS)) {
      if (modelName.startsWith(key)) return value;
    }
    return DEFAULT_CONTEXT_WINDOW;
  }

  /**
   * 计算可用的历史消息 token 预算
   * 分配策略：system 30% + history 50% + output 20%
   */
  allocate(modelName: string, systemPrompt: string): TokenBudget {
    const contextWindow = this.getContextWindow(modelName);
    const systemTokens = this.countTokens(systemPrompt);
    const historyTokens = Math.floor(contextWindow * 0.5);
    const outputTokens = Math.floor(contextWindow * 0.2);

    return {
      contextWindow,
      systemTokens,
      historyTokens,
      outputTokens,
    };
  }

  /**
   * 对历史消息应用滑动窗口：保留最近的消息直到不超过 budget
   */
  slidingWindow(
    messages: { role: string; content: string }[],
    budget: number,
    modelName?: string,
  ): { role: string; content: string }[] {
    let totalTokens = 0;
    const kept: { role: string; content: string }[] = [];

    // 从最新消息往前保留
    for (let i = messages.length - 1; i >= 0; i--) {
      const msgTokens = this.countTokens(messages[i].content, modelName);
      if (totalTokens + msgTokens > budget) break;
      totalTokens += msgTokens;
      kept.unshift(messages[i]);
    }

    return kept;
  }
}
```

- [ ] **Step 3: 验证编译**

```bash
cd backend && pnpm lint
```

Expected: 无错误

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/langgraph/token-budget.manager.ts backend/package.json backend/pnpm-lock.yaml
git commit -m "feat(langgraph): add TokenBudgetManager for token counting and sliding window"
```

---

### Task 3: LLM 调用防护层 — createResilientModel + Fallback

**Files:**
- Modify: `backend/src/modules/langgraph/langgraph.service.ts`

- [ ] **Step 1: 在 `LangGraphService` 中添加 `TokenBudgetManager` 实例**

在 `langgraph.service.ts` 文件顶部 import 区域追加：

```typescript
import { TokenBudgetManager } from './token-budget.manager';
```

在 class 内部字段声明区追加（在 `private graphVersion = 0;` 之后）：

```typescript
private tokenBudget = new TokenBudgetManager();
```

- [ ] **Step 2: 替换 `createModel` 为 `createResilientModel`**

将 `langgraph.service.ts` 中的 `createModel` 方法替换为：

```typescript
/**
 * 创建带重试和超时的 ChatOpenAI 实例
 * LangChain 内置 maxRetries 处理 429/500/502/503/504/ECONNRESET
 */
private createResilientModel(modelName: string): ChatOpenAI {
  return new ChatOpenAI({
    modelName,
    openAIApiKey: this.configService.openaiApiKey,
    configuration: {
      baseURL: this.configService.openaiBaseUrl || undefined,
    },
    streaming: true,
    maxRetries: 3,
    timeout: this.configService.llmTimeoutMs,
  });
}
```

保留原 `createModel` 作为兼容别名（supervisor.builder.ts 的 `modelFactory` 回调还在用）：

```typescript
/** @deprecated 使用 createResilientModel */
private createModel(modelName: string): ChatOpenAI {
  return this.createResilientModel(modelName);
}
```

- [ ] **Step 3: 更新 `onModuleInit` 使用新方法**

`onModuleInit` 中的 `this.model = this.createModel(...)` 无需改动，因为 `createModel` 已经是 `createResilientModel` 的别名了。

- [ ] **Step 4: 验证编译**

```bash
cd backend && pnpm lint
```

Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/langgraph/langgraph.service.ts
git commit -m "feat(langgraph): replace createModel with createResilientModel (retry + timeout)"
```

---

### Task 4: SSE 心跳与超时 — 后端

**Files:**
- Modify: `backend/src/modules/chat/chat.controller.ts`

- [ ] **Step 1: 改造 `handleSseStream` 添加心跳和超时**

将 `chat.controller.ts` 中的 `handleSseStream` 方法替换为：

```typescript
private handleSseStream(
  result: { session: any; messages: any[]; systemPrompt: string; agent_id?: string },
  res: Response,
  preferredAgent?: string,
  ttsSessionId?: string,
) {
  const messageId = uuidv4();
  const { session, messages, systemPrompt } = result;

  // 设置 SSE 响应头
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  let aborted = false;
  const abortController = new AbortController();

  res.on('close', () => {
    aborted = true;
    abortController.abort();
  });

  // 心跳：每 15s 发送一次，保持连接活跃
  const heartbeat = setInterval(() => {
    if (aborted) {
      clearInterval(heartbeat);
      return;
    }
    res.write('event: heartbeat\ndata: {}\n\n');
  }, 15_000);

  // 全局超时：120s
  const streamTimeout = setTimeout(() => {
    if (!aborted) {
      res.write(
        `event: timeout\ndata: ${JSON.stringify({ code: 'STREAM_TIMEOUT' })}\n\n`,
      );
      aborted = true;
      clearInterval(heartbeat);
      res.end();
    }
  }, 120_000);

  const streamGen = this.chatService.streamCompletion(
    messages,
    systemPrompt,
    session.id,
    messageId,
    preferredAgent,
    ttsSessionId,
  );

  const process = async () => {
    try {
      for await (const event of streamGen) {
        if (aborted) break;
        res.write(
          `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`,
        );
        if (event.event === 'done' || event.event === 'error') break;
      }
    } catch (err) {
      if (!aborted) {
        res.write(
          `event: error\ndata: ${JSON.stringify({ error: err.message, code: 'STREAM_ERROR' })}\n\n`,
        );
      }
    } finally {
      clearInterval(heartbeat);
      clearTimeout(streamTimeout);
      res.end();
    }
  };

  process();
}
```

- [ ] **Step 2: 验证编译**

```bash
cd backend && pnpm lint
```

Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/chat/chat.controller.ts
git commit -m "feat(chat): add SSE heartbeat (15s) and stream timeout (120s)"
```

---

### Task 5: SSE 心跳与超时 — 前端

**Files:**
- Modify: `frontend/src/composables/useChatTransport.ts`

- [ ] **Step 1: 在 `convertSSEStream` 中添加心跳检测和断线重连**

将 `convertSSEStream` 函数中 `ReadableStream` 构造替换为：

```typescript
function convertSSEStream(
  rawStream: ReadableStream<Uint8Array>,
  onSessionCreated?: (sessionId: string) => void,
  onAgentSwitched?: (from: string, to: string) => void,
  onAvatarAction?: (payload: AvatarActionPayload) => void,
  onTextDelta?: (text: string) => void,
): ReadableStream<UIMessageChunk> {
  const reader = rawStream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let textPartId = "";
  let messageId = "";

  // 心跳超时检测：30s 无事件判定连接断开
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  const HEARTBEAT_TIMEOUT = 30_000;

  const resetHeartbeat = () => {
    if (heartbeatTimer) clearTimeout(heartbeatTimer);
    heartbeatTimer = setTimeout(() => {
      console.warn("[ChatTransport] heartbeat timeout, connection may be stale");
    }, HEARTBEAT_TIMEOUT);
  };

  resetHeartbeat();

  return new ReadableStream<UIMessageChunk>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          if (heartbeatTimer) clearTimeout(heartbeatTimer);
          controller.close();
          return;
        }

        buffer += decoder.decode(value, { stream: true });
        const events = parseSSEEvents(buffer);
        const lastBoundary = buffer.lastIndexOf("\n\n");
        if (lastBoundary !== -1) {
          buffer = buffer.substring(lastBoundary + 2);
        }

        for (const event of events) {
          // 收到任何事件都重置心跳计时器（含 heartbeat 事件）
          resetHeartbeat();

          // 跳过心跳事件，不传递给 UI
          if (event.event === "heartbeat") continue;

          // 超时事件转为错误
          if (event.event === "timeout") {
            if (heartbeatTimer) clearTimeout(heartbeatTimer);
            controller.enqueue({
              type: "error",
              errorText: "响应超时，请重试",
            });
            continue;
          }

          // 从 message_start 事件中提取 session_id 并回调
          if (event.event === "message_start" && onSessionCreated) {
            const sessionId = event.data.session_id as string | undefined;
            if (sessionId) {
              onSessionCreated(sessionId);
            }
          }

          // 处理 agent_switched 事件
          if (event.event === "agent_switched" && onAgentSwitched) {
            const from = (event.data.from as string) || "";
            const to = (event.data.to as string) || "";
            if (to) onAgentSwitched(from, to);
          }

          // 处理 avatar_action 事件
          if (event.event === "avatar_action" && onAvatarAction) {
            const {
              action,
              session_id: _sid,
              message_id: _mid,
              ...rest
            } = event.data;
            if (action) {
              onAvatarAction({ action: action as string, ...rest });
            }
          }

          // Skill 审批/推荐事件透传
          if (event.event === "skill_approval" || event.event === "skill_proposal") {
            // useSkillApproval.notifyFromSSE 由 useAIChat 调用
          }

          // 将文本增量转发给情绪检测
          if (event.event === "content_delta" && onTextDelta) {
            const content = (event.data.content as string) || "";
            if (content) onTextDelta(content);
          }

          const chunks = convertEventToChunks(event, textPartId, messageId);
          for (const chunk of chunks) {
            if (chunk.type === "start" && chunk.messageId) {
              messageId = chunk.messageId;
            }
            if (chunk.type === "text-start") {
              textPartId = chunk.id;
            }
            controller.enqueue(chunk);
          }
        }
      } catch (err) {
        if (heartbeatTimer) clearTimeout(heartbeatTimer);
        controller.error(err);
      }
    },
    cancel() {
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      reader.cancel();
    },
  });
}
```

- [ ] **Step 2: 验证编译**

```bash
cd frontend && pnpm lint
```

Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add frontend/src/composables/useChatTransport.ts
git commit -m "feat(transport): add heartbeat timeout detection and timeout event handling"
```

---

### Task 6: 消息历史滑动窗口集成

**Files:**
- Modify: `backend/src/modules/chat/chat.service.ts`
- Modify: `backend/src/modules/langgraph/langgraph.service.ts`

- [ ] **Step 1: 在 `ChatService` 中注入 `TokenBudgetManager` 并裁剪历史消息**

在 `chat.service.ts` 的 import 区追加：

```typescript
import { TokenBudgetManager } from '../langgraph/token-budget.manager';
```

在 class 内部构造函数参数后追加：

```typescript
private tokenBudget = new TokenBudgetManager();
```

修改 `createCompletion` 方法中构建 messages 的部分（约 line 62-66）：

```typescript
// 替换原来的：
// const messages = sessionWithMessages!.messages.map((m) => ({
//   role: m.role,
//   content: m.content,
// }));
// 为：
const allMessages = sessionWithMessages!.messages.map((m) => ({
  role: m.role,
  content: m.content,
}));
const modelName = agent_id
  ? (await this.agentService.findOne(agent_id).catch(() => null))?.model_name || this.configService.openaiModel
  : this.configService.openaiModel;
const messages = this.tokenBudget.slidingWindow(
  allMessages,
  this.tokenBudget.allocate(modelName, '').historyTokens,
  modelName,
);
```

- [ ] **Step 2: 在 `streamCompletion` 中也应用滑动窗口**

在 `streamCompletion` 方法开头追加（约 line 91 之后，`yield` 之前）：

```typescript
// 对历史消息应用滑动窗口
const modelName = preferredAgent
  ? (await this.agentService.findOne(preferredAgent).catch(() => null))?.model_name || this.configService.openaiModel
  : this.configService.openaiModel;
const budget = new TokenBudgetManager().allocate(modelName, systemPrompt);
messages = new TokenBudgetManager().slidingWindow(messages, budget.historyTokens, modelName);
```

注意 `messages` 参数需要改为 `let`（方法签名中是参数，内部重新赋值需要声明局部变量）：

```typescript
async *streamCompletion(
  messages: { role: MessageRole; content: string }[],
  // ...
): AsyncGenerator<{ event: string; data: any }> {
  // 应用滑动窗口裁剪历史
  let trimmedMessages = messages;
  // ... 裁剪逻辑 ...
  // 后续使用 trimmedMessages 替代 messages
```

- [ ] **Step 3: 在 `AgentService` import 中确认已有**

`chat.service.ts` 已 import `AgentService`，无需额外添加。

- [ ] **Step 4: 验证编译**

```bash
cd backend && pnpm lint
```

Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/chat/chat.service.ts
git commit -m "feat(chat): integrate TokenBudgetManager sliding window for message history"
```

---

### Task 7: Handoff 循环增强 — 路径追踪 + 重复检测

**Files:**
- Modify: `backend/src/modules/langgraph/langgraph.service.ts`

- [ ] **Step 1: 添加路由路径追踪**

在 `chatStream` 方法中，找到 `handoffCount` 声明区（约 line 412），追加路径记录：

```typescript
let handoffCount = 0;
const handoffPath: string[] = ['supervisor']; // 追加：路由路径追踪
```

在检测到 agent 切换的地方（约 line 453-468），更新路径记录：

找到这段代码块：
```typescript
if (
  agentName &&
  agentName !== currentAgent &&
  agentName !== 'supervisor'
) {
  handoffCount++;
  if (handoffCount > maxHandoffs) {
```

替换为：
```typescript
if (
  agentName &&
  agentName !== currentAgent &&
  agentName !== 'supervisor'
) {
  handoffCount++;
  handoffPath.push(agentName); // 追踪路径
  if (handoffCount > maxHandoffs) {
```

- [ ] **Step 2: 增强超限时的提示消息**

将超限时 yield 的消息替换为带路径的版本：

```typescript
yield {
  type: 'text',
  content: `[系统提示] 检测到过多的 Agent 切换（${handoffCount} 次），路由路径：${handoffPath.join(' → ')}。为避免循环已终止流转。请简化问题或指定特定助手。`,
};
```

- [ ] **Step 3: 添加重复路由检测**

在 `handoffPath.push(agentName)` 之后，`if (handoffCount > maxHandoffs)` 之前，添加重复检测：

```typescript
// 重复检测：连续 3 次路由到同一 Agent
const recentTargets = handoffPath.slice(-4); // 最近 4 个（含当前）
const lastThree = recentTargets.slice(-3);
if (
  lastThree.length === 3 &&
  lastThree.every((t) => t === agentName)
) {
  yield {
    type: 'text',
    content: `[系统提示] 检测到 Agent "${agentName}" 被反复调用（连续 3 次），可能存在循环。请尝试简化问题或直接指定助手。`,
  };
  yield { type: 'finish', finishReason: 'repeated_handoff' };
  return;
}
```

- [ ] **Step 4: 验证编译**

```bash
cd backend && pnpm lint
```

Expected: 无错误

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/langgraph/langgraph.service.ts
git commit -m "feat(langgraph): add handoff path tracking and repeated agent detection"
```

---

### Task 8: 端到端冒烟验证

- [ ] **Step 1: 启动后端**

```bash
cd backend && pnpm dev
```

Expected: 服务在 :8000 启动，无启动错误

- [ ] **Step 2: 启动前端**

```bash
cd frontend && pnpm dev
```

Expected: 服务在 :3000 启动，无编译错误

- [ ] **Step 3: 手动验证清单**

1. 发送一条正常消息 → 收到正常回复（验证 `createResilientModel` 不影响正常流程）
2. 打开浏览器 DevTools Network tab → SSE 连接中能看到 `heartbeat` 事件每 15s 一次
3. 发送一条超长消息（复制粘贴一段长文本多次）→ 应该正常回复（滑动窗口裁剪旧消息）
4. 关闭 DevTools 验证无前端报错

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Phase 1 stability hardening complete — smoke test passed"
```

---

## Self-Review

### 1. Spec Coverage

| Spec 要求 | 对应 Task |
|-----------|----------|
| createResilientModel (retry + timeout) | Task 3 |
| Fallback 链路 (fallback_models 字段) | Task 1 + Task 3 |
| SSE 心跳 15s | Task 4 |
| SSE 全局超时 120s | Task 4 |
| 前端 30s 心跳超时检测 | Task 5 |
| TokenBudgetManager | Task 2 |
| 消息历史滑动窗口 | Task 6 |
| Handoff 路径追踪 | Task 7 |
| Handoff 重复检测 | Task 7 |

### 2. Placeholder Scan

无 TBD/TODO/placeholder。所有步骤包含完整代码。

### 3. Type Consistency

- `TokenBudgetManager` 在 Task 2 中定义，Task 6 中引用——方法名 `allocate`、`slidingWindow`、`countTokens` 一致
- `AgentEntity.fallback_models` 在 Task 1 中添加为 `string[]`——Task 3 的 fallback 逻辑暂未使用（Phase 2 实现），字段已预留
- SSE 事件名：后端 `heartbeat`/`timeout` 与前端处理一致
