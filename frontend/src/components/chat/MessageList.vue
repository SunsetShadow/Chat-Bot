<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import { useChatStore } from "@/stores/chat";
import MessageItem from "./MessageItem.vue";
import { ChatbubbleEllipsesOutline } from "@vicons/ionicons5";

const chatStore = useChatStore();
const listContainer = ref<HTMLElement | null>(null);

// 消息变化时自动滚动到底部
watch(
  () => chatStore.messages.length,
  () => {
    nextTick(() => {
      scrollToBottom();
    });
  },
);

watch(
  () => chatStore.currentStreamingContent,
  () => {
    nextTick(() => {
      scrollToBottom();
    });
  },
);

function scrollToBottom() {
  if (listContainer.value) {
    listContainer.value.scrollTo({
      top: listContainer.value.scrollHeight,
      behavior: "smooth",
    });
  }
}
</script>

<template>
  <div ref="listContainer" class="message-list">
    <!-- Empty State -->
    <div v-if="chatStore.messages.length === 0" class="empty-state">
      <div class="empty-visual">
        <div class="empty-icon-wrapper">
          <NIcon :component="ChatbubbleEllipsesOutline" :size="48" />
        </div>
        <div class="empty-glow" />
      </div>
      <h3 class="empty-title">开始一段新对话</h3>
      <p class="empty-subtitle">选择一个 Agent，输入您的问题</p>

      <div class="quick-tips">
        <div class="tip-item">
          <span class="tip-icon">⚡</span>
          <span class="tip-text">支持流式响应</span>
        </div>
        <div class="tip-item">
          <span class="tip-icon">🎭</span>
          <span class="tip-text">多种 Agent 角色</span>
        </div>
        <div class="tip-item">
          <span class="tip-icon">🧠</span>
          <span class="tip-text">智能记忆系统</span>
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div v-else class="messages-container">
      <template
        v-for="(message, index) in chatStore.messages"
        :key="message.id"
      >
        <MessageItem
          :message="message"
          :is-streaming="false"
          :style="{ animationDelay: `${index * 0.05}s` }"
        />
        <!-- Streaming Assistant Message -->
        <MessageItem
          v-if="
            chatStore.isStreaming &&
            index === chatStore.messages.length - 1 &&
            message.role === 'user'
          "
          :message="{
            id: 'streaming',
            role: 'assistant',
            content: '',
            created_at: new Date().toISOString(),
          }"
          :is-streaming="true"
          :streaming-content="chatStore.currentStreamingContent"
        />
      </template>
    </div>
  </div>
</template>

<style scoped>
.message-list {
  height: 100%;
  overflow-y: auto;
  padding: 24px;
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 40px;
}

.empty-visual {
  position: relative;
  margin-bottom: 32px;
}

.empty-icon-wrapper {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: linear-gradient(
    135deg,
    var(--bg-tertiary) 0%,
    var(--bg-secondary) 100%
  );
  border: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  position: relative;
  z-index: 1;
}

.empty-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgba(0, 245, 212, 0.1) 0%,
    transparent 70%
  );
  animation: pulse-glow 3s ease-in-out infinite;
}

.empty-title {
  font-family: var(--font-display);
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  letter-spacing: -0.5px;
}

.empty-subtitle {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 40px;
}

.quick-tips {
  display: flex;
  gap: 24px;
}

.tip-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 16px 24px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: all var(--transition-smooth);
}

.tip-item:hover {
  border-color: var(--border-glow);
  transform: translateY(-2px);
}

.tip-icon {
  font-size: 24px;
}

.tip-text {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
}

/* Messages Container */
.messages-container {
  display: flex;
  flex-direction: column;
}
</style>
