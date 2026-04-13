import { defineStore } from "pinia";
import { ref } from "vue";
import type { CronJob, JobExecution, CreateJobRequest } from "@/types/cron-job";
import * as api from "@/api/cron-job";

export const useCronJobStore = defineStore("cron-job", () => {
  const jobs = ref<CronJob[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

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
