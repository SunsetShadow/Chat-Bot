import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
        running: this.jobService.listJobs().then((jobs) => jobs.find((j) => j.id === id)?.running ?? false),
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
