<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useAIChat } from "@/composables/useAIChat";
import MessageItem from "./MessageItem.vue";
import { ChatbubbleEllipsesOutline } from "@vicons/ionicons5";

const { messages, isLoading } = useAIChat();

const listContainer = ref<HTMLElement | null>(null);

// 消息变化时自动滚动到底部
watch(
  () => messages.value.length,
  () => {
    nextTick(() => {
      scrollToBottom();
    });
  },
);

// 流式内容变化时滚动（通过检查最后一条消息的 text part 长度）
watch(
  () => {
    const lastMsg = messages.value[messages.value.length - 1];
    if (!lastMsg) return 0;
    const textPart = lastMsg.parts?.find(
      (p: { type: string }) => p.type === "text",
    ) as { type: "text"; text: string } | undefined;
    return textPart?.text?.length ?? 0;
  },
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

// 代码复制事件委托
function handleCopyClick(event: MouseEvent) {
  const target = event.target as HTMLElement;
  const copyBtn = target.closest(".copy-btn") as HTMLButtonElement | null;
  if (copyBtn?.dataset.code) {
    const code = decodeURIComponent(copyBtn.dataset.code);
    navigator.clipboard.writeText(code).then(() => {
      const originalText = copyBtn.textContent;
      copyBtn.textContent = "已复制!";
      copyBtn.disabled = true;
      setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.disabled = false;
      }, 2000);
    });
  }
}

onMounted(() => {
  listContainer.value?.addEventListener("click", handleCopyClick);
});

onUnmounted(() => {
  listContainer.value?.removeEventListener("click", handleCopyClick);
});
</script>

<template>
  <div ref="listContainer" class="h-full overflow-y-auto p-6">
    <!-- Empty State -->
    <div
      v-if="messages.length === 0"
      class="flex flex-col items-center justify-center h-full text-center p-10"
    >
      <div class="relative mb-8">
        <div
          class="w-[100px] h-[100px] rounded-full bg-gradient-to-br from-[var(--bg-tertiary)] to-[var(--bg-secondary)] border border-[var(--border-color)] flex items-center justify-center text-[var(--text-muted)] relative z-10"
        >
          <NIcon :component="ChatbubbleEllipsesOutline" :size="48" />
        </div>
        <div
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140px] h-[140px] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.1)_0%,transparent_70%)] animate-pulse"
        ></div>
      </div>
      <h3
        class="text-2xl font-semibold text-[var(--text-primary)] mb-2 tracking-tight"
      >
        开始一段新对话
      </h3>
      <p class="text-[15px] text-[var(--text-secondary)] mb-10">
        选择一个 Agent，输入您的问题
      </p>

      <div class="flex gap-6">
        <div
          class="flex flex-col items-center gap-2 px-6 py-4 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-[var(--radius-md)] transition-all duration-300 hover:border-[var(--color-primary)] hover:-translate-y-0.5"
        >
          <span class="text-2xl">⚡</span>
          <span
            class="font-mono text-[11px] text-[var(--text-secondary)] tracking-wide"
            >支持流式响应</span
          >
        </div>
        <div
          class="flex flex-col items-center gap-2 px-6 py-4 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-[var(--radius-md)] transition-all duration-300 hover:border-[var(--color-primary)] hover:-translate-y-0.5"
        >
          <span class="text-2xl">🎭</span>
          <span
            class="font-mono text-[11px] text-[var(--text-secondary)] tracking-wide"
            >多种 Agent 角色</span
          >
        </div>
        <div
          class="flex flex-col items-center gap-2 px-6 py-4 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-[var(--radius-md)] transition-all duration-300 hover:border-[var(--color-primary)] hover:-translate-y-0.5"
        >
          <span class="text-2xl">🧠</span>
          <span
            class="font-mono text-[11px] text-[var(--text-secondary)] tracking-wide"
            >智能记忆系统</span
          >
        </div>
      </div>
    </div>

    <!-- Messages -->
    <div v-else class="flex flex-col">
      <template v-for="(message, index) in messages" :key="message.id">
        <MessageItem
          :message="message"
          :is-streaming="
            isLoading &&
            index === messages.length - 1 &&
            message.role === 'assistant'
          "
          :style="{ animationDelay: `${index * 0.05}s` }"
        />
      </template>
    </div>
  </div>
</template>
