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
import { JobEntity } from '../../common/entities/job.entity';
import { JobExecutionEntity } from '../../common/entities/job-execution.entity';
import { JobExecutionService } from './job-execution.service';
import { LangGraphService } from '../langgraph/langgraph.service';

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
    @Inject(forwardRef(() => LangGraphService))
    private langGraphService: LangGraphService,
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
      timezone: input.timezone || 'Asia/Shanghai',
      timeout_ms: input.timeout_ms ?? 60000,
      max_retries: input.max_retries ?? 3,
      is_enabled: true,
      consecutive_failures: 0,
      auto_disable_threshold: 5,
    } as Partial<JobEntity>);

    // 按类型设置调度参数
    if (input.type === 'cron') entity.cron = input.cron;
    if (input.type === 'every') entity.every_ms = input.every_ms;
    if (input.type === 'at') entity.at = input.at;
    if (input.allowed_tools) entity.allowed_tools = input.allowed_tools;
    if (input.agent_id) entity.agent_id = input.agent_id;
    if (input.created_by_session) entity.created_by_session = input.created_by_session;

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
    const sessionId = `job-${Date.now()}`;
    const execute = async (): Promise<string> => {
      return this.langGraphService.executeAsAgent(instruction, sessionId);
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
