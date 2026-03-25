<script setup lang="ts">
import { ref, computed } from "vue";
import { useChatStream } from "@/composables/useChatStream";
import { useFileUpload } from "@/composables/useFileUpload";
import {
  SendOutline,
  StopOutline,
  AttachOutline,
  GlobeOutline,
  BulbOutline,
  CloseOutline,
} from "@vicons/ionicons5";

const emit = defineEmits<{
  send: [message: string];
}>();

const { isStreaming, sendStreamMessage, cancelStream } = useChatStream();
const { isUploading, attachments, uploadMultiple, remove, clear } = useFileUpload({ maxFiles: 5 });

const inputValue = ref("");
const isFocused = ref(false);

// 功能开关状态
const webSearchEnabled = ref(false);
const thinkingEnabled = ref(false);

const canSend = computed(
  () => (inputValue.value.trim() || attachments.value.length > 0) && !isStreaming.value && !isUploading.value,
);

// 文件输入引用
const fileInput = ref<HTMLInputElement | null>(null);

function triggerFileUpload() {
  fileInput.value?.click();
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (!files) return;

  await uploadMultiple(files);
  target.value = "";
}

function removeAttachment(id: string) {
  remove(id);
}

async function handleSend() {
  if (!canSend.value) return;

  const message = inputValue.value.trim();
  inputValue.value = "";

  try {
    await sendStreamMessage(message, {
      attachments: attachments.value,
      webSearch: webSearchEnabled.value,
      thinking: thinkingEnabled.value,
    });
    emit("send", message);
    clear();
    webSearchEnabled.value = false;
    thinkingEnabled.value = false;
  } catch (error) {
    console.error("发送消息失败:", error);
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

function handleCancel() {
  cancelStream();
}
</script>

<template>
  <div
    class="p-5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-lg transition-all duration-300"
    :class="isFocused ? 'border-[var(--color-primary)] shadow-[var(--shadow-primary)]' : ''"
  >
    <!-- 附件预览区域 -->
    <div
      v-if="attachments.length > 0"
      class="flex flex-wrap gap-2 mb-3 pb-3 border-b border-[var(--border-color)]"
    >
      <div
        v-for="attachment in attachments"
        :key="attachment.id"
        class="relative group animate-in fade-in zoom-in duration-200"
      >
        <!-- 图片预览 -->
        <div
          v-if="attachment.type === 'image'"
          class="w-14 h-14 rounded-xl overflow-hidden border-2 border-[var(--border-color)] shadow-sm"
        >
          <img
            :src="attachment.url"
            :alt="attachment.filename"
            class="w-full h-full object-cover"
          />
        </div>
        <!-- 文档预览 -->
        <div
          v-else
          class="w-14 h-14 rounded-xl border-2 border-[var(--border-color)] flex items-center justify-center bg-[var(--bg-tertiary)]"
        >
          <span class="font-mono text-[9px] font-bold text-[var(--text-muted)]">
            {{ attachment.filename.split('.').pop()?.toUpperCase() }}
          </span>
        </div>
        <!-- 删除按钮 -->
        <button
          class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--color-error)] text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-150 hover:scale-110 shadow-sm"
          @click="removeAttachment(attachment.id)"
        >
          <NIcon :component="CloseOutline" :size="12" />
        </button>
      </div>
    </div>

    <!-- 主输入行 -->
    <div class="flex items-center gap-3">
      <input
        ref="fileInput"
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.md"
        class="hidden"
        @change="handleFileSelect"
      />

      <!-- 输入框 -->
      <div class="flex-1 relative">
        <textarea
          v-model="inputValue"
          :disabled="isStreaming"
          placeholder="说点什么..."
          rows="2"
          class="w-full min-h-[64px] max-h-40 px-5 py-4 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-2xl text-[var(--text-primary)] text-[16px] leading-relaxed resize-none transition-all duration-200 placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--color-primary)] focus:bg-[var(--bg-secondary)] disabled:opacity-60 disabled:cursor-not-allowed"
          @focus="isFocused = true"
          @blur="isFocused = false"
          @keydown="handleKeyDown"
        />
      </div>

      <!-- 发送/停止按钮 -->
      <button
        v-if="isStreaming"
        class="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)] text-[var(--color-error)] transition-all duration-150 hover:bg-[rgba(239,68,68,0.25)] hover:scale-105 active:scale-95"
        @click="handleCancel"
      >
        <NIcon :component="StopOutline" :size="22" />
      </button>
      <button
        v-else
        class="flex-shrink-0 w-14 h-14 flex items-center justify-center rounded-2xl transition-all duration-200"
        :class="
          canSend
            ? 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] hover:scale-105 active:scale-95 shadow-md hover:shadow-lg'
            : 'bg-[var(--bg-tertiary)] border border-[var(--border-color)] text-[var(--text-muted)]'
        "
        :disabled="!canSend"
        @click="handleSend"
      >
        <NIcon :component="SendOutline" :size="22" />
      </button>
    </div>

    <!-- 底部功能栏 -->
    <div class="flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-color)]">
      <!-- 左侧功能按钮 -->
      <div class="flex items-center gap-2">
        <!-- 附件上传 -->
        <button
          class="h-10 px-4 flex items-center gap-2 rounded-xl text-[14px] font-semibold border transition-all duration-200"
          :class="
            attachments.length > 0
              ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'bg-transparent border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
          "
          :disabled="isStreaming"
          @click="triggerFileUpload"
        >
          <NIcon :component="AttachOutline" :size="20" />
          <span>{{ attachments.length > 0 ? `${attachments.length}/5` : '附件' }}</span>
        </button>

        <!-- 联网搜索 -->
        <button
          class="h-10 px-4 flex items-center gap-2 rounded-xl text-[14px] font-semibold border transition-all duration-200"
          :class="
            webSearchEnabled
              ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'bg-transparent border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
          "
          @click="webSearchEnabled = !webSearchEnabled"
        >
          <NIcon :component="GlobeOutline" :size="20" />
          <span>联网</span>
        </button>

        <!-- 思考过程 -->
        <button
          class="h-10 px-4 flex items-center gap-2 rounded-xl text-[14px] font-semibold border transition-all duration-200"
          :class="
            thinkingEnabled
              ? 'bg-[var(--color-primary-light)] border-[var(--color-primary)] text-[var(--color-primary)]'
              : 'bg-transparent border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]'
          "
          @click="thinkingEnabled = !thinkingEnabled"
        >
          <NIcon :component="BulbOutline" :size="20" />
          <span>思考</span>
        </button>
      </div>

      <!-- 右侧提示 -->
      <div class="flex items-center gap-2">
        <span
          v-if="inputValue.length > 0"
          class="font-mono text-[11px] text-[var(--text-muted)]"
        >
          {{ inputValue.length }}
        </span>
        <span class="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
          <kbd class="px-1.5 py-0.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded text-[10px] font-mono">
            Enter
          </kbd>
          <span>发送</span>
        </span>
      </div>
    </div>
  </div>
</template>
