<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import {
  NIcon,
  NModal,
  NButton,
  NSpin,
  NEmpty,
  NPopconfirm,
  useMessage,
  useDialog,
} from "naive-ui";
import {
  ArrowBackOutline,
  AddOutline,
  PlayOutline,
  PauseOutline,
  TrashOutline,
  FlashOutline,
  TimeOutline,
  RefreshOutline,
} from "@vicons/ionicons5";
import { useCronJobStore } from "@/stores/cron-job";
import type { CreateJobRequest, CronJob } from "@/types/cron-job";
import JobStatusBadge from "@/components/cron-job/JobStatusBadge.vue";
import JobForm from "@/components/cron-job/JobForm.vue";
import ExecutionHistory from "@/components/cron-job/ExecutionHistory.vue";

const router = useRouter();
const store = useCronJobStore();
const message = useMessage();
const dialog = useDialog();

const showModal = ref(false);
const saving = ref(false);
const showHistory = ref(false);
const historyJobId = ref<string | null>(null);
const formRef = ref<InstanceType<typeof JobForm> | null>(null);

const defaultForm = (): CreateJobRequest => ({
  instruction: "",
  type: "cron",
  cron: "",
  timeout_ms: 60_000,
  max_retries: 0,
});

const formValue = ref<CreateJobRequest>(defaultForm());

onMounted(() => {
  store.fetchJobs();
});

function goBack() {
  router.push("/");
}

function openCreateModal() {
  formValue.value = defaultForm();
  showModal.value = true;
}

async function handleSubmit() {
  if (!formValue.value.instruction?.trim()) {
    message.warning("请输入任务指令");
    return;
  }

  const scheduleOk =
    (formValue.value.type === "cron" && !!formValue.value.cron?.trim()) ||
    (formValue.value.type === "every" && formValue.value.every_ms != null) ||
    (formValue.value.type === "at" && !!formValue.value.at);

  if (!scheduleOk) {
    message.warning("请完善调度配置");
    return;
  }

  saving.value = true;
  try {
    await store.createJob(formValue.value);
    message.success("任务创建成功");
    showModal.value = false;
  } catch (e) {
    message.error(e instanceof Error ? e.message : "创建失败");
  } finally {
    saving.value = false;
  }
}

async function handleToggle(job: CronJob) {
  try {
    await store.toggleJob(job.id, !job.is_enabled);
    message.success(job.is_enabled ? "已停用" : "已启用");
  } catch (e) {
    message.error(e instanceof Error ? e.message : "操作失败");
  }
}

async function handleTrigger(job: CronJob) {
  try {
    await store.triggerJob(job.id);
    message.success("已触发执行");
  } catch (e) {
    message.error(e instanceof Error ? e.message : "触发失败");
  }
}

function handleDelete(job: CronJob) {
  dialog.warning({
    title: "确认删除",
    content: `确定要删除任务「${truncateInstruction(job.instruction)}」吗？此操作不可恢复。`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await store.deleteJob(job.id);
        message.success("已删除");
      } catch (e) {
        message.error(e instanceof Error ? e.message : "删除失败");
      }
    },
  });
}

function openHistory(jobId: string) {
  historyJobId.value = jobId;
  showHistory.value = true;
}

function formatSchedule(job: CronJob): string {
  switch (job.type) {
    case "cron":
      return job.cron ?? "-";
    case "every": {
      if (!job.every_ms) return "-";
      if (job.every_ms < 60_000) return `${(job.every_ms / 1000).toFixed(0)}s`;
      if (job.every_ms < 3_600_000) return `${(job.every_ms / 60_000).toFixed(0)}min`;
      return `${(job.every_ms / 3_600_000).toFixed(1)}h`;
    }
    case "at":
      return job.at ? new Date(job.at).toLocaleString("zh-CN") : "-";
    default:
      return "-";
  }
}

function formatLastRun(iso: string | null): string {
  if (!iso) return "从未执行";
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeLabel(type: string): string {
  switch (type) {
    case "cron": return "Cron";
    case "every": return "间隔";
    case "at": return "一次性";
    default: return type;
  }
}

function truncateInstruction(text: string, max = 80): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "..." : text;
}
</script>

<template>
  <div class="cron-jobs-view">
    <!-- Header -->
    <header class="config-header glass-card">
      <button class="back-btn" @click="goBack">
        <NIcon :component="ArrowBackOutline" :size="20" />
        <span>返回</span>
      </button>
      <div class="header-title">
        <span class="label-mono">Cron Jobs</span>
        <h2>定时任务管理</h2>
      </div>
      <div class="header-actions">
        <button class="refresh-btn" @click="store.fetchJobs()">
          <NIcon :component="RefreshOutline" :size="18" />
        </button>
        <button class="create-btn" @click="openCreateModal">
          <NIcon :component="AddOutline" :size="18" />
          <span>创建任务</span>
        </button>
      </div>
    </header>

    <!-- Job List -->
    <div class="jobs-content">
      <NSpin :show="store.isLoading">
        <div v-if="store.jobs.length > 0" class="job-cards">
          <div
            v-for="job in store.jobs"
            :key="job.id"
            class="job-card glass-card"
            :class="{ disabled: !job.is_enabled }"
          >
            <!-- Card Header -->
            <div class="card-header">
              <div class="card-title-row">
                <span class="type-tag" :class="job.type">
                  {{ typeLabel(job.type) }}
                </span>
                <JobStatusBadge
                  :is-enabled="job.is_enabled"
                  :running="job.running"
                />
              </div>
              <div class="card-actions">
                <button
                  class="action-btn"
                  title="手动触发"
                  :disabled="job.running"
                  @click="handleTrigger(job)"
                >
                  <NIcon :component="FlashOutline" :size="16" />
                </button>
                <button
                  class="action-btn"
                  :title="job.is_enabled ? '停用' : '启用'"
                  @click="handleToggle(job)"
                >
                  <NIcon
                    :component="job.is_enabled ? PauseOutline : PlayOutline"
                    :size="16"
                  />
                </button>
                <button
                  class="action-btn"
                  title="执行历史"
                  @click="openHistory(job.id)"
                >
                  <NIcon :component="TimeOutline" :size="16" />
                </button>
                <button
                  class="action-btn delete"
                  title="删除"
                  @click="handleDelete(job)"
                >
                  <NIcon :component="TrashOutline" :size="16" />
                </button>
              </div>
            </div>

            <!-- Instruction -->
            <div class="card-instruction">{{ job.instruction }}</div>

            <!-- Meta -->
            <div class="card-meta">
              <div class="meta-item">
                <span class="meta-label">调度</span>
                <code class="meta-value schedule">{{ formatSchedule(job) }}</code>
              </div>
              <div class="meta-item">
                <span class="meta-label">上次执行</span>
                <span class="meta-value">{{ formatLastRun(job.last_run) }}</span>
              </div>
              <div v-if="job.consecutive_failures > 0" class="meta-item">
                <span class="meta-label">连续失败</span>
                <span class="meta-value failure">{{ job.consecutive_failures }} 次</span>
              </div>
            </div>

            <!-- Last Execution -->
            <div v-if="job.last_execution" class="last-exec">
              <NTag
                :type="job.last_execution.status === 'success' ? 'success' : 'error'"
                size="small"
                :bordered="false"
                round
              >
                {{ job.last_execution.status === "success" ? "成功" : "失败" }}
              </NTag>
              <span v-if="job.last_execution.duration_ms != null" class="exec-duration">
                {{ (job.last_execution.duration_ms / 1000).toFixed(1) }}s
              </span>
              <span v-if="job.last_execution.error" class="exec-error-preview">
                {{ truncateInstruction(job.last_execution.error, 60) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Empty -->
        <div
          v-if="store.jobs.length === 0 && !store.isLoading"
          class="empty-state"
        >
          <div class="empty-icon">
            <NIcon :component="TimeOutline" :size="48" />
          </div>
          <p class="empty-title">暂无定时任务</p>
          <p class="empty-hint">点击「创建任务」开始设置自动化任务</p>
        </div>
      </NSpin>

      <!-- Error -->
      <div v-if="store.error" class="error-bar">
        <span>{{ store.error }}</span>
        <button @click="store.fetchJobs()">重试</button>
      </div>
    </div>

    <!-- Create Modal -->
    <NModal
      v-model:show="showModal"
      preset="card"
      title="创建定时任务"
      style="width: 560px"
    >
      <JobForm ref="formRef" v-model="formValue" />
      <template #footer>
        <div class="modal-footer">
          <button class="modal-btn cancel" @click="showModal = false">
            取消
          </button>
          <button
            class="modal-btn submit"
            :disabled="saving"
            @click="handleSubmit"
          >
            <NSpin v-if="saving" :size="16" style="margin-right: 6px" />
            创建
          </button>
        </div>
      </template>
    </NModal>

    <!-- Execution History Drawer -->
    <ExecutionHistory
      v-model:show="showHistory"
      :job-id="historyJobId"
    />
  </div>
</template>

<style scoped>
.cron-jobs-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 16px;
}

/* === Header === */
.config-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 24px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.back-btn:hover {
  border-color: var(--neon-cyan);
  color: var(--neon-cyan);
}

.header-title {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-title h2 {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.label-mono {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-muted);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.refresh-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-sm);
  color: #fff;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

:root.dark .create-btn {
  color: var(--text-inverse);
}

.create-btn:hover {
  background: var(--color-primary-hover);
}

/* === Job List === */
.jobs-content {
  flex: 1;
  overflow-y: auto;
}

.job-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  gap: 16px;
}

.job-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  transition: all var(--transition-smooth);
}

.job-card:hover {
  border-color: var(--color-primary);
}

.job-card.disabled {
  opacity: 0.6;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.type-tag {
  padding: 2px 10px;
  border: 1px solid;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.type-tag.cron {
  color: var(--neon-cyan);
  border-color: rgba(0, 180, 216, 0.25);
  background: rgba(0, 180, 216, 0.1);
}

:root.dark .type-tag.cron {
  color: var(--neon-cyan);
  border-color: rgba(0, 240, 255, 0.25);
  background: rgba(0, 240, 255, 0.1);
}

.type-tag.every {
  color: var(--neon-purple);
  border-color: rgba(155, 93, 229, 0.25);
  background: rgba(155, 93, 229, 0.1);
}

:root.dark .type-tag.every {
  color: var(--neon-purple);
  border-color: rgba(191, 90, 242, 0.25);
  background: rgba(191, 90, 242, 0.1);
}

.type-tag.at {
  color: var(--neon-pink);
  border-color: rgba(247, 37, 133, 0.25);
  background: rgba(247, 37, 133, 0.1);
}

:root.dark .type-tag.at {
  color: var(--neon-pink);
  border-color: rgba(255, 45, 146, 0.25);
  background: rgba(255, 45, 146, 0.1);
}

.card-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.job-card:hover .card-actions {
  opacity: 1;
}

.action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover:not(:disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn.delete:hover {
  border-color: var(--neon-pink);
  color: var(--neon-pink);
  background: rgba(247, 37, 133, 0.1);
}

:root.dark .action-btn.delete:hover {
  background: rgba(255, 45, 146, 0.1);
}

/* Card Content */
.card-instruction {
  font-size: 14px;
  color: var(--text-primary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-label {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.meta-value {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-secondary);
}

.meta-value.schedule {
  color: var(--neon-cyan);
}

.meta-value.failure {
  color: var(--color-error, #ff453a);
}

.last-exec {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.exec-duration {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--text-muted);
}

.exec-error-preview {
  font-size: 12px;
  color: var(--color-error, #ff453a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}

/* === Modal Footer === */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.modal-btn {
  display: flex;
  align-items: center;
  padding: 10px 24px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.modal-btn.cancel {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.modal-btn.cancel:hover {
  border-color: var(--text-secondary);
}

.modal-btn.submit {
  background: var(--color-primary);
  border: none;
  color: #fff;
}

:root.dark .modal-btn.submit {
  color: var(--text-inverse);
}

.modal-btn.submit:hover {
  background: var(--color-primary-hover);
}

.modal-btn.submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* === Empty === */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  margin-bottom: 20px;
}

.empty-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
}

/* === Error Bar === */
.error-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding: 10px 16px;
  background: rgba(255, 69, 58, 0.1);
  border: 1px solid rgba(255, 69, 58, 0.25);
  border-radius: var(--radius-sm);
  font-size: 13px;
  color: var(--color-error, #ff453a);
}

.error-bar button {
  padding: 4px 12px;
  background: transparent;
  border: 1px solid rgba(255, 69, 58, 0.3);
  border-radius: var(--radius-sm);
  color: var(--color-error, #ff453a);
  cursor: pointer;
  font-size: 12px;
}

.error-bar button:hover {
  background: rgba(255, 69, 58, 0.1);
}
</style>
