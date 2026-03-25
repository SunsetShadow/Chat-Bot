# 核心功能规范

本文档定义 Chat Bot 的核心功能：聊天系统、Agent 系统、规则系统、记忆系统和上下文管理。

---

## 聊天系统

基于 Server-Sent Events (SSE) 的实时流式聊天系统。

### 数据流

```
用户输入 → API 请求 → LLM Provider → SSE 流式响应 → 前端渲染
```

### SSE 事件类型

| 事件类型 | 描述 |
|---------|------|
| `message_start` | 新消息开始 |
| `content_delta` | 内容块增量 |
| `message_done` | 消息完成 |
| `done` | 会话完成 |

### API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/v1/chat/completions` | 发送聊天消息（SSE 流式） |
| GET | `/api/v1/sessions` | 获取会话列表 |
| GET | `/api/v1/sessions/{id}` | 获取特定会话 |
| DELETE | `/api/v1/sessions/{id}` | 删除会话 |

### 错误处理

| 错误类型 | 处理策略 |
|---------|---------|
| 连接超时 | 30秒无响应自动重连，最多3次 |
| 网络中断 | 指数退避重连（1s, 2s, 4s, 8s） |
| 服务端错误 | 显示错误提示，保留用户输入 |

### 约束

1. 所有聊天消息必须通过 SSE 流式传输
2. Agent 和 Rule 在请求时注入到系统提示词
3. 会话持久化存储在本地文件系统
4. SSE 连接超时设为 30 秒
5. 失败消息保留在本地，支持手动重试

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
  avatar?: string
  is_active: boolean
  created_at: string
  updated_at: string
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
  description: string
  content: string
  category: 'behavior' | 'format' | 'constraint'
  is_enabled: boolean
  priority: number  // 1-10，默认 5
  created_at: string
  updated_at: string
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
  session_id: string
  memory_type: 'fact' | 'preference' | 'event'
  content: string
  confidence: number  // 0.0 - 1.0
  created_at: string
}
```

### 记忆类型

| 类型 | 描述 | 过期时间 |
|------|------|----------|
| `fact` | 事实信息 | 永不过期 |
| `preference` | 用户偏好 | 30 天 |
| `event` | 重要事件 | 7 天 |

### API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/memories` | 获取所有记忆 |
| GET | `/api/v1/memories/{id}` | 获取特定记忆 |
| DELETE | `/api/v1/memories/{id}` | 删除记忆 |

### 约束

1. 记忆提取是异步进行的，不阻塞聊天响应
2. 低置信度的记忆应该被过滤
3. 敏感信息不应被存储为记忆
4. 每次对话注入的记忆不超过 10 条
5. 事件类型记忆默认 7 天后过期

---

## 上下文管理

管理对话上下文，包括 Token 限制和消息截断。

### Token 分配原则

- 系统提示词优先级最高，不可截断
- 最近 10 条消息必须完整保留
- Token 超限时优先移除最早的普通消息
- 保留的消息总数不超过配置的最大值

### 上下文构建流程

1. 加载系统提示词（Agent + Rules）
2. 注入相关记忆
3. 加载历史消息（滑动窗口截断）
4. 添加当前用户输入
5. 检查 Token 限制，如超限则执行摘要或截断
6. 发送到 LLM

### 约束

1. 系统提示词优先级最高，不可截断
2. 最近 10 条消息必须完整保留
3. 摘要操作异步进行，不阻塞响应
4. Token 超限时优先移除最早的普通消息

---

## 关键文件

| 路径 | 用途 |
|------|------|
| `frontend/src/composables/useSSE.ts` | SSE 解析逻辑 |
| `frontend/src/api/chat.ts` | API 调用和流处理 |
| `backend/app/api/v1/chat.py` | 聊天 API 路由 |
| `backend/app/services/chat_service.py` | 核心聊天逻辑 |
| `backend/app/services/agent_service.py` | Agent 业务逻辑 |
| `backend/app/services/rule_service.py` | 规则业务逻辑 |
| `backend/app/services/memory_service.py` | AI 记忆提取 |
| `backend/app/services/context_service.py` | 上下文管理服务 |
