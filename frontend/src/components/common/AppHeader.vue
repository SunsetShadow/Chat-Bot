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
        <NIcon :component="ChatbubblesOutline" size="24" color="#18a058" />
        <span class="logo-text">Chat Bot</span>
      </div>
    </div>
    <div class="header-center">
      <span v-if="agentStore.currentAgent" class="current-agent">
        {{ agentStore.currentAgent.name }}
      </span>
    </div>
    <div class="header-right">
      <NButton text @click="goToSettings">
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
  background: white;
  border-bottom: 1px solid #eee;
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

.logo-text {
  font-size: 16px;
  font-weight: 600;
}

.current-agent {
  font-size: 14px;
  color: #666;
}
</style>
