# 核心功能规范

本文档定义 Chat Bot 的核心功能：聊天系统、Agent 系统、规则系统、记忆系统和上下文管理。

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

### 前端关键文件

| 文件 | 用途 |
|------|------|
| `composables/useAIChat.ts` | Chat 实例管理（单例），提供 sendMessage / stopStreaming / regenerate |
| `composables/useChatTransport.ts` | 自定义 ChatTransport，SSE → UIMessageChunk 转换 |
| `stores/chat.ts` | Pinia store，管理会话列表和当前会话状态 |
| `api/chat.ts` | REST API 调用（会话 CRUD、消息历史） |

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
| POST | `/api/v1/chat/completions` | 发送聊天消息（SSE 流式，ChatTransport 调用） |
| POST | `/api/v1/chat/sessions` | 创建新会话 |
| GET | `/api/v1/chat/sessions` | 获取会话列表（分页） |
| GET | `/api/v1/chat/sessions/{id}` | 获取特定会话 |
| GET | `/api/v1/chat/sessions/{id}/messages` | 获取会话消息历史 |
| PUT | `/api/v1/chat/sessions/{id}/pin` | 切换会话置顶状态 |

### 错误处理

| 错误类型 | 处理策略 |
|---------|---------|
| 连接超时 | 30秒无响应自动重连，最多3次 |
| 网络中断 | 指数退避重连（1s, 2s, 4s, 8s） |
| 服务端错误 | 显示错误提示，保留用户输入 |

### 约束

1. 聊天流式传输基于 AI SDK UI 的 `Chat` 类 + 自定义 `ChatTransport`
2. 后端 SSE 事件必须在 `useChatTransport.ts` 中正确转换为 `UIMessageChunk`
3. Chat 实例为模块级单例，所有组件共享同一份消息状态
4. Agent 和 Rule 在请求时通过 ChatTransport 的 extraBody 注入
5. 会话持久化存储在本地文件系统
6. 失败消息保留在本地，支持手动重试（regenerate）

---

## Agent 系统

允许用户选择不同的 AI 人设角色，每个 Agent 拥有自定义的系统提示词。

### 数据模型

```typescript
interface Agent {
  id: string
  name: string
  description: string
  system_prompt: string
  traits: string[]          // 性格特征列表
  is_builtin: boolean       // 内置 Agent 不可删除
  created_at?: Date
  updated_at?: Date
}
```

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
interface Rule {
  id: string
  name: string
  content: string
  enabled: boolean                          // 是否启用
  category: 'behavior' | 'format' | 'constraint'
  priority: number                          // 优先级
  conflict_strategy: 'override' | 'merge' | 'reject'  // 冲突策略
  is_builtin: boolean                       // 内置规则不可删除
}
```

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

使用 AI 自动从对话中提取重要信息，存储为长期记忆。

### 数据模型

```typescript
interface Memory {
  id: string
  content: string
  type: 'fact' | 'preference' | 'event'
  source_session_id: string | null  // 来源会话
  importance: number                // 1-10，重要程度
  created_at: Date
  last_accessed: Date
}
```

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

### 上下文构建流程（当前）

1. 加载系统提示词 = Agent.system_prompt + 启用的规则内容 + 记忆上下文
2. 加载历史消息（全量，无截断）
3. 添加当前用户输入
4. 发送到 LLM

### 已知限制

- 无 Token 计数，依赖模型自身的上下文窗口截断
- 无滑动窗口或消息摘要机制
- 记忆注入无数量限制

> 改进方案见 `docs/specs/agent-architecture/spec.md` Phase 2.2-2.3

---

## 关键文件

| 路径 | 用途 |
|------|------|
| `frontend/src/composables/useAIChat.ts` | AI SDK Chat 实例管理（单例） |
| `frontend/src/composables/useChatTransport.ts` | 自定义 ChatTransport（SSE → UIMessageChunk） |
| `frontend/src/stores/chat.ts` | Pinia 聊天状态管理 |
| `frontend/src/api/chat.ts` | REST API 调用 |
| `frontend/src/components/chat/` | 聊天 UI 组件 |
| `backend/src/modules/chat/chat.controller.ts` | 聊天 API 路由（含 SSE） |
| `backend/src/modules/chat/chat.service.ts` | 核心聊天逻辑 |
| `backend/src/modules/langgraph/langgraph.service.ts` | LangGraph 工作流 |
| `backend/src/modules/agent/` | Agent 模块（controller/service/dto） |
| `backend/src/modules/rule/rule.service.ts` | 规则业务逻辑 |
| `backend/src/modules/memory/memory.service.ts` | 记忆管理 |
