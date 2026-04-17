<script setup lang="ts">
import { ref, computed } from "vue";
import { useAIChat } from "@/composables/useAIChat";
import { useFileUpload } from "@/composables/useFileUpload";
import { useChatStore } from "@/stores/chat";
import {
  SendOutline,
  StopOutline,
  AttachOutline,
  GlobeOutline,
  BulbOutline,
  CloseOutline,
} from "@vicons/ionicons5";
import ModelSelector from "./ModelSelector.vue";

const emit = defineEmits<{
  send: [message: string];
}>();

const { isLoading: isStreaming, sendMessage, stopStreaming } = useAIChat();
const { isUploading, attachments, uploadMultiple, remove, clear } =
  useFileUpload({ maxFiles: 5 });
const chatStore = useChatStore();

const inputValue = ref("");
const isFocused = ref(false);

// 功能开关状态
const webSearchEnabled = ref(true);
const thinkingEnabled = ref(false);

const canSend = computed(
  () =>
    (inputValue.value.trim() || attachments.value.length > 0) &&
    !isStreaming.value &&
    !isUploading.value,
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
    await sendMessage(message, {
      attachments: attachments.value,
      webSearch: webSearchEnabled.value,
      thinking: thinkingEnabled.value,
    });
    emit("send", message);
    clear();
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
  stopStreaming();
}
</script>

<template>
  <div class="message-input-container" :class="{ 'is-focused': isFocused }">
    <!-- 模型选择器区域 -->
    <div class="model-selector-bar">
      <ModelSelector :session-id="chatStore.currentSessionId || undefined" />
    </div>

    <!-- 附件预览区域 -->
    <div v-if="attachments.length > 0" class="attachments-preview">
      <div
        v-for="attachment in attachments"
        :key="attachment.id"
        class="attachment-item group animate-in fade-in zoom-in duration-200"
      >
        <!-- 图片预览 -->
        <div v-if="attachment.type === 'image'" class="attachment-image">
          <img
            :src="attachment.url"
            :alt="attachment.filename"
            class="w-full h-full object-cover"
          />
        </div>
        <!-- 文档预览 -->
        <div v-else class="attachment-document">
          <span class="font-mono text-[9px] font-bold text-[var(--text-muted)]">
            {{ attachment.filename.split(".").pop()?.toUpperCase() }}
          </span>
        </div>
        <!-- 删除按钮 -->
        <button
          class="attachment-remove"
          @click="removeAttachment(attachment.id)"
        >
          <NIcon :component="CloseOutline" :size="12" />
        </button>
      </div>
    </div>

    <!-- 主输入行 -->
    <div class="input-row">
      <input
        ref="fileInput"
        type="file"
        multiple
        accept="image/*,.pdf,.txt,.md"
        class="hidden"
        @change="handleFileSelect"
      />

      <!-- 输入框 -->
      <div class="input-wrapper flex-1 relative">
        <textarea
          v-model="inputValue"
          :disabled="isStreaming"
          placeholder="说点什么..."
          rows="2"
          class="main-textarea"
          @focus="isFocused = true"
          @blur="isFocused = false"
          @keydown="handleKeyDown"
        />
      </div>

      <!-- 发送/停止按钮 -->
      <button
        v-if="isStreaming"
        class="send-button is-cancel"
        @click="handleCancel"
      >
        <NIcon :component="StopOutline" :size="22" />
      </button>
      <button
        v-else
        class="send-button"
        :class="{ 'is-active': canSend }"
        :disabled="!canSend"
        @click="handleSend"
      >
        <NIcon :component="SendOutline" :size="22" />
      </button>
    </div>

    <!-- 底部功能栏 -->
    <div class="bottom-bar">
      <!-- 左侧功能按钮 -->
      <div class="action-buttons">
        <!-- 附件上传 -->
        <button
          class="action-button"
          :class="{ 'is-active': attachments.length > 0 }"
          :disabled="isStreaming"
          @click="triggerFileUpload"
        >
          <NIcon :component="AttachOutline" :size="20" />
          <span>{{
            attachments.length > 0 ? `${attachments.length}/5` : "附件"
          }}</span>
        </button>

        <!-- 联网搜索 -->
        <button
          class="action-button"
          :class="{ 'is-active': webSearchEnabled }"
          @click="webSearchEnabled = !webSearchEnabled"
        >
          <NIcon :component="GlobeOutline" :size="20" />
          <span>联网</span>
        </button>

        <!-- 思考过程 -->
        <button
          class="action-button"
          :class="{ 'is-active': thinkingEnabled }"
          @click="thinkingEnabled = !thinkingEnabled"
        >
          <NIcon :component="BulbOutline" :size="20" />
          <span>思考</span>
        </button>
      </div>

      <!-- 右侧提示 -->
      <div class="hints">
        <span
          v-if="inputValue.length > 0"
          class="font-mono text-[11px] text-[var(--text-muted)]"
        >
          {{ inputValue.length }}
        </span>
        <span class="hint-enter">
          <kbd class="kbd">Enter</kbd>
          <span>发送</span>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.message-input-container {
  padding: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  transition: all var(--transition-smooth);
}

.message-input-container.is-focused {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-primary);
}

/* Model Selector Bar */
.model-selector-bar {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
}

/* Attachments Preview */
.attachments-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.attachment-item {
  position: relative;
}

.attachment-image {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  overflow: hidden;
  border: 2px solid var(--border-color);
  box-shadow: var(--shadow-xs);
}

.attachment-document {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-sm);
  border: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
}

.attachment-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-error);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all var(--transition-fast);
  border: none;
  cursor: pointer;
}

.attachment-item:hover .attachment-remove {
  opacity: 1;
}

.attachment-remove:hover {
  transform: scale(1.1);
}

/* Input Row */
.input-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.main-textarea {
  width: 100%;
  min-height: 64px;
  max-height: 160px;
  padding: 16px 20px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 16px;
  line-height: 1.6;
  resize: none;
  transition: all var(--transition-fast);
}

.main-textarea::placeholder {
  color: var(--text-muted);
}

.main-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  background: var(--bg-secondary);
}

.main-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Send Button */
.send-button {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.send-button.is-active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
  box-shadow: var(--shadow-md);
}

.send-button.is-active:hover {
  background: var(--color-primary-hover);
  transform: scale(1.05);
}

.send-button.is-active:active {
  transform: scale(0.95);
}

.send-button.is-cancel {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.3);
  color: var(--color-error);
}

.send-button.is-cancel:hover {
  background: rgba(239, 68, 68, 0.25);
  transform: scale(1.05);
}

/* Bottom Bar */
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-button {
  height: 40px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 600;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-button:hover {
  background: var(--bg-tertiary);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.action-button.is-active {
  background: var(--color-primary-light);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.action-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* Hints */
.hints {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hint-enter {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
}

.kbd {
  padding: 2px 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 10px;
  font-family: var(--font-mono);
}
</style>
