<script setup lang="ts">
import { useRouter } from "vue-router";
import AgentEditor from "@/components/agent/AgentEditor.vue";
import RuleEditor from "@/components/rules/RuleEditor.vue";
import { useMemoryStore } from "@/stores/memory";
import { onMounted, ref } from "vue";
import type { MemoryType } from "@/types";
import {
  ArrowBackOutline,
  TrashOutline,
  SparklesOutline,
} from "@vicons/ionicons5";

const router = useRouter();
const memoryStore = useMemoryStore();

const activeTab = ref("agents");
const memoryTypeFilter = ref<MemoryType | undefined>(undefined);

onMounted(() => {
  memoryStore.fetchMemories();
});

function goBack() {
  router.push("/");
}
</script>

<template>
  <div class="settings-view">
    <!-- Header -->
    <header class="settings-header glass-card">
      <button class="back-btn" @click="goBack">
        <NIcon :component="ArrowBackOutline" :size="20" />
        <span>返回</span>
      </button>
      <div class="header-title">
        <span class="label-mono">Settings</span>
        <h2>设置中心</h2>
      </div>
      <div class="header-spacer" />
    </header>

    <!-- Content -->
    <div class="settings-content">
      <div class="tabs-wrapper glass-card">
        <NTabs v-model:value="activeTab" type="line" animated>
          <!-- Agents Tab -->
          <NTabPane name="agents" tab="Agent 管理">
            <div class="tab-content">
              <AgentEditor />
            </div>
          </NTabPane>

          <!-- Rules Tab -->
          <NTabPane name="rules" tab="规则管理">
            <div class="tab-content">
              <div class="section-header">
                <div class="section-title">
                  <span class="label-mono">Rules</span>
                  <h3>规则配置</h3>
                </div>
              </div>
              <div class="rules-panel">
                <RuleEditor />
              </div>
            </div>
          </NTabPane>

          <!-- Memories Tab -->
          <NTabPane name="memories" tab="记忆管理">
            <div class="tab-content">
              <div class="section-header">
                <div class="section-title">
                  <span class="label-mono">Memories</span>
                  <h3>长期记忆</h3>
                </div>
                <div class="section-actions">
                  <NSelect
                    v-model:value="memoryTypeFilter"
                    :options="[
                      { label: '全部类型', value: undefined },
                      { label: '事实', value: 'fact' },
                      { label: '偏好', value: 'preference' },
                      { label: '事件', value: 'event' },
                    ]"
                    style="width: 140px"
                    @update:value="memoryStore.fetchMemories($event)"
                  />
                </div>
              </div>

              <NSpin :show="memoryStore.isLoading">
                <div class="memory-list">
                  <div
                    v-for="(memory, index) in memoryStore.memories"
                    :key="memory.id"
                    class="memory-card"
                    :style="{ animationDelay: `${index * 0.05}s` }"
                  >
                    <div class="memory-icon">
                      <NIcon :component="SparklesOutline" :size="20" />
                    </div>
                    <div class="memory-info">
                      <div class="memory-content">{{ memory.content }}</div>
                      <div class="memory-meta">
                        <span class="memory-type">{{ memory.type }}</span>
                        <span class="memory-importance">
                          重要性: {{ memory.importance }}/10
                        </span>
                      </div>
                    </div>
                    <button
                      class="delete-btn"
                      @click="memoryStore.deleteMemory(memory.id)"
                    >
                      <NIcon :component="TrashOutline" :size="16" />
                    </button>
                  </div>

                  <div
                    v-if="memoryStore.memories.length === 0"
                    class="empty-memories"
                  >
                    <div class="empty-icon">
                      <NIcon :component="SparklesOutline" :size="40" />
                    </div>
                    <p class="empty-text">暂无记忆</p>
                    <p class="empty-hint">AI 会自动从对话中提取重要信息</p>
                  </div>
                </div>
              </NSpin>
            </div>
          </NTabPane>
        </NTabs>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 16px;
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 24px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.back-btn:hover {
  border-color: var(--neon-cyan);
  color: var(--neon-cyan);
}

.header-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-title h2 {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-spacer {
  width: 100px;
}

.settings-content {
  flex: 1;
  overflow: hidden;
}

.tabs-wrapper {
  height: 100%;
  padding: 24px;
  overflow: hidden;
}

.tabs-wrapper :deep(.n-tabs) {
  height: 100%;
}

.tabs-wrapper :deep(.n-tabs-pane-wrapper) {
  height: calc(100% - 50px);
  overflow-y: auto;
}

.tab-content {
  padding: 20px 0;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.section-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-title h3 {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

/* Memory Cards */
.memory-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.memory-card {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: all var(--transition-smooth);
  opacity: 0;
  animation: fadeInUp 0.4s ease-out forwards;
}

.memory-card:hover {
  border-color: var(--border-glow);
}

.memory-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(0, 245, 212, 0.15) 0%,
    rgba(0, 245, 212, 0.05) 100%
  );
  border: 1px solid rgba(0, 245, 212, 0.2);
  border-radius: var(--radius-sm);
  color: var(--neon-cyan);
  flex-shrink: 0;
}

.memory-info {
  flex: 1;
  min-width: 0;
}

.memory-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.memory-meta {
  display: flex;
  align-items: center;
  gap: 16px;
}

.memory-type {
  padding: 3px 10px;
  background: rgba(155, 93, 229, 0.15);
  border: 1px solid rgba(155, 93, 229, 0.3);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--neon-purple);
  letter-spacing: 0.5px;
}

.memory-importance {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.delete-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all var(--transition-fast);
}

.memory-card:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  border-color: var(--neon-pink);
  color: var(--neon-pink);
  background: rgba(247, 37, 133, 0.1);
}

.empty-memories {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  margin-bottom: 20px;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
}
</style>
