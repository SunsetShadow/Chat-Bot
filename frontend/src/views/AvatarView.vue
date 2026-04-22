<script setup lang="ts">
import { ref } from "vue";
import Live2DAvatar from "@/components/avatar/Live2DAvatar.vue";
import { useVoice } from "@/composables/useVoice";

const MODEL_URL = "/live2d/haru_greeter_t03.model3.json";

const avatarRef = ref<InstanceType<typeof Live2DAvatar>>();
const modelLoaded = ref(false);
const modelError = ref("");

const {
  isRecording,
  isRecognizing,
  audioLevel,
  startRecording,
  stopRecording,
  setOnRecognized,
} = useVoice();

const recognizedText = ref("");
setOnRecognized((text) => {
  if (text) recognizedText.value = text;
});

const expressions = [
  { label: "默认", index: -1 },
  { label: "表情 1", index: 0 },
  { label: "表情 2", index: 1 },
  { label: "表情 3", index: 2 },
  { label: "表情 4", index: 3 },
  { label: "表情 5", index: 4 },
  { label: "表情 6", index: 5 },
  { label: "表情 7", index: 6 },
  { label: "表情 8", index: 7 },
];
const currentExpression = ref(-1);

const motions = [
  { label: "动作 1", group: "Tap", index: 0 },
  { label: "动作 2", group: "Tap", index: 1 },
  { label: "动作 3", group: "Idle", index: 1 },
];

function toggleRecording() {
  if (isRecording.value) {
    stopRecording();
  } else {
    startRecording();
  }
}

function setExpression(idx: number) {
  currentExpression.value = idx;
  if (idx === -1) return;
  avatarRef.value?.setExpression(idx);
}

function playMotion(group: string, index: number) {
  avatarRef.value?.startMotion(group, index);
}

function onModelLoaded() {
  modelLoaded.value = true;
}

function onModelError(msg: string) {
  modelError.value = msg;
}
</script>

<template>
  <div class="avatar-page">
    <div class="avatar-stage">
      <Live2DAvatar
        ref="avatarRef"
        :model-url="MODEL_URL"
        :width="400"
        :height="560"
        :volume="isRecording ? audioLevel : 0"
        @loaded="onModelLoaded"
        @error="onModelError"
        @click="playMotion('Tap', Math.floor(Math.random() * 2))"
      />
      <div v-if="!modelLoaded && !modelError" class="stage-hint">
        模型加载中...
      </div>
      <div v-if="modelError" class="stage-error">
        模型加载失败: {{ modelError }}
      </div>
    </div>

    <div class="control-panel">
      <!-- 语音交互 -->
      <NCard title="语音交互" size="small" class="control-card">
        <div class="voice-section">
          <NButton
            :type="isRecording ? 'error' : 'primary'"
            round
            size="large"
            :loading="isRecognizing"
            @click="toggleRecording"
          >
            {{
              isRecording
                ? "停止录音"
                : isRecognizing
                  ? "识别中..."
                  : "按住说话"
            }}
          </NButton>
          <div v-if="isRecording" class="audio-meter">
            <div class="meter-bar" :style="{ width: audioLevel * 100 + '%' }" />
          </div>
        </div>
        <div v-if="recognizedText" class="recognized-text">
          <NText depth="3" style="font-size: 12px">识别结果:</NText>
          <NText>{{ recognizedText }}</NText>
        </div>
      </NCard>

      <!-- 表情控制 -->
      <NCard title="表情" size="small" class="control-card">
        <div class="expression-grid">
          <NButton
            v-for="exp in expressions"
            :key="exp.index"
            :type="currentExpression === exp.index ? 'primary' : 'default'"
            size="small"
            @click="setExpression(exp.index)"
          >
            {{ exp.label }}
          </NButton>
        </div>
      </NCard>

      <!-- 动作控制 -->
      <NCard title="动作" size="small" class="control-card">
        <NSpace>
          <NButton
            v-for="(m, i) in motions"
            :key="i"
            size="small"
            @click="playMotion(m.group, m.index)"
          >
            {{ m.label }}
          </NButton>
        </NSpace>
      </NCard>
    </div>
  </div>
</template>

<style scoped>
.avatar-page {
  display: flex;
  height: 100vh;
  padding: 24px;
  gap: 24px;
  box-sizing: border-box;
}

.avatar-stage {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.stage-hint,
.stage-error {
  margin-top: 12px;
  font-size: 13px;
}

.stage-error {
  color: #e74c3c;
}

.control-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 480px;
  overflow-y: auto;
}

.control-card {
  border-radius: 12px;
}

.voice-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.audio-meter {
  width: 200px;
  height: 6px;
  background: rgba(128, 128, 128, 0.2);
  border-radius: 3px;
  overflow: hidden;
}

.meter-bar {
  height: 100%;
  background: #5b9cf6;
  border-radius: 3px;
  transition: width 0.05s linear;
}

.recognized-text {
  margin-top: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(128, 128, 128, 0.08);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.expression-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
