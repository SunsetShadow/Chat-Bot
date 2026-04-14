# AI 定时任务系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Chat-Bot 实现自然语言驱动的 AI 定时任务系统，用户通过对话创建任务，系统按计划自动触发执行 Agent 完成任务。

**Architecture:** 双 Agent 分离模式 — 对话 Agent 绑定 `cron_job` 工具负责创建，执行 Agent 复用 Supervisor 路由负责到点执行。调度层用 `@nestjs/schedule` + `SchedulerRegistry` 动态管理三种任务类型（cron/every/at）。前端管理页面借助 `frontend-design` 技能实现。

**Tech Stack:** NestJS 11 + TypeORM + PostgreSQL + LangGraph + `@nestjs/schedule` + `cron` + Vue 3 + Naive UI + Pinia

---

## File Structure

### 新增文件

```
backend/src/
├── common/entities/
│   ├── job.entity.ts                          # Task 1 — 任务实体
│   └── job-execution.entity.ts                # Task 1 — 执行记录实体
├── modules/cron-job/
│   ├── cron-job.module.ts                     # Task 3 — 模块定义
│   ├── job.service.ts                         # Task 2 + Task 4 — 调度核心
│   ├── job-execution.service.ts               # Task 2 — 执行记录管理
│   ├── cron-job.controller.ts                 # Task 5 — REST API
│   └── dto/
│       ├── create-job.dto.ts                  # Task 5 — 创建请求 DTO
│       └── job-response.dto.ts                # Task 5 — 响应 DTO
├── modules/langgraph/tools/
│   └── cron-job.tool.ts                       # Task 6 — cron_job LangChain 工具

frontend/src/
├── api/cron-job.ts                            # Task 8 — API 服务
├── stores/cron-job.ts                         # Task 8 — Pinia store
├── types/cron-job.ts                          # Task 8 — 类型定义
├── views/CronJobsView.vue                     # Task 9 — 管理页面
└── components/cron-job/                       # Task 9 — 子组件
    ├── JobList.vue
    ├── JobForm.vue
    ├── ExecutionHistory.vue
    └── JobStatusBadge.vue
```

### 修改文件

```
backend/src/app.module.ts                      # Task 3 — 添加 ScheduleModule + CronJobModule
backend/src/modules/langgraph/langgraph.module.ts  # Task 6 — 注册 cron_job 工具
backend/src/modules/langgraph/tools/tool.loader.ts # Task 6 — 加载 cron_job 工具
backend/src/modules/agent/agent.service.ts     # Task 7 — seed 执行 Agent
frontend/src/router/index.ts                   # Task 8 — 添加路由
```

---

## Task 1: 数据模型 — JobEntity + JobExecutionEntity

**Files:**
- Create: `backend/src/common/entities/job.entity.ts`
- Create: `backend/src/common/entities/job-execution.entity.ts`

- [ ] **Step 1: 创建 JobEntity**

```typescript
// backend/src/common/entities/job.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type JobType = 'cron' | 'every' | 'at';

@Entity('jobs')
export class JobEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('text')
  instruction: string;

  @Column('varchar', { length: 10, default: 'cron' })
  type: JobType;

  @Column('varchar', { length: 100, nullable: true })
  cron: string | null;

  @Column('int', { nullable: true })
  every_ms: number | null;

  @Column('timestamp', { nullable: true })
  at: Date | null;

  @Column('varchar', { length: 50, default: 'Asia/Shanghai' })
  timezone: string;

  @Column({ default: true })
  is_enabled: boolean;

  @Column('simple-array', { nullable: true })
  allowed_tools: string[];

  @Column('int', { default: 60000 })
  timeout_ms: number;

  @Column('int', { default: 3 })
  max_retries: number;

  @Column('int', { default: 0 })
  consecutive_failures: number;

  @Column('int', { default: 5 })
  auto_disable_threshold: number;

  @Column('varchar', { nullable: true })
  agent_id: string | null;

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

- [ ] **Step 2: 创建 JobExecutionEntity**

```typescript
// backend/src/common/entities/job-execution.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { JobEntity } from './job.entity';

export type JobExecutionStatus = 'running' | 'success' | 'failed';

@Entity('job_executions')
export class JobExecutionEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  job_id: string;

  @ManyToOne(() => JobEntity, { onDelete: 'CASCADE' })
  job: JobEntity;

  @Column('varchar', { length: 20, default: 'running' })
  status: JobExecutionStatus;

  @Column('text', { nullable: true })
  result: string | null;

  @Column('text', { nullable: true })
  error: string | null;

  @Column('int', { nullable: true })
  duration_ms: number | null;

  @Column('int', { default: 0 })
  retry_attempt: number;

  @Column('timestamp')
  started_at: Date;

  @Column('timestamp', { nullable: true })
  finished_at: Date | null;
}
```

- [ ] **Step 3: 验证 TypeORM 自动同步**

Run: `cd /vol2/1000/机械硬盘1/Linux/workspace/Chat-Bot/backend && pnpm dev`

Expected: 服务正常启动，PostgreSQL 自动创建 `jobs` 和 `job_executions` 表（`synchronize: true`）。检查日志无报错后停止服务。

- [ ] **Step 4: Commit**

```bash
git add backend/src/common/entities/job.entity.ts backend/src/common/entities/job-execution.entity.ts
git commit -m "feat(cron-job): add JobEntity and JobExecutionEntity"
```

---

## Task 2: JobExecutionService — 执行记录管理

**Files:**
- Create: `backend/src/modules/cron-job/job-execution.service.ts`

**Depends on:** Task 1

- [ ] **Step 1: 创建 JobExecutionService**

```typescript
// backend/src/modules/cron-job/job-execution.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { JobExecutionEntity, JobExecutionStatus } from '../../common/entities/job-execution.entity';
import { JobEntity } from '../../common/entities/job.entity';

@Injectable()
export class JobExecutionService {
  constructor(
    @InjectRepository(JobExecutionEntity)
    private execRepo: Repository<JobExecutionEntity>,
  ) {}

  async create(jobId: string, retryAttempt: number): Promise<JobExecutionEntity> {
    const exec = this.execRepo.create({
      id: uuidv4(),
      job_id: jobId,
      status: 'running',
      retry_attempt: retryAttempt,
      started_at: new Date(),
      result: null,
      error: null,
      duration_ms: null,
      finished_at: null,
    });
    return this.execRepo.save(exec);
  }

  async finish(
    id: string,
    status: JobExecutionStatus,
    result: string | null,
    error: string | null,
    startedAt: Date,
  ): Promise<void> {
    await this.execRepo.update(id, {
      status,
      result,
      error,
      duration_ms: Date.now() - startedAt.getTime(),
      finished_at: new Date(),
    });
  }

  async findLatestByJobId(jobId: string): Promise<JobExecutionEntity | null> {
    return this.execRepo.findOne({
      where: { job_id: jobId },
      order: { started_at: 'DESC' },
    });
  }

  async findByJobId(
    jobId: string,
    page = 1,
    perPage = 20,
    status?: JobExecutionStatus,
  ): Promise<{ data: JobExecutionEntity[]; total: number }> {
    const where: any = { job_id: jobId };
    if (status) where.status = status;

    const [data, total] = await this.execRepo.findAndCount({
      where,
      order: { started_at: 'DESC' },
      skip: (page - 1) * perPage,
      take: perPage,
    });
    return { data, total };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/cron-job/job-execution.service.ts
git commit -m "feat(cron-job): add JobExecutionService for execution records"
```

---

## Task 3: CronJobModule + AppModule 集成

**Files:**
- Create: `backend/src/modules/cron-job/cron-job.module.ts`
- Modify: `backend/src/app.module.ts`

**Depends on:** Task 2

- [ ] **Step 1: 安装依赖**

Run: `cd /vol2/1000/机械硬盘1/Linux/workspace/Chat-Bot/backend && pnpm add @nestjs/schedule cron`

- [ ] **Step 2: 创建 CronJobModule（骨架）**

```typescript
// backend/src/modules/cron-job/cron-job.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { JobEntity } from '../../common/entities/job.entity';
import { JobExecutionEntity } from '../../common/entities/job-execution.entity';
import { JobService } from './job.service';
import { JobExecutionService } from './job-execution.service';
import { CronJobController } from './cron-job.controller';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobEntity, JobExecutionEntity]),
    forwardRef(() => ChatModule),
  ],
  controllers: [CronJobController],
  providers: [JobService, JobExecutionService],
  exports: [JobService],
})
export class CronJobModule {}
```

- [ ] **Step 3: 修改 AppModule**

在 `backend/src/app.module.ts` 中添加 `ScheduleModule` 和 `CronJobModule`：

```typescript
// 在文件顶部添加 import
import { ScheduleModule } from '@nestjs/schedule';
import { CronJobModule } from './modules/cron-job/cron-job.module';

// 在 imports 数组中，ConfigModule 之后添加 ScheduleModule.forRoot()
// 在 imports 数组末尾添加 CronJobModule
```

完整的 imports 数组变为：
```typescript
imports: [
  ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
  TypeOrmModule.forRootAsync({ /* 保持不变 */ }),
  ScheduleModule.forRoot(),    // ← 新增
  ChatModule,
  AgentModule,
  RuleModule,
  MemoryModule,
  UploadModule,
  ModelModule,
  CronJobModule,               // ← 新增
],
```

- [ ] **Step 4: 验证编译**

Run: `cd /vol2/1000/机械硬盘1/Linux/workspace/Chat-Bot/backend && pnpm dev`

Expected: 服务启动报错（JobService 和 CronJobController 还不存在），这是正常的。只要 module 解析无问题即可。确认后停止服务。

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/cron-job/cron-job.module.ts backend/src/app.module.ts backend/package.json backend/pnpm-lock.yaml
git commit -m "feat(cron-job): add CronJobModule with ScheduleModule integration"
```

---

## Task 4: JobService — 调度核心

**Files:**
- Create: `backend/src/modules/cron-job/job.service.ts`

**Depends on:** Task 3

这是整个系统最复杂的服务，包含：CRUD、运行时调度、启动恢复、核心执行引擎、超时控制、分层重试、并发保护、自动停用、优雅关闭。

- [ ] **Step 1: 创建 JobService 完整实现**

```typescript
// backend/src/modules/cron-job/job.service.ts
import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { v4 as uuidv4 } from 'uuid';
import { JobEntity, JobType } from '../../common/entities/job.entity';
import { JobExecutionEntity } from '../../common/entities/job-execution.entity';
import { JobExecutionService } from './job-execution.service';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class JobService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(JobService.name);
  private readonly runningJobs = new Set<string>();
  private static readonly RETRY_DELAYS = [2000, 4000, 8000];

  constructor(
    @InjectRepository(JobEntity)
    private jobRepo: Repository<JobEntity>,
    @Inject(SchedulerRegistry)
    private schedulerRegistry: SchedulerRegistry,
    private execService: JobExecutionService,
    @Inject(forwardRef(() => ChatService))
    private chatService: ChatService,
  ) {}

  // ─────────────────────────────────────────────
  // 1. 启动恢复
  // ─────────────────────────────────────────────
  async onApplicationBootstrap() {
    const enabledJobs = await this.jobRepo.find({ where: { is_enabled: true } });
    for (const job of enabledJobs) {
      try {
        if (this.isRegistered(job)) continue;
        await this.startRuntime(job);
      } catch (err) {
        this.logger.warn(`恢复任务 ${job.id} 失败: ${(err as Error).message}`);
      }
    }
    this.logger.log(`启动恢复完成: ${enabledJobs.length} 个任务`);
  }

  // ─────────────────────────────────────────────
  // 2. 优雅关闭
  // ─────────────────────────────────────────────
  async onApplicationShutdown() {
    const deadline = Date.now() + 10000;
    while (this.runningJobs.size > 0 && Date.now() < deadline) {
      await this.sleep(500);
    }
    if (this.runningJobs.size > 0) {
      this.logger.warn(`关闭时仍有 ${this.runningJobs.size} 个任务在执行`);
    }
  }

  // ─────────────────────────────────────────────
  // 3. CRUD
  // ─────────────────────────────────────────────
  async listJobs() {
    const jobs = await this.jobRepo.find({ order: { created_at: 'DESC' } });

    // 批量获取最近执行记录（避免 N+1）
    const jobIds = jobs.map((j) => j.id);
    const recentExecs = jobIds.length
      ? await this.jobRepo.manager
          .createQueryBuilder(JobExecutionEntity, 'exec')
          .where('exec.job_id IN (:...jobIds)', { jobIds })
          .orderBy('exec.started_at', 'DESC')
          .getMany()
      : [];

    const latestByJob = new Map<string, JobExecutionEntity>();
    for (const exec of recentExecs) {
      if (!latestByJob.has(exec.job_id)) latestByJob.set(exec.job_id, exec);
    }

    return jobs.map((job) => ({
      ...job,
      running: this.isRegistered(job),
      last_execution: latestByJob.get(job.id)
        ? {
            status: latestByJob.get(job.id)!.status,
            result: latestByJob.get(job.id)!.result,
            error: latestByJob.get(job.id)!.error,
            duration_ms: latestByJob.get(job.id)!.duration_ms,
            finished_at: latestByJob.get(job.id)!.finished_at?.toISOString() ?? null,
          }
        : null,
    }));
  }

  async getJob(id: string): Promise<JobEntity> {
    const job = await this.jobRepo.findOneBy({ id });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  async addJob(
    input:
      | { type: 'cron'; instruction: string; cron: string; timezone?: string; allowed_tools?: string[]; timeout_ms?: number; max_retries?: number; agent_id?: string; created_by_session?: string }
      | { type: 'every'; instruction: string; every_ms: number; timezone?: string; allowed_tools?: string[]; timeout_ms?: number; max_retries?: number; agent_id?: string; created_by_session?: string }
      | { type: 'at'; instruction: string; at: Date; timezone?: string; allowed_tools?: string[]; timeout_ms?: number; max_retries?: number; agent_id?: string; created_by_session?: string },
  ): Promise<JobEntity> {
    // 校验 cron 表达式
    if (input.type === 'cron') {
      try {
        new CronJob(input.cron, () => {});
      } catch {
        throw new Error(`无效的 Cron 表达式: ${input.cron}`);
      }
    }

    const entity = this.jobRepo.create({
      id: uuidv4(),
      instruction: input.instruction,
      type: input.type,
      cron: input.type === 'cron' ? input.cron : null,
      every_ms: input.type === 'every' ? input.every_ms : null,
      at: input.type === 'at' ? input.at : null,
      timezone: input.timezone || 'Asia/Shanghai',
      allowed_tools: input.allowed_tools || null,
      timeout_ms: input.timeout_ms ?? 60000,
      max_retries: input.max_retries ?? 3,
      agent_id: input.agent_id || null,
      created_by_session: input.created_by_session || null,
      is_enabled: true,
      consecutive_failures: 0,
      auto_disable_threshold: 5,
      last_run: null,
    });

    const saved = await this.jobRepo.save(entity);
    await this.startRuntime(saved);
    return saved;
  }

  async toggleJob(jobId: string, enabled?: boolean): Promise<JobEntity> {
    const job = await this.getJob(jobId);
    const nextEnabled = enabled ?? !job.is_enabled;

    if (job.is_enabled !== nextEnabled) {
      job.is_enabled = nextEnabled;
      await this.jobRepo.save(job);
    }

    if (job.is_enabled) {
      await this.jobRepo.update(job.id, { consecutive_failures: 0 });
      await this.startRuntime(job);
    } else {
      this.stopRuntime(job);
    }
    return job;
  }

  async deleteJob(jobId: string): Promise<void> {
    const job = await this.getJob(jobId);
    this.stopRuntime(job);
    await this.jobRepo.delete(jobId);
  }

  async triggerJob(jobId: string): Promise<JobExecutionEntity> {
    const job = await this.getJob(jobId);
    return this.executeJob(job);
  }

  // ─────────────────────────────────────────────
  // 4. 运行时调度
  // ─────────────────────────────────────────────
  private isRegistered(job: JobEntity): boolean {
    try {
      if (job.type === 'cron') return this.schedulerRegistry.getCronJobs().has(job.id);
      if (job.type === 'every') return this.schedulerRegistry.getIntervals().includes(job.id);
      if (job.type === 'at') return this.schedulerRegistry.getTimeouts().includes(job.id);
    } catch { /* ignore */ }
    return false;
  }

  private async startRuntime(job: JobEntity): Promise<void> {
    if (job.type === 'cron') {
      if (this.schedulerRegistry.getCronJobs().has(job.id)) {
        this.schedulerRegistry.getCronJobs().get(job.id)!.start();
        return;
      }
      const runtimeJob = new CronJob(job.cron ?? '', async () => {
        this.logger.log(`[cron] 触发任务 ${job.id}: ${job.instruction}`);
        await this.executeJob(job);
      });
      this.schedulerRegistry.addCronJob(job.id, runtimeJob);
      runtimeJob.start();
      return;
    }

    if (job.type === 'every') {
      if (this.schedulerRegistry.getIntervals().includes(job.id)) return;
      if (!job.every_ms || job.every_ms <= 0) throw new Error(`无效的 every_ms: ${job.every_ms}`);
      const ref = setInterval(async () => {
        this.logger.log(`[every] 触发任务 ${job.id}: ${job.instruction}`);
        await this.executeJob(job);
      }, job.every_ms);
      this.schedulerRegistry.addInterval(job.id, ref);
      return;
    }

    if (job.type === 'at') {
      if (this.schedulerRegistry.getTimeouts().includes(job.id)) return;
      if (!job.at) throw new Error('at 类型缺少 at 字段');
      const delay = Math.max(0, job.at.getTime() - Date.now());
      const ref = setTimeout(async () => {
        this.logger.log(`[at] 触发任务 ${job.id}: ${job.instruction}`);
        await this.executeJob(job);
        await this.jobRepo.update(job.id, { is_enabled: false });
        try { this.schedulerRegistry.deleteTimeout(job.id); } catch { /* ignore */ }
      }, delay);
      this.schedulerRegistry.addTimeout(job.id, ref);
    }
  }

  private stopRuntime(job: JobEntity): void {
    try {
      if (job.type === 'cron') {
        this.schedulerRegistry.getCronJobs().get(job.id)?.stop();
      } else if (job.type === 'every') {
        this.schedulerRegistry.deleteInterval(job.id);
      } else if (job.type === 'at') {
        this.schedulerRegistry.deleteTimeout(job.id);
      }
    } catch { /* ignore */ }
  }

  // ─────────────────────────────────────────────
  // 5. 核心执行引擎
  // ─────────────────────────────────────────────
  private async executeJob(job: JobEntity): Promise<JobExecutionEntity> {
    // 并发保护
    if (this.runningJobs.has(job.id)) {
      this.logger.warn(`跳过任务 ${job.id}: 上一次执行尚未完成`);
      return null!;
    }
    this.runningJobs.add(job.id);

    const startedAt = new Date();
    let lastExec: JobExecutionEntity | null = null;

    try {
      await this.jobRepo.update(job.id, { last_run: startedAt });

      let lastError: Error | null = null;
      const maxAttempts = job.max_retries + 1;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const exec = await this.execService.create(job.id, attempt);

        try {
          const result = await this.runWithTimeout(job.instruction, job.timeout_ms);
          await this.execService.finish(exec.id, 'success', result, null, startedAt);
          await this.jobRepo.update(job.id, { consecutive_failures: 0 });
          lastError = null;
          lastExec = exec;
          break;
        } catch (err) {
          lastError = err as Error;
          await this.execService.finish(exec.id, 'failed', null, lastError.message, startedAt);
          lastExec = exec;

          // 判断是否可重试
          if (!this.isRetryable(lastError) || attempt >= maxAttempts - 1) break;

          const delay = JobService.RETRY_DELAYS[attempt] ?? 8000;
          this.logger.warn(`任务 ${job.id} 第 ${attempt + 1} 次失败, ${delay}ms 后重试: ${lastError.message}`);
          await this.sleep(delay);
        }
      }

      if (lastError) {
        const fresh = await this.jobRepo.findOneBy({ id: job.id });
        if (fresh) {
          const newFailCount = fresh.consecutive_failures + 1;
          await this.jobRepo.update(job.id, { consecutive_failures: newFailCount });
          if (job.type !== 'at' && newFailCount >= fresh.auto_disable_threshold) {
            this.logger.warn(`任务 ${job.id} 连续失败 ${newFailCount} 次, 自动停用`);
            await this.toggleJob(job.id, false);
          }
        }
      }
    } finally {
      this.runningJobs.delete(job.id);
    }

    return lastExec!;
  }

  // ─────────────────────────────────────────────
  // 6. 辅助方法
  // ─────────────────────────────────────────────
  private async runWithTimeout(instruction: string, timeoutMs: number): Promise<string> {
    const execute = async (): Promise<string> => {
      // 通过 ChatService 执行，复用 Supervisor 路由
      const result = await this.chatService.createCompletion({
        message: instruction,
        stream: false,
        agent_id: 'builtin-job-executor',
      });
      return result.assistantMessage?.content ?? '';
    };

    if (timeoutMs <= 0) return execute();

    return Promise.race([
      execute(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`执行超时 ${timeoutMs}ms`)), timeoutMs),
      ),
    ]);
  }

  private isRetryable(error: Error): boolean {
    const msg = error.message;
    return /timeout|rate.limit|ECONNREFUSED|ECONNRESET|503/i.test(msg);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/cron-job/job.service.ts
git commit -m "feat(cron-job): add JobService with scheduling, retry, timeout, concurrency"
```

---

## Task 5: DTO + Controller — REST API

**Files:**
- Create: `backend/src/modules/cron-job/dto/create-job.dto.ts`
- Create: `backend/src/modules/cron-job/dto/job-response.dto.ts`
- Create: `backend/src/modules/cron-job/cron-job.controller.ts`

**Depends on:** Task 4

- [ ] **Step 1: 创建 DTO**

```typescript
// backend/src/modules/cron-job/dto/create-job.dto.ts
import { IsString, IsOptional, IsEnum, IsInt, IsArray, Min, IsDateString } from 'class-validator';

export class CreateJobDto {
  @IsString()
  instruction: string;

  @IsEnum(['cron', 'every', 'at'])
  type: 'cron' | 'every' | 'at';

  @IsString()
  @IsOptional()
  cron?: string;

  @IsInt()
  @Min(1000)
  @IsOptional()
  every_ms?: number;

  @IsDateString()
  @IsOptional()
  at?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsArray()
  @IsOptional()
  allowed_tools?: string[];

  @IsInt()
  @IsOptional()
  timeout_ms?: number;

  @IsInt()
  @IsOptional()
  max_retries?: number;
}
```

```typescript
// backend/src/modules/cron-job/dto/job-response.dto.ts
export interface JobResponse {
  id: string;
  instruction: string;
  type: 'cron' | 'every' | 'at';
  cron: string | null;
  every_ms: number | null;
  at: string | null;
  timezone: string;
  is_enabled: boolean;
  running: boolean;
  allowed_tools: string[] | null;
  timeout_ms: number;
  max_retries: number;
  consecutive_failures: number;
  auto_disable_threshold: number;
  agent_id: string | null;
  last_run: string | null;
  created_at: string;
  updated_at: string;
  last_execution: {
    status: string;
    result: string | null;
    error: string | null;
    duration_ms: number | null;
    finished_at: string | null;
  } | null;
}

export interface JobListResponse {
  data: JobResponse[];
  total: number;
}
```

- [ ] **Step 2: 创建 Controller**

```typescript
// backend/src/modules/cron-job/cron-job.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { JobService } from './job.service';
import { JobExecutionService } from './job-execution.service';
import { CreateJobDto } from './dto/create-job.dto';

@Controller('api/v1/cron-jobs')
export class CronJobController {
  constructor(
    private jobService: JobService,
    private execService: JobExecutionService,
  ) {}

  @Get()
  async list() {
    const jobs = await this.jobService.listJobs();
    return { success: true, data: jobs };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const job = await this.jobService.getJob(id);
    const lastExec = await this.execService.findLatestByJobId(id);
    return {
      success: true,
      data: {
        ...job,
        running: await this.jobService.listJobs().then((jobs) => jobs.find((j) => j.id === id)?.running ?? false),
        last_execution: lastExec
          ? {
              status: lastExec.status,
              result: lastExec.result,
              error: lastExec.error,
              duration_ms: lastExec.duration_ms,
              finished_at: lastExec.finished_at?.toISOString() ?? null,
            }
          : null,
      },
    };
  }

  @Post()
  async create(@Body() dto: CreateJobDto) {
    let input: any = {
      instruction: dto.instruction,
      type: dto.type,
      timezone: dto.timezone,
      allowed_tools: dto.allowed_tools,
      timeout_ms: dto.timeout_ms,
      max_retries: dto.max_retries,
    };

    if (dto.type === 'cron') input.cron = dto.cron;
    else if (dto.type === 'every') input.every_ms = dto.every_ms;
    else if (dto.type === 'at') {
      if (!dto.at) throw new Error('type=at 时需要提供 at');
      input.at = new Date(dto.at);
    }

    const job = await this.jobService.addJob(input);
    return { success: true, data: job };
  }

  @Patch(':id/toggle')
  async toggle(
    @Param('id') id: string,
    @Body() body: { enabled?: boolean },
  ) {
    const job = await this.jobService.toggleJob(id, body.enabled);
    return { success: true, data: job };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.jobService.deleteJob(id);
    return { success: true };
  }

  @Post(':id/trigger')
  async trigger(@Param('id') id: string) {
    const exec = await this.jobService.triggerJob(id);
    return { success: true, data: { execution_id: exec.id, status: exec.status, started_at: exec.started_at } };
  }

  @Get(':id/executions')
  async executions(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
    @Query('status') status?: 'running' | 'success' | 'failed',
  ) {
    const result = await this.execService.findByJobId(
      id,
      page ? parseInt(page, 10) : 1,
      perPage ? parseInt(perPage, 10) : 20,
      status,
    );
    return {
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page: page ? parseInt(page, 10) : 1,
        per_page: perPage ? parseInt(perPage, 10) : 20,
      },
    };
  }

  @Get(':id/executions/latest')
  async latestExecution(@Param('id') id: string) {
    const exec = await this.execService.findLatestByJobId(id);
    return { success: true, data: exec };
  }
}
```

- [ ] **Step 3: 验证编译**

Run: `cd /vol2/1000/机械硬盘1/Linux/workspace/Chat-Bot/backend && pnpm dev`

Expected: 服务正常启动，所有端点注册成功。用 curl 测试：

```bash
curl http://localhost:8000/api/v1/cron-jobs
```

Expected: `{"success":true,"data":[]}`

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/cron-job/dto/ backend/src/modules/cron-job/cron-job.controller.ts
git commit -m "feat(cron-job): add REST API with CRUD, trigger, execution history"
```

---

## Task 6: cron_job LangChain 工具 + 工具注册

**Files:**
- Create: `backend/src/modules/langgraph/tools/cron-job.tool.ts`
- Modify: `backend/src/modules/langgraph/langgraph.module.ts`
- Modify: `backend/src/modules/langgraph/tools/tool.loader.ts`

**Depends on:** Task 4

- [ ] **Step 1: 创建 cron_job 工具**

```typescript
// backend/src/modules/langgraph/tools/cron-job.tool.ts
import { z } from 'zod';
import { safeTool } from './base/tool.helper';
import { JobService } from '../../cron-job/job.service';

export function createCronJobTool(jobService: JobService) {
  return safeTool(
    'cron_job',
    `管理定时任务。

操作说明：
- action=list: 查看当前所有定时任务列表
- action=add: 新增一个定时任务
- action=toggle: 启用或停用指定任务

类型选择规则：
- 一次性任务（"X分钟后""明天""下周一"）→ type=at, 提供 at 参数（ISO 8601）
- 固定间隔循环（"每X分钟""每小时""每天"）→ type=every, 提供 everyMs 参数（毫秒）
- Cron 表达式（"0 9 * * *"）→ type=cron, 提供 cron 参数

instruction 规则：
- 保持用户原始表述，不要改写、翻译或总结
- 必须是自然语言描述，不能写成工具调用脚本`,
    z.object({
      action: z.enum(['list', 'add', 'toggle']),
      type: z.enum(['cron', 'every', 'at']).optional().describe('任务类型，add 时必填'),
      instruction: z.string().optional().describe('自然语言任务指令，add 时必填'),
      cron: z.string().optional().describe('Cron 表达式，type=cron 时必填'),
      everyMs: z.number().int().positive().optional().describe('间隔毫秒，type=every 时必填'),
      at: z.string().optional().describe('ISO 8601 时间，type=at 时必填'),
      id: z.string().optional().describe('任务 ID，toggle 时必填'),
      enabled: z.boolean().optional().describe('启用/停用，toggle 时使用'),
    }),
    async ({ action, type, instruction, cron, everyMs, at, id, enabled }) => {
      switch (action) {
        case 'list': {
          const jobs = await jobService.listJobs();
          if (!jobs.length) return '当前没有任何定时任务。';
          return '当前定时任务列表：\n' + jobs.map((j: any) =>
            `id=${j.id} type=${j.type} enabled=${j.is_enabled} running=${j.running} ` +
            `failures=${j.consecutive_failures ?? 0} ` +
            `cron=${j.cron ?? ''} everyMs=${j.every_ms ?? ''} ` +
            `at=${j.at instanceof Date ? j.at.toISOString() : j.at ?? ''} ` +
            `instruction=${j.instruction ?? ''}`,
          ).join('\n');
        }

        case 'add': {
          if (!type) return '新增任务需要提供 type（cron/every/at）。';
          if (!instruction) return '新增任务需要提供 instruction。';

          if (type === 'cron') {
            if (!cron) return 'type=cron 时需要提供 cron 表达式。';
            const created = await jobService.addJob({ type: 'cron', instruction, cron });
            return `已新增定时任务：id=${created.id} type=cron cron=${created.cron}`;
          }
          if (type === 'every') {
            if (!everyMs) return 'type=every 时需要提供 everyMs（毫秒）。';
            const created = await jobService.addJob({ type: 'every', instruction, every_ms: everyMs });
            return `已新增定时任务：id=${created.id} type=every everyMs=${created.every_ms}`;
          }
          if (type === 'at') {
            if (!at) return 'type=at 时需要提供 at 时间（ISO 8601）。';
            const date = new Date(at);
            if (Number.isNaN(date.getTime())) return 'at 不是合法的 ISO 8601 时间。';
            const created = await jobService.addJob({ type: 'at', instruction, at: date });
            return `已新增定时任务：id=${created.id} type=at at=${created.at?.toISOString()}`;
          }
          return `不支持的任务类型: ${type}`;
        }

        case 'toggle': {
          if (!id) return 'toggle 需要提供任务 id。';
          const updated = await jobService.toggleJob(id, enabled);
          return `已更新任务状态：id=${updated.id} enabled=${updated.is_enabled}`;
        }

        default:
          return `不支持的操作: ${action}`;
      }
    },
  );
}
```

- [ ] **Step 2: 修改 LangGraphModule 注册 cron_job 工具**

在 `backend/src/modules/langgraph/langgraph.module.ts` 中：

在文件顶部添加 import：
```typescript
import { CronJobModule } from '../cron-job/cron-job.module';
import { JobService } from '../cron-job/job.service';
import { createCronJobTool } from './tools/cron-job.tool';
```

在 `@Module` 装饰器的 `imports` 数组中添加 `CronJobModule`：
```typescript
imports: [ConfigModule, MemoryModule, AgentModule, CronJobModule],
```

在 `onModuleInit()` 方法末尾（`agentService.setRebuildCallback` 之前）添加：
```typescript
// 注册定时任务管理工具
this.toolRegistry.register(
  createCronJobTool(this.moduleRef.get(JobService, { strict: false })),
  {
    permission_level: 'write',
    category: 'orchestration',
    description: '创建和管理 AI 定时任务',
  },
);
```

需要在 constructor 中注入 `ModuleRef`：
```typescript
import { ModuleRef } from '@nestjs/core';

constructor(
  private moduleRef: ModuleRef,
  // ... 其他现有依赖
) {}
```

- [ ] **Step 3: 验证编译和工具注册**

Run: `cd /vol2/1000/机械硬盘1/Linux/workspace/Chat-Bot/backend && pnpm dev`

Expected: 服务正常启动。测试工具是否注册成功：

```bash
curl http://localhost:8000/api/v1/tools
```

Expected: 响应中包含 `cron_job` 工具。

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/langgraph/tools/cron-job.tool.ts backend/src/modules/langgraph/langgraph.module.ts
git commit -m "feat(cron-job): add cron_job tool and register in LangGraphModule"
```

---

## Task 7: Seed 执行 Agent + System Prompt 规则

**Files:**
- Modify: `backend/src/modules/agent/agent.service.ts`

**Depends on:** Task 3

- [ ] **Step 1: 在 BUILTIN_AGENTS 数组中添加执行 Agent**

在 `backend/src/modules/agent/agent.service.ts` 的 `BUILTIN_AGENTS` 数组末尾添加：

```typescript
{
  id: 'builtin-job-executor',
  name: '定时任务执行器',
  description: '后台定时任务的执行代理，根据指令调用工具完成操作',
  system_prompt: `你是一个后台任务执行代理。你的职责是根据指令调用工具完成操作，然后给出简洁的结果说明。

执行规则：
- 根据指令内容决定调用哪些工具
- 直接执行，不要询问或确认
- 执行完毕后给出简洁的结果摘要
- 如果工具调用失败，说明失败原因`,
  capabilities: '执行定时任务指令、调用工具完成操作',
  traits: ['直接', '高效', '简洁'],
  tools: ['send_mail', 'web_search', 'execute_command', 'time_now'],
  is_builtin: true,
},
```

同时在默认通用助手的 system_prompt 中添加定时任务管理规则。修改 `builtin-general` 的 system_prompt：

```typescript
system_prompt: `你是一个友好、专业的 AI 助手。请用简洁、准确的语言回答用户的问题。

【定时任务管理规则】
- 用户请求"在未来执行某动作"时，用 cron_job 工具创建任务，不要在当前轮直接执行该动作
- instruction 保持用户原始表述，不要改写、翻译或总结
- 类型选择：一次性 → type=at，固定间隔 → type=every，Cron 表达式 → type=cron
- type=at 时，at 参数使用 ISO 8601 格式
- 创建任务后告诉用户任务已创建、何时会执行`,
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/agent/agent.service.ts
git commit -m "feat(cron-job): seed builtin-job-executor agent and add scheduling rules to system prompt"
```

---

## Task 8: 前端 — 类型定义 + API 服务 + Store + 路由

**Files:**
- Create: `frontend/src/types/cron-job.ts`
- Create: `frontend/src/api/cron-job.ts`
- Create: `frontend/src/stores/cron-job.ts`
- Modify: `frontend/src/router/index.ts`

**Depends on:** Task 5

- [ ] **Step 1: 创建类型定义**

```typescript
// frontend/src/types/cron-job.ts
export type JobType = 'cron' | 'every' | 'at';
export type JobExecutionStatus = 'running' | 'success' | 'failed';

export interface CronJob {
  id: string;
  instruction: string;
  type: JobType;
  cron: string | null;
  every_ms: number | null;
  at: string | null;
  timezone: string;
  is_enabled: boolean;
  running: boolean;
  allowed_tools: string[] | null;
  timeout_ms: number;
  max_retries: number;
  consecutive_failures: number;
  auto_disable_threshold: number;
  agent_id: string | null;
  last_run: string | null;
  created_at: string;
  updated_at: string;
  last_execution: {
    status: JobExecutionStatus;
    result: string | null;
    error: string | null;
    duration_ms: number | null;
    finished_at: string | null;
  } | null;
}

export interface JobExecution {
  id: string;
  job_id: string;
  status: JobExecutionStatus;
  result: string | null;
  error: string | null;
  duration_ms: number | null;
  retry_attempt: number;
  started_at: string;
  finished_at: string | null;
}

export interface CreateJobRequest {
  instruction: string;
  type: JobType;
  cron?: string;
  every_ms?: number;
  at?: string;
  timezone?: string;
  allowed_tools?: string[];
  timeout_ms?: number;
  max_retries?: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
  };
}
```

- [ ] **Step 2: 创建 API 服务**

```typescript
// frontend/src/api/cron-job.ts
import { get, post, del } from "./request";
import type {
  CronJob,
  CreateJobRequest,
  JobExecution,
  PaginatedResponse,
} from "@/types/cron-job";

const BASE = "/api/v1/cron-jobs";

export async function getJobs() {
  return get<{ success: boolean; data: CronJob[] }>(BASE);
}

export async function getJob(id: string) {
  return get<{ success: boolean; data: CronJob }>(`${BASE}/${id}`);
}

export async function createJob(data: CreateJobRequest) {
  return post<{ success: boolean; data: CronJob }>(BASE, data);
}

export async function toggleJob(id: string, enabled?: boolean) {
  return post<{ success: boolean; data: CronJob }>(`${BASE}/${id}/toggle`, { enabled });
}

export async function deleteJob(id: string) {
  return del<{ success: boolean }>(`${BASE}/${id}`);
}

export async function triggerJob(id: string) {
  return post<{ success: boolean; data: { execution_id: string; status: string; started_at: string } }>(`${BASE}/${id}/trigger`);
}

export async function getExecutions(
  jobId: string,
  page = 1,
  perPage = 20,
  status?: string,
) {
  const params: Record<string, string | number> = { page, per_page: perPage };
  if (status) params.status = status;
  return get<PaginatedResponse<JobExecution>>(`${BASE}/${jobId}/executions`, params);
}

export async function getLatestExecution(jobId: string) {
  return get<{ success: boolean; data: JobExecution | null }>(`${BASE}/${jobId}/executions/latest`);
}
```

- [ ] **Step 3: 创建 Pinia Store**

```typescript
// frontend/src/stores/cron-job.ts
import { defineStore } from "pinia";
import { ref } from "vue";
import type { CronJob, JobExecution, CreateJobRequest } from "@/types/cron-job";
import * as api from "@/api/cron-job";

export const useCronJobStore = defineStore("cron-job", () => {
  const jobs = ref<CronJob[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 执行历史
  const executions = ref<JobExecution[]>([]);
  const executionsTotal = ref(0);
  const selectedJobId = ref<string | null>(null);

  async function fetchJobs() {
    isLoading.value = true;
    error.value = null;
    try {
      const res = await api.getJobs();
      jobs.value = res.data;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "获取任务列表失败";
    } finally {
      isLoading.value = false;
    }
  }

  async function createJob(data: CreateJobRequest) {
    const res = await api.createJob(data);
    await fetchJobs();
    return res.data;
  }

  async function toggleJob(id: string, enabled?: boolean) {
    await api.toggleJob(id, enabled);
    await fetchJobs();
  }

  async function deleteJob(id: string) {
    await api.deleteJob(id);
    await fetchJobs();
  }

  async function triggerJob(id: string) {
    const res = await api.triggerJob(id);
    await fetchJobs();
    return res.data;
  }

  async function fetchExecutions(jobId: string, page = 1, status?: string) {
    selectedJobId.value = jobId;
    const res = await api.getExecutions(jobId, page, 20, status);
    executions.value = res.data;
    executionsTotal.value = res.pagination.total;
  }

  return {
    jobs, isLoading, error,
    executions, executionsTotal, selectedJobId,
    fetchJobs, createJob, toggleJob, deleteJob, triggerJob, fetchExecutions,
  };
});
```

- [ ] **Step 4: 添加路由**

在 `frontend/src/router/index.ts` 的 routes 数组中添加：

```typescript
{
  path: "/cron-jobs",
  name: "CronJobs",
  component: () => import("@/views/CronJobsView.vue"),
},
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/cron-job.ts frontend/src/api/cron-job.ts frontend/src/stores/cron-job.ts frontend/src/router/index.ts
git commit -m "feat(cron-job): add frontend types, API service, store, and route"
```

---

## Task 9: 前端管理页面 — 借助 frontend-design 技能

**Files:**
- Create: `frontend/src/views/CronJobsView.vue`
- Create: `frontend/src/components/cron-job/JobList.vue`
- Create: `frontend/src/components/cron-job/JobForm.vue`
- Create: `frontend/src/components/cron-job/ExecutionHistory.vue`
- Create: `frontend/src/components/cron-job/JobStatusBadge.vue`

**Depends on:** Task 8

**此 Task 使用 `frontend-design` 技能完成 UI 设计和实现。**

- [ ] **Step 1: 调用 frontend-design 技能**

输入给 frontend-design 的需求描述：

```
为 AI 定时任务系统创建管理页面，赛博朋克/霓虹未来主义主题。

页面结构：
1. 顶部标题栏 "定时任务管理" + 创建按钮
2. 任务列表（卡片式布局）：
   - 每个卡片显示：instruction（任务指令）、类型标签（cron/every/at）、调度规则、状态徽章（启用/停用/运行中）
   - 操作按钮：启停切换、手动触发、删除
   - 展开可查看最近执行状态
3. 创建任务表单（模态框）：
   - 任务类型选择（cron/every/at）
   - 根据类型动态显示：Cron 表达式 / 间隔毫秒 / 时间选择器
   - 指令输入（textarea）
   - 可选：超时时间、重试次数
4. 执行历史面板（侧边抽屉）：
   - 按时间倒序列出执行记录
   - 每条显示：时间、状态、耗时、结果/错误
   - 状态过滤（全部/成功/失败）

技术栈：Vue 3 + Naive UI + Pinia
Store: useCronJobStore (已在 frontend/src/stores/cron-job.ts 定义)
API: frontend/src/api/cron-job.ts (已在 Task 8 定义)
现有页面参考：frontend/src/views/ChatView.vue 的 UI 风格
```

- [ ] **Step 2: 实现页面组件**

按照 frontend-design 技能输出的设计稿实现组件。

- [ ] **Step 3: 在现有布局中添加导航入口**

在聊天界面的侧边栏或导航栏中添加"定时任务"入口，链接到 `/cron-jobs`。

- [ ] **Step 4: 验证前端功能**

Run: `cd /vol2/1000/机械硬盘1/Linux/workspace/Chat-Bot/frontend && pnpm dev`

在浏览器中测试：
1. 访问 `/cron-jobs`，确认页面加载
2. 点击创建按钮，填写表单创建任务
3. 验证任务列表显示
4. 测试启停、删除、手动触发
5. 查看执行历史

- [ ] **Step 5: Commit**

```bash
git add frontend/src/views/CronJobsView.vue frontend/src/components/cron-job/
git commit -m "feat(cron-job): add frontend management page with cyberpunk theme"
```

---

## Task 10: 端到端集成测试 + Lint

**Files:** 无新文件

**Depends on:** Task 9

- [ ] **Step 1: 启动后端，验证 API 全链路**

Run: `cd /vol2/1000/机械硬盘1/Linux/workspace/Chat-Bot/backend && pnpm dev`

```bash
# 创建 cron 任务
curl -X POST http://localhost:8000/api/v1/cron-jobs \
  -H "Content-Type: application/json" \
  -d '{"instruction":"测试任务","type":"every","every_ms":60000}'

# 列出任务
curl http://localhost:8000/api/v1/cron-jobs

# 停用任务
curl -X PATCH http://localhost:8000/api/v1/cron-jobs/<job-id>/toggle \
  -H "Content-Type: application/json" \
  -d '{"enabled":false}'

# 删除任务
curl -X DELETE http://localhost:8000/api/v1/cron-jobs/<job-id>
```

- [ ] **Step 2: 通过对话测试 cron_job 工具**

在聊天界面输入："每分钟执行一次测试任务"

Expected: Agent 调用 `cron_job` 工具创建任务，返回任务创建确认。

- [ ] **Step 3: 后端 Lint**

Run: `cd /vol2/1000/机械硬盘1/Linux/workspace/Chat-Bot/backend && pnpm lint`

Expected: 0 errors, 0 warnings

- [ ] **Step 4: 前端 Lint**

Run: `cd /vol2/1000/机械硬盘1/Linux/workspace/Chat-Bot/frontend && pnpm lint`

Expected: 0 errors, 0 warnings

- [ ] **Step 5: Commit (如有 lint 修复)**

```bash
git add -A
git commit -m "fix: resolve lint issues in cron-job module"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** 所有设计文档中的需求都有对应 Task
  - JobEntity + JobExecutionEntity → Task 1
  - JobExecutionService → Task 2
  - CronJobModule + AppModule → Task 3
  - JobService（调度+重试+超时+并发+启动恢复+优雅关闭） → Task 4
  - REST API + DTO → Task 5
  - cron_job 工具 + 注册 → Task 6
  - 执行 Agent seed + System Prompt → Task 7
  - 前端类型+API+Store+路由 → Task 8
  - 前端管理页面 → Task 9
  - 端到端测试 + Lint → Task 10
- [x] **Placeholder scan:** 无 TBD/TODO/待定
- [x] **Type consistency:** JobEntity 字段名 (snake_case) 在 JobService、Controller、前端类型中一致
