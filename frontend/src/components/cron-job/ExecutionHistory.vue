<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  NDrawer,
  NDrawerContent,
  NSelect,
  NTag,
  NEmpty,
  NSpin,
  NScrollbar,
} from "naive-ui";
import { useCronJobStore } from "@/stores/cron-job";
import type { JobExecution, JobExecutionStatus } from "@/types/cron-job";

const store = useCronJobStore();

const props = defineProps<{
  show: boolean;
  jobId: string | null;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
}>();

const statusFilter = ref<JobExecutionStatus | null>(null);

const statusOptions = [
  { label: "全部", value: "" },
  { label: "运行中", value: "running" },
  { label: "成功", value: "success" },
  { label: "失败", value: "failed" },
];

const selectedJob = computed(() =>
  store.jobs.find((j) => j.id === props.jobId),
);

watch(
  () => [props.show, props.jobId],
  async ([show, jobId]) => {
    if (show && jobId) {
      await store.fetchExecutions(jobId, 1, statusFilter.value || undefined);
    }
  },
);

async function onFilterChange(val: string) {
  if (props.jobId) {
    await store.fetchExecutions(props.jobId, 1, val || undefined);
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function statusTagType(status: JobExecutionStatus) {
  switch (status) {
    case "success":
      return "success";
    case "failed":
      return "error";
    case "running":
      return "info";
  }
}

function statusLabel(status: JobExecutionStatus) {
  switch (status) {
    case "success":
      return "成功";
    case "failed":
      return "失败";
    case "running":
      return "运行中";
  }
}
</script>

<template>
  <NDrawer
    :show="show"
    :width="480"
    placement="right"
    :mask-closable="true"
    @update:show="emit('update:show', $event)"
  >
    <NDrawerContent :title="'执行历史'" closable>
      <template #header-extra>
        <NSelect
          :value="statusFilter ?? ''"
          :options="statusOptions"
          size="small"
          style="width: 120px"
          @update:value="onFilterChange"
        />
      </template>

      <div v-if="selectedJob" class="job-info">
        <span class="job-instruction">{{ selectedJob.instruction }}</span>
      </div>

      <NSpin :show="store.isLoading">
        <NScrollbar style="max-height: calc(100vh - 200px)">
          <div class="execution-list">
            <div
              v-for="exec in store.executions"
              :key="exec.id"
              class="execution-item glass-card"
            >
              <div class="exec-header">
                <NTag
                  :type="statusTagType(exec.status)"
                  size="small"
                  :bordered="false"
                  round
                >
                  {{ statusLabel(exec.status) }}
                </NTag>
                <span class="exec-time">{{ formatTime(exec.started_at) }}</span>
              </div>

              <div class="exec-details">
                <span class="exec-detail">
                  耗时: {{ formatDuration(exec.duration_ms) }}
                </span>
                <span v-if="exec.retry_attempt > 0" class="exec-detail retry">
                  重试: #{{ exec.retry_attempt }}
                </span>
              </div>

              <div v-if="exec.result" class="exec-result">
                <span class="result-label">结果</span>
                <div class="result-text">{{ exec.result }}</div>
              </div>

              <div v-if="exec.error" class="exec-error">
                <span class="result-label">错误</span>
                <div class="error-text">{{ exec.error }}</div>
              </div>
            </div>

            <NEmpty
              v-if="store.executions.length === 0 && !store.isLoading"
              description="暂无执行记录"
            />
          </div>
        </NScrollbar>
      </NSpin>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.job-info {
  margin-bottom: 16px;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}

.job-instruction {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.execution-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-right: 4px;
}

.execution-item {
  padding: 14px 16px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--bg-secondary);
  transition: border-color var(--transition-fast);
}

.execution-item:hover {
  border-color: var(--color-primary);
}

.exec-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.exec-time {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
}

.exec-details {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.exec-detail {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.exec-detail.retry {
  color: var(--color-warning, #ffb800);
}

.exec-result,
.exec-error {
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}

.result-label {
  display: block;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.result-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
}

.error-text {
  font-size: 13px;
  color: var(--color-error, #ff453a);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 120px;
  overflow-y: auto;
}
</style>
