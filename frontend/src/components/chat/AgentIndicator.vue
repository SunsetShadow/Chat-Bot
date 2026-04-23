<script setup lang="ts">
import { computed } from "vue";
import { useAgentStore } from "@/stores/agent";

const agentStore = useAgentStore();

const props = defineProps<{
  agentId: string;
}>();

const agent = computed(() =>
  agentStore.agents.find((a) => a.id === props.agentId),
);

const displayName = computed(() => agent.value?.name || props.agentId);
const displayIcon = computed(() => agent.value?.avatar || "✨");
</script>

<template>
  <div v-if="agentId" class="agent-indicator">
    <div class="indicator-dot"></div>
    <span class="indicator-name">{{ displayName }}</span>
  </div>
</template>

<style scoped>
.agent-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--color-primary-light, rgba(59, 130, 246, 0.1));
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 20px;
  font-size: 12px;
  color: var(--color-primary, #3b82f6);
  animation: fadeIn 0.3s ease-out;
}

.indicator-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--neon-green, #06d6a0);
  animation: pulse 2s infinite;
}

.indicator-icon {
  font-size: 14px;
}

.indicator-name {
  font-family: var(--font-mono, monospace);
  font-weight: 500;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}
</style>
