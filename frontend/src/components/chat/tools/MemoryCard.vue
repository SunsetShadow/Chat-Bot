<script setup lang="ts">
import { computed } from "vue";
import {
  BookmarkOutline,
  CheckmarkCircleOutline,
  AlertCircleOutline,
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

const content = computed(() => (props.input?.content as string) || "");
const memoryType = computed(() => (props.input?.memory_type as string) || "fact");
const importance = computed(() => (props.input?.importance as number) || 5);

const typeConfig = computed(() => {
  switch (memoryType.value) {
    case "preference":
      return { label: "偏好", color: "text-cyan-400 bg-cyan-400/10" };
    case "event":
      return { label: "事件", color: "text-green-400 bg-green-400/10" };
    default:
      return { label: "事实", color: "text-purple-400 bg-purple-400/10" };
  }
});

const importanceColor = computed(() => {
  if (importance.value >= 8) return "bg-[var(--neon-pink)]";
  if (importance.value >= 5) return "bg-[var(--color-warning)]";
  return "bg-[var(--color-primary)]";
});

const outputText = computed(() =>
  typeof props.output === "string" ? props.output : "",
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
        :component="BookmarkOutline"
        :size="13"
        class="text-[var(--color-primary)]"
      />
      <span class="font-mono text-xs text-[var(--color-primary)]">记忆提取</span>
      <span class="font-mono text-[10px] text-[var(--text-muted)] ml-auto">
        {{ state === "output-available" ? "已保存" : state === "output-error" ? "保存失败" : "提取中..." }}
      </span>
    </div>

    <!-- Memory Content -->
    <div
      v-if="content && (state === 'input-available' || state === 'output-available')"
      class="border-t border-[var(--border-color)] px-3 py-2"
    >
      <div class="flex items-center gap-2 mb-1.5">
        <span
          class="text-[10px] font-mono px-1.5 py-0.5 rounded"
          :class="typeConfig.color"
        >{{ typeConfig.label }}</span>
        <div class="flex items-center gap-1 ml-auto">
          <span class="text-[10px] text-[var(--text-muted)]">重要度</span>
          <div class="flex gap-0.5">
            <div
              v-for="i in 10"
              :key="i"
              class="w-1 h-3 rounded-sm"
              :class="i <= importance ? importanceColor : 'bg-[var(--border-color)]'"
            ></div>
          </div>
        </div>
      </div>
      <p class="text-[12px] text-[var(--text-secondary)] leading-relaxed">
        {{ content }}
      </p>
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
