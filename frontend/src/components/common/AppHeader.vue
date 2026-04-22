<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAgentStore } from "@/stores/agent";
import { NIcon, NButton } from "naive-ui";
import {
  SettingsOutline,
  ChatbubblesOutline,
  SparklesOutline,
  PersonOutline,
} from "@vicons/ionicons5";
import ThemeToggle from "./ThemeToggle.vue";
import NotificationBell from "./NotificationBell.vue";

const router = useRouter();
const agentStore = useAgentStore();

function goToSettings() {
  router.push("/settings");
}

function goToAgentConfig() {
  router.push("/agentconfig");
}

function goToAvatar() {
  router.push("/avatar");
}
</script>

<template>
  <header
    class="flex items-center justify-between px-4 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]"
  >
    <div class="flex items-center">
      <div class="flex items-center gap-2">
        <NIcon
          :component="ChatbubblesOutline"
          size="24"
          class="text-[var(--color-primary)]"
        />
        <span class="text-base font-semibold text-[var(--text-primary)]"
          >Chat Bot</span
        >
      </div>
    </div>
    <div class="flex items-center">
      <span
        v-if="agentStore.currentAgent"
        class="text-sm text-[var(--text-secondary)] px-3 py-1 bg-[var(--bg-tertiary)] rounded-[var(--radius-sm)]"
      >
        {{ agentStore.currentAgent.name }}
      </span>
    </div>
    <div class="flex items-center gap-2">
      <NotificationBell />
      <ThemeToggle />
      <NButton
        text
        class="text-[var(--text-secondary)] hover:text-[var(--color-primary)]"
        @click="goToAvatar"
      >
        <template #icon>
          <NIcon :component="PersonOutline" size="20" />
        </template>
      </NButton>
      <NButton
        text
        class="text-[var(--text-secondary)] hover:text-[var(--color-primary)]"
        @click="goToAgentConfig"
      >
        <template #icon>
          <NIcon :component="SparklesOutline" size="20" />
        </template>
      </NButton>
      <NButton
        text
        class="text-[var(--text-secondary)] hover:text-[var(--color-primary)]"
        @click="goToSettings"
      >
        <template #icon>
          <NIcon :component="SettingsOutline" size="20" />
        </template>
      </NButton>
    </div>
  </header>
</template>
