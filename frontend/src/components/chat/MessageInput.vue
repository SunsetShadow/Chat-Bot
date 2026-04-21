<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useAIChat } from "@/composables/useAIChat";
import { useFileUpload } from "@/composables/useFileUpload";
import { useVoice } from "@/composables/useVoice";
import { useChatStore } from "@/stores/chat";
import { useMessage } from "naive-ui";
import {
  SendOutline,
  StopOutline,
  AttachOutline,
  GlobeOutline,
  BulbOutline,
  CloseOutline,
  MicOutline,
  MicOffOutline,
  VolumeHighOutline,
  VolumeMuteOutline,
  TrashOutline,
} from "@vicons/ionicons5";
import ModelSelector from "./ModelSelector.vue";

const emit = defineEmits<{
  send: [message: string];
}>();

const { isLoading: isStreaming, sendMessage, stopStreaming } = useAIChat();
const { isUploading, attachments, uploadMultiple, remove, clear } =
  useFileUpload({ maxFiles: 5 });
const chatStore = useChatStore();
const {
  isRecording,
  isRecognizing,
  asrError,
  recordingDuration,
  audioLevel,
  startRecording,
  stopRecording,
  cancelRecording,
  ttsStatus,
  ttsSessionId,
  connectTts,
  disconnectTts,
  setOnRecognized,
  dispose: disposeVoice,
} = useVoice();

const nMessage = useMessage();
const inputValue = ref("");
const isFocused = ref(false);

watch(asrError, (err) => {
  if (err) {
    nMessage.warning(err);
    asrError.value = null;
  }
});

function usePersistedRef<T>(key: string, defaultValue: T) {
  const stored = localStorage.getItem(key);
  const refVal = ref<T>(stored !== null ? JSON.parse(stored) : defaultValue);
  watch(refVal, (val) => {
    localStorage.setItem(key, JSON.stringify(val));
  });
  return refVal;
}

const webSearchEnabled = usePersistedRef("chat:webSearch", true);
const thinkingEnabled = usePersistedRef("chat:thinking", false);
const voiceEnabled = usePersistedRef("chat:voice", false);

const canSend = computed(
  () =>
    (inputValue.value.trim() || attachments.value.length > 0) &&
    !isStreaming.value &&
    !isUploading.value,
);

const fileInput = ref<HTMLInputElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const isTtsSpeaking = computed(() => ttsStatus.value === "speaking");

function autoResizeTextarea() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

watch(inputValue, () => nextTick(autoResizeTextarea));

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

setOnRecognized((text) => {
  if (text) {
    inputValue.value = text;
  }
});

async function toggleTts() {
  if (voiceEnabled.value) {
    disconnectTts();
    voiceEnabled.value = false;
  } else {
    const sid = await connectTts();
    voiceEnabled.value = !!sid;
  }
}

function toggleRecording() {
  if (isRecording.value) {
    stopRecording();
  } else {
    startRecording();
  }
}

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

  const text = inputValue.value.trim();
  inputValue.value = "";

  try {
    await sendMessage(text, {
      attachments: attachments.value,
      webSearch: webSearchEnabled.value,
      thinking: thinkingEnabled.value,
      ttsSessionId: voiceEnabled.value ? ttsSessionId.value : undefined,
    });
    emit("send", text);
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

// --- 快捷键录音：Alt+Space 长按录音，松手停止，ESC 取消 ---

let shortcutRecordingStart = 0;
const MIN_RECORDING_MS = 200;

function handleGlobalKeyDown(e: KeyboardEvent) {
  // ESC 取消录音
  if (e.key === "Escape" && isRecording.value) {
    e.preventDefault();
    cancelRecording();
    return;
  }

  // Alt+Space 开始录音
  if (e.key !== " " || !e.altKey) return;
  if (isRecording.value || isRecognizing.value || isStreaming.value) return;

  e.preventDefault();
  shortcutRecordingStart = Date.now();
  startRecording();
}

function handleGlobalKeyUp(e: KeyboardEvent) {
  if (e.key !== " ") return;
  if (!isRecording.value) return;

  if (Date.now() - shortcutRecordingStart < MIN_RECORDING_MS) {
    cancelRecording();
    nMessage.info("按住时间过短，已取消");
  } else {
    stopRecording();
  }
}

function handleWindowBlur() {
  if (isRecording.value) {
    cancelRecording();
  }
}

onMounted(() => {
  document.addEventListener("keydown", handleGlobalKeyDown);
  document.addEventListener("keyup", handleGlobalKeyUp);
  window.addEventListener("blur", handleWindowBlur);
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleGlobalKeyDown);
  document.removeEventListener("keyup", handleGlobalKeyUp);
  window.removeEventListener("blur", handleWindowBlur);
  disposeVoice();
});
</script>

<template>
  <div class="message-input-container" :class="{ 'is-focused': isFocused, 'is-recording': isRecording }">
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
        <div v-if="attachment.type === 'image'" class="attachment-image">
          <img
            :src="attachment.url"
            :alt="attachment.filename"
            class="w-full h-full object-cover"
          />
        </div>
        <div v-else class="attachment-document">
          <span class="font-mono text-[9px] font-bold text-[var(--text-muted)]">
            {{ attachment.filename.split(".").pop()?.toUpperCase() }}
          </span>
        </div>
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

      <!-- 录音状态面板 -->
      <div v-if="isRecording" class="recording-panel">
        <div class="recording-left">
          <div class="recording-indicator">
            <span class="recording-dot"></span>
          </div>
          <div class="waveform-bars">
            <span
              v-for="i in 20"
              :key="i"
              class="wave-bar"
              :style="{ height: `${Math.max(4, audioLevel * 100 * (0.3 + Math.random() * 0.7))}%` }"
            ></span>
          </div>
          <span class="recording-timer">{{ formatDuration(recordingDuration) }}</span>
        </div>
        <div class="recording-actions">
          <button class="recording-btn is-cancel" @click="cancelRecording">
            <NIcon :component="TrashOutline" :size="18" />
          </button>
          <button class="recording-btn is-stop" @click="toggleRecording">
            <NIcon :component="StopOutline" :size="20" />
          </button>
        </div>
      </div>

      <!-- 识别中状态 -->
      <div v-else-if="isRecognizing" class="recognizing-panel">
        <div class="recognizing-spinner"></div>
        <span class="recognizing-text">语音识别中...</span>
      </div>

      <!-- 正常输入框 -->
      <div v-else class="input-wrapper flex-1 relative">
        <textarea
          ref="textareaRef"
          v-model="inputValue"
          :disabled="isStreaming"
          placeholder="说点什么..."
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
        v-else-if="!isRecording && !isRecognizing"
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
      <div class="action-buttons">
        <button
          class="action-button"
          :class="{ 'is-active': attachments.length > 0 }"
          :disabled="isStreaming || isRecording"
          @click="triggerFileUpload"
        >
          <NIcon :component="AttachOutline" :size="20" />
          <span>{{
            attachments.length > 0 ? `${attachments.length}/5` : "附件"
          }}</span>
        </button>

        <button
          class="action-button"
          :class="{ 'is-active': webSearchEnabled }"
          :disabled="isRecording"
          @click="webSearchEnabled = !webSearchEnabled"
        >
          <NIcon :component="GlobeOutline" :size="20" />
          <span>联网</span>
        </button>

        <button
          class="action-button"
          :class="{ 'is-active': thinkingEnabled }"
          :disabled="isRecording"
          @click="thinkingEnabled = !thinkingEnabled"
        >
          <NIcon :component="BulbOutline" :size="20" />
          <span>思考</span>
        </button>

        <button
          class="action-button"
          :class="{ 'is-active': voiceEnabled, 'is-speaking': isTtsSpeaking }"
          :disabled="isRecognizing || isRecording"
          @click="toggleTts"
        >
          <NIcon
            :component="voiceEnabled ? VolumeHighOutline : VolumeMuteOutline"
            :size="20"
          />
          <span>{{
            voiceEnabled ? (isTtsSpeaking ? "朗读中" : "朗读") : "朗读"
          }}</span>
        </button>

        <button
          class="action-button voice-button"
          :class="{ 'is-active': isRecording, 'is-recognizing': isRecognizing }"
          :disabled="isStreaming || isRecognizing"
          @click="toggleRecording"
        >
          <NIcon
            :component="isRecording ? MicOffOutline : MicOutline"
            :size="20"
          />
          <span>{{
            isRecording ? "停止" : isRecognizing ? "识别中" : "语音"
          }}</span>
          <kbd v-if="!isRecording && !isRecognizing" class="shortcut-badge">⌥Space</kbd>
        </button>
      </div>

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
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  transition: all var(--transition-smooth);
}

@media (min-width: 768px) {
  .message-input-container {
    padding: 16px;
  }
}

.message-input-container.is-focused {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-primary);
}

.message-input-container.is-recording {
  border-color: var(--color-error);
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15);
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

/* Recording Panel */
.recording-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  padding: 12px 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  border-color: rgba(239, 68, 68, 0.2);
}

.recording-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
  margin-right: 16px;
}

.recording-indicator {
  flex-shrink: 0;
}

.recording-dot {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-error);
  animation: pulse-dot 1.2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.waveform-bars {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 32px;
  flex: 1;
  min-width: 0;
}

.wave-bar {
  flex: 1;
  max-width: 6px;
  min-width: 2px;
  border-radius: 2px;
  background: var(--color-primary);
  transition: height 80ms ease;
  opacity: 0.7;
}

.recording-timer {
  flex-shrink: 0;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  letter-spacing: 0.5px;
}

.recording-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.recording-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background: var(--bg-tertiary);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.recording-btn.is-stop {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.recording-btn.is-stop:hover {
  background: var(--color-primary-hover);
  transform: scale(1.05);
}

.recording-btn.is-cancel {
  color: var(--color-error);
  border-color: rgba(239, 68, 68, 0.2);
  background: rgba(239, 68, 68, 0.06);
}

.recording-btn.is-cancel:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
}

/* Recognizing Panel */
.recognizing-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 64px;
  padding: 12px 16px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.recognizing-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border-color);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.recognizing-text {
  font-size: 13px;
  color: var(--text-secondary);
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
  flex-wrap: wrap;
  gap: 6px;
}

.action-button {
  height: 36px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  background: transparent;
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

@media (min-width: 768px) {
  .action-button {
    height: 40px;
    padding: 0 16px;
    gap: 8px;
    font-size: 14px;
  }

  .action-buttons {
    gap: 8px;
  }

  .recording-left {
    margin-right: 20px;
  }
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

.action-button:disabled .shortcut-badge {
  display: none;
}

.shortcut-badge {
  padding: 1px 5px;
  font-size: 9px;
  font-family: var(--font-mono);
  line-height: 1.4;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 3px;
  color: var(--text-muted);
  white-space: nowrap;
}

.action-button.is-speaking {
  animation: pulse-speak 1.5s ease-in-out infinite;
}

.action-button.is-recognizing {
  animation: pulse-speak 1s ease-in-out infinite;
}

@keyframes pulse-speak {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
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
