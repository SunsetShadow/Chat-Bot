<script setup lang="ts">
import { computed } from "vue";
import { NTag } from "naive-ui";

const props = defineProps<{
  isEnabled: boolean;
  running: boolean;
}>();

const badgeConfig = computed(() => {
  if (props.isEnabled && props.running) {
    return { label: "运行中", type: "success" as const };
  }
  if (props.isEnabled) {
    return { label: "已启用", type: "warning" as const };
  }
  return { label: "已停用", type: "default" as const };
});
</script>

<template>
  <NTag :type="badgeConfig.type" size="small" round :bordered="false">
    <template #icon>
      <span v-if="badgeConfig.label === '运行中'" class="status-dot running" />
      <span v-else-if="badgeConfig.label === '已启用'" class="status-dot enabled" />
    </template>
    {{ badgeConfig.label }}
  </NTag>
</template>

<style scoped>
.status-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.status-dot.running {
  background: var(--neon-green);
  animation: pulse 2s infinite;
}

.status-dot.enabled {
  background: var(--color-warning, #ffb800);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
