# NestJS + LangChain AI 定时任务系统 — 完整实现指南

> 基于 cron-job-tool 项目提炼，面向 NestJS 开发者，提供从零搭建"自然语言驱动的 AI 定时任务系统"的完整方案。
> 包含架构设计、数据模型、核心代码、工程健壮性保障、模块组织和逐步搭建步骤。

---

## 目录

1. [系统全貌](#1-系统全貌)
2. [依赖与环境](#2-依赖与环境)
3. [Step 1: 数据模型](#step-1-数据模型)
4. [Step 2: 调度核心 — JobService](#step-2-调度核心--jobservice)
5. [Step 3: LangChain 工具封装](#step-3-langchain-工具封装)
6. [Step 4: 执行 Agent — JobAgentService](#step-4-执行-agent--jobagentservice)
7. [Step 5: 对话 Agent — AiService](#step-5-对话-agent--aiservice)
8. [Step 6: 模块组织](#step-6-模块组织)
9. [Step 7: 控制器与前端](#step-7-控制器与前端)
10. [System Prompt 设计要点](#system-prompt-设计要点)
11. [注意事项与常见陷阱](#注意事项与常见陷阱)

---

## 1. 系统全貌

### 核心思路

**将定时任务的"创建/管理"和"触发执行"分离为两个独立的 Agent，各自绑定不同的工具集。**

```
┌──────────────────────────────────────────────────────────────────┐
│  用户自然语言： "每天早上 9 点给我发天气预报邮件"                      │
└──────────────────────────┬───────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  对话 Agent (AiService)                                          │
│  绑定工具：cron_job + send_mail + web_search + ...               │
│  职责：理解意图 → 解析时间 → 创建定时任务 → 回复用户                 │
│  ⚠ 本轮只创建任务，不直接执行任务动作                               │
└──────────────────────────┬───────────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  调度层 (JobService)                                              │
│  职责：任务 CRUD + 运行时调度 + 启动恢复 + 超时/重试/并发保护       │
│  三种类型：cron(CronJob) / every(setInterval) / at(setTimeout)    │
└──────────────────────────┬───────────────────────────────────────┘
                           ▼ 触发
┌──────────────────────────────────────────────────────────────────┐
│  执行 Agent (JobAgentService)                                     │
│  绑定工具：send_mail + web_search + db_users_crud + time_now     │
│  职责：LLM 解析 instruction → 多轮工具调用 → 返回结果              │
│  ⚠ 不绑定 cron_job 工具（防无限递归）                              │
└──────────────────────────────────────────────────────────────────┘
```

### 为什么需要两个 Agent？

| | 对话 Agent | 执行 Agent |
|---|---|---|
| **何时触发** | 用户发消息时 | 任务到点时 |
| **绑定 cron_job** | 是 | **否** |
| **System Prompt** | 包含时间解析规则 | 只聚焦执行任务 |
| **instruction** | 从自然语言中提取 | 作为 HumanMessage 接收 |

> **关键**：执行 Agent 如果绑定了 cron_job，任务执行时可能再创建子任务，导致无限递归。

---

## 2. 依赖与环境

### npm 包

```json
{
  "dependencies": {
    "@nestjs/common": "^11.0.1",
    "@nestjs/config": "^4.0.3",
    "@nestjs/core": "^11.0.1",
    "@nestjs/platform-express": "^11.0.1",
    "@nestjs/schedule": "^6.1.1",
    "@nestjs/typeorm": "^11.0.0",
    "@langchain/core": "^1.1.32",
    "@langchain/openai": "^1.2.13",
    "cron": "^4.4.0",
    "typeorm": "^0.3.28",
    "mysql2": "^3.20.0",
    "zod": "^4.3.6"
  }
}
```

> `@nestjs/schedule` 提供 `ScheduleModule` 和 `SchedulerRegistry`；`cron` 提供 `CronJob` 类。

### .env 配置

```bash
# LLM（兼容 OpenAI 协议即可）
OPENAI_API_KEY=sk-xx
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL_NAME=qwen-plus
```

---

## Step 1: 数据模型

### 1.1 Job 实体（任务定义）

```typescript
// src/job/entities/job.entity.ts
import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';

export type JobType = 'cron' | 'every' | 'at';

@Entity()
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // 自然语言任务指令（交给执行 Agent 解析，不是工具调用脚本）
  @Column({ type: 'text' })
  instruction: string;

  // 三种类型：cron（Cron 表达式循环）/ every（固定间隔循环）/ at（一次性定时）
  @Column({ type: 'varchar', length: 10, default: 'cron' })
  type: JobType;

  // cron 类型：Cron 表达式，如 "0 9 * * *"
  @Column({ type: 'varchar', length: 100, nullable: true })
  cron: string | null;

  // every 类型：间隔毫秒，如 60000 = 每分钟
  @Column({ type: 'int', nullable: true })
  everyMs: number | null;

  // at 类型：指定触发时间点
  @Column({ type: 'timestamp', nullable: true })
  at: Date | null;

  @Column({ default: true })
  isEnabled: boolean;

  // 工程健壮性字段
  @Column({ type: 'int', default: 60000 })
  timeoutMs: number;            // 执行超时（毫秒），0=不限

  @Column({ type: 'int', default: 3 })
  maxRetries: number;           // 最大重试次数

  @Column({ type: 'int', default: 0 })
  consecutiveFailures: number;  // 连续失败计数

  @Column({ type: 'int', default: 5 })
  autoDisableThreshold: number; // 连续失败自动停用阈值

  @Column({ type: 'timestamp', nullable: true })
  lastRun: Date | null;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;
}
```

### 1.2 JobExecution 实体（执行记录）

```typescript
// src/job/entities/job-execution.entity.ts
import {
  Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn,
} from 'typeorm';
import { Job } from './job.entity';

export type JobExecutionStatus = 'running' | 'success' | 'failed';

@Entity()
export class JobExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  jobId: string;

  @ManyToOne(() => Job, { onDelete: 'CASCADE' })
  job: Job;

  @Column({ type: 'varchar', length: 20, default: 'running' })
  status: JobExecutionStatus;

  @Column({ type: 'text', nullable: true })
  result: string | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'int', nullable: true })
  durationMs: number | null;

  // 0=首次尝试, 1=第一次重试, ...
  @Column({ type: 'int', default: 0 })
  retryAttempt: number;

  @Column({ type: 'timestamp' })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  finishedAt: Date | null;
}
```

### 1.3 三种任务类型的映射

| Job.type | 底层实现 | 触发条件 | 执行语义 |
|---|---|---|---|
| `cron` | `CronJob`（cron 库） | 匹配 Cron 表达式 | 循环执行 |
| `every` | `setInterval` | 每隔 `everyMs` 毫秒 | 循环执行 |
| `at` | `setTimeout` | 到达 `at` 时间点 | 执行一次后自动停用 |

---

## Step 2: 调度核心 — JobService

这是整个系统最复杂的部分，负责：任务 CRUD、运行时调度、启动恢复、超时控制、失败重试、并发保护、执行记录。

```typescript
// src/job/job.service.ts
import {
  Inject, Injectable, Logger, NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { EntityManager } from 'typeorm';
import { Job } from './entities/job.entity';
import { JobExecution } from './entities/job-execution.entity';
import { JobAgentService } from '../ai/job-agent.service';

@Injectable()
export class JobService implements OnApplicationBootstrap {
  private readonly logger = new Logger(JobService.name);
  private readonly runningJobs = new Set<string>(); // 并发保护
  private static readonly RETRY_DELAYS = [2000, 4000, 8000]; // 指数退避

  @Inject(EntityManager)
  private readonly entityManager: EntityManager;

  @Inject(SchedulerRegistry)
  private readonly schedulerRegistry: SchedulerRegistry;

  @Inject(JobAgentService)
  private readonly jobAgentService: JobAgentService;

  // ─────────────────────────────────────────────
  // 1. 启动恢复：从数据库加载所有已启用的任务
  // ─────────────────────────────────────────────
  async onApplicationBootstrap() {
    const enabledJobs = await this.entityManager.find(Job, {
      where: { isEnabled: true },
    });
    const cronJobs = this.schedulerRegistry.getCronJobs();
    const intervals = this.schedulerRegistry.getIntervals();
    const timeouts = this.schedulerRegistry.getTimeouts();

    for (const job of enabledJobs) {
      const alreadyRegistered =
        (job.type === 'cron' && cronJobs.has(job.id)) ||
        (job.type === 'every' && intervals.includes(job.id)) ||
        (job.type === 'at' && timeouts.includes(job.id));
      if (alreadyRegistered) continue;
      await this.startRuntime(job);
    }
  }

  // ─────────────────────────────────────────────
  // 2. CRUD
  // ─────────────────────────────────────────────
  async listJobs() {
    const jobs = await this.entityManager.find(Job, {
      order: { createdAt: 'DESC' },
    });

    const cronJobs = this.schedulerRegistry.getCronJobs();
    const intervalNames = this.schedulerRegistry.getIntervals();
    const timeoutNames = this.schedulerRegistry.getTimeouts();

    // 批量获取最近执行记录（避免 N+1）
    const jobIds = jobs.map((j) => j.id);
    const recentExecutions = jobIds.length
      ? await this.entityManager
          .createQueryBuilder(JobExecution, 'exec')
          .where('exec.jobId IN (:...jobIds)', { jobIds })
          .orderBy('exec.startedAt', 'DESC')
          .getMany()
      : [];

    const latestByJob = new Map<string, JobExecution>();
    for (const exec of recentExecutions) {
      if (!latestByJob.has(exec.jobId)) {
        latestByJob.set(exec.jobId, exec);
      }
    }

    return jobs.map((job) => {
      const running =
        job.isEnabled &&
        ((job.type === 'cron' && cronJobs.has(job.id)) ||
          (job.type === 'every' && intervalNames.includes(job.id)) ||
          (job.type === 'at' && timeoutNames.includes(job.id)));

      const lastExec = latestByJob.get(job.id);
      return {
        ...job,
        running,
        lastExecutionStatus: lastExec?.status ?? null,
      };
    });
  }

  async addJob(
    input:
      | { type: 'cron'; instruction: string; cron: string; isEnabled?: boolean }
      | { type: 'every'; instruction: string; everyMs: number; isEnabled?: boolean }
      | { type: 'at'; instruction: string; at: Date; isEnabled?: boolean },
  ) {
    const entity = this.entityManager.create(Job, {
      instruction: input.instruction,
      type: input.type,
      cron: input.type === 'cron' ? input.cron : null,
      everyMs: input.type === 'every' ? input.everyMs : null,
      at: input.type === 'at' ? input.at : null,
      isEnabled: input.isEnabled ?? true,
      lastRun: null,
    });

    const saved = await this.entityManager.save(Job, entity);
    if (saved.isEnabled) {
      await this.startRuntime(saved);
    }
    return saved;
  }

  async toggleJob(jobId: string, enabled?: boolean) {
    const job = await this.entityManager.findOne(Job, { where: { id: jobId } });
    if (!job) throw new NotFoundException(`Job not found: ${jobId}`);

    const nextEnabled = enabled ?? !job.isEnabled;
    if (job.isEnabled !== nextEnabled) {
      job.isEnabled = nextEnabled;
      await this.entityManager.save(Job, job);
    }

    if (job.isEnabled) {
      await this.entityManager.update(Job, job.id, { consecutiveFailures: 0 });
      await this.startRuntime(job);
    } else {
      this.stopRuntime(job);
    }
    return job;
  }

  // ─────────────────────────────────────────────
  // 3. 运行时调度（注册到 SchedulerRegistry）
  // ─────────────────────────────────────────────
  private async startRuntime(job: Job) {
    if (job.type === 'cron') {
      const cronJobs = this.schedulerRegistry.getCronJobs();
      const existing = cronJobs.get(job.id);
      if (existing) { existing.start(); return; }

      const runtimeJob = new CronJob(job.cron ?? '', async () => {
        this.logger.log(`run job ${job.id}, ${job.instruction}`);
        await this.executeJob(job);
      });
      this.schedulerRegistry.addCronJob(job.id, runtimeJob);
      runtimeJob.start();
      return;
    }

    if (job.type === 'every') {
      const names = this.schedulerRegistry.getIntervals();
      if (names.includes(job.id)) return;
      if (typeof job.everyMs !== 'number' || job.everyMs <= 0) {
        throw new Error(`Invalid everyMs for job ${job.id}`);
      }

      const ref = setInterval(async () => {
        this.logger.log(`run job ${job.id}, ${job.instruction}`);
        await this.executeJob(job);
      }, job.everyMs);

      this.schedulerRegistry.addInterval(job.id, ref);
      // ⚠ 注意：这里不要 clearInterval(ref)，否则间隔会立即停止
      return;
    }

    if (job.type === 'at') {
      const names = this.schedulerRegistry.getTimeouts();
      if (names.includes(job.id)) return;
      if (!job.at) throw new Error(`Invalid at for job ${job.id}`);

      const delay = Math.max(0, job.at.getTime() - Date.now());
      const ref = setTimeout(async () => {
        this.logger.log(`run job ${job.id}, ${job.instruction}`);
        await this.executeJob(job);
        await this.entityManager.update(Job, job.id, { isEnabled: false });
        try { this.schedulerRegistry.deleteTimeout(job.id); } catch { /* ignore */ }
      }, delay);

      this.schedulerRegistry.addTimeout(job.id, ref);
      return;
    }
  }

  private stopRuntime(job: Job) {
    if (job.type === 'cron') {
      const cronJobs = this.schedulerRegistry.getCronJobs();
      cronJobs.get(job.id)?.stop();
      return;
    }
    if (job.type === 'every') {
      try { this.schedulerRegistry.deleteInterval(job.id); } catch { /* ignore */ }
      return;
    }
    if (job.type === 'at') {
      try { this.schedulerRegistry.deleteTimeout(job.id); } catch { /* ignore */ }
      return;
    }
  }

  // ─────────────────────────────────────────────
  // 4. 核心执行引擎（超时 + 重试 + 记录 + 并发保护 + 自动停用）
  // ─────────────────────────────────────────────
  private async executeJob(job: Job): Promise<void> {
    // 并发保护：如果上一次执行还未结束，跳过本次
    if (this.runningJobs.has(job.id)) {
      this.logger.warn(`[job ${job.id}] 跳过: 上一次执行尚未完成`);
      return;
    }
    this.runningJobs.add(job.id);

    const startedAt = new Date();

    try {
      await this.entityManager.update(Job, job.id, { lastRun: startedAt });

      let lastError: Error | null = null;
      let finalResult: string | null = null;
      const maxAttempts = job.maxRetries + 1; // 首次 + 重试

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const execution = await this.createExecution(job.id, attempt);

        try {
          const result = await this.runWithTimeout(job.instruction, job.timeoutMs);
          await this.finalizeExecution(execution, 'success', result, null, startedAt);

          // 成功 → 重置连续失败计数
          await this.entityManager.update(Job, job.id, { consecutiveFailures: 0 });
          finalResult = result;
          lastError = null;
          break;
        } catch (err) {
          lastError = err as Error;
          await this.finalizeExecution(
            execution, 'failed', null, lastError.message, startedAt,
          );

          // 还有重试机会 → 等待后继续
          if (attempt < maxAttempts - 1) {
            const delay = JobService.RETRY_DELAYS[attempt] ?? 8000;
            this.logger.warn(
              `[job ${job.id}] 第 ${attempt + 1} 次执行失败, ${delay}ms 后重试: ${lastError.message}`,
            );
            await this.sleep(delay);
          }
        }
      }

      if (lastError) {
        // 所有重试耗尽 → 增加连续失败计数
        const freshJob = await this.entityManager.findOne(Job, { where: { id: job.id } });
        if (freshJob) {
          const newFailCount = freshJob.consecutiveFailures + 1;
          await this.entityManager.update(Job, job.id, { consecutiveFailures: newFailCount });

          // at 类型跳过自动停用（它本身就会停用）
          if (job.type !== 'at' && newFailCount >= freshJob.autoDisableThreshold) {
            this.logger.warn(
              `[job ${job.id}] 连续失败 ${newFailCount} 次, 已达阈值 ${freshJob.autoDisableThreshold}, 自动停用`,
            );
            await this.toggleJob(job.id, false);
          }
        }
        this.logger.error(`[job ${job.id}] 所有重试均失败: ${lastError.message}`);
      } else {
        this.logger.log(`[job ${job.id}] ${finalResult}`);
      }
    } finally {
      this.runningJobs.delete(job.id);
    }
  }

  // ─────────────────────────────────────────────
  // 5. 辅助方法
  // ─────────────────────────────────────────────

  // 超时包装：防止任务挂死
  private async runWithTimeout(instruction: string, timeoutMs: number): Promise<string> {
    if (timeoutMs <= 0) {
      return this.jobAgentService.runJob(instruction);
    }
    return Promise.race([
      this.jobAgentService.runJob(instruction),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Job execution timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
  }

  // 创建执行记录
  private async createExecution(jobId: string, retryAttempt: number): Promise<JobExecution> {
    const execution = this.entityManager.create(JobExecution, {
      jobId,
      status: 'running',
      retryAttempt,
      startedAt: new Date(),
      result: null,
      error: null,
      durationMs: null,
      finishedAt: null,
    });
    return this.entityManager.save(JobExecution, execution);
  }

  // 结束执行记录
  private async finalizeExecution(
    execution: JobExecution,
    status: 'success' | 'failed',
    result: string | null,
    error: string | null,
    startedAt: Date,
  ): Promise<void> {
    execution.status = status;
    execution.result = result;
    execution.error = error;
    execution.durationMs = Date.now() - startedAt.getTime();
    execution.finishedAt = new Date();
    await this.entityManager.save(JobExecution, execution);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

---

## Step 3: LangChain 工具封装

每个工具封装为一个 `@Injectable()` Service，在构造函数中用 `tool()` 创建。

### 3.1 通用封装模式

```typescript
// src/tool/xxx-tool.service.ts
import { Injectable } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

@Injectable()
export class XxxToolService {
  readonly tool;

  constructor() {
    const argsSchema = z.object({
      // 用 zod 定义参数 schema
    });

    this.tool = tool(
      async (args) => {
        // 实际业务逻辑
        return '结果字符串';
      },
      {
        name: 'tool_name',
        description: '工具描述（LLM 根据此描述决定是否调用）',
        schema: argsSchema,
      },
    );
  }
}
```

### 3.2 cron_job 工具（关键）

这个工具是对话 Agent 创建/管理定时任务的入口：

```typescript
// src/tool/cron-job-tool.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { JobService } from '../job/job.service';

@Injectable()
export class CronJobToolService {
  readonly tool;

  @Inject(JobService)
  private readonly jobService: JobService;

  constructor() {
    const schema = z.object({
      action: z.enum(['list', 'add', 'toggle']),
      id: z.string().optional(),
      enabled: z.boolean().optional(),
      type: z.enum(['cron', 'every', 'at']).optional(),
      instruction: z.string().optional(),
      cron: z.string().optional(),
      everyMs: z.number().int().positive().optional(),
      at: z.string().optional(),
    });

    this.tool = tool(
      async ({ action, id, enabled, type, instruction, cron, everyMs, at }) => {
        switch (action) {
          case 'list': {
            const jobs = await this.jobService.listJobs();
            if (!jobs.length) return '当前没有任何定时任务。';
            return '当前定时任务列表：\n' + jobs.map((j: any) =>
              `id=${j.id} type=${j.type} enabled=${j.isEnabled} running=${j.running} ` +
              `failures=${j.consecutiveFailures ?? 0} lastStatus=${j.lastExecutionStatus ?? 'none'} ` +
              `cron=${j.cron ?? ''} everyMs=${j.everyMs ?? ''} ` +
              `at=${j.at instanceof Date ? j.at.toISOString() : j.at ?? ''} ` +
              `instruction=${j.instruction ?? ''}`
            ).join('\n');
          }
          case 'add': {
            if (!type) return '新增任务需要提供 type（cron/every/at）。';
            if (!instruction) return '新增任务需要提供 instruction。';

            if (type === 'cron') {
              if (!cron) return 'type=cron 时需要提供 cron 表达式。';
              const created = await this.jobService.addJob({ type, instruction, cron });
              return `已新增定时任务：id=${created.id} type=cron`;
            }
            if (type === 'every') {
              if (!everyMs) return 'type=every 时需要提供 everyMs。';
              const created = await this.jobService.addJob({ type, instruction, everyMs });
              return `已新增定时任务：id=${created.id} type=every everyMs=${created.everyMs}`;
            }
            if (type === 'at') {
              if (!at) return 'type=at 时需要提供 at 时间。';
              const date = new Date(at);
              if (Number.isNaN(date.getTime())) return 'at 不是合法的 ISO 时间字符串。';
              const created = await this.jobService.addJob({ type, instruction, at: date });
              return `已新增定时任务：id=${created.id} type=at`;
            }
            return `不支持的类型: ${type}`;
          }
          case 'toggle': {
            if (!id) return 'toggle 需要提供 id。';
            const updated = await this.jobService.toggleJob(id, enabled);
            return `已更新任务状态：id=${updated.id} enabled=${updated.isEnabled}`;
          }
          default:
            return `不支持的操作: ${action}`;
        }
      },
      {
        name: 'cron_job',
        description:
          '管理定时任务。type=at 一次性；type=every 固定间隔；type=cron Cron 表达式。',
        schema,
      },
    );
  }
}
```

### 3.3 在模块中注册

```typescript
// src/tool/tool.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { JobModule } from '../job/job.module';
import { CronJobToolService } from './cron-job-tool.service';
// ... 其他工具服务

@Module({
  imports: [forwardRef(() => JobModule)],
  providers: [
    CronJobToolService,
    {
      provide: 'CRON_JOB_TOOL',
      useFactory: (svc: CronJobToolService) => svc.tool,
      inject: [CronJobToolService],
    },
    // ... 其他工具的 Provider Token
  ],
  exports: ['CRON_JOB_TOOL', /* ... */],
})
export class ToolModule {}
```

---

## Step 4: 执行 Agent — JobAgentService

绑定执行类工具，**不绑定 cron_job**。实现多轮工具调用循环。

```typescript
// src/ai/job-agent.service.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';

@Injectable()
export class JobAgentService {
  private readonly logger = new Logger(JobAgentService.name);
  private readonly modelWithTools: any;

  // ⚠ 注意：不绑定 cron_job，防止无限递归
  constructor(
    @Inject('CHAT_MODEL') model: ChatOpenAI,
    @Inject('SEND_MAIL_TOOL') private readonly sendMailTool: any,
    @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: any,
    @Inject('DB_USERS_CRUD_TOOL') private readonly dbUsersCrudTool: any,
    @Inject('TIME_NOW_TOOL') private readonly timeNowTool: any,
  ) {
    this.modelWithTools = model.bindTools([
      this.sendMailTool,
      this.webSearchTool,
      this.dbUsersCrudTool,
      this.timeNowTool,
    ]);
  }

  async runJob(instruction: string): Promise<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(
        '你是一个后台任务执行代理。根据指令调用工具完成操作，然后给出结果说明。',
      ),
      new HumanMessage(instruction),
    ];

    while (true) {
      const aiMessage = await this.modelWithTools.invoke(messages);
      messages.push(aiMessage);

      const toolCalls = aiMessage.tool_calls ?? [];
      if (!toolCalls.length) {
        return String(aiMessage.content ?? '');
      }

      for (const toolCall of toolCalls) {
        const toolCallId = toolCall.id || '';
        const toolName = toolCall.name;
        let result: string;

        switch (toolName) {
          case 'send_mail':
            result = await this.sendMailTool.invoke(toolCall.args);
            break;
          case 'web_search':
            result = await this.webSearchTool.invoke(toolCall.args);
            break;
          case 'db_users_crud':
            result = await this.dbUsersCrudTool.invoke(toolCall.args);
            break;
          case 'time_now':
            result = JSON.stringify(await this.timeNowTool.invoke({}));
            break;
          default:
            this.logger.warn(`未知工具: ${toolName}`);
            continue;
        }

        messages.push(new ToolMessage({ tool_call_id: toolCallId, name: toolName, content: result }));
      }
    }
  }
}
```

### 多轮工具调用循环（通用模式）

这是对话 Agent 和执行 Agent 共用的核心引擎：

```
while (true) {
  aiMessage = model.invoke(messages)
  messages.push(aiMessage)

  if (无 tool_calls) → 返回 content    // 最终回答

  for (toolCall of toolCalls) {
    result = tool.invoke(toolCall.args)  // 执行工具
    messages.push(ToolMessage(result))   // 结果喂回模型
  }
  // 继续下一轮，让模型决定是否还需要调用工具
}
```

---

## Step 5: 对话 Agent — AiService

绑定所有工具（**包含 cron_job**），处理用户对话。

```typescript
// src/ai/ai.service.ts
import { Inject, Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';

@Injectable()
export class AiService {
  private readonly modelWithTools: any;

  constructor(
    @Inject('CHAT_MODEL') model: ChatOpenAI,
    @Inject('QUERY_USER_TOOL') private readonly queryUserTool: any,
    @Inject('SEND_MAIL_TOOL') private readonly sendMailTool: any,
    @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: any,
    @Inject('DB_USERS_CRUD_TOOL') private readonly dbUsersCrudTool: any,
    @Inject('TIME_NOW_TOOL') private readonly timeNowTool: any,
    @Inject('CRON_JOB_TOOL') private readonly cronJobTool: any,
  ) {
    this.modelWithTools = model.bindTools([
      this.queryUserTool,
      this.sendMailTool,
      this.webSearchTool,
      this.dbUsersCrudTool,
      this.timeNowTool,
      this.cronJobTool,  // 对话 Agent 可以创建定时任务
    ]);
  }

  async runChain(query: string): Promise<string> {
    const messages: BaseMessage[] = [
      new SystemMessage(SYSTEM_PROMPT),  // 见下方 "System Prompt 设计要点"
      new HumanMessage(query),
    ];

    while (true) {
      const aiMessage = await this.modelWithTools.invoke(messages);
      messages.push(aiMessage);

      if (!(aiMessage.tool_calls ?? []).length) {
        return aiMessage.content as string;
      }

      for (const toolCall of aiMessage.tool_calls) {
        const result = await this.resolveTool(toolCall.name).invoke(toolCall.args);
        messages.push(new ToolMessage({
          tool_call_id: toolCall.id || '',
          name: toolCall.name,
          content: typeof result === 'string' ? result : JSON.stringify(result),
        }));
      }
    }
  }

  // 流式模式类似，用 model.stream() 替代 model.invoke()
  // 遇到 tool_call 时静默执行，文本内容逐 token yield 给前端
  async *runChainStream(query: string): AsyncIterable<string> { /* ... */ }
}
```

---

## Step 6: 模块组织

```
┌─────────────────────────────────────────────────────┐
│ AppModule                                           │
│  ├── ScheduleModule.forRoot()                       │
│  ├── TypeOrmModule.forRoot({ entities: [            │
│  │     User, Job, JobExecution                      │
│  │ ] })                                             │
│  ├── ConfigModule.forRoot({ isGlobal: true })       │
│  ├── AiModule ──────────────────────────────────┐   │
│  │   ├── AiController                           │   │
│  │   ├── AiService (绑定所有工具含 cron_job)      │   │
│  │   └── UserService                            │   │
│  ├── JobModule ─────────────────────────────────┐│  │
│  │   ├── JobService (调度核心)                    ││  │
│  │   └── JobAgentService (执行 Agent)             ││  │
│  ├── ToolModule ────────────────────────────────┘│  │
│  │   ├── LlmService → CHAT_MODEL                  │  │
│  │   ├── CronJobToolService → CRON_JOB_TOOL       │  │
│  │   ├── SendMailToolService → SEND_MAIL_TOOL     │  │
│  │   ├── WebSearchToolService → WEB_SEARCH_TOOL   │  │
│  │   ├── DbUsersCrudToolService → DB_USERS_CRUD   │  │
│  │   └── TimeNowToolService → TIME_NOW_TOOL       │  │
│  └── UsersModule                                  │  │
│       └── 用户 CRUD                               │  │
└───────────────────────────────────────────────────┘  │
        ToolModule ↔ JobModule 通过 forwardRef 解决循环依赖
```

```typescript
// src/job/job.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { JobService } from './job.service';
import { JobAgentService } from '../ai/job-agent.service';
import { ToolModule } from '../tool/tool.module';

@Module({
  imports: [forwardRef(() => ToolModule)],
  providers: [JobService, JobAgentService],
  exports: [JobService],
})
export class JobModule {}
```

---

## Step 7: 控制器与前端

```typescript
// src/ai/ai.controller.ts
import { Controller, Get, Query, Sse } from '@nestjs/common';
import { AiService } from './ai.service';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // 同步对话
  @Get('chat')
  async chat(@Query('query') query: string) {
    const answer = await this.aiService.runChain(query);
    return { answer };
  }

  // 流式对话（SSE）
  @Sse('chat/stream')
  chatStream(@Query('query') query: string): Observable<MessageEvent> {
    return from(this.aiService.runChainStream(query)).pipe(
      map((chunk) => ({ data: chunk })),
    );
  }
}
```

前端通过 EventSource 连接 `/ai/chat/stream?query=...` 即可实现逐字输出。

---

## System Prompt 设计要点

对话 Agent 的 System Prompt 是整个系统能正确工作的关键。以下是必须包含的规则：

```
你是一个通用任务助手，可以在需要时调用工具（send_mail、web_search、db_users_crud、
time_now、cron_job 等）来完成各种自动化任务。

【定时任务类型选择规则 — 非常重要】
- 用户说"X分钟/小时/天后""在某个时间点""到点提醒"（一次性）
  → 用 cron_job + type=at（执行一次后自动停用）
- 用户说"每X分钟/每小时/每天""定期/循环/一直"（重复执行）
  → 用 cron_job + type=every，everyMs=X换算成毫秒
- 用户给出 Cron 表达式或明确说"用 cron 表达式"
  → 用 cron_job + type=cron

【instruction 拆分规则 — 非常重要】
从用户原始自然语言中拆成两部分：
1. "什么时候执行" → 用来决定 type/at/everyMs/cron
2. "要做什么" → 写进 instruction 字段（保持原语言，不要改写/翻译/总结）

【instruction 格式限制】
必须是自然语言任务描述，不能写成工具调用或脚本。
例如：禁止 send_mail(...)、db_users_crud(...)。
工具调用由将来的执行 Agent 自行决定。

【当前轮行为限制】
当用户请求"在未来某个时间点执行某动作"时：
- 本轮只使用 cron_job 设置定时任务
- 不要在当前轮直接执行该动作
- 不要直接调用 send_mail / web_search 等
- 把要执行的动作写进 instruction，交给将来的定时任务去跑
```

---

## 注意事项与常见陷阱

### 1. setInterval 注册后不要立即 clearInterval

```typescript
// ❌ 错误：间隔立即被销毁，任务只执行一次
const ref = setInterval(() => { ... }, 60000);
this.schedulerRegistry.addInterval(job.id, ref);
clearInterval(ref);

// ✅ 正确：只注册，由 stopRuntime 负责清理
const ref = setInterval(() => { ... }, 60000);
this.schedulerRegistry.addInterval(job.id, ref);
```

### 2. 执行 Agent 绝不能绑定 cron_job

```typescript
// ❌ 错误：任务执行时可能再创建子任务，无限递归
this.modelWithTools = model.bindTools([this.cronJobTool, ...]);

// ✅ 正确：执行 Agent 只绑定执行类工具
this.modelWithTools = model.bindTools([
  this.sendMailTool, this.webSearchTool, this.dbUsersCrudTool, this.timeNowTool,
]);
```

### 3. at 类型执行后自动停用

`at` 类型任务触发后必须将 `isEnabled` 设为 `false`，否则进程重启后会再次执行：

```typescript
// at 类型的 setTimeout 回调中：
await this.entityManager.update(Job, job.id, { isEnabled: false });
```

### 4. 启动恢复时的去重检查

应用重启后注册任务前，必须检查 SchedulerRegistry 是否已存在同名任务，避免重复注册：

```typescript
const alreadyRegistered = cronJobs.has(job.id); // 用 job.id 作为注册名
if (alreadyRegistered) continue;
```

### 5. 并发保护用 Set 而非锁

单进程场景用 `Set<string>` 足够，不需要 Redis 分布式锁。`finally` 块确保清理：

```typescript
if (this.runningJobs.has(job.id)) return; // 跳过
this.runningJobs.add(job.id);
try { /* 执行 */ } finally { this.runningJobs.delete(job.id); }
```

### 6. 重新启用任务时重置失败计数

用户手动重新启用一个因连续失败被自动停用的任务时，必须重置 `consecutiveFailures`，否则下次失败立即又被停用：

```typescript
if (job.isEnabled) {
  await this.entityManager.update(Job, job.id, { consecutiveFailures: 0 });
  await this.startRuntime(job);
}
```

### 7. Job 实体默认值兼容

新增字段必须提供 `default` 值，确保 TypeORM `synchronize: true` 自动加列时现有数据不受影响：

```typescript
@Column({ type: 'int', default: 60000 })  // 不是 nullable
timeoutMs: number;
```
