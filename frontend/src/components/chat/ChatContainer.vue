<script setup lang="ts">
import { watch } from "vue";
import SessionList from "./SessionList.vue";
import MessageList from "./MessageList.vue";
import MessageInput from "./MessageInput.vue";
import AgentSelector from "@/components/agent/AgentSelector.vue";
import RuleEditor from "@/components/rules/RuleEditor.vue";
import ThemeToggle from "@/components/common/ThemeToggle.vue";
import { useChatStore } from "@/stores/chat";
import { useAIChat } from "@/composables/useAIChat";

const chatStore = useChatStore();
const { loadMessages, clearMessages } = useAIChat();

// 会话切换时同步历史消息到 AI SDK Chat 实例
// 只在用户主动切换会话时同步，新建会话（oldId === null）时不干预 Chat 实例
watch(
  () => chatStore.currentSessionId,
  (newId, oldId) => {
    if (newId && oldId) {
      // 切换到已有会话：加载历史消息
      loadMessages(chatStore.messages);
    } else if (!newId) {
      // 点击"新对话"：清空消息
      clearMessages();
    }
    // newId !== null && oldId === null：新建会话，Chat 已有消息，不干预
  },
);
</script>

<template>
  <div class="flex h-full p-4 gap-4">
    <!-- 左侧会话列表 -->
    <aside
      class="w-[280px] shrink-0 p-0 overflow-hidden relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-sm hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-primary)] transition-all duration-300"
    >
      <SessionList />
    </aside>

    <!-- 主聊天区域 -->
    <main class="flex-1 flex flex-col min-w-0 gap-4">
      <!-- 顶部工具栏 -->
      <header
        class="flex items-center justify-between px-6 py-4 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-sm hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-primary)] transition-all duration-300"
      >
        <div class="flex items-center gap-4">
          <AgentSelector />
        </div>
        <div class="flex items-center gap-4">
          <RuleEditor />
          <ThemeToggle />
          <div class="flex items-center gap-2">
            <div
              class="w-2 h-2 bg-[var(--color-secondary)] rounded-full animate-pulse"
            ></div>
            <span
              class="font-mono text-[11px] tracking-wider uppercase text-[var(--text-muted)]"
              >在线</span
            >
          </div>
        </div>
      </header>

      <!-- 消息列表 -->
      <div
        class="flex-1 overflow-hidden relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-sm hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-primary)] transition-all duration-300"
      >
        <MessageList />
      </div>

      <!-- 输入区域 -->
      <div class="relative">
        <MessageInput />
      </div>
    </main>
  </div>
</template>
