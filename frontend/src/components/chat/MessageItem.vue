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
  <div
    class="flex gap-4 py-5 animate-[fadeInUp_0.3s_ease-out_forwards]"
    :class="[
      message.role === 'user' ? 'flex-row-reverse' : '',
      isStreaming ? '!opacity-100 !animate-none' : '',
    ]"
  >
    <!-- Avatar -->
    <div
      class="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 transition-all duration-150"
      :class="
        isUser
          ? 'bg-[var(--color-primary)] text-white'
          : 'bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--color-secondary)]'
      "
    >
      <NIcon :component="isUser ? PersonOutline : SparklesOutline" :size="18" />
    </div>

    <!-- Content -->
    <div
      class="flex-1 flex flex-col gap-2 min-w-0"
      :class="isUser ? 'items-end' : ''"
      :style="{ maxWidth: '75%' }"
    >
      <!-- Header -->
      <div class="flex items-center gap-2.5">
        <span
          class="font-mono text-xs font-medium tracking-wide text-[var(--text-secondary)]"
        >
          {{ isUser ? "你" : "AI 助手" }}
        </span>
        <span class="font-mono text-[11px] text-[var(--text-muted)]">
          {{ formatRelativeTime(message.created_at) }}
        </span>
      </div>

      <!-- Body -->
      <div
        class="px-5 py-4 rounded-2xl border relative"
        :class="
          isUser
            ? 'bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] border-transparent text-white rounded-tr-sm'
            : 'bg-[var(--bg-secondary)] border-[var(--border-color)] rounded-tl-sm'
        "
      >
        <!-- Loading State -->
        <div
          v-if="isStreaming && !displayContent"
          class="flex items-center gap-3"
        >
          <div class="flex gap-1">
            <span
              class="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse"
            ></span>
            <span
              class="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse"
              style="animation-delay: 0.2s"
            ></span>
            <span
              class="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse"
              style="animation-delay: 0.4s"
            ></span>
          </div>
          <span class="text-[13px] text-[var(--text-muted)] italic"
            >思考中...</span
          >
        </div>

        <!-- Content -->
        <div
          v-else
          class="message-text text-[15px] leading-relaxed break-words"
          :class="{ 'markdown-body': !isUser }"
          v-html="renderedContent"
        ></div>
        <span
          v-if="isStreaming && displayContent"
          class="inline-block w-0.5 h-[18px] ml-0.5 align-text-bottom animate-[blink-cursor_1s_step-end_infinite]"
          :class="isUser ? 'bg-white' : 'bg-[var(--color-primary)]'"
        ></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Markdown Body - 保留深度样式，无法用 Tailwind 实现 */
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

.message-text.markdown-body :deep(ul),
.message-text.markdown-body :deep(ol) {
  margin: 8px 0;
  padding-left: 24px;
}

.message-text.markdown-body :deep(li) {
  margin: 4px 0;
}

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

.message-text.markdown-body :deep(blockquote) {
  margin: 12px 0;
  padding: 8px 16px;
  border-left: 3px solid var(--color-primary);
  background: var(--color-primary-light);
  color: var(--text-secondary);
}

.message-text.markdown-body :deep(a) {
  color: var(--color-primary);
  text-decoration: none;
}

.message-text.markdown-body :deep(a:hover) {
  text-decoration: underline;
}
</style>
