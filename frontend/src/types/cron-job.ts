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
