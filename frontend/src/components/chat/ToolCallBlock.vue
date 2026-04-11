<script setup lang="ts">
import { ref, computed } from "vue";
import {
  ConstructOutline,
  CheckmarkCircleOutline,
  AlertCircleOutline,
  EllipseOutline,
  ChevronDownOutline,
  ChevronUpOutline,
} from "@vicons/ionicons5";

type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  extract_memory: "记忆提取",
};

const props = defineProps<{
  toolName: string;
  state: ToolState;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}>();

const expanded = ref(false);
const toggleExpand = () => (expanded.value = !expanded.value);

const displayName = computed(
  () => TOOL_DISPLAY_NAMES[props.toolName] || props.toolName,
);

const stateLabel = computed(() => {
  switch (props.state) {
    case "input-streaming":
      return "调用中...";
    case "input-available":
      return "准备执行";
    case "output-available":
      return "已完成";
    case "output-error":
      return "执行失败";
  }
});

const hasDetails = computed(
  () =>
    (props.state === "input-available" || props.state === "output-available") &&
    (props.input || props.output),
);
</script>

<template>
  <div
    class="tool-call-block border border-[var(--border-color)] rounded-lg overflow-hidden"
  >
    <!-- Header -->
    <div
      class="flex items-center gap-2 px-3 py-2 cursor-pointer select-none hover:bg-[var(--bg-tertiary)] transition-colors"
      @click="hasDetails && toggleExpand()"
    >
      <!-- State Icon -->
      <div class="flex items-center justify-center w-4 h-4">
        <div
          v-if="state === 'input-streaming'"
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
        <NIcon
          v-else
          :component="EllipseOutline"
          :size="14"
          class="text-[var(--text-muted)]"
        />
      </div>

      <!-- Tool Info -->
      <NIcon :component="ConstructOutline" :size="13" class="text-[var(--color-primary)]" />
      <span class="font-mono text-xs text-[var(--color-primary)]">{{
        displayName
      }}</span>
      <span
        class="font-mono text-[10px] text-[var(--text-muted)] tracking-wide"
        >{{ stateLabel }}</span
      >

      <!-- Expand Toggle -->
      <NIcon
        v-if="hasDetails"
        :component="expanded ? ChevronUpOutline : ChevronDownOutline"
        :size="12"
        class="ml-auto text-[var(--text-muted)]"
      />
    </div>

    <!-- Details -->
    <div v-if="expanded && hasDetails" class="border-t border-[var(--border-color)]">
      <!-- Input -->
      <div v-if="input" class="px-3 py-2 border-b border-[var(--border-color)]">
        <div
          class="font-mono text-[10px] text-[var(--text-muted)] mb-1 uppercase tracking-wider"
        >
          输入参数
        </div>
        <pre
          class="text-[12px] text-[var(--text-secondary)] whitespace-pre-wrap break-all font-mono leading-relaxed"
        >{{ JSON.stringify(input, null, 2) }}</pre>
      </div>

      <!-- Output -->
      <div v-if="output && state === 'output-available'" class="px-3 py-2">
        <div
          class="font-mono text-[10px] text-[var(--text-muted)] mb-1 uppercase tracking-wider"
        >
          执行结果
        </div>
        <pre
          class="text-[12px] text-[var(--text-secondary)] whitespace-pre-wrap break-all font-mono leading-relaxed"
        >{{
          typeof output === "string" ? output : JSON.stringify(output, null, 2)
        }}</pre>
      </div>

      <!-- Error -->
      <div
        v-if="state === 'output-error' && errorText"
        class="px-3 py-2 text-[12px] text-red-400"
      >
        {{ errorText }}
      </div>
    </div>
  </div>
</template>
