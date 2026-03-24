<script setup lang="ts">
import { onMounted, computed } from "vue";
import { useAgentStore } from "@/stores/agent";
import {
  InformationCircleOutline,
  ChevronDownOutline,
} from "@vicons/ionicons5";

const agentStore = useAgentStore();

onMounted(() => {
  agentStore.fetchAgents();
});

const agentOptions = computed(() =>
  agentStore.agents.map((agent) => ({
    label: agent.name,
    value: agent.id,
  })),
);

function handleChange(agentId: string) {
  agentStore.setCurrentAgent(agentId);
}
</script>

<template>
  <div class="agent-selector">
    <div class="selector-label">
      <span class="label-mono">Agent</span>
    </div>
    <NSelect
      :value="agentStore.currentAgentId"
      :options="agentOptions"
      :loading="agentStore.isLoading"
      :render-label="(option: any) => option.label"
      style="width: 180px"
      @update:value="handleChange"
    >
      <template #arrow>
        <NIcon :component="ChevronDownOutline" :size="16" />
      </template>
    </NSelect>
    <NTooltip v-if="agentStore.currentAgent" placement="bottom">
      <template #trigger>
        <button class="info-btn">
          <NIcon :component="InformationCircleOutline" :size="16" />
        </button>
      </template>
      <div class="agent-tooltip">
        <div class="tooltip-title">{{ agentStore.currentAgent.name }}</div>
        <div class="tooltip-desc">
          {{ agentStore.currentAgent.description }}
        </div>
        <div
          class="tooltip-traits"
          v-if="agentStore.currentAgent.traits.length"
        >
          <span
            v-for="trait in agentStore.currentAgent.traits"
            :key="trait"
            class="trait-tag"
          >
            {{ trait }}
          </span>
        </div>
      </div>
    </NTooltip>
  </div>
</template>

<style scoped>
.agent-selector {
  display: flex;
  align-items: center;
  gap: 12px;
}

.selector-label {
  display: flex;
  flex-direction: column;
}

.info-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.info-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.agent-tooltip {
  max-width: 280px;
}

.tooltip-title {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.tooltip-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 8px;
}

.tooltip-traits {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.trait-tag {
  padding: 3px 8px;
  background: var(--color-primary-light);
  border: 1px solid var(--color-primary);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-primary);
  letter-spacing: 0.5px;
}
</style>
