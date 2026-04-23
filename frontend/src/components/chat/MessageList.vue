<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useAIChat } from "@/composables/useAIChat";
import MessageItem from "./MessageItem.vue";
import { ArrowDownOutline } from "@vicons/ionicons5";

const { messages, isLoading, regenerate, activeAgent } = useAIChat();

function isUserMsg(message: { role: string }) {
  return message.role === "user";
}

const listContainer = ref<HTMLElement | null>(null);
const isUserAtBottom = ref(true);

const showScrollButton = computed(
  () => !isUserAtBottom.value && messages.value.length > 0,
);

function checkIfAtBottom() {
  if (!listContainer.value) return;
  const { scrollTop, scrollHeight, clientHeight } = listContainer.value;
  isUserAtBottom.value = scrollHeight - scrollTop - clientHeight < 80;
}

function scrollToBottom() {
  if (listContainer.value) {
    listContainer.value.scrollTo({
      top: listContainer.value.scrollHeight,
      behavior: "smooth",
    });
    isUserAtBottom.value = true;
  }
}

// 消息数量变化时，仅在底部自动滚动
watch(
  () => messages.value.length,
  () => {
    nextTick(() => {
      if (isUserAtBottom.value) scrollToBottom();
    });
  },
);

// 流式内容变化时，仅在底部自动滚动
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
      if (isUserAtBottom.value) scrollToBottom();
    });
  },
);

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
  <div
    ref="listContainer"
    class="h-full overflow-y-auto p-6 relative"
    @scroll="checkIfAtBottom"
  >
    <!-- Empty State: no messages, nothing to render -->
    <div v-if="messages.length === 0" class="h-full"></div>

    <!-- Messages -->
    <div v-else class="flex flex-col">
      <template v-for="(message, index) in messages" :key="message.id">
        <MessageItem
          :message="message"
          :agent-name="
            !isUserMsg(message) ? activeAgent || 'AI 助手' : undefined
          "
          :is-streaming="
            isLoading &&
            index === messages.length - 1 &&
            message.role === 'assistant'
          "
          :is-last="index === messages.length - 1"
          :on-retry="index === messages.length - 1 ? regenerate : undefined"
          :style="{ animationDelay: `${index * 0.05}s` }"
        />
      </template>
    </div>

    <!-- 滚动到底部按钮 -->
    <Transition name="fade">
      <button
        v-if="showScrollButton"
        class="scroll-to-bottom-btn"
        @click="scrollToBottom"
      >
        <NIcon :component="ArrowDownOutline" :size="18" />
      </button>
    </Transition>
  </div>
</template>

<style scoped>
.scroll-to-bottom-btn {
  position: absolute;
  bottom: 24px;
  right: 24px;
  z-index: 10;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.scroll-to-bottom-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
