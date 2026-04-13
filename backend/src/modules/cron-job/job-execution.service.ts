import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { JobExecutionEntity, JobExecutionStatus } from '../../common/entities/job-execution.entity';

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
