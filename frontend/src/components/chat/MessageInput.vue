<script setup lang="ts">
import { ref, computed } from "vue";
import { useChatStream } from "@/composables/useChatStream";
import { SendOutline, StopOutline } from "@vicons/ionicons5";

const emit = defineEmits<{
  send: [message: string];
}>();

const { isStreaming, sendStreamMessage, cancelStream } = useChatStream();
const inputValue = ref("");

const canSend = computed(() => inputValue.value.trim() && !isStreaming.value);

async function handleSend() {
  if (!canSend.value) return;

  const message = inputValue.value.trim();
  inputValue.value = "";

  try {
    await sendStreamMessage(message);
    emit("send", message);
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
  <div class="message-input glass-card">
    <div class="input-container">
      <!-- Input Area -->
      <div class="input-wrapper">
        <textarea
          v-model="inputValue"
          :disabled="isStreaming"
          placeholder="输入消息... (Enter 发送)"
          rows="1"
          class="input-textarea"
          @keydown="handleKeyDown"
        />
      </div>

      <!-- Actions -->
      <div class="input-actions">
        <!-- Character Count -->
        <span class="char-count" v-if="inputValue.length > 0">
          {{ inputValue.length }}
        </span>

        <!-- Send / Stop Button -->
        <button
          v-if="isStreaming"
          class="action-btn stop"
          @click="handleCancel"
        >
          <NIcon :component="StopOutline" :size="18" />
          <span>停止</span>
        </button>
        <button
          v-else
          class="action-btn send"
          :class="{ active: canSend }"
          :disabled="!canSend"
          @click="handleSend"
        >
          <NIcon :component="SendOutline" :size="18" />
          <span>发送</span>
        </button>
      </div>
    </div>

    <!-- Hint -->
    <div class="input-hint">
      <span class="hint-item"> <kbd>Enter</kbd> 发送 </span>
      <span class="hint-item"> <kbd>Shift + Enter</kbd> 换行 </span>
    </div>
  </div>
</template>

<style scoped>
.message-input {
  padding: 16px 20px;
}

.input-container {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.input-wrapper {
  flex: 1;
  position: relative;
}

.input-textarea {
  width: 100%;
  height: 50px;
  padding: 14px 18px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: 15px;
  line-height: 1.5;
  resize: none;
  transition: all var(--transition-fast);
}

.input-textarea::placeholder {
  color: var(--text-muted);
}

.input-textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.input-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.input-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.char-count {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 50px;
  gap: 8px;
  padding: 0 20px;
  border: none;
  border-radius: var(--radius-md);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn.send {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-muted);
}

.action-btn.send.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: var(--text-inverse);
}

.action-btn.send.active:hover {
  background: var(--color-primary-hover);
}

.action-btn.stop {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: var(--color-error);
}

.action-btn.stop:hover {
  background: rgba(239, 68, 68, 0.2);
}

.input-hint {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  margin-top: 10px;
}

.hint-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.hint-item kbd {
  padding: 2px 6px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 10px;
}
</style>
