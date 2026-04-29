// frontend/src/composables/avatar/useEmotionDetector.ts

import { ref, onUnmounted } from "vue";
import type { EmotionBaseline, EmotionType } from "@/types/avatar";
import { detectEmotion } from "@/config/avatar/emotion-keywords";

const LLM_EMOTION_TTL = 30_000;
const DETECT_WINDOW_SIZE = 20;

export function useEmotionDetector() {
  const emotionBaseline = ref<EmotionBaseline>({
    emotion: "neutral",
    source: "detector",
    setAt: 0,
  });

  let textBuffer = "";
  let llmDecayTimer: ReturnType<typeof setTimeout> | null = null;

  function feedText(chunk: string): void {
    textBuffer += chunk;

    const hasSentenceEnd = /[！？。；\n]/.test(chunk);
    const bufferFull = textBuffer.length >= DETECT_WINDOW_SIZE;

    if (!hasSentenceEnd && !bufferFull) return;

    if (
      emotionBaseline.value.source === "llm" &&
      Date.now() - emotionBaseline.value.setAt < LLM_EMOTION_TTL
    ) {
      textBuffer = "";
      return;
    }

    const detected = detectEmotion(textBuffer);
    if (detected) {
      emotionBaseline.value = {
        emotion: detected,
        source: "detector",
        setAt: Date.now(),
      };
    } else if (emotionBaseline.value.source === "detector") {
      emotionBaseline.value = {
        emotion: "neutral",
        source: "detector",
        setAt: Date.now(),
      };
    }

    textBuffer = "";
  }

  function setLlmEmotion(emotion: EmotionType): void {
    if (llmDecayTimer) clearTimeout(llmDecayTimer);
    emotionBaseline.value = {
      emotion,
      source: "llm",
      setAt: Date.now(),
    };
    llmDecayTimer = setTimeout(() => {
      emotionBaseline.value = {
        emotion: "neutral",
        source: "detector",
        setAt: Date.now(),
      };
    }, LLM_EMOTION_TTL);
  }

  function resetBuffer(): void {
    textBuffer = "";
  }

  onUnmounted(() => {
    if (llmDecayTimer) clearTimeout(llmDecayTimer);
  });

  return {
    emotionBaseline,
    feedText,
    setLlmEmotion,
    resetBuffer,
  };
}
