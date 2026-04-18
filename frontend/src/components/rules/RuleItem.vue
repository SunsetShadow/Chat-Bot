<script setup lang="ts">
import type { Rule } from "@/types";

defineProps<{
  rule: Rule;
  readonly?: boolean;
}>();

const emit = defineEmits<{
  toggle: [id: string];
}>();
</script>

<template>
  <div
    class="flex items-center justify-between px-4 py-3.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-[var(--radius-md)] transition-all duration-150 hover:border-[var(--color-primary)]"
    :class="{ 'opacity-50': !rule.enabled }"
  >
    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-1.5">
        <span class="text-sm font-medium text-[var(--text-primary)]">{{
          rule.name
        }}</span>
        <span
          v-if="rule.scope === 'global'"
          class="px-1.5 py-0.5 bg-[rgba(16,185,129,0.1)] border border-[rgba(16,185,129,0.3)] rounded font-mono text-[9px] text-emerald-500 tracking-wide uppercase"
        >
          全局
        </span>
        <span
          v-if="rule.is_builtin"
          class="px-1.5 py-0.5 bg-[rgba(139,92,246,0.1)] border border-[rgba(139,92,246,0.3)] rounded font-mono text-[9px] text-purple-500 tracking-wide uppercase"
        >
          内置
        </span>
      </div>
      <div
        class="text-xs text-[var(--text-secondary)] leading-relaxed truncate mb-1.5"
      >
        {{ rule.content }}
      </div>
      <div class="flex gap-1">
        <span
          class="px-2 py-0.5 bg-[var(--color-primary-light)] rounded font-mono text-[10px] text-[var(--color-primary)] tracking-wide"
        >
          {{ rule.category }}
        </span>
      </div>
    </div>
    <div class="ml-3">
      <NSwitch
        v-if="!readonly"
        :value="rule.enabled"
        size="small"
        @update:value="emit('toggle', rule.id)"
      />
      <div v-else class="w-8 h-5 flex items-center justify-center">
        <span class="text-[10px] text-[var(--text-muted)] font-mono">ON</span>
      </div>
    </div>
  </div>
</template>
