<script setup lang="ts">
import { computed } from "vue";
import {
  MailOutline,
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

const to = computed(() => (props.input?.to as string) || "");
const subject = computed(() => (props.input?.subject as string) || "");
const body = computed(() => (props.input?.body as string) || "");
const bodyPreview = computed(() => {
  const text = body.value;
  if (text.length <= 120) return text;
  return text.slice(0, 120) + "...";
});
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
        :component="MailOutline"
        :size="13"
        class="text-[var(--color-primary)]"
      />
      <span class="font-mono text-xs text-[var(--color-primary)]">发送邮件</span>
      <span v-if="to" class="text-xs text-[var(--text-secondary)] truncate max-w-[200px]">{{
        to
      }}</span>
      <span class="font-mono text-[10px] text-[var(--text-muted)] ml-auto">
        {{ state === "output-available" ? "已发送" : state === "output-error" ? "发送失败" : "发送中..." }}
      </span>
    </div>

    <!-- Mail Preview -->
    <div
      v-if="state === 'output-available' && subject"
      class="border-t border-[var(--border-color)] px-3 py-2"
    >
      <div class="text-[13px] font-medium text-[var(--text-primary)] mb-1">
        {{ subject }}
      </div>
      <p class="text-[12px] text-[var(--text-secondary)] leading-relaxed line-clamp-3">
        {{ bodyPreview }}
      </p>
    </div>

    <!-- Loading Preview -->
    <div
      v-else-if="(state === 'input-streaming' || state === 'input-available') && subject"
      class="border-t border-[var(--border-color)] px-3 py-2"
    >
      <div class="flex items-center gap-2">
        <span class="text-[12px] text-[var(--text-muted)]">准备发送给</span>
        <span class="text-[12px] font-mono text-[var(--text-secondary)]">{{ to }}</span>
      </div>
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
