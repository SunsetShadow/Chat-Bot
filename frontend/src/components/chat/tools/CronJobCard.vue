<script setup lang="ts">
import { computed } from "vue";
import {
  TimeOutline,
  CheckmarkCircleOutline,
  AlertCircleOutline,
  AddCircleOutline,
  TrashOutline,
  ToggleOutline,
} from "@vicons/ionicons5";

type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

const props = defineProps<{
  toolName: string;
  state: ToolState;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}>();

const action = computed(() => (props.input?.action as string) || "");

const actionIcon = computed(() => {
  switch (action.value) {
    case "add":
      return AddCircleOutline;
    case "delete":
      return TrashOutline;
    case "toggle":
      return ToggleOutline;
    default:
      return TimeOutline;
  }
});

const actionLabel = computed(() => {
  switch (action.value) {
    case "list":
      return "查看任务";
    case "add":
      return "创建任务";
    case "toggle":
      return "切换状态";
    case "delete":
      return "删除任务";
    default:
      return "定时任务";
  }
});

const instruction = computed(() => (props.input?.instruction as string) || "");
const cronExpr = computed(() => (props.input?.cron as string) || "");
const _taskId = computed(() => (props.input?.id as string) || "");
const everyMs = computed(() => (props.input?.everyMs as number) || 0);
const type = computed(() => (props.input?.type as string) || "");

const outputText = computed(() =>
  typeof props.output === "string" ? props.output : "",
);

const scheduleLabel = computed(() => {
  if (cronExpr.value) return `Cron: ${cronExpr.value}`;
  if (everyMs.value) return `每 ${Math.round(everyMs.value / 1000)} 秒`;
  if (type.value === "at") return "一次性定时";
  return "";
});

interface CronJob {
  id: string;
  instruction?: string;
  enabled?: boolean;
  cron?: string;
}

const jobList = computed<CronJob[]>(() => {
  if (!props.output || typeof props.output !== "string") return [];
  try {
    const parsed = JSON.parse(props.output);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.jobs && Array.isArray(parsed.jobs)) return parsed.jobs;
    return [];
  } catch {
    return [];
  }
});

const isListAction = computed(
  () => action.value === "list" && jobList.value.length > 0,
);
</script>

<template>
  <div class="border border-[var(--border-color)] rounded-lg overflow-hidden">
    <!-- Header -->
    <div class="flex items-center gap-2 px-3 py-2">
      <div class="flex items-center justify-center w-4 h-4">
        <div
          v-if="state === 'input-streaming' || state === 'input-available'"
          class="w-3 h-3 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"
        ></div>
        <NIcon
          v-else-if="state === 'output-available'"
          :component="CheckmarkCircleOutline"
          :size="14"
          class="text-green-500"
        />
        <NIcon
          v-else-if="state === 'output-error'"
          :component="AlertCircleOutline"
          :size="14"
          class="text-red-400"
        />
      </div>
      <NIcon
        :component="actionIcon"
        :size="13"
        class="text-[var(--color-primary)]"
      />
      <span class="font-mono text-xs text-[var(--color-primary)]">{{ actionLabel }}</span>
      <span
        v-if="instruction && action !== 'list'"
        class="text-[11px] text-[var(--text-secondary)] truncate max-w-[200px]"
      >{{ instruction }}</span>
      <span class="font-mono text-[10px] text-[var(--text-muted)] ml-auto">
        {{ state === "output-available" ? "已完成" : state === "output-error" ? "失败" : "处理中..." }}
      </span>
    </div>

    <!-- Job List -->
    <div
      v-if="state === 'output-available' && isListAction"
      class="border-t border-[var(--border-color)]"
    >
      <div
        v-for="job in jobList"
        :key="job.id"
        class="px-3 py-2 border-b border-[var(--border-color)] last:border-b-0 flex items-center gap-2"
      >
        <span
          class="w-2 h-2 rounded-full shrink-0"
          :class="job.enabled ? 'bg-green-500' : 'bg-[var(--text-muted)]'"
        ></span>
        <span class="text-[12px] text-[var(--text-primary)] flex-1 truncate">{{
          job.instruction || job.id
        }}</span>
        <span class="font-mono text-[10px] text-[var(--text-muted)] shrink-0">{{
          job.cron || ""
        }}</span>
      </div>
    </div>

    <!-- Add confirmation -->
    <div
      v-else-if="state === 'output-available' && action === 'add' && instruction"
      class="border-t border-[var(--border-color)] px-3 py-2"
    >
      <div class="flex items-center gap-2 mb-1">
        <span class="text-[12px] text-[var(--text-secondary)]">任务：</span>
        <span class="text-[12px] text-[var(--text-primary)]">{{ instruction }}</span>
      </div>
      <div v-if="scheduleLabel" class="text-[11px] text-[var(--text-muted)] font-mono">
        {{ scheduleLabel }}
      </div>
    </div>

    <!-- Generic output -->
    <div
      v-else-if="state === 'output-available' && outputText && !isListAction"
      class="border-t border-[var(--border-color)] px-3 py-2"
    >
      <p class="text-[12px] text-[var(--text-secondary)]">{{ outputText }}</p>
    </div>

    <!-- Error -->
    <div
      v-if="state === 'output-error' && errorText"
      class="border-t border-[var(--border-color)] px-3 py-2 text-[12px] text-red-400"
    >
      {{ errorText }}
    </div>
  </div>
</template>
