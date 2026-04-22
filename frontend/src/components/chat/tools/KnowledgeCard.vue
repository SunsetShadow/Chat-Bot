<script setup lang="ts">
import { computed } from "vue";
import {
  BookOutline,
  CheckmarkCircleOutline,
  AlertCircleOutline,
} from "@vicons/ionicons5";
import { renderMarkdownSafe } from "@/utils/markdown";

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

const query = computed(() => (props.input?.query as string) || "");

const rawOutput = computed(() =>
  typeof props.output === "string" ? props.output : "",
);

const renderedOutput = computed(() =>
  rawOutput.value ? renderMarkdownSafe(rawOutput.value) : "",
);

const isEmpty = computed(
  () =>
    props.state === "output-available" &&
    (!rawOutput.value ||
      rawOutput.value.includes("未找到") ||
      rawOutput.value.includes("没有找到")),
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
        :component="BookOutline"
        :size="13"
        class="text-[var(--color-primary)]"
      />
      <span class="font-mono text-xs text-[var(--color-primary)]">知识查询</span>
      <span v-if="query" class="text-xs text-[var(--text-secondary)] truncate max-w-[200px]"
        >"{{ query }}"</span
      >
      <span class="font-mono text-[10px] text-[var(--text-muted)] ml-auto">
        {{ state === "output-available" ? "已查询" : state === "output-error" ? "查询失败" : "查询中..." }}
      </span>
    </div>

    <!-- Empty state -->
    <div
      v-if="isEmpty"
      class="border-t border-[var(--border-color)] px-3 py-3 text-center"
    >
      <span class="text-[12px] text-[var(--text-muted)]">未找到相关知识</span>
    </div>

    <!-- Results -->
    <div
      v-else-if="state === 'output-available' && renderedOutput"
      class="border-t border-[var(--border-color)] px-3 py-2"
    >
      <div
        class="text-[12px] text-[var(--text-secondary)] leading-relaxed break-words markdown-body max-h-60 overflow-y-auto"
        v-html="renderedOutput"
      ></div>
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
