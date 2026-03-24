<script setup lang="ts">
import { computed } from "vue";
import type { Message } from "@/types";
import { formatRelativeTime } from "@/utils/id";
import { renderMarkdownSafe } from "@/utils/markdown";
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

// 渲染 Markdown 内容
const renderedContent = computed(() => {
  if (isUser.value) {
    // 用户消息不渲染 Markdown
    return displayContent.value;
  }
  return renderMarkdownSafe(displayContent.value || "");
});
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
        <div
          v-else
          class="message-text"
          :class="{ 'markdown-body': !isUser }"
          v-html="renderedContent"
        ></div>
        <span v-if="isStreaming && displayContent" class="typing-cursor"></span>
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
  animation: fadeInUp 0.3s ease-out forwards;
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
  transition: all var(--transition-fast);
}

.message-avatar.user {
  background: var(--color-primary);
  color: var(--text-inverse);
}

.message-avatar:not(.user) {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--color-secondary);
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
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  position: relative;
}

.message-body.user {
  background: linear-gradient(
    135deg,
    var(--color-primary) 0%,
    var(--color-primary-hover) 100%
  );
  border-color: transparent;
  color: var(--text-inverse);
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
  background: var(--color-primary);
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
}

.message-body.user .message-text {
  color: var(--text-inverse);
}

/* Markdown Body */
.message-text.markdown-body {
  white-space: normal;
}

.message-text.markdown-body :deep(p) {
  margin: 0 0 12px;
}

.message-text.markdown-body :deep(p:last-child) {
  margin-bottom: 0;
}

.message-text.markdown-body :deep(code) {
  background: var(--color-primary-light);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 0.9em;
  color: var(--color-primary);
}

/* Code Block */
.message-text.markdown-body :deep(.code-block) {
  margin: 12px 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
}

.message-text.markdown-body :deep(.code-header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.message-text.markdown-body :deep(.code-lang) {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-primary);
  text-transform: uppercase;
}

.message-text.markdown-body :deep(.copy-btn) {
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.message-text.markdown-body :deep(.copy-btn:hover) {
  background: var(--color-primary);
  color: var(--text-inverse);
  border-color: var(--color-primary);
}

.message-text.markdown-body :deep(pre) {
  margin: 0;
  padding: 16px;
  overflow-x: auto;
}

.message-text.markdown-body :deep(pre code) {
  background: transparent;
  padding: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary);
}

/* Lists */
.message-text.markdown-body :deep(ul),
.message-text.markdown-body :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.message-text.markdown-body :deep(li) {
  margin: 4px 0;
}

/* Headings */
.message-text.markdown-body :deep(h1),
.message-text.markdown-body :deep(h2),
.message-text.markdown-body :deep(h3) {
  margin: 16px 0 8px;
  color: var(--text-primary);
}

.message-text.markdown-body :deep(h1) {
  font-size: 1.4em;
}

.message-text.markdown-body :deep(h2) {
  font-size: 1.2em;
}

.message-text.markdown-body :deep(h3) {
  font-size: 1.1em;
}

/* Blockquote */
.message-text.markdown-body :deep(blockquote) {
  margin: 12px 0;
  padding: 8px 16px;
  border-left: 3px solid var(--color-primary);
  background: var(--color-primary-light);
  color: var(--text-secondary);
}

/* Links */
.message-text.markdown-body :deep(a) {
  color: var(--color-primary);
  text-decoration: none;
}

.message-text.markdown-body :deep(a:hover) {
  text-decoration: underline;
}

/* Typing Cursor */
.typing-cursor {
  display: inline-block;
  width: 2px;
  height: 18px;
  background: var(--color-primary);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: blink-cursor 1s step-end infinite;
}

.message-body.user .typing-cursor {
  background: var(--text-inverse);
}
</style>
