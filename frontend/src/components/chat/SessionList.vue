<script setup lang="ts">
import { onMounted } from "vue";
import { useChatStore } from "@/stores/chat";
import { formatRelativeTime } from "@/utils/id";
import {
  AddOutline,
  ChatbubbleEllipsesOutline,
  TrashOutline,
} from "@vicons/ionicons5";

const chatStore = useChatStore();

onMounted(() => {
  chatStore.fetchSessions();
});

async function handleSelectSession(sessionId: string) {
  await chatStore.selectSession(sessionId);
}

async function handleNewChat() {
  chatStore.clearCurrentSession();
}

async function handleDeleteSession(sessionId: string) {
  await chatStore.removeSession(sessionId);
}
</script>

<template>
  <div class="session-list">
    <!-- 头部 -->
    <div class="session-header">
      <div class="header-title">
        <span class="label-mono">会话</span>
        <h2 class="header-text">Conversations</h2>
      </div>
    </div>

    <!-- 新建按钮 -->
    <div class="new-chat-wrapper">
      <button class="new-chat-btn" @click="handleNewChat">
        <NIcon :component="AddOutline" :size="18" />
        <span>新对话</span>
      </button>
    </div>

    <!-- 会话列表 -->
    <NScrollbar class="session-content">
      <div v-if="chatStore.isLoading" class="loading-state">
        <div class="loader" />
      </div>
      <div v-else-if="chatStore.sessions.length === 0" class="empty-state">
        <div class="empty-icon">
          <NIcon :component="ChatbubbleEllipsesOutline" :size="32" />
        </div>
        <p class="empty-text">暂无会话记录</p>
        <p class="empty-hint">开始一段新对话吧</p>
      </div>
      <div v-else class="sessions">
        <div
          v-for="(session, index) in chatStore.sessions"
          :key="session.id"
          class="session-item"
          :class="{ active: chatStore.currentSessionId === session.id }"
          :style="{ animationDelay: `${index * 0.05}s` }"
          @click="handleSelectSession(session.id)"
        >
          <div class="session-icon">
            <NIcon :component="ChatbubbleEllipsesOutline" :size="18" />
          </div>
          <div class="session-info">
            <div class="session-title">{{ session.title }}</div>
            <div class="session-meta">
              <span class="meta-count">{{ session.message_count }} 条消息</span>
              <span class="meta-dot">·</span>
              <span class="meta-time">{{
                formatRelativeTime(session.updated_at)
              }}</span>
            </div>
          </div>
          <button
            class="delete-btn"
            @click.stop="handleDeleteSession(session.id)"
          >
            <NIcon :component="TrashOutline" :size="16" />
          </button>
        </div>
      </div>
    </NScrollbar>
  </div>
</template>

<style scoped>
.session-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px 16px;
}

.session-header {
  margin-bottom: 20px;
}

.header-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-text {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  letter-spacing: -0.5px;
}

.new-chat-wrapper {
  margin-bottom: 20px;
}

.new-chat-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 14px;
  background: var(--color-primary-light);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  color: var(--color-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.new-chat-btn:hover {
  background: var(--color-primary);
  color: var(--text-inverse);
}

.session-content {
  flex: 1;
}

.loading-state {
  display: flex;
  justify-content: center;
  padding: 40px;
}

.loader {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.empty-text {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.empty-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.sessions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  animation: fadeInUp 0.3s ease-out forwards;
  opacity: 0;
  border: 1px solid transparent;
}

.session-item:hover {
  background: var(--bg-tertiary);
}

.session-item.active {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
}

.session-item.active .session-icon {
  background: var(--color-primary);
  color: var(--text-inverse);
}

.session-icon {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  flex-shrink: 0;
  transition: all var(--transition-fast);
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.session-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.meta-dot {
  opacity: 0.5;
}

.delete-btn {
  opacity: 0;
  padding: 8px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.session-item:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}
</style>
