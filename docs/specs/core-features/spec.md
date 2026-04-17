# 核心功能规范

本文档定义 Chat Bot 的核心功能：聊天系统、Agent 系统、工具系统、规则系统、记忆系统、定时任务系统、通知系统和上下文管理。

> 架构演进计划见 [plans/后续.md](../../plans/后续.md)

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
| `agent_switch` | — | Agent 切换事件（多 Agent 协作） |
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
| DELETE | `/api/v1/chat/sessions/{id}` | 删除会话及其消息 |
| PUT | `/api/v1/chat/sessions/{id}/pin` | 切换会话置顶状态 |

### 约束

1. 聊天流式传输基于 AI SDK UI 的 `Chat` 类 + 自定义 `ChatTransport`
2. 后端 SSE 事件必须在 `useChatTransport.ts` 中正确转换为 `UIMessageChunk`
3. Chat 实例为模块级单例，所有组件共享同一份消息状态
4. Agent 和 Rule 在请求时通过 ChatTransport 的 extraBody 注入
5. 会话和消息持久化存储在 PostgreSQL（TypeORM）
6. 失败消息保留在数据库，支持手动重试（regenerate）

### 联网搜索控制

联网搜索默认开启，采用意图判断机制：

| 状态 | 行为 |
|------|------|
| 开启（默认） | AI 判断用户意图：需要实时数据的请求（新闻、天气、最新信息）调用 `web_search`；普通对话、知识问答、代码编写等不调用 |
| 关闭 | 在 system prompt 中明确指示不调用 `web_search`，直接用已有知识回答 |

- 用户可通过输入框下方"联网"按钮切换
- 切换状态在发送后保持，不会重置

### 消息发送反馈

- 用户消息气泡右下角显示"已发送"灰色小字
- AI 空回复（无内容且非 streaming 且为最后一条）显示"暂无回复"+ 重试按钮
- 消息发送失败时显示错误提示 + 重试按钮

---

## Agent 系统

基于 LangGraph Supervisor 模式的多 Agent 协作系统。Supervisor 根据用户请求自动路由到最合适的专业 Agent，支持多步编排（一次任务串联多个 Agent）。

### 架构

```
Supervisor（任务协调器）
  ├── Worker Agent A (createReactAgent) — 独立 system_prompt + 工具集 + 可选模型
  ├── Worker Agent B (createReactAgent) — ...
  └── Worker Agent C (createReactAgent) — ...

独立执行图（不经过 Supervisor）
  └── builtin-job-executor (createReactAgent) — 定时任务执行专用

Standalone 模式（自定义 Agent）
  └── 用户选 standalone Agent 时 → 跳过 Supervisor，直接用该 Agent 的独立图
```

- Supervisor 根据 Agent 的 `capabilities` + 工具列表进行路由决策
- Supervisor 支持多步编排：Agent A 完成 → 返回 Supervisor → 路由到 Agent B → 综合 results
- `outputMode: 'full_history'` 保留完整消息历史，让 Supervisor 看到每个 Agent 的中间结果
- `HIDDEN_AGENTS` 中的 Agent 不参与 Supervisor 路由，拥有独立的执行图
- 每个 Worker Agent 拥有独立的 system prompt、工具集、可选模型和 temperature
- 支持 `preferredAgent` 偏好提示（软偏好，不阻止多 Agent 编排）
- `standalone` 模式的 Agent 跳过 Supervisor，用户选它时只走单 Agent 图
- Agent 变更时自动触发 Supervisor 图重建和 standalone 图缓存清理
- 定时任务执行通过 `LangGraphService.executeAsAgent()` 独立运行，不经过 Supervisor

### 数据模型

```typescript
// TypeORM Entity: backend/src/common/entities/agent.entity.ts
interface Agent {
  id: string               // UUID，主键
  name: string
  description: string
  system_prompt: string
  traits: string[]          // simple-array 类型
  tools: string[]           // Agent 绑定的工具名列表
  skills: string[]          // 技能标签
  model_name?: string       // 可选独立模型
  capabilities: string      // 能力描述（Supervisor 路由依据）
  enabled: boolean          // 是否启用
  temperature?: number      // 可选温度参数
  avatar?: string           // Agent 头像
  category?: string         // 分类
  max_turns?: number        // 最大轮次
  handoff_targets: string[] // 可委托目标 Agent 列表
  standalone: boolean       // true = 独立运行，不经过 Supervisor 编排
  is_builtin: boolean       // 内置 Agent 标记
  is_system: boolean        // 系统核心 Agent（不可编辑/删除/复制创建）
  created_at: Date
  updated_at: Date
}
```

持久化：PostgreSQL（TypeORM），启动时自动 seed 内置 Agent。

### 内置 Agent

Agent 分为三种权限级别：

| 类型 | is_builtin | is_system | 说明 |
|------|-----------|-----------|------|
| 系统内置 | true | true | 超级助手、定时任务执行器 — 不可编辑/删除/复制创建 |
| 系统示例 | true | false | 编程专家、写作助手 — 可编辑/删除/复制创建 |
| 用户自定义 | false | false | 用户创建 — 可编辑/删除 |

| ID | 名称 | is_system | standalone | 说明 |
|----|------|-----------|-----------|------|
| `builtin-general` | 超级助手 | true | false | 多 Agent 编排入口，日常对话、定时任务管理 |
| `builtin-programmer` | 编程专家 | false | false | 代码编写与调试 |
| `builtin-writer` | 写作助手 | false | false | 文案创作、文章润色 |
| `builtin-job-executor` | 定时任务执行器 | true | false | 后台定时任务执行（隐藏，不参与 Supervisor 路由） |

- `is_system: true` 的 Agent 不可修改、删除、复制创建
- `is_builtin && !is_system` 的系统示例 Agent 允许编辑行为配置、删除和复制创建
- 内置 Agent `standalone: false`，参与 Supervisor 多 Agent 编排
- 用户自定义 Agent 默认 `standalone: true`，选它时跳过 Supervisor 独立运行

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
4. Agent 变更时触发 Supervisor 图重建 + standalone 图缓存清理
5. `is_system: true` 的 Agent 拒绝 update/delete 操作
6. `is_builtin && !is_system` 的系统示例 Agent 允许部分字段修改（system_prompt、description、tools 等）和删除

---

## 工具系统

统一的工具注册和管理系统，支持权限分级、分类管理和批量注册。

### 架构

```
ToolRegistryService（注册中心）
  ├── tool.loader.ts         ← 统一加载器，批量注册工具集合
  ├── base/tool.helper.ts    ← safeTool 错误包装，透传 RunnableConfig（含 session_id）
  ├── collections/           ← 按能力域分组的工具
  │   ├── search.tools.ts         — web_search (Bocha)
  │   ├── communication.tools.ts  — send_mail (SMTP)
  │   ├── system.tools.ts         — time_now, execute_command
  │   └── file-system.tools.ts    — read_file, write_file, list_directory
  ├── memory-extract.tool.ts      — 从对话提取记忆
  ├── knowledge-query.tool.ts     — 语义查询记忆
  └── cron-job.tool.ts            — 定时任务管理（add/list/toggle/delete）
```

### 工具权限与分类

**权限级别**：`read`（只读） | `write`（写入） | `confirm`（需确认，待实现）

**工具类别**：`search` | `communication` | `system` | `file` | `memory` | `orchestration` | `general`

### 工具清单

| 工具名 | 类别 | 权限 | 功能 | 外部依赖 |
|--------|------|------|------|---------|
| `web_search` | search | read | Bocha 联网搜索 | `BOCHA_API_KEY` |
| `send_mail` | communication | write | SMTP 发送邮件 | `MAIL_HOST/USER/PASS` |
| `time_now` | system | read | 获取服务器时间 | 无 |
| `execute_command` | system | write | 执行系统命令 | OS shell（需白名单限制） |
| `read_file` | file | read | 读取文件（限 50KB） | 无 |
| `write_file` | file | write | 写入文件 | 无 |
| `list_directory` | file | read | 列出目录内容 | 无 |
| `extract_memory` | memory | write | 提取对话记忆 | MemoryService |
| `knowledge_query` | memory | read | 语义查询记忆 | MemoryService |
| `cron_job` | orchestration | write | 定时任务管理（创建/查看/启停/删除） | JobService |

### 注册流程

1. `LangGraphModule.onModuleInit()` 触发注册
2. `registerAllTools()` 批量注册通用工具集合（collections/）
3. 逐一注册业务工具（memory-extract、knowledge-query、cron-job）
4. 所有工具注册完成后，调用 `LangGraphService.initGraph()` 构建 Supervisor 图和执行器图
5. 每个 Agent 通过 `tools` 字段绑定所需的工具名列表
6. `safeTool()` 透传 `RunnableConfig`，工具可通过 `config.configurable.thread_id` 获取当前会话 ID

### API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/tools` | 获取所有工具（含权限信息） |

### 约束

1. 所有工具使用 `safeTool()` 包装，统一错误格式，避免 stack trace 泄露给 Agent
2. `safeTool()` handler 签名 `(input, config?)` 可访问 `config.configurable.thread_id`（会话 ID）
3. 工具通过 `ToolRegistryService` 集中管理，按名查找
4. 新增工具只需在 `collections/` 中创建文件并在 `tool.loader.ts` 中注册
5. `execute_command` 和 `write_file` 具有安全风险，生产环境需加白名单限制
6. Agent 间路由由 Supervisor 原生 `transfer_to_<agent_name>` handoff 工具处理，无需自定义委托工具

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

## 定时任务系统

AI 驱动的定时任务系统，用户通过自然语言对话创建定时任务，由独立的后台执行 Agent 调用工具完成操作。

### 架构

```
用户对话 → cron_job 工具 → JobService.addJob() → 数据库 + 运行时注册
                               ↓ 自动绑定 created_by_session
定时触发 → JobService.executeJob() → LangGraphService.executeAsAgent()
                                        ↓
                                    builtin-job-executor（独立执行图）
                                        ↓
                                    调用工具（send_mail / web_search / ...）
                                        ↓ 按任务 allowed_tools 白名单过滤（未设置则用完整工具集）
                                    JobExecutionService 记录结果
                                        ↓
                                    双重通知：
                                    ├── NotificationService.create() → 全局通知（右上角铃铛）
                                    └── MessageEntity 注入 session → 会话内通知消息
```

**双 Agent 分离设计**：
- 对话 Agent（如 `builtin-general` 超级助手）绑定 `cron_job` 工具，负责解析用户意图并创建任务
- 执行 Agent（`builtin-job-executor`）隐藏于 Supervisor 路由之外，拥有独立的执行图和工具集

### 数据模型

```typescript
// TypeORM Entity: backend/src/common/entities/job.entity.ts
interface Job {
  id: string                    // UUID，主键
  instruction: string           // 自然语言任务指令
  type: 'cron' | 'every' | 'at' // 任务类型
  cron: string | null           // Cron 表达式（type=cron）
  every_ms: number | null       // 间隔毫秒（type=every）
  at: Date | null               // 执行时间（type=at）
  timezone: string              // 时区，默认 Asia/Shanghai
  is_enabled: boolean           // 是否启用
  allowed_tools: string[]       // 执行时可用的工具白名单
  timeout_ms: number            // 执行超时（默认 60000ms）
  max_retries: number           // 最大重试次数（默认 3）
  consecutive_failures: number  // 连续失败计数
  auto_disable_threshold: number// 自动停用阈值（默认 5）
  agent_id: string | null       // 执行 Agent ID
  created_by_session: string | null
  last_run: Date | null
  created_at: Date
  updated_at: Date
}

// TypeORM Entity: backend/src/common/entities/job-execution.entity.ts
interface JobExecution {
  id: string
  job_id: string
  status: 'running' | 'success' | 'failed'
  result: string | null
  error: string | null
  duration_ms: number | null
  retry_attempt: number
  started_at: Date
  finished_at: Date | null
}
```

### 任务类型

| 类型 | 触发方式 | 参数 | 示例 |
|------|---------|------|------|
| `cron` | Cron 表达式 | `cron` | "0 8 * * *"（每天 8 点） |
| `every` | 固定间隔 | `every_ms`（毫秒） | 300000（每 5 分钟） |
| `at` | 一次性定时 | `at`（ISO 8601） | "2026-04-14T15:00:00Z" |

### 执行机制

1. 任务到期触发 → `executeJob()` 加锁防并发
2. 调用 `LangGraphService.executeAsAgent(instruction, sessionId)` 执行
3. 执行器 Agent 根据指令自主决定调用哪些工具
4. 分层重试：可重试错误（timeout / rate-limit / 网络错误）自动重试，延迟递增
5. 连续失败达到阈值自动停用任务
6. 一次性任务（`at` 类型）执行后自动禁用

### API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/cron-jobs` | 获取所有任务（含运行状态和最近执行） |
| GET | `/api/v1/cron-jobs/{id}` | 获取特定任务 |
| POST | `/api/v1/cron-jobs` | 创建任务 |
| PATCH | `/api/v1/cron-jobs/{id}/toggle` | 启用/停用任务 |
| DELETE | `/api/v1/cron-jobs/{id}` | 删除任务 |
| POST | `/api/v1/cron-jobs/{id}/trigger` | 手动触发执行 |
| GET | `/api/v1/cron-jobs/{id}/executions` | 获取执行历史 |
| GET | `/api/v1/cron-jobs/{id}/executions/latest` | 获取最近一次执行 |

### 约束

1. 工具通过 `safeTool()` + `ToolRegistryService` 注册，不使用 `@Injectable` Service 模式
2. `builtin-job-executor` 必须在 `HIDDEN_AGENTS` 中，不参与 Supervisor 路由
3. 执行 Agent 的工具集独立于对话 Agent，通过 DB `tools` 字段配置
4. 调度参数结构化存储，任务指令保持自然语言（用户原始表述）
5. 任务执行有超时保护，默认 60 秒
6. 前端管理页面位于 `/cron-jobs`，赛博朋克主题风格
7. `cron_job` 工具支持 `add/list/toggle/delete` 四种操作，prompt 包含每个 action 的 JSON 调用示例以防止参数遗漏
8. `at` 类型任务校验时间不能是过去的时间，过期时间会被拒绝
9. 任务执行时按 `allowed_tools` 白名单过滤工具（未设置则使用执行器完整工具集）
10. 任务执行完成后触发双重通知：全局通知（右上角铃铛）+ 会话内 system 消息
11. `created_by_session` 通过 `safeTool` 透传的 `config.configurable.thread_id` 自动绑定

---

## 通知系统

定时任务执行完成后的全局通知机制，用户在任何页面都能通过右上角铃铛收到通知。

### 数据模型

```typescript
// TypeORM Entity: backend/src/common/entities/notification.entity.ts
interface Notification {
  id: string               // UUID，主键
  type: 'cron_job'         // 通知类型
  title: string            // 通知标题
  content: string          // 通知内容
  is_read: boolean         // 是否已读
  job_id: string | null    // 关联任务 ID
  session_id: string | null// 关联会话 ID
  created_at: Date
}
```

### 通知流程

1. 任务执行完成（成功或失败）→ `JobService.notifyJobResult()`
2. 创建 `NotificationEntity` 记录（全局通知，前端铃铛轮询展示）
3. 若任务有 `created_by_session`，注入 `system` 角色消息到该会话
4. 前端 `NotificationBell` 组件每 30 秒轮询 `/api/v1/notifications/unread-count`

### API 端点

| 方法 | 端点 | 描述 |
|------|------|------|
| GET | `/api/v1/notifications` | 获取通知列表（分页） |
| GET | `/api/v1/notifications/unread-count` | 获取未读通知数 |
| POST | `/api/v1/notifications/{id}/read` | 标记单条已读 |
| POST | `/api/v1/notifications/read-all` | 全部标记已读 |

### 前端组件

- `NotificationBell.vue`：全局铃铛组件，含未读数 badge + 下拉通知面板
- `NotificationToast.vue`：实时 toast 通知组件，检测到新通知时通过 Naive UI `useNotification()` 弹出
- 挂载位置：`NotificationBell` 在 `ChatContainer.vue` 工具栏 + `AppHeader.vue`；`NotificationToast` 在 `App.vue`（全局生效）
- `stores/notification.ts`：Pinia Store，30s 轮询 `unread-count`，检测增量时推送 `toastQueue`

### Toast 通知机制

1. Store 轮询 `fetchUnreadCount` 时，检测到未读数增加（排除首次加载）
2. 拉取新增通知，过滤未读项推入 `toastQueue`
3. `NotificationToast` 组件 watch `toastQueue.length`，消费队列调用 `naiveNotification.info()` 弹出 toast
4. Toast 5 秒自动关闭，hover 时保持显示

### 约束

1. 通知为全局单用户模式，无多用户区分
2. 前端轮询间隔 30 秒，可通过 store 配置
3. 点击通知可跳转到关联会话
4. Toast 仅在未读数增量时触发，首次加载不弹窗

---

## 上下文管理

当前实现为简单拼接，无 Token 计算和消息截断逻辑。

### 上下文构建流程

1. 加载系统提示词 = Agent.system_prompt + 启用的规则内容 + 记忆上下文
2. 加载历史消息（全量，无截断）
3. 添加当前用户输入
4. 构建 Supervisor Graph（根据启用的 Agent 和工具配置动态构建）
5. 发送到 LLM

### 已知限制

- 无 Token 计数，依赖模型自身的上下文窗口截断
- 无滑动窗口或消息摘要机制
- 记忆注入数量限制为 10 条

> 改进方案见 [plans/后续.md](../../plans/后续.md)
