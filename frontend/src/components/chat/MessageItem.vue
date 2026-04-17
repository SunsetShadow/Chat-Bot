<script setup lang="ts">
import { computed } from "vue";
import type {
  UIMessage,
  TextUIPart,
  ReasoningUIPart,
  FileUIPart,
  SourceUrlUIPart,
  SourceDocumentUIPart,
  StepStartUIPart,
} from "ai";
import { renderMarkdownSafe } from "@/utils/markdown";
import { PersonOutline, SparklesOutline, RefreshOutline } from "@vicons/ionicons5";
import ToolCallBlock from "./ToolCallBlock.vue";

const props = defineProps<{
  message: UIMessage;
  isStreaming?: boolean;
  isLast?: boolean;
  onRetry?: () => void;
}>();

const isUser = computed(() => props.message.role === "user");

const textContent = computed(() => {
  return (
    props.message.parts
      ?.filter((p): p is TextUIPart => p.type === "text")
      .map((p) => p.text)
      .join("") || ""
  );
});

const hasToolParts = computed(() =>
  props.message.parts?.some(
    (p) => p.type.startsWith("tool-") || p.type === "step-start",
  ),
);

const renderedParts = computed(() => {
  if (isUser.value) return {};
  const map: Record<number, string> = {};
  props.message.parts?.forEach((part, idx) => {
    if (part.type === "text") {
      const text = (part as TextUIPart).text;
      if (text) map[idx] = renderMarkdownSafe(text);
    }
  });
  return map;
});

const toolInfoMap = computed(() => {
  const map: Record<number, NonNullable<ReturnType<typeof getToolInfo>>> = {};
  props.message.parts?.forEach((part, idx) => {
    const info = getToolInfo(part);
    if (info) map[idx] = info;
  });
  return map;
});

function getToolInfo(part: { type: string }) {
  if (!part.type.startsWith("tool-")) return null;
  const typed = part as {
    type: string;
    toolCallId?: string;
    toolName?: string;
    state?: string;
    input?: Record<string, unknown>;
    output?: unknown;
    errorText?: string;
  };
  return {
    toolName: typed.toolName || typed.type.replace("tool-", ""),
    state: (typed.state || "input-available") as
      | "input-streaming"
      | "input-available"
      | "output-available"
      | "output-error",
    input: typed.input,
    output: typed.output,
    errorText: typed.errorText,
  };
}

function isFilePart(part: { type: string }): part is FileUIPart {
  return part.type === "file";
}

function isSourceUrlPart(part: { type: string }): part is SourceUrlUIPart {
  return part.type === "source-url";
}

function isSourceDocumentPart(part: {
  type: string;
}): part is SourceDocumentUIPart {
  return part.type === "source-document";
}

function isStepStartPart(part: { type: string }): part is StepStartUIPart {
  return part.type === "step-start";
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
</script>

<template>
  <div
    class="flex gap-4 py-5 animate-[fadeInUp_0.3s_ease-out_forwards]"
    :class="[
      message.role === 'user' ? 'flex-row-reverse' : '',
      isStreaming ? '!opacity-100 !animate-none' : '',
    ]"
  >
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

    <div
      class="flex-1 flex flex-col gap-2 min-w-0"
      :class="isUser ? 'items-end' : ''"
      :style="{ maxWidth: '75%' }"
    >
      <div class="flex items-center gap-2.5">
        <span
          class="font-mono text-xs font-medium tracking-wide text-[var(--text-secondary)]"
        >
          {{ isUser ? "你" : "AI 助手" }}
        </span>
      </div>

      <div
        class="px-5 py-4 rounded-2xl border relative"
        :class="
          isUser
            ? 'bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-hover)] border-transparent text-white rounded-tr-sm'
            : 'bg-[var(--bg-secondary)] border-[var(--border-color)] rounded-tl-sm'
        "
      >
        <template v-if="!isUser">
          <template v-for="(part, idx) in message.parts" :key="idx">
            <div
              v-if="isStepStartPart(part) && idx > 0"
              class="my-3 border-t border-dashed border-[var(--border-color)]"
            ></div>

            <div
              v-else-if="part.type === 'reasoning'"
              class="mb-3 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]"
            >
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[11px] font-mono text-[var(--color-primary)]"
                  >思考过程</span
                >
              </div>
              <p
                class="text-[13px] text-[var(--text-secondary)] whitespace-pre-wrap"
              >
                {{ (part as ReasoningUIPart).text }}
              </p>
            </div>

            <template v-else-if="toolInfoMap[idx]">
              <ToolCallBlock
                :toolName="toolInfoMap[idx].toolName"
                :state="toolInfoMap[idx].state"
                :input="toolInfoMap[idx].input"
                :output="toolInfoMap[idx].output"
                :errorText="toolInfoMap[idx].errorText"
                class="my-2"
              />
            </template>

            <div v-else-if="isFilePart(part)" class="my-2">
              <div
                v-if="part.mediaType?.startsWith('image/')"
                class="inline-block rounded-lg overflow-hidden border border-[var(--border-color)]"
              >
                <img
                  :src="part.url"
                  :alt="part.filename || '图片'"
                  class="max-w-full max-h-60 object-contain"
                />
              </div>
              <div
                v-else
                class="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-color)]"
              >
                <span class="font-mono text-xs text-[var(--color-primary)]">
                  {{ part.filename || part.mediaType }}
                </span>
              </div>
            </div>

            <div v-else-if="isSourceUrlPart(part)" class="my-1">
              <a
                :href="part.url"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--color-primary)] hover:underline"
              >
                [{{ part.title || getHostname(part.url) }}]
              </a>
            </div>

            <div v-else-if="isSourceDocumentPart(part)" class="my-1">
              <span
                class="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--text-muted)]"
              >
                [{{ part.title || "文档" }}]
              </span>
            </div>

            <template v-else-if="part.type === 'text'">
              <div
                v-if="isStreaming && !textContent && !hasToolParts"
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

              <div
                v-else-if="!isStreaming && !textContent && !hasToolParts && isLast"
                class="flex items-center gap-3"
              >
                <span class="text-[13px] text-[var(--color-error)]">暂无回复</span>
                <button
                  v-if="onRetry"
                  class="flex items-center gap-1 text-[12px] text-[var(--color-primary)] hover:underline cursor-pointer"
                  @click="onRetry"
                >
                  <NIcon :component="RefreshOutline" :size="12" />
                  重试
                </button>
              </div>

              <div
                v-else-if="renderedParts[idx]"
                class="message-text text-[15px] leading-relaxed break-words markdown-body"
                v-html="renderedParts[idx]"
              ></div>
            </template>
          </template>

          <span
            v-if="isStreaming && textContent"
            class="inline-block w-0.5 h-[18px] ml-0.5 align-text-bottom animate-[blink-cursor_1s_step-end_infinite] bg-[var(--color-primary)]"
          ></span>
        </template>

        <template v-else>
          <div class="message-text text-[15px] leading-relaxed break-words">
            {{ textContent }}
          </div>
          <div class="text-[10px] text-white/40 mt-1.5 text-right font-mono">
            已发送
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
