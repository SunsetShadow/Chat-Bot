# AI 定时任务系统设计文档

> 日期: 2026-04-13
> 状态: 待实施
> 范围: Phase 1 (基础调度) + Phase 2 (生产加固) + 前端管理页面

---

## 1. 概述

为 Chat-Bot 项目实现自然语言驱动的 AI 定时任务系统。用户通过对话创建定时任务，系统按计划自动触发执行 Agent 完成任务。

### 核心架构

**双 Agent 分离模式**：对话 Agent 绑定 `cron_job` 工具负责任务创建，执行 Agent（复用 Supervisor 路由）负责到点执行。执行 Agent 不绑定 `cron_job` 工具，防止无限递归。

```
用户对话 → Supervisor Agent
              ↓ 识别定时任务意图
              ↓ 调用 cron_job 工具
         JobService
              ↓ 写入 JobEntity + 注册到 SchedulerRegistry
              ↓
         调度器触发 → ChatService.streamCompletion()
              ↓ Supervisor 路由到执行 Agent
         Worker Agent（工具白名单控制）
              ↓ 执行任务 → 返回结果
         JobExecution 记录
```

### 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 执行 Agent 实现 | 复用 Supervisor 路由 | 零新代码，复用完整 Supervisor + 工具体系 |
| 工具注册模式 | `safeTool()` + `ToolRegistryService` | 与现有架构一致 |
| 数据库 | PostgreSQL + TypeORM | 与项目一致 |
| 调度实现 | `@nestjs/schedule` + `SchedulerRegistry` | 轻量方案，Phase 3 按需升级 BullMQ |
| 并发保护 | `Set<string>` 单进程方案 | 够用，Phase 3 按需升级 Redis 锁 |
| 前端 | 完整管理页面（借助 frontend-design 技能） | 任务列表 + 执行历史 + 创建/删除/启停 |

---

## 2. 数据模型

### 2.1 JobEntity（任务定义）

文件: `backend/src/common/entities/job.entity.ts`

```typescript
@Entity('jobs')
export class JobEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('text')
  instruction: string;           // 自然语言任务指令

  @Column('varchar', { length: 10, default: 'cron' })
  type: 'cron' | 'every' | 'at';

  // 调度参数
  @Column('varchar', { length: 100, nullable: true })
  cron: string | null;           // type=cron: Cron 表达式

  @Column('int', { nullable: true })
  every_ms: number | null;       // type=every: 间隔毫秒

  @Column('timestamp', { nullable: true })
  at: Date | null;               // type=at: 触发时间点（UTC）

  @Column('varchar', { length: 50, default: 'Asia/Shanghai' })
  timezone: string;

  // 执行控制
  @Column({ default: true })
  is_enabled: boolean;

  @Column('simple-array', { nullable: true })
  allowed_tools: string[];       // 工具白名单，null=使用 Agent 默认工具

  @Column('int', { default: 60000 })
  timeout_ms: number;            // 执行超时毫秒，0=不限

  @Column('int', { default: 3 })
  max_retries: number;

  @Column('int', { default: 0 })
  consecutive_failures: number;

  @Column('int', { default: 5 })
  auto_disable_threshold: number;

  // Agent 关联
  @Column('varchar', { nullable: true })
  agent_id: string | null;       // 执行用的 Agent ID

  // 来源追踪
  @Column('uuid', { nullable: true })
  created_by_session: string | null;

  @Column('timestamp', { nullable: true })
  last_run: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

### 2.2 JobExecutionEntity（执行记录）

文件: `backend/src/common/entities/job-execution.entity.ts`

```typescript
@Entity('job_executions')
export class JobExecutionEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  job_id: string;

  @ManyToOne(() => JobEntity, { onDelete: 'CASCADE' })
  job: JobEntity;

  @Column('varchar', { length: 20, default: 'running' })
  status: 'running' | 'success' | 'failed';

  @Column('text', { nullable: true })
  result: string | null;

  @Column('text', { nullable: true })
  error: string | null;

  @Column('int', { nullable: true })
  duration_ms: number | null;

  @Column('int', { default: 0 })
  retry_attempt: number;         // 0=首次, 1=第一次重试, ...

  @Column('timestamp')
  started_at: Date;

  @Column('timestamp', { nullable: true })
  finished_at: Date | null;
}
```

### 2.3 三种任务类型映射

| type | 底层实现 | 触发条件 | 执行语义 |
|------|---------|---------|---------|
| `cron` | `CronJob`（cron 库） | 匹配 Cron 表达式 | 循环执行 |
| `every` | `setInterval` | 每隔 `every_ms` 毫秒 | 循环执行 |
| `at` | `setTimeout` | 到达 `at` 时间点 | 执行一次后自动停用 |

---

## 3. 调度核心 — JobService

文件: `backend/src/modules/cron-job/job.service.ts`

### 3.1 职责

- 任务 CRUD（addJob / toggleJob / deleteJob / listJobs）
- 运行时调度（startRuntime / stopRuntime）
- 启动恢复（onApplicationBootstrap）
- 核心执行引擎（executeJob）
- 超时控制 + 分层重试 + 并发保护 + 自动停用
- 优雅关闭（onApplicationShutdown）

### 3.2 执行触发方式

通过 ChatService 复用完整的 Supervisor → Worker Agent 路由链：

```
调度器触发
  → JobService.executeJob(job)
  → ChatService.streamCompletion(
      messages: [{ role: 'user', content: job.instruction }],
      systemPrompt: 执行 Agent 的 system_prompt,
      agentId: job.agent_id || 默认执行 Agent ID
    )
  → LangGraphService → Supervisor 路由 → Worker Agent
  → 收集最终结果 → 更新 JobExecution
```

选择走 ChatService 而非直接调 LangGraphService 的原因：
- ChatService 处理 session/message 持久化、system prompt 构建、规则注入、记忆注入
- 复用这些逻辑避免重复实现
- 执行记录自然保存到 MessageEntity

### 3.3 并发保护

```typescript
private readonly runningJobs = new Set<string>();

// executeJob 入口
if (this.runningJobs.has(job.id)) {
  this.logger.warn(`跳过: ${job.id} 上一次执行尚未完成`);
  return;
}
this.runningJobs.add(job.id);
try { /* 执行 */ } finally { this.runningJobs.delete(job.id); }
```

### 3.4 分层重试

```typescript
private static readonly RETRY_DELAYS = [2000, 4000, 8000]; // 指数退避

function isRetryable(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  // 超时、限流、网络错误 → 可重试
  if (/timeout|rate.limit|ECONNREFUSED|ECONNRESET|503/i.test(msg)) return true;
  // 递归超限、业务逻辑错误 → 不重试
  return false;
}
```

重试流程：
1. 首次执行失败 → 判断 `isRetryable`
2. 可重试 → 指数退避等待 → 重试（最多 `max_retries` 次）
3. 不可重试 → 直接记录失败
4. 所有重试耗尽 → `consecutive_failures++`
5. 达到 `auto_disable_threshold` → 自动停用 + 日志告警

### 3.5 超时控制

```typescript
private async runWithTimeout(instruction: string, timeoutMs: number): Promise<string> {
  if (timeoutMs <= 0) return this.executeViaChatService(instruction);
  return Promise.race([
    this.executeViaChatService(instruction),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`执行超时 ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}
```

### 3.6 启动恢复

```typescript
async onApplicationBootstrap() {
  const enabledJobs = await this.jobRepo.find({ where: { is_enabled: true } });
  for (const job of enabledJobs) {
    // 去重检查
    const alreadyRegistered = /* 检查 SchedulerRegistry */;
    if (!alreadyRegistered) await this.startRuntime(job);
  }
}
```

### 3.7 优雅关闭

```typescript
async onApplicationShutdown() {
  // 等待 runningJobs 中的任务完成（带超时）
  const deadline = Date.now() + 10000; // 最多等 10 秒
  while (this.runningJobs.size > 0 && Date.now() < deadline) {
    await this.sleep(500);
  }
  if (this.runningJobs.size > 0) {
    this.logger.warn(`关闭时仍有 ${this.runningJobs.size} 个任务在执行`);
  }
}
```

### 3.8 执行 Agent Seed

系统启动时自动 seed 一个内置 Agent 记录：

```typescript
{
  name: '定时任务执行器',
  system_prompt: '你是一个后台任务执行代理。根据指令调用工具完成操作，给出简洁的结果说明。',
  tools: ['send_mail', 'web_search', 'db_users_crud', 'time_now'],
  enabled: true,
  is_builtin: true,
}
```

如果 Job 的 `allowed_tools` 非空，触发执行时动态覆盖工具绑定。

---

## 4. cron_job 工具

文件: `backend/src/modules/langgraph/tools/cron-job.tool.ts`

### 4.1 工具定义

```typescript
export function createCronJobTool(jobService: JobService): DynamicStructuredTool {
  return safeTool(
    'cron_job',
    '管理定时任务。action=list 查看列表, action=add 新增任务, action=toggle 启停任务。',
    z.object({
      action: z.enum(['list', 'add', 'toggle']),
      type: z.enum(['cron', 'every', 'at']).optional(),
      instruction: z.string().optional(),
      cron: z.string().optional(),
      everyMs: z.number().int().positive().optional(),
      at: z.string().optional(),
      id: z.string().optional(),
      enabled: z.boolean().optional(),
    }),
    async (args) => { /* action 分发 */ },
  );
}
```

### 4.2 注册

在 `registerAllTools()` 中添加：

```typescript
registry.register(createCronJobTool(jobService), {
  permission_level: 'write',
  category: 'orchestration',
  description: '创建和管理 AI 定时任务',
});
```

### 4.3 System Prompt 规则

添加到对话 Agent 的 system prompt（通过规则系统或 Agent system_prompt）：

```
【定时任务管理规则】
- 用户请求"在未来执行某动作"时，用 cron_job 工具创建任务，不要在当前轮直接执行
- instruction 保持用户原始表述，不要改写/翻译/总结
- 类型选择：一次性 → type=at，固定间隔 → type=every，Cron 表达式 → type=cron
- type=at 时，at 参数使用 ISO 8601 格式
```

---

## 5. REST API

文件: `backend/src/modules/cron-job/cron-job.controller.ts`

### 5.1 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/cron-jobs` | 列出所有任务（含运行状态、最近执行结果） |
| GET | `/api/v1/cron-jobs/:id` | 单个任务详情 |
| POST | `/api/v1/cron-jobs` | 手动创建任务 |
| PATCH | `/api/v1/cron-jobs/:id/toggle` | 启停任务 |
| DELETE | `/api/v1/cron-jobs/:id` | 删除任务（同时停止运行时） |
| POST | `/api/v1/cron-jobs/:id/trigger` | 手动触发一次执行 |
| GET | `/api/v1/cron-jobs/:id/executions` | 执行历史（分页 + 状态过滤） |
| GET | `/api/v1/cron-jobs/:id/executions/latest` | 最近一次执行详情 |

### 5.2 DTO

**List 响应:**
```typescript
{
  id: string;
  instruction: string;
  type: 'cron' | 'every' | 'at';
  cron?: string;
  every_ms?: number;
  at?: string;
  is_enabled: boolean;
  running: boolean;           // 当前是否在 SchedulerRegistry 中注册
  consecutive_failures: number;
  last_run: string | null;
  last_execution: {
    status: 'running' | 'success' | 'failed';
    result?: string;
    error?: string;
    duration_ms?: number;
    finished_at?: string;
  } | null;
}
```

**Add 请求:**
```typescript
{
  instruction: string;
  type: 'cron' | 'every' | 'at';
  cron?: string;              // type=cron 时必填
  every_ms?: number;          // type=every 时必填
  at?: string;                // type=at 时必填（ISO 8601）
  timezone?: string;          // 默认 Asia/Shanghai
  allowed_tools?: string[];
  timeout_ms?: number;
  max_retries?: number;
}
```

### 5.3 删除行为

1. `stopRuntime()` 停止运行中的调度
2. 从数据库删除 JobEntity（`CASCADE` 自动清理 JobExecution）

### 5.4 分页

```
GET /api/v1/cron-jobs/:id/executions?page=1&per_page=20&status=failed
```

---

## 6. 错误处理策略

| 错误场景 | 处理方式 |
|---------|---------|
| Cron 表达式无效 | `addJob()` 时校验，返回友好错误给 Agent |
| 任务执行超时 | `Promise.race` + `setTimeout`，超时后 reject |
| 工具调用异常 | `safeTool` 内部 try-catch，返回结构化错误 |
| Agent 循环调用 | LangGraph `recursion_limit: 25` |
| 数据库写入失败 | JobService 内部 catch，记日志，不影响调度循环 |
| 启动恢复注册失败 | 单个任务失败不影响其他任务，记 warn 日志继续 |
| ChatService 不可用 | 执行失败走正常重试流程 |

---

## 7. 模块依赖

```
AppModule
  ├── ScheduleModule.forRoot()          ← 新增
  ├── TypeOrmModule (entities + JobEntity + JobExecutionEntity)
  ├── ChatModule
  │     ├── ChatService                 ← 被 CronJobModule 调用
  │     └── LangGraphModule
  │           ├── LangGraphService
  │           └── ToolRegistryService   ← 注册 cron_job 工具
  ├── CronJobModule                     ← 新增
  │     ├── JobService                  (调度核心)
  │     ├── JobExecutionService         (执行记录)
  │     └── CronJobController           (REST API)
  ├── AgentModule                       ← seed 执行 Agent 记录
  └── ...
```

新增依赖: `@nestjs/schedule`、`cron`

循环依赖: CronJobModule ↔ ChatModule 用 `forwardRef` 解决。

---

## 8. 前端管理页面

借助 `frontend-design` 技能在实施阶段完成 UI 设计和实现。

### 功能要求

1. **任务列表页** — 展示所有定时任务，含状态指示（启用/停用/运行中）、类型、调度规则、最近执行状态
2. **启停控制** — 一键启用/停用任务
3. **手动创建** — 表单创建任务（选类型、填调度参数、写指令）
4. **删除任务** — 确认后删除
5. **执行历史** — 查看单个任务的执行记录（时间、状态、耗时、结果/错误）
6. **手动触发** — 一键触发执行（调试用）

### 技术要求

- 遵循项目现有 Vue 3 + 赛博朋克/霓虹未来主义主题
- 与现有聊天界面的 UI 风格保持一致
- 可作为独立路由页面或聊天界面内的侧边面板

### API 对接

对接后端 REST API（第 5 节），无需额外 WebSocket（执行状态通过轮询刷新）。

---

## 9. 范围与不做什么

### 本期实现（Phase 1 + Phase 2 + 前端）

- JobEntity + JobExecutionEntity 数据模型
- JobService（CRUD + 运行时调度 + 启动恢复 + 优雅关闭）
- cron_job 工具（safeTool + ToolRegistryService 注册）
- 执行 Agent seed（内置 Agent 记录）
- 并发保护（Set）
- 超时控制（Promise.race）
- 分层重试（指数退避 + isRetryable 判断）
- 自动停用 + 重置失败计数
- 执行记录 CRUD
- REST API（CRUD + 手动触发 + 执行历史）
- 前端管理页面（借助 frontend-design 技能）
- System Prompt 规则注入

### 不做（YAGNI）

- 不实现分布式锁（单实例足够）
- 不引入 BullMQ（@nestjs/schedule + Set 轻量方案）
- 不实现任务版本管理
- 不实现结果通知渠道（执行结果存数据库可查）
- 不修改现有工具或 Agent 的核心逻辑

---

## 10. 新增/修改文件清单

```
新增文件:
backend/src/
├── common/entities/
│   ├── job.entity.ts
│   └── job-execution.entity.ts
└── modules/cron-job/
    ├── cron-job.module.ts
    ├── job.service.ts
    ├── job-execution.service.ts
    ├── cron-job.controller.ts
    └── dto/
        ├── create-job.dto.ts
        └── job-response.dto.ts

新增工具:
backend/src/modules/langgraph/tools/cron-job.tool.ts

修改文件:
backend/src/app.module.ts                    ← 添加 ScheduleModule + CronJobModule
backend/src/modules/langgraph/tools/         ← 注册 cron_job 工具
backend/src/modules/agent/                   ← seed 内置执行 Agent
frontend/src/                                ← 前端管理页面（具体文件由 frontend-design 确定）
```
