<script setup lang="ts">
import { computed } from "vue";
import {
  TerminalOutline,
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

const command = computed(() => (props.input?.command as string) || "");
const _workDir = computed(() => (props.input?.workingDirectory as string) || "");

interface CommandResult {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

const result = computed<CommandResult | null>(() => {
  if (!props.output || typeof props.output !== "string") return null;
  try {
    return JSON.parse(props.output);
  } catch {
    return null;
  }
});

const rawOutput = computed(() => {
  if (result.value) return "";
  return typeof props.output === "string" ? props.output : "";
});

const exitCode = computed(() => result.value?.exitCode);
const isFailed = computed(() => exitCode.value !== undefined && exitCode.value !== 0);
</script>

<template>
  <div
    class="border border-[var(--border-color)] rounded-lg overflow-hidden"
  >
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
          :class="isFailed ? 'text-yellow-500' : 'text-green-500'"
        />
        <NIcon
          v-else-if="state === 'output-error'"
          :component="AlertCircleOutline"
          :size="14"
          class="text-red-400"
        />
      </div>
      <NIcon
        :component="TerminalOutline"
        :size="13"
        class="text-[var(--color-primary)]"
      />
      <span class="font-mono text-xs text-[var(--color-primary)]">执行命令</span>
      <span
        v-if="command"
        class="text-[11px] text-[var(--text-secondary)] truncate max-w-[240px] font-mono"
        >{{ command }}</span
      >
      <span class="font-mono text-[10px] text-[var(--text-muted)] ml-auto">
        <template v-if="state === 'output-available'">
          exit {{ exitCode ?? "?" }}
        </template>
        <template v-else-if="state === 'output-error'">失败</template>
        <template v-else>执行中...</template>
      </span>
    </div>

    <!-- Terminal Output -->
    <div
      v-if="state === 'output-available' && (result || rawOutput)"
      class="border-t border-[var(--border-color)] bg-[var(--bg-primary)]"
    >
      <!-- Structured result -->
      <template v-if="result">
        <div v-if="result.stdout" class="px-3 py-2">
          <pre
            class="text-[12px] text-green-400 whitespace-pre-wrap break-all font-mono leading-relaxed max-h-48 overflow-y-auto"
          >{{ result.stdout }}</pre>
        </div>
        <div v-if="result.stderr" class="px-3 py-2" :class="result.stdout ? 'border-t border-[var(--border-color)]' : ''">
          <pre
            class="text-[12px] text-red-400 whitespace-pre-wrap break-all font-mono leading-relaxed max-h-32 overflow-y-auto"
          >{{ result.stderr }}</pre>
        </div>
      </template>
      <!-- Raw text fallback -->
      <div v-else class="px-3 py-2">
        <pre
          class="text-[12px] text-[var(--text-secondary)] whitespace-pre-wrap break-all font-mono leading-relaxed max-h-48 overflow-y-auto"
        >{{ rawOutput }}</pre>
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
