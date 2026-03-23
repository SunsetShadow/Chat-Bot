<script setup lang="ts">
import { computed } from "vue";
import type { Message } from "@/types";
import { formatRelativeTime } from "@/utils/id";
import { PersonOutline, SparklesOutline } from "@vicons/ionicons5";

const props = defineProps<{
  message: Message;
  isStreaming?: boolean;
  streamingContent?: string;
}>();

const isUser = computed(() => props.message.role === "user");
const displayContent = computed(() =>
  props.isStreaming ? props.streamingContent : props.message.content,
);
</script>

<template>
  <div class="message-item" :class="[message.role, { streaming: isStreaming }]">
    <!-- Avatar -->
    <div class="message-avatar" :class="{ user: isUser }">
      <NIcon :component="isUser ? PersonOutline : SparklesOutline" :size="18" />
    </div>

    <!-- Content -->
    <div class="message-content">
      <!-- Header -->
      <div class="message-header">
        <span class="message-role">{{ isUser ? "你" : "AI 助手" }}</span>
        <span class="message-time">{{
          formatRelativeTime(message.created_at)
        }}</span>
      </div>

      <!-- Body -->
      <div class="message-body" :class="{ user: isUser }">
        <!-- Loading State -->
        <div v-if="isStreaming && !displayContent" class="message-loading">
          <div class="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span class="loading-text">思考中...</span>
        </div>

        <!-- Content -->
        <div v-else class="message-text">
          {{ displayContent }}
          <span v-if="isStreaming" class="typing-cursor"></span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-item {
  display: flex;
  gap: 16px;
  padding: 20px 0;
  opacity: 0;
  animation: fadeInUp 0.4s ease-out forwards;
}

.message-item.user {
  flex-direction: row-reverse;
}

.message-item.streaming {
  animation: none;
  opacity: 1;
}

/* Avatar */
.message-avatar {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  transition: all var(--transition-smooth);
}

.message-avatar.user {
  background: linear-gradient(
    135deg,
    var(--neon-cyan) 0%,
    var(--neon-cyan-dim) 100%
  );
  color: var(--bg-primary);
  box-shadow: 0 0 20px rgba(0, 245, 212, 0.3);
}

.message-avatar:not(.user) {
  background: linear-gradient(
    135deg,
    rgba(155, 93, 229, 0.3) 0%,
    rgba(155, 93, 229, 0.1) 100%
  );
  border: 1px solid rgba(155, 93, 229, 0.3);
  color: var(--neon-purple);
}

/* Content */
.message-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 75%;
  min-width: 0;
}

.message-item.user .message-content {
  align-items: flex-end;
}

/* Header */
.message-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.message-role {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.5px;
  color: var(--text-secondary);
}

.message-time {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

/* Body */
.message-body {
  padding: 16px 20px;
  border-radius: var(--radius-lg);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  position: relative;
  overflow: hidden;
}

.message-body::before {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(255, 255, 255, 0.02) 0%,
    transparent 50%
  );
  pointer-events: none;
}

.message-body.user {
  background: linear-gradient(
    135deg,
    rgba(0, 245, 212, 0.15) 0%,
    rgba(0, 245, 212, 0.05) 100%
  );
  border-color: rgba(0, 245, 212, 0.2);
}

.message-item:not(.user) .message-body {
  border-top-left-radius: 4px;
}

.message-item.user .message-body {
  border-top-right-radius: 4px;
}

/* Loading */
.message-loading {
  display: flex;
  align-items: center;
  gap: 12px;
}

.loading-dots {
  display: flex;
  gap: 4px;
}

.loading-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--neon-cyan);
  animation: dotPulse 1.4s ease-in-out infinite;
}

.loading-dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.loading-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dotPulse {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}

.loading-text {
  font-size: 13px;
  color: var(--text-muted);
  font-style: italic;
}

/* Text */
.message-text {
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-primary);
  word-wrap: break-word;
  white-space: pre-wrap;
}
</style>
