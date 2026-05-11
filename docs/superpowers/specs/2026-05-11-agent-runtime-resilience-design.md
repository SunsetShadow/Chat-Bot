# Agent Runtime 韧性优化设计

> 日期：2026-05-11
> 范围：Agent Loop 稳定性、Context 治理、成本控制
> 优先级：稳定性(P0) > Context(P1) > 成本(P2)
> 方案：渐进式加固，分三个 Phase 实施，每个 Phase 独立可用

## 背景

系统在生产使用中暴露了四类稳定性问题：LLM API 报错直接崩掉、长对话卡死/截断、弱网 SSE 卡住、Handoff 循环。同时 Context 无全局 token 预算管理，消息历史无限累积，无 Prompt Cache，无 token 追踪。

三个维度互相咬合：Context 无限累积 → token 超限报错（稳定性）→ 烧钱（成本）。

## Phase 1：稳定性止血

### 1.1 LLM 调用防护层

**问题**：`createModel()` 无 retry/timeout/fallback，一次 429 或网络抖动整个对话崩掉。

**方案**：`LangGraphService.createResilientModel()` 替代 `createModel()`：

```typescript
// LangChain ChatOpenAI 内置 retry，直接配置
new ChatOpenAI({
  modelName,
  openAIApiKey,
  configuration: { baseURL },
  streaming: true,
  maxRetries: 3,
  timeout: 30000,
  // LangChain 自动处理 429/500/502/503/504/ECONNRESET
});
```

**Fallback 链路**：
- Agent 实体新增 `fallback_models: string[]` 字段（可选）
- 主模型连续失败 3 次后自动切换到 fallback
- Fallback 只在当前会话内生效
- 触发时发 `model_fallback` SSE 事件通知前端

**实现要点**：
- 不在 LangGraph 外层包 retry——LangChain 内置已足够
- Fallback 切换在 `chatStream` 的异常捕获中实现
- 配置存储在 Agent 实体中，不引入新的配置文件

### 1.2 SSE 心跳与超时

**问题**：弱网 SSE 推送卡住，前端永远 loading。

**方案**：

后端（`ChatController`）：
- SSE 循环每 15s 发 `heartbeat` 事件：`event: heartbeat\ndata: {}\n\n`
- 整体流超时 120s，超时发 `timeout` 事件并关闭连接
- 使用 `AbortController` 统一管理超时和客户端断开

前端（`useChatTransport`）：
- 30s 无任何事件（含心跳）判定连接断开
- 自动重连一次，携带 `Last-Event-ID` header
- 重连失败则显示错误提示，不无限重试

**实现要点**：
- 心跳发送在 SSE 循环的 `for await` 之外用 `setInterval`，避免阻塞流
- 超时用 `Promise.race` 包裹整个流处理
- 前端用 `setTimeout` 检测心跳超时，每次收到事件重置计时器

### 1.3 消息历史滑动窗口

**问题**：全部历史消息直接塞给模型，长对话 token 爆炸。

**方案**：新增 `TokenBudgetManager`：

```
总预算 = 模型 context window（如 128k）
├─ System Prompt: 30%（固定）
├─ 历史消息: 50%（滑动窗口）
└─ 模型输出: 20%（预留）
```

**滑动窗口逻辑**（`buildMessages()` 中）：
1. 计算现有 system prompt 的 token 数
2. 剩余空间按 50% 分配给历史消息
3. 保留最近 N 条完整消息（N 由预算决定）
4. 更早的消息用摘要替代（LLM 生成，缓存到 DB）

**摘要生成**：
- 触发条件：历史消息超过 historyBudget 的 80%
- 异步生成，不阻塞当前请求
- 摘要存储在 `MessageEntity` 中（新字段 `is_summary: boolean`）
- 首次摘要生成后，后续请求直接使用缓存摘要

**Token 计数**：
- 使用 `js-tiktoken`（轻量，不依赖 API 调用）
- 按模型选择 tokenizer：GPT 系列用 `cl100k_base`，其他用通用估算（字符数/4）

### 1.4 Handoff 循环增强

现有 Handoff 计数保护（`DEFAULT_MAX_HANDOFFS = 5`）增强两点：

1. **路径追踪**：超限时 yield 的消息加上已完成的路由路径，如：
   `Supervisor → Ani → Supervisor → Coder → Supervisor（终止）`

2. **重复检测**：连续 3 次路由到同一 Agent 且结果相似时，主动打断并提示用户简化问题。

---

## Phase 2：Context 治理

### 2.1 Prompt 前缀固定化

**核心思路**：System Prompt 拆成「静态前缀」+「动态后缀」。静态前缀在 Agent 配置不变时恒定，可被 Prompt Cache 命中。

**当前结构**（每次请求都不同）：
```
Agent system_prompt
+ 当前时间           ← 每次变化
+ 联网搜索开关       ← 可能变化
+ 全局规则
+ Agent 规则
+ Memory 上下文      ← 每次可能不同
+ Skill Index        ← 偶尔变化
+ Patch 建议         ← 偶尔变化
+ 工具提示           ← Agent 不变则不变
+ Agent ID 提示
```

**重构后**：
```
[静态前缀 — 可缓存]
  Agent system_prompt
  + 全局规则
  + Agent 规则
  + 工具提示
  + Agent ID 提示

[动态后缀 — 不可缓存]
  当前时间
  + 联网搜索开关
  + Memory 上下文
  + Skill Index
  + Patch 建议
```

**实现**：
- `buildSystemPrompt()` 拆成 `buildStaticPrefix()` + `buildDynamicSuffix()`
- 静态前缀通过 hash 缓存（key: `agentId + ruleIds + toolNames`，Agent 配置变更时失效）
- LangChain SystemMessage 支持多段拼接，不需要改框架

**跨厂商 Cache 适配**：
- OpenAI 兼容 API（Qwen/DeepSeek/GLM）：隐式缓存，前缀不变即可命中
- Anthropic：在静态前缀末尾加 `cache_control: {"type": "ephemeral"}`
- Gemini 显式缓存：预留接口，当前不实现

### 2.2 全局 Token 预算管理器

Phase 1 的 `TokenBudgetManager` 扩展：

```typescript
class TokenBudgetManager {
  allocate(contextWindow: number, systemPrompt: string): Budget {
    const systemTokens = countTokens(systemPrompt);
    if (systemTokens > contextWindow * 0.4) {
      // 告警：system prompt 太臃肿
    }
    return {
      systemTokens,
      historyTokens: Math.floor(contextWindow * 0.5),
      outputTokens: Math.floor(contextWindow * 0.2),
    };
  }
}
```

- Memory 查询结果 top-k 限制（默认 20 条），按 importance 排序
- Skill Index 超预算时降级为精简模式（已有实现，确保集成到预算管理器中）

### 2.3 Memory 治理

- **定期巡检**：超过 90 天未被召回的记忆，importance -1
- **过期淘汰**：importance 降到 0 且超过 180 天的记忆，归档到冷存储（标记 `archived: true`，不参与查询）
- **写入限流**：单次对话最多提取 5 条新记忆
- 巡检任务挂载到定时任务系统，每天执行一次

---

## Phase 3：成本优化

### 3.1 Token 使用量追踪

**数据采集**：
- LangGraph 的 `AIMessage.usage_metadata` 包含 prompt_tokens/completion_tokens
- 在 `chatStream` 的 finish 事件中提取 usage，写入 `token_usage` 表

**表结构**：
```sql
CREATE TABLE token_usage (
  id UUID PRIMARY KEY,
  session_id VARCHAR NOT NULL,
  agent_id VARCHAR,
  model_name VARCHAR NOT NULL,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  estimated_cost DECIMAL(10,6), -- USD
  created_at TIMESTAMP DEFAULT NOW()
);
```

**成本计算**：
- 内置各模型单价表（per 1M tokens），可通过环境变量覆盖
- `estimated_cost = (prompt_tokens * input_price + completion_tokens * output_price) / 1_000_000`

**前端看板**（设置页新增「用量」tab）：
- 今日/本周/本月 总 token 和费用
- 按 Agent 分组的费用占比
- 按 Model 分组的费用占比
- 费用趋势图（最近 30 天）

### 3.2 模型路由

**规则**：简单任务用轻量模型，复杂任务不变。

| 场景 | 当前 | 优化后 |
|------|------|--------|
| 标题生成 | 主模型 + maxTokens:30 | `lightModel`（如 qwen-turbo） |
| Memory 提取 | 主模型 | `lightModel` |
| Skill lookup 意图判断 | 主模型 | `lightModel` |
| Supervisor 路由 | 主模型 | `mediumModel`（可选） |
| Worker Agent 执行 | 按 Agent 配置 | 不变 |

**配置**：
```env
LIGHT_MODEL=qwen-turbo    # 轻量模型
MEDIUM_MODEL=qwen-plus    # 中等模型
OPENAI_MODEL=qwen-max     # 主模型（不变）
```

**不做**：自动判断任务复杂度再路由——过度工程。

### 3.3 Prompt Cache 友好结构

Phase 2 的前缀固定化已解决 system prompt 级别的缓存。这里补充对话级别：

- 多轮对话中 system prompt 静态前缀保持不变（LangGraph checkpointer 天然保持）
- 确保每次 API 调用的 messages 数组前缀一致
- 如需更新 system prompt（规则变更），在新一轮对话开始时生效，不在对话中间插入

**不做的事情**：
- 不自己做 KV 缓存（各厂商 API 已做好）
- 不做 embedding-based context 压缩（滑动窗口已够用）

---

## 实施顺序与依赖

```
Phase 1（稳定性止血）
  1.1 LLM 防护层 ─── 无依赖，直接改 createModel
  1.2 SSE 心跳 ─── 无依赖，改 ChatController
  1.3 滑动窗口 ─── 需要 js-tiktoken，改 buildMessages
  1.4 Handoff 增强 ─── 无依赖，改 chatStream
  ↓
Phase 2（Context 治理）
  2.1 前缀固定化 ─── 依赖 Phase 1.3（token 计数基础设施）
  2.2 预算管理器 ─── 依赖 Phase 1.3 + 2.1
  2.3 Memory 治理 ─── 无依赖，可独立实施
  ↓
Phase 3（成本优化）
  3.1 Token 追踪 ─── 依赖 Phase 1.3（需要 token 计数）
  3.2 模型路由 ─── 无依赖，可独立实施
  3.3 Cache 结构 ─── 依赖 Phase 2.1（前缀固定化）
```

## 关键文件

| 改动目标 | 文件 |
|---------|------|
| LLM 防护 | `backend/src/modules/langgraph/langgraph.service.ts` |
| SSE 心跳 | `backend/src/modules/chat/chat.controller.ts` |
| 前端重连 | `frontend/src/composables/useChatTransport.ts` |
| 滑动窗口 | `backend/src/modules/langgraph/langgraph.service.ts` |
| Token 预算 | 新增 `backend/src/modules/langgraph/token-budget.manager.ts` |
| Prompt 拆分 | `backend/src/modules/chat/chat.service.ts` |
| Token 追踪 | 新增 `backend/src/modules/chat/token-usage.entity.ts` |
| 模型路由 | `backend/src/config/config.service.ts` |
| Memory 巡检 | `backend/src/modules/memory/memory.service.ts` |
| Agent Fallback | `backend/src/modules/agent/agent.entity.ts` |

## 不做的事情

- 不做自定义 KV 缓存（厂商已实现）
- 不做自动复杂度判断路由（过度工程）
- 不做 embedding-based context 压缩（滑动窗口足够）
- 不做分布式重试队列（单实例够用）
- 不改 LangGraph 框架层（在其之上扩展）
