// frontend/src/composables/avatar/useAniBehavior.ts

import { ref, watch, onUnmounted } from "vue";
import type {
  BehaviorState,
  EmotionType,
  AvatarActionPayload,
  AvatarModelConfig,
  EmotionBaseline,
} from "@/types/avatar";

const IDLE_DELAY = 3000;

interface AvatarModelApi {
  config: AvatarModelConfig;
  setParam: (key: keyof AvatarModelConfig["params"], value: number) => void;
  setExpression: (emotion: string) => void;
  playMotion: (group: string, index?: number) => void;
  playRandomIdleMotion: () => void;
}

interface LipSyncApi {
  mouthOpenY: { value: number };
  setEnabled: (v: boolean) => void;
}

interface EmotionDetectorApi {
  emotionBaseline: { value: EmotionBaseline };
  setLlmEmotion: (emotion: EmotionType) => void;
  resetBuffer: () => void;
}

export function useAniBehavior(deps: {
  avatarModel: AvatarModelApi;
  lipSync: LipSyncApi;
  emotionDetector: EmotionDetectorApi;
  getTtsStatus: () => string;
  getIsRecording: () => boolean;
  getIsStreaming: () => boolean;
  getAvatarAction: () => AvatarActionPayload | null;
}) {
  const { avatarModel, lipSync, emotionDetector } = deps;

  const state = ref<BehaviorState>("idle");
  const prevState = ref<BehaviorState>("idle");
  let idleDelayTimer: ReturnType<typeof setTimeout> | null = null;

  let breathRaf = 0;
  let blinkTimer: ReturnType<typeof setTimeout> | null = null;
  let idleMotionTimer: ReturnType<typeof setTimeout> | null = null;
  let headSwayRaf = 0;

  // === State transitions ===

  function transitionTo(newState: BehaviorState): void {
    if (state.value === newState) return;
    prevState.value = state.value;
    state.value = newState;
    clearAutoBehaviors();

    switch (newState) {
      case "idle":
        startIdleBehaviors();
        lipSync.setEnabled(false);
        break;
      case "speaking":
        startSpeakingBehaviors();
        lipSync.setEnabled(true);
        break;
      case "listening":
        startListeningBehaviors();
        lipSync.setEnabled(false);
        break;
      case "reacting":
        lipSync.setEnabled(false);
        break;
    }
  }

  // === Auto behaviors ===

  function startBreathing(): void {
    const startTime = performance.now();
    const period = 3500;

    function tick() {
      const elapsed = performance.now() - startTime;
      const phase = ((elapsed % period) / period) * Math.PI * 2;
      const breathValue = (Math.sin(phase) + 1) / 2;
      avatarModel.setParam("breath", breathValue * 0.3);
      breathRaf = requestAnimationFrame(tick);
    }
    breathRaf = requestAnimationFrame(tick);
  }

  function scheduleBlink(minMs: number, maxMs: number): void {
    const delay = minMs + Math.random() * (maxMs - minMs);
    blinkTimer = setTimeout(() => {
      doBlink();
      if (state.value === "idle" || state.value === "speaking" || state.value === "listening") {
        scheduleBlink(minMs, maxMs);
      }
    }, delay);
  }

  function doBlink(): void {
    avatarModel.setParam("eyeLOpen", 0);
    avatarModel.setParam("eyeROpen", 0);
    setTimeout(() => {
      avatarModel.setParam("eyeLOpen", 1);
      avatarModel.setParam("eyeROpen", 1);
    }, 100);
  }

  function scheduleIdleMotion(): void {
    const { idle } = avatarModel.config.motions;
    if (!idle.randomInterval) return;
    const [min, max] = idle.randomInterval;
    const delay = min + Math.random() * (max - min);
    idleMotionTimer = setTimeout(() => {
      if (state.value === "idle") {
        avatarModel.playRandomIdleMotion();
        scheduleIdleMotion();
      }
    }, delay);
  }

  function startHeadSway(): void {
    const startTime = performance.now();

    function tick() {
      const elapsed = performance.now() - startTime;
      const offsetX = Math.sin(elapsed / 2000) * 2;
      const offsetY = Math.sin(elapsed / 3000 + 1) * 1;
      avatarModel.setParam("angleX", offsetX);
      avatarModel.setParam("angleY", offsetY);
      headSwayRaf = requestAnimationFrame(tick);
    }
    headSwayRaf = requestAnimationFrame(tick);
  }

  // === State behavior compositions ===

  function startIdleBehaviors(): void {
    startBreathing();
    scheduleBlink(2000, 5000);
    scheduleIdleMotion();
    avatarModel.setExpression("neutral");
  }

  function startSpeakingBehaviors(): void {
    startBreathing();
    scheduleBlink(3000, 7000);
    startHeadSway();
    applyEmotionBaseline(emotionDetector.emotionBaseline.value.emotion);
  }

  function startListeningBehaviors(): void {
    startBreathing();
    scheduleBlink(2000, 5000);
    avatarModel.setExpression("thinking");
    avatarModel.setParam("angleX", 3);
    avatarModel.setParam("angleY", -2);
  }

  function applyEmotionBaseline(emotion: EmotionType): void {
    if (state.value === "reacting") return;
    avatarModel.setExpression(emotion);
    switch (emotion) {
      case "sad":
        avatarModel.setParam("angleY", -5);
        break;
      case "thinking":
        avatarModel.setParam("angleX", -3);
        break;
      default:
        break;
    }
  }

  // === Cleanup ===

  function clearAutoBehaviors(): void {
    if (breathRaf) { cancelAnimationFrame(breathRaf); breathRaf = 0; }
    if (blinkTimer) { clearTimeout(blinkTimer); blinkTimer = null; }
    if (idleMotionTimer) { clearTimeout(idleMotionTimer); idleMotionTimer = null; }
    if (headSwayRaf) { cancelAnimationFrame(headSwayRaf); headSwayRaf = 0; }
    if (idleDelayTimer) { clearTimeout(idleDelayTimer); idleDelayTimer = null; }
    avatarModel.setParam("angleX", 0);
    avatarModel.setParam("angleY", 0);
    avatarModel.setParam("breath", 0);
  }

  // === External input handlers ===

  function handleAvatarAction(action: AvatarActionPayload | null): void {
    if (!action) return;
    if (action.action === "expression" && action.emotion) {
      emotionDetector.setLlmEmotion(action.emotion as EmotionType);
    }
    transitionTo("reacting");
    if (action.action === "expression" && action.emotion) {
      avatarModel.setExpression(action.emotion);
    }
    if (action.action === "motion" && action.group) {
      avatarModel.playMotion(action.group, action.index);
    }
    setTimeout(() => { transitionTo(prevState.value); }, 2000);
  }

  // === Watch external state ===

  watch(() => deps.getTtsStatus(), (status) => {
    if (idleDelayTimer) { clearTimeout(idleDelayTimer); idleDelayTimer = null; }
    if (status === "speaking") {
      transitionTo("speaking");
    } else if (state.value === "speaking") {
      idleDelayTimer = setTimeout(() => { transitionTo("idle"); idleDelayTimer = null; }, IDLE_DELAY);
    }
  });

  watch(() => deps.getIsRecording(), (recording) => {
    if (recording && state.value !== "reacting") {
      transitionTo("listening");
    } else if (!recording && state.value === "listening") {
      transitionTo("idle");
    }
  });

  watch(() => deps.getIsStreaming(), (streaming) => {
    if (!streaming) emotionDetector.resetBuffer();
  });

  watch(() => emotionDetector.emotionBaseline.value.emotion, (emotion) => {
    applyEmotionBaseline(emotion);
  });

  watch(() => deps.getAvatarAction(), (action) => {
    handleAvatarAction(action);
  });

  // Lip sync bridge
  watch(() => lipSync.mouthOpenY.value, (v) => {
    if (state.value === "speaking") avatarModel.setParam("mouthOpenY", v);
  });

  // === Lifecycle ===
  startIdleBehaviors();

  onUnmounted(() => { clearAutoBehaviors(); });

  return { state };
}
