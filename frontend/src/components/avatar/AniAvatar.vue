<script setup lang="ts">
import { onMounted } from "vue";
import Live2DAvatar from "./Live2DAvatar.vue";
import { useAvatarModel } from "@/composables/avatar/useAvatarModel";
import { useLipSync } from "@/composables/avatar/useLipSync";
import { useEmotionDetector } from "@/composables/avatar/useEmotionDetector";
import { useAniBehavior } from "@/composables/avatar/useAniBehavior";
import { useAIChat } from "@/composables/useAIChat";
import { useVoice } from "@/composables/useVoice";
import { getModelConfig } from "@/config/avatar/models";

const props = defineProps<{
  width: number;
  height: number;
}>();

const modelConfig = getModelConfig("haru")!;

const avatarModel = useAvatarModel(modelConfig);
const lipSync = useLipSync();
const emotionDetector = useEmotionDetector();

const { avatarAction, isLoading: isStreaming, setEmotionTextCallback } = useAIChat();
const { ttsStatus, isRecording } = useVoice();

useAniBehavior({
  avatarModel,
  lipSync,
  emotionDetector,
  getTtsStatus: () => ttsStatus.value,
  getIsRecording: () => isRecording.value,
  getIsStreaming: () => isStreaming.value,
  getAvatarAction: () => avatarAction.value,
});

onMounted(() => {
  setEmotionTextCallback(emotionDetector.feedText);
});

defineExpose({
  connectAudioElement: lipSync.connectAudioElement,
  disconnectLipSync: lipSync.disconnect,
  feedEmotionText: emotionDetector.feedText,
  resetEmotionBuffer: emotionDetector.resetBuffer,
});
</script>

<template>
  <Live2DAvatar
    :ref="avatarModel.setAvatarRef"
    :model-url="modelConfig.modelUrl"
    :width="props.width"
    :height="props.height"
  />
</template>
