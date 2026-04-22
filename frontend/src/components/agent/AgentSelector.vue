<script setup lang="ts">
import { onMounted, computed, watch } from "vue";
import { useAgentStore } from "@/stores/agent";
import { useRulesStore } from "@/stores/rules";
import {
  InformationCircleOutline,
  ChevronDownOutline,
} from "@vicons/ionicons5";

const agentStore = useAgentStore();
const rulesStore = useRulesStore();

onMounted(() => {
  agentStore.fetchAgents();
});

const agentOptions = computed(() =>
  agentStore.agents
    .filter((agent) => agent.id !== "builtin-job-executor")
    .map((agent) => ({
      label: agent.name,
      value: agent.id,
    })),
);

async function handleChange(agentId: string) {
  // 先保存当前规则到当前 Agent
  await agentStore.saveCurrentRulesToAgent();
  // 再切换
  agentStore.setCurrentAgent(agentId);
}

// 规则变化时 debounce 保存到当前 Agent
let saveTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  () => rulesStore.enabledRuleIds,
  () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      agentStore.saveCurrentRulesToAgent();
    }, 1000);
  },
  { deep: true },
);
</script>

<template>
  <div class="flex items-center gap-2 md:gap-3">
    <div class="hidden md:flex flex-col">
      <span
        class="font-mono text-[11px] tracking-wider uppercase text-[var(--text-muted)]"
        >Agent</span
      >
    </div>
    <NSelect
      :value="agentStore.currentAgentId"
      :options="agentOptions"
      :loading="agentStore.isLoading"
      :render-label="(option: any) => option.label"
      class="agent-select"
      @update:value="handleChange"
    >
      <template #arrow>
        <NIcon :component="ChevronDownOutline" :size="16" />
      </template>
    </NSelect>
    <NTooltip v-if="agentStore.currentAgent" placement="bottom">
      <template #trigger>
        <button
          class="hidden md:flex w-8 h-8 items-center justify-center bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        >
          <NIcon :component="InformationCircleOutline" :size="16" />
        </button>
      </template>
      <div class="max-w-[280px]">
        <div class="font-semibold text-[var(--text-primary)] mb-1.5">
          {{ agentStore.currentAgent.name }}
        </div>
        <div
          class="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-2"
        >
          {{ agentStore.currentAgent.description }}
        </div>
        <div
          v-if="agentStore.currentAgent.traits.length"
          class="flex flex-wrap gap-1.5"
        >
          <span
            v-for="trait in agentStore.currentAgent.traits"
            :key="trait"
            class="px-2 py-0.5 bg-[var(--color-primary-light)] border border-[var(--color-primary)] rounded text-[10px] font-mono text-[var(--color-primary)] tracking-wide"
          >
            {{ trait }}
          </span>
        </div>
      </div>
    </NTooltip>
  </div>
</template>

<style scoped>
.agent-select {
  width: 180px;
}
@media (max-width: 767px) {
  .agent-select {
    width: 120px;
  }
}
</style>
