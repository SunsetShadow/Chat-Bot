<script setup lang="ts">
import { ref, watch } from "vue";
import { useRouter } from "vue-router";
import SessionList from "./SessionList.vue";
import MessageList from "./MessageList.vue";
import MessageInput from "./MessageInput.vue";
import AgentSelector from "@/components/agent/AgentSelector.vue";
import AgentIndicator from "@/components/chat/AgentIndicator.vue";
import RuleEditor from "@/components/rules/RuleEditor.vue";
import ThemeToggle from "@/components/common/ThemeToggle.vue";
import NotificationBell from "@/components/common/NotificationBell.vue";
import { useChatStore } from "@/stores/chat";
import { useAgentStore } from "@/stores/agent";
import { useAIChat } from "@/composables/useAIChat";
import { SparklesOutline, SettingsOutline, ReorderTwoOutline } from "@vicons/ionicons5";

const router = useRouter();
const chatStore = useChatStore();
const agentStore = useAgentStore();
const { loadMessages, clearMessages, activeAgent } = useAIChat();

const mobileDrawerOpen = ref(false);

// 会话切换时同步历史消息到 AI SDK Chat 实例
watch(
  () => chatStore.currentSessionId,
  (newId) => {
    if (newId && chatStore.messages.length > 0) {
      // 切换到已有会话：加载历史消息
      loadMessages(chatStore.messages);
    } else if (!newId) {
      // 点击"新对话"：清空消息
      clearMessages();
    }
  },
);
</script>

<template>
  <div class="flex h-full p-2 md:p-4 gap-2 md:gap-4">
    <!-- 左侧会话列表（桌面端） -->
    <aside
      class="hidden md:flex w-[280px] shrink-0 p-0 overflow-hidden relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-sm hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-primary)] transition-all duration-300"
    >
      <SessionList />
    </aside>

    <!-- 移动端侧边栏抽屉 -->
    <NDrawer v-model:show="mobileDrawerOpen" placement="left" :width="300">
      <NDrawerContent>
        <SessionList @session-selected="mobileDrawerOpen = false" />
      </NDrawerContent>
    </NDrawer>

    <!-- 主聊天区域 -->
    <main class="flex-1 flex flex-col min-w-0 gap-2 md:gap-4 min-h-0">
      <!-- 顶部工具栏 -->
      <header
        class="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-sm hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-primary)] transition-all duration-300"
      >
        <div class="flex items-center gap-3 md:gap-4">
          <!-- 移动端汉堡菜单 -->
          <button
            class="flex md:hidden items-center justify-center w-9 h-9 bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            @click="mobileDrawerOpen = true"
          >
            <NIcon :component="ReorderTwoOutline" :size="20" />
          </button>
          <AgentSelector />
          <AgentIndicator
            :agent-id="activeAgent || agentStore.currentAgentId || ''"
          />
        </div>
        <div class="flex items-center gap-3 md:gap-4">
          <RuleEditor />
          <ThemeToggle />
          <button
            class="flex items-center justify-center w-9 h-9 bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            title="设置"
            @click="router.push('/settings')"
          >
            <NIcon :component="SettingsOutline" :size="18" />
          </button>
          <div class="w-px h-6 bg-[var(--border-color)]"></div>
          <NotificationBell />
        </div>
      </header>

      <!-- 消息列表 -->
      <div
        class="flex-1 overflow-hidden relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-sm hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-primary)] transition-all duration-300"
      >
        <MessageList />
      </div>

      <!-- 输入区域 -->
      <div class="relative shrink-0">
        <MessageInput />
      </div>
    </main>
  </div>
</template>
