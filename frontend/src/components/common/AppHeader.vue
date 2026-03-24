<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAgentStore } from "@/stores/agent";
import { SettingsOutline, ChatbubblesOutline } from "@vicons/ionicons5";

const router = useRouter();
const agentStore = useAgentStore();

function goToSettings() {
  router.push("/settings");
}
</script>

<template>
  <header class="app-header">
    <div class="header-left">
      <div class="logo">
        <NIcon :component="ChatbubblesOutline" size="24" class="logo-icon" />
        <span class="logo-text">Chat Bot</span>
      </div>
    </div>
    <div class="header-center">
      <span v-if="agentStore.currentAgent" class="current-agent">
        {{ agentStore.currentAgent.name }}
      </span>
    </div>
    <div class="header-right">
      <NButton text class="settings-btn" @click="goToSettings">
        <template #icon>
          <NIcon :component="SettingsOutline" size="20" />
        </template>
      </NButton>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.header-left,
.header-center,
.header-right {
  display: flex;
  align-items: center;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo-icon {
  color: var(--color-primary);
}

.logo-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.current-agent {
  font-size: 14px;
  color: var(--text-secondary);
  padding: 4px 12px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
}

.settings-btn {
  color: var(--text-secondary);
}

.settings-btn:hover {
  color: var(--color-primary);
}
</style>
