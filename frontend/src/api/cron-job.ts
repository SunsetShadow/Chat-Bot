import { get, post, del } from "./request";
import type {
  CronJob,
  CreateJobRequest,
  JobExecution,
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
  return get<{ success: boolean; data: JobExecution[]; pagination: { total: number; page: number; per_page: number } }>(`${BASE}/${jobId}/executions`, params);
}

export async function getLatestExecution(jobId: string) {
  return get<{ success: boolean; data: JobExecution | null }>(`${BASE}/${jobId}/executions/latest`);
}
