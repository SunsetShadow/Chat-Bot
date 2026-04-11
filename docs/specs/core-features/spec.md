# 核心功能规范

本文档定义 Chat Bot 的核心功能：聊天系统、Agent 系统、规则系统、记忆系统和上下文管理。

> 架构演进计划见 [plans/agent-architecture/evolution-plan.md](../../plans/agent-architecture/evolution-plan.md)

---

## 聊天系统

基于 [AI SDK UI](https://ai-sdk.dev/docs/reference/ai-sdk-ui) + Server-Sent Events (SSE) 的实时流式聊天系统。

### 架构

前端使用 `@ai-sdk/vue` 的 `Chat` 类（模块级单例）配合自定义 `ChatTransport`，将后端 SSE 事件转换为 AI SDK 的 `UIMessageChunk` 格式。

```
用户输入 → useAIChat.sendMessage()
  → ChatTransport.sendMessages() → POST /api/v1/chat/completions
  → 后端 SSE 流 → convertSSEStream() → UIMessageChunk
  → Chat 实例自动更新 messages → Vue 响应式渲染
```

### SSE 事件类型（后端 → 前端）

| 后端事件 | 转换为 UIMessageChunk 类型 | 描述 |
|---------|--------------------------|------|
| `message_start` | `start` + `text-start` | 新消息开始，携带 session_id |
| `content_delta` | `text-delta` | 内容块增量 |
| `message_done` | `text-end` + `finish` | 消息完成 |
| `tool_call_start` | `tool-input-start` | 工具调用开始 |
| `tool_call_delta` | `tool-input-delta` | 工具参数流式传输 |
| `tool_call_input` | `tool-input-available` | 完整工具输入 |
| `tool_call_output` | `tool-output-available` | 工具执行结果 |
| `step_start` | — | 新步骤开始（不生成 chunk） |
| `done` | — | 会话完成（不生成 chunk） |
| `error` | `error` | 错误事件 |

### API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/v1/chat/completions` | 发送聊天消息（SSE 流式） |
| POST | `/api/v1/chat/sessions` | 创建新会话 |
| GET | `/api/v1/chat/sessions` | 获取会话列表（分页） |
| GET | `/api/v1/chat/sessions/{id}` | 获取特定会话 |
| GET | `/api/v1/chat/sessions/{id}/messages` | 获取会话消息历史 |
| PUT | `/api/v1/chat/sessions/{id}/pin` | 切换会话置顶状态 |

### 约束

1. 聊天流式传输基于 AI SDK UI 的 `Chat` 类 + 自定义 `ChatTransport`
2. 后端 SSE 事件必须在 `useChatTransport.ts` 中正确转换为 `UIMessageChunk`
3. Chat 实例为模块级单例，所有组件共享同一份消息状态
4. Agent 和 Rule 在请求时通过 ChatTransport 的 extraBody 注入
5. 会话和消息持久化存储在 PostgreSQL（TypeORM）
6. 失败消息保留在数据库，支持手动重试（regenerate）

---

## Agent 系统

允许用户选择不同的 AI 人设角色，每个 Agent 拥有自定义的系统提示词。

### 数据模型

```typescript
// TypeORM Entity: backend/src/common/entities/agent.entity.ts
interface Agent {
  id: string               // UUID，主键
  name: string
  description: string
  system_prompt: string
  traits: string[]          // simple-array 类型
  is_builtin: boolean       // 内置 Agent 不可删除/修改
  created_at: Date          // 自动生成
  updated_at: Date          // 自动更新
}
```

持久化：PostgreSQL（TypeORM），启动时自动 seed 3 个内置 Agent。

### API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/agents` | 获取所有 Agent |
| GET | `/api/v1/agents/{id}` | 获取特定 Agent |
| POST | `/api/v1/agents` | 创建新 Agent |
| PUT | `/api/v1/agents/{id}` | 更新 Agent |
| DELETE | `/api/v1/agents/{id}` | 删除 Agent |

### 约束

1. 每个 Agent 必须有唯一的名称
2. system_prompt 不能为空
3. 删除 Agent 不影响已有的聊天会话

---

## 规则系统

允许用户为 AI 添加行为约束、格式要求和输出规则。

### 数据模型

```typescript
// TypeORM Entity: backend/src/common/entities/rule.entity.ts
interface Rule {
  id: string               // UUID，主键
  name: string
  content: string
  enabled: boolean
  category: 'behavior' | 'format' | 'constraint'
  priority: number
  conflict_strategy: 'override' | 'merge' | 'reject'
  is_builtin: boolean
}
```

持久化：PostgreSQL（TypeORM），启动时自动 seed 5 个内置 Rule。

### 规则类别

| 类别 | 描述 |
|------|------|
| `behavior` | 行为规则 - 控制 AI 的行为模式 |
| `format` | 格式规则 - 控制输出的格式要求 |
| `constraint` | 约束规则 - 限制 AI 的行为边界 |

### API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/rules` | 获取所有规则 |
| GET | `/api/v1/rules/{id}` | 获取特定规则 |
| POST | `/api/v1/rules` | 创建新规则 |
| PUT | `/api/v1/rules/{id}` | 更新规则 |
| DELETE | `/api/v1/rules/{id}` | 删除规则 |

### 约束

1. 规则内容需要有明确的格式要求
2. 规则应该简洁明了，避免过长
3. 默认规则不可删除，但可以禁用
4. 规则优先级默认为 5

---

## 记忆系统

使用 AI 自动从对话中提取重要信息，存储为长期记忆。支持关键词过滤和语义检索两种查询方式。

### 数据模型

```typescript
// TypeORM Entity: backend/src/common/entities/memory.entity.ts
interface Memory {
  id: string               // UUID，主键（同时作为 Milvus 关联 ID）
  content: string
  type: 'fact' | 'preference' | 'event'
  source_session_id: string | null
  importance: number       // 1-10
  created_at: Date
  last_accessed: Date
}
```

### 存储架构

```
MemoryService
  ├── TypeORM Repository → PostgreSQL（结构化数据：content, type, importance...）
  └── MilvusService       → Milvus（embedding 向量）
        ↑ EmbeddingService 生成向量（@langchain/openai OpenAIEmbeddings）
```

- **写入**：生成 embedding → 存 PG → 存 Milvus（Milvus 失败不阻塞）
- **更新**：更新 PG，content 变更时重新生成 embedding 更新 Milvus
- **删除**：PG + Milvus 同步删除
- **语义检索**：embedding → Milvus 相似度搜索 → PG 取完整数据

### Embedding 配置

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `EMBEDDINGS_MODEL_NAME` | Embedding 模型名 | text-embedding-v3 |
| `EMBEDDINGS_DIMENSION` | 向量维度 | 1536 |
| `MILVUS_ADDRESS` | Milvus 地址 | localhost:19530 |

### 记忆类型

| 类型 | 描述 |
|------|------|
| `fact` | 事实信息 |
| `preference` | 用户偏好 |
| `event` | 重要事件 |

### API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/memories` | 获取记忆列表（支持 type、min_importance 过滤） |
| GET | `/api/v1/memories/search` | 语义检索记忆（query, limit, type 参数） |
| GET | `/api/v1/memories/{id}` | 获取特定记忆 |
| POST | `/api/v1/memories` | 创建记忆 |
| PUT | `/api/v1/memories/{id}` | 更新记忆 |
| DELETE | `/api/v1/memories/{id}` | 删除记忆 |

### 约束

1. 记忆提取是异步进行的，不阻塞聊天响应
2. 低重要度的记忆应该被过滤
3. 敏感信息不应被存储为记忆
4. 每次对话注入的记忆不超过 10 条

---

## 上下文管理

当前实现为简单拼接，无 Token 计算和消息截断逻辑。

### 上下文构建流程

1. 加载系统提示词 = Agent.system_prompt + 启用的规则内容 + 记忆上下文
2. 加载历史消息（全量，无截断）
3. 添加当前用户输入
4. 发送到 LLM

### 已知限制

- 无 Token 计数，依赖模型自身的上下文窗口截断
- 无滑动窗口或消息摘要机制
- 记忆注入无数量限制

> 改进方案见 [plans/agent-architecture/evolution-plan.md](../../plans/agent-architecture/evolution-plan.md) Phase 2.2-2.3
