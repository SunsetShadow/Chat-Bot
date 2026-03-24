<script setup lang="ts">
import type { Rule } from "@/types";

defineProps<{
  rule: Rule;
}>();

const emit = defineEmits<{
  toggle: [id: string];
}>();
</script>

<template>
  <div class="rule-item" :class="{ disabled: !rule.enabled }">
    <div class="rule-info">
      <div class="rule-header">
        <span class="rule-name">{{ rule.name }}</span>
        <span v-if="rule.is_builtin" class="builtin-badge">内置</span>
      </div>
      <div class="rule-content">{{ rule.content }}</div>
      <div class="rule-category">
        <span class="category-tag">{{ rule.category }}</span>
      </div>
    </div>
    <div class="rule-toggle">
      <NSwitch
        :value="rule.enabled"
        size="small"
        @update:value="emit('toggle', rule.id)"
      />
    </div>
  </div>
</template>

<style scoped>
.rule-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.rule-item:hover {
  border-color: var(--color-primary);
}

.rule-item.disabled {
  opacity: 0.5;
}

.rule-info {
  flex: 1;
  min-width: 0;
}

.rule-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.rule-name {
  font-family: var(--font-display);
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.builtin-badge {
  padding: 2px 6px;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 9px;
  color: #8b5cf6;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.rule-content {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 6px;
}

.rule-category {
  display: flex;
  gap: 4px;
}

.category-tag {
  padding: 2px 8px;
  background: var(--color-primary-light);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--color-primary);
  letter-spacing: 0.5px;
}

.rule-toggle {
  margin-left: 12px;
}
</style>
