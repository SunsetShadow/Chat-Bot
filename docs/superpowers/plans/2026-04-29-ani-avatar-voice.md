# Ani Avatar + Voice 联动 - Phase 1 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Ani Agent 构建统一的行为控制层，实现自然说话行为、情绪自动联动、口型同步优化。

**Architecture:** 前端驱动状态机（idle/speaking/listening/reacting），四个新 composable 收拢散落逻辑，Live2DAvatar 降级为纯渲染层。LLM 工具指令覆盖自动行为。

**Tech Stack:** Vue 3 Composition API, TypeScript, PixiJS 6, pixi-live2d-display (Cubism 4), Web Audio API

---

## 文件结构

### 新建文件

| 文件 | 职责 |
|------|------|
| `frontend/src/types/avatar.ts` | **扩展现有文件**，新增 AvatarModelConfig、BehaviorState、EmotionType 等类型 |
| `frontend/src/config/avatar/models/haru.ts` | Haru 模型配置（参数映射、表情映射、动作组） |
| `frontend/src/config/avatar/models/index.ts` | 模型注册表，按 id 查找配置 |
| `frontend/src/config/avatar/emotion-keywords.ts` | 情绪关键词词典 + 匹配逻辑 |
| `frontend/src/composables/avatar/useAvatarModel.ts` | 模型加载 + 参数映射抽象，提供 setParam/setExpression/playMotion |
| `frontend/src/composables/avatar/useLipSync.ts` | 口型同步（Phase 1 音量驱动优化版） |
| `frontend/src/composables/avatar/useEmotionDetector.ts` | SSE 文本流情绪检测，输出 emotionBaseline ref |
| `frontend/src/composables/avatar/useAniBehavior.ts` | 行为状态机 + 自动化行为调度（呼吸/眨眼/微动作） |
| `frontend/src/components/avatar/AniAvatar.vue` | Ani 专属入口，组合所有 avatar composable |

### 修改文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/avatar/Live2DAvatar.vue` | 移除 `watch(volume)`，新增 `setParam(id, value)` 方法 |
| `frontend/src/components/avatar/AvatarFloat.vue` | 移除散落的行为逻辑，用 AniAvatar 替代 Live2DAvatar |
| `frontend/src/composables/useVoice.ts` | 移除 ttsAudioLevel 的 AnalyserNode 逻辑，改为由 useLipSync 接管 |
| `frontend/src/config/emotion-map.ts` | 删除，功能合并到 haru.ts 配置 |

---

### Task 1: 扩展类型定义

**Files:**
- Modify: `frontend/src/types/avatar.ts`

- [ ] **Step 1: 扩展 avatar.ts 类型**

在现有文件中新增类型定义（保留现有的 AvatarActionPayload、AvatarLayoutMode 等）：

```typescript
// frontend/src/types/avatar.ts

/** SSE avatar_action 事件的 payload */
export interface AvatarActionPayload {
  action: "expression" | "motion";
  emotion?: string;
  group?: string;
  index?: number;
}

/** 布局模式 */
export type AvatarLayoutMode = "float" | "side" | "fullscreen";

/** Avatar 工具名常量 */
export const AVATAR_TOOL_NAMES = ["express_emotion", "play_motion"] as const;

// === 新增类型 ===

/** Ani 行为状态 */
export type BehaviorState = "idle" | "speaking" | "listening" | "reacting";

/** 情绪类型（8 种，与 Live2D 表情对齐） */
export type EmotionType =
  | "neutral"
  | "happy"
  | "sad"
  | "angry"
  | "surprised"
  | "sympathetic"
  | "thinking"
  | "excited";

/** 情绪 → 表情索引映射（由模型配置提供） */
export type EmotionMap = Record<string, number>;

/** 动作组配置 */
export interface MotionGroupConfig {
  count: number;
  randomInterval?: [number, number]; // [min, max] ms，仅 idle 组使用
}

/** Live2D 模型参数映射（不同模型参数 ID 可能不同） */
export interface AvatarModelParams {
  mouthOpenY: string;
  mouthForm: string;
  eyeLOpen: string;
  eyeROpen: string;
  angleX: string;
  angleY: string;
  breath: string;
  bodyAngleX: string;
}

/** Live2D 模型配置 */
export interface AvatarModelConfig {
  id: string;
  name: string;
  modelUrl: string;
  params: AvatarModelParams;
  expressions: Record<EmotionType, number>;
  motions: {
    idle: MotionGroupConfig;
    tap: MotionGroupConfig;
    speak?: MotionGroupConfig;
    greeting?: MotionGroupConfig;
  };
}

/** 情绪关键词规则 */
export interface EmotionKeywordRule {
  keywords: string[];
  emotion: EmotionType;
  weight: number;
}

/** 情绪基线状态 */
export interface EmotionBaseline {
  emotion: EmotionType;
  source: "llm" | "detector";
  setAt: number; // Date.now()
}
```

注意：删除原来的 `EmotionMap` type alias（它现在在上方重新定义了，内容相同）。如果编译冲突，保留新的定义。

- [ ] **Step 2: 验证编译**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && npx vue-tsc --noEmit 2>&1 | head -20`
Expected: 无新增类型错误（原有错误忽略）

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/avatar.ts
git commit -m "types: 扩展 avatar 类型定义 — 行为状态/情绪/模型配置"
```

---

### Task 2: Haru 模型配置 + 模型注册表

**Files:**
- Create: `frontend/src/config/avatar/models/haru.ts`
- Create: `frontend/src/config/avatar/models/index.ts`

- [ ] **Step 1: 创建 haru.ts**

```typescript
// frontend/src/config/avatar/models/haru.ts

import type { AvatarModelConfig } from "@/types/avatar";

/**
 * Haru 模型配置
 *
 * Haru expressions (haru_greeter_t03.model3.json):
 *   F01-F08 对应 index 0-7
 */
export const haruConfig: AvatarModelConfig = {
  id: "haru",
  name: "Haru",
  modelUrl: "/live2d/haru_greeter_t03.model3.json",
  params: {
    mouthOpenY: "ParamMouthOpenY",
    mouthForm: "ParamMouthForm",
    eyeLOpen: "ParamEyeLOpen",
    eyeROpen: "ParamEyeROpen",
    angleX: "ParamAngleX",
    angleY: "ParamAngleY",
    breath: "ParamBreath",
    bodyAngleX: "ParamBodyAngleX",
  },
  expressions: {
    neutral: 0,
    happy: 1,
    sad: 2,
    angry: 3,
    surprised: 4,
    sympathetic: 5,
    thinking: 6,
    excited: 7,
  },
  motions: {
    idle: { count: 3, randomInterval: [10000, 20000] },
    tap: { count: 5 },
  },
};
```

- [ ] **Step 2: 创建 index.ts 模型注册表**

```typescript
// frontend/src/config/avatar/models/index.ts

import type { AvatarModelConfig } from "@/types/avatar";
import { haruConfig } from "./haru";

const modelRegistry: Map<string, AvatarModelConfig> = new Map();

function registerModel(config: AvatarModelConfig): void {
  modelRegistry.set(config.id, config);
}

export function getModelConfig(id: string): AvatarModelConfig | undefined {
  return modelRegistry.get(id);
}

export function getAllModelIds(): string[] {
  return Array.from(modelRegistry.keys());
}

// 注册内置模型
registerModel(haruConfig);
```

- [ ] **Step 3: 验证编译**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && npx vue-tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/config/avatar/
git commit -m "config: Haru 模型配置 + 模型注册表"
```

---

### Task 3: 情绪关键词词典

**Files:**
- Create: `frontend/src/config/avatar/emotion-keywords.ts`

- [ ] **Step 1: 创建情绪关键词配置**

```typescript
// frontend/src/config/avatar/emotion-keywords.ts

import type { EmotionKeywordRule, EmotionType } from "@/types/avatar";

export const emotionRules: EmotionKeywordRule[] = [
  // happy
  { keywords: ["哈哈", "开心", "太好了", "不错", "很棒"], emotion: "happy", weight: 1 },
  // sad
  { keywords: ["抱歉", "不好意思", "遗憾", "可惜", "难过"], emotion: "sad", weight: 1 },
  // thinking
  { keywords: ["嗯", "让我想想", "这个问题", "分析", "考虑"], emotion: "thinking", weight: 1 },
  // excited
  { keywords: ["太棒了", "哇", "厉害", "厉害了", "太牛"], emotion: "excited", weight: 2 },
  // angry — 预留，中文对话中较少触发
  { keywords: ["生气", "过分", "不可接受"], emotion: "angry", weight: 1 },
  // surprised
  { keywords: ["没想到", "出乎意料", "居然", "竟然"], emotion: "surprised", weight: 1 },
  // sympathetic
  { keywords: ["理解", "辛苦了", "不容易", "心疼"], emotion: "sympathetic", weight: 1 },
  // neutral — 不做映射，作为默认值
];

/** 标点情绪增强 */
const punctuationBoosts: Array<{ pattern: RegExp; emotion: EmotionType; boost: number }> = [
  { pattern: /！{2,}/, emotion: "excited", boost: 1 },
  { pattern: /？{2,}/, emotion: "surprised", boost: 1 },
];

/**
 * 从文本中检测情绪
 * 返回匹配到的情绪（权重最高），无匹配返回 null
 */
export function detectEmotion(text: string): EmotionType | null {
  let bestEmotion: EmotionType | null = null;
  let bestScore = 0;

  for (const rule of emotionRules) {
    let matched = false;
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        matched = true;
        break;
      }
    }
    if (matched && rule.weight > bestScore) {
      bestScore = rule.weight;
      bestEmotion = rule.emotion;
    }
  }

  // 标点增强
  for (const boost of punctuationBoosts) {
    if (boost.pattern.test(text) && boost.boost >= bestScore) {
      bestEmotion = boost.emotion;
      bestScore = boost.boost;
    }
  }

  return bestEmotion;
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && npx vue-tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/config/avatar/emotion-keywords.ts
git commit -m "config: 情绪关键词词典 + 检测函数"
```

---

### Task 4: useAvatarModel composable

**Files:**
- Create: `frontend/src/composables/avatar/useAvatarModel.ts`

- [ ] **Step 1: 创建 useAvatarModel**

这个 composable 封装 Live2DAvatar 的 ref，提供统一的参数操作接口，屏蔽不同模型的参数 ID 差异。

```typescript
// frontend/src/composables/avatar/useAvatarModel.ts

import { ref, onUnmounted, type ComponentPublicInstance } from "vue";
import type { AvatarModelConfig } from "@/types/avatar";

/**
 * 封装 Live2DAvatar ref，提供参数级操作接口
 *
 * 使用方式:
 *   const avatarModel = useAvatarModel(haruConfig)
 *   // 在 template 中绑定 ref
 *   <Live2DAvatar :ref="avatarModel.setAvatarRef" />
 *   // 调用
 *   avatarModel.setParam("mouthOpenY", 0.5)
 *   avatarModel.setExpression("happy")
 */
export function useAvatarModel(config: AvatarModelConfig) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const avatarRef = ref<any>(null);

  // 当前参数值缓存（用于状态机读取当前值）
  const paramValues = ref<Record<string, number>>({});

  function setAvatarRef(el: ComponentPublicInstance | null | Element) {
    // Vue 3 ref callback: 可能是组件实例或 DOM 元素
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    avatarRef.value = el && "$el" in el ? el : null;
  }

  function getInternalModel() {
    return avatarRef.value?.model;
  }

  function getCoreModel() {
    return avatarRef.value?.coreModel;
  }

  /** 设置 Live2D 参数值 */
  function setParam(paramKey: keyof AvatarModelConfig["params"], value: number): void {
    const paramId = config.params[paramKey];
    if (!paramId) return;
    try {
      getCoreModel()?.setParameterValueById(paramId, value);
      paramValues.value[paramId] = value;
    } catch {
      // coreModel 可能在模型切换时不可用
    }
  }

  /** 读取当前 Live2D 参数值 */
  function getParam(paramKey: keyof AvatarModelConfig["params"]): number {
    const paramId = config.params[paramKey];
    if (!paramId) return 0;
    try {
      return getCoreModel()?.getParameterValueById(paramId) ?? 0;
    } catch {
      return paramValues.value[paramId] ?? 0;
    }
  }

  /** 设置表情（按情绪名） */
  function setExpression(emotion: string): void {
    const idx = config.expressions[emotion as keyof typeof config.expressions];
    if (idx === undefined) return;
    try {
      getInternalModel()?.expression(idx);
    } catch {
      // expression index 可能超出范围
    }
  }

  /** 设置表情（按索引） */
  function setExpressionIndex(index: number): void {
    try {
      getInternalModel()?.expression(index);
    } catch {
      // ignore
    }
  }

  /** 播放动作 */
  function playMotion(group: string, index?: number): void {
    try {
      getInternalModel()?.motion(group, index ?? 0);
    } catch {
      // motion group/index 可能不存在
    }
  }

  /** 播放随机 idle 动作 */
  function playRandomIdleMotion(): void {
    const { idle } = config.motions;
    const idx = Math.floor(Math.random() * idle.count);
    playMotion("Idle", idx);
  }

  return {
    avatarRef,
    setAvatarRef,
    config,
    setParam,
    getParam,
    setExpression,
    setExpressionIndex,
    playMotion,
    playRandomIdleMotion,
  };
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && npx vue-tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/composables/avatar/useAvatarModel.ts
git commit -m "feat: useAvatarModel composable — 模型参数抽象层"
```

---

### Task 5: useLipSync composable

**Files:**
- Create: `frontend/src/composables/avatar/useLipSync.ts`

这个 composable 从 `useVoice` 的 TTS 音频流中接管口型同步逻辑，增加 smoothing 和噪声门限。

- [ ] **Step 1: 创建 useLipSync**

```typescript
// frontend/src/composables/avatar/useLipSync.ts

import { ref, onUnmounted } from "vue";

/** Phase 1: 音量驱动口型同步（优化版） */
export function useLipSync() {
  const mouthOpenY = ref(0);
  const isEnabled = ref(true);

  // Audio 分析
  let audioCtx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let rafId = 0;
  let levelData: Uint8Array | null = null;

  // Smoothing 状态
  let smoothedValue = 0;
  const SMOOTH_UP = 0.4; // 张嘴快（0→1 越大越快）
  const SMOOTH_DOWN = 0.15; // 闭嘴慢
  const NOISE_GATE = 0.05; // 噪声门限
  const SCALE_FACTOR = 3.0; // 放大系数
  const JITTER_AMOUNT = 0.02; // 微抖幅度

  /**
   * 将 AudioElement 连接到 AnalyserNode
   * 在 TTS 开始播放时调用一次
   */
  function connectAudioElement(audioEl: HTMLAudioElement): void {
    disconnect();
    try {
      audioCtx = new AudioContext();
      const source = audioCtx.createMediaElementSource(audioEl);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      startLoop();
    } catch {
      // createMediaElementSource 只能调用一次
    }
  }

  function startLoop(): void {
    if (!analyser) return;
    if (!levelData || levelData.length !== analyser.frequencyBinCount) {
      levelData = new Uint8Array(analyser.frequencyBinCount);
    }
    update();
  }

  function update(): void {
    if (!analyser || !levelData) return;
    analyser.getByteFrequencyData(levelData);

    // 计算原始音量
    let sum = 0;
    for (let i = 0; i < levelData.length; i++) sum += levelData[i];
    const raw = (sum / levelData.length / 255) * SCALE_FACTOR;

    // 噪声门限
    const gated = raw < NOISE_GATE ? 0 : raw;

    // Smoothing: 张嘴快、闭嘴慢
    const alpha = gated > smoothedValue ? SMOOTH_UP : SMOOTH_DOWN;
    smoothedValue += (gated - smoothedValue) * alpha;

    // 微抖（避免机械感，仅在有声音时）
    const jitter = smoothedValue > NOISE_GATE
      ? (Math.random() - 0.5) * JITTER_AMOUNT
      : 0;

    mouthOpenY.value = isEnabled.value
      ? Math.max(0, Math.min(1, smoothedValue + jitter))
      : 0;

    rafId = requestAnimationFrame(update);
  }

  function disconnect(): void {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    analyser = null;
    levelData = null;
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    smoothedValue = 0;
    mouthOpenY.value = 0;
  }

  /** 暂停/恢复口型同步 */
  function setEnabled(v: boolean): void {
    isEnabled.value = v;
    if (!v) mouthOpenY.value = 0;
  }

  onUnmounted(() => {
    disconnect();
  });

  return {
    mouthOpenY,
    isEnabled,
    connectAudioElement,
    disconnect,
    setEnabled,
  };
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && npx vue-tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/composables/avatar/useLipSync.ts
git commit -m "feat: useLipSync composable — 音量驱动口型同步优化版"
```

---

### Task 6: useEmotionDetector composable

**Files:**
- Create: `frontend/src/composables/avatar/useEmotionDetector.ts`

- [ ] **Step 1: 创建 useEmotionDetector**

```typescript
// frontend/src/composables/avatar/useEmotionDetector.ts

import { ref, onUnmounted } from "vue";
import type { EmotionBaseline, EmotionType } from "@/types/avatar";
import { detectEmotion } from "@/config/avatar/emotion-keywords";

/** LLM 设置的情绪衰减时间（ms） */
const LLM_EMOTION_TTL = 30_000;
/** 文本检测的累积窗口大小（字符数） */
const DETECT_WINDOW_SIZE = 20;

export function useEmotionDetector() {
  const emotionBaseline = ref<EmotionBaseline>({
    emotion: "neutral",
    source: "detector",
    setAt: 0,
  });

  let textBuffer = "";
  let llmDecayTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * SSE 文本 chunk 输入
   * 逐 chunk 累积，句末标点或累积达到阈值时分析
   */
  function feedText(chunk: string): void {
    textBuffer += chunk;

    // 检查是否需要分析：句末标点 或 累积足够长度
    const hasSentenceEnd = /[！？。；\n]/.test(chunk);
    const bufferFull = textBuffer.length >= DETECT_WINDOW_SIZE;

    if (!hasSentenceEnd && !bufferFull) return;

    // LLM 情绪未过期时跳过前端检测
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
      // 无匹配，回到 neutral
      emotionBaseline.value = {
        emotion: "neutral",
        source: "detector",
        setAt: Date.now(),
      };
    }

    textBuffer = "";
  }

  /**
   * LLM 主动设置情绪（通过 avatar_action SSE）
   * 高优先级，覆盖前端检测
   */
  function setLlmEmotion(emotion: EmotionType): void {
    if (llmDecayTimer) clearTimeout(llmDecayTimer);
    emotionBaseline.value = {
      emotion,
      source: "llm",
      setAt: Date.now(),
    };
    // 30s 后自动衰减到 neutral
    llmDecayTimer = setTimeout(() => {
      emotionBaseline.value = {
        emotion: "neutral",
        source: "detector",
        setAt: Date.now(),
      };
    }, LLM_EMOTION_TTL);
  }

  /** 流式结束重置文本缓冲 */
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
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && npx vue-tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/composables/avatar/useEmotionDetector.ts
git commit -m "feat: useEmotionDetector composable — SSE 文本流情绪检测"
```

---

### Task 7: useAniBehavior composable（核心状态机）

**Files:**
- Create: `frontend/src/composables/avatar/useAniBehavior.ts`

这是最核心的 composable，管理行为状态机和所有自动化行为。

- [ ] **Step 1: 创建 useAniBehavior**

```typescript
// frontend/src/composables/avatar/useAniBehavior.ts

import { ref, watch, onUnmounted } from "vue";
import type {
  BehaviorState,
  EmotionType,
  AvatarActionPayload,
  AvatarModelConfig,
} from "@/types/avatar";
import type { useAvatarModel } from "./useAvatarModel";
import type { useLipSync } from "./useLipSync";
import type { useEmotionDetector } from "./useEmotionDetector";

/** speaking → idle 的延迟（ms） */
const IDLE_DELAY = 3000;

export function useAniBehavior(deps: {
  avatarModel: ReturnType<typeof useAvatarModel>;
  lipSync: ReturnType<typeof useLipSync>;
  emotionDetector: ReturnType<typeof useEmotionDetector>;
  getTtsStatus: () => string;
  getIsRecording: () => boolean;
  getIsStreaming: () => boolean;
  getAvatarAction: () => AvatarActionPayload | null;
}) {
  const { avatarModel, lipSync, emotionDetector } = deps;

  const state = ref<BehaviorState>("idle");
  const prevState = ref<BehaviorState>("idle");
  let idleDelayTimer: ReturnType<typeof setTimeout> | null = null;

  // === 自动化行为定时器 ===
  let breathRaf = 0;
  let blinkTimer: ReturnType<typeof setTimeout> | null = null;
  let idleMotionTimer: ReturnType<typeof setTimeout> | null = null;
  let headSwayRaf = 0;

  // === 状态转换 ===

  function transitionTo(newState: BehaviorState): void {
    if (state.value === newState) return;
    prevState.value = state.value;
    state.value = newState;

    // 清理旧状态的定时器
    clearAutoBehaviors();

    // 启动新状态的行为
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
        // reacting 期间暂停自动化行为
        lipSync.setEnabled(false);
        break;
    }
  }

  // === 自动化行为实现 ===

  /** 呼吸：正弦波驱动 ParamBreath，3-4s 周期 */
  function startBreathing(): void {
    const startTime = performance.now();
    const period = 3500; // 3.5s 周期

    function tick() {
      const elapsed = performance.now() - startTime;
      const phase = (elapsed % period) / period * Math.PI * 2;
      const breathValue = (Math.sin(phase) + 1) / 2; // 0→1
      avatarModel.setParam("breath", breathValue * 0.3); // 最大幅度 0.3
      breathRaf = requestAnimationFrame(tick);
    }
    breathRaf = requestAnimationFrame(tick);
  }

  /** 眨眼：随机间隔 */
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
    // 快速闭眼 → 睁眼
    avatarModel.setParam("eyeLOpen", 0);
    avatarModel.setParam("eyeROpen", 0);
    setTimeout(() => {
      avatarModel.setParam("eyeLOpen", 1);
      avatarModel.setParam("eyeROpen", 1);
    }, 100);
  }

  /** 随机 idle 动作 */
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

  /** 说话时头部微动 */
  function startHeadSway(): void {
    const startTime = performance.now();

    function tick() {
      const elapsed = performance.now() - startTime;
      // 缓慢、小幅度的 X/Y 偏移
      const offsetX = Math.sin(elapsed / 2000) * 2; // ±2 度
      const offsetY = Math.sin(elapsed / 3000 + 1) * 1; // ±1 度
      avatarModel.setParam("angleX", offsetX);
      avatarModel.setParam("angleY", offsetY);
      headSwayRaf = requestAnimationFrame(tick);
    }
    headSwayRaf = requestAnimationFrame(tick);
  }

  // === 各状态行为组合 ===

  function startIdleBehaviors(): void {
    startBreathing();
    scheduleBlink(2000, 5000);
    scheduleIdleMotion();
    // 恢复中性表情
    avatarModel.setExpression("neutral");
  }

  function startSpeakingBehaviors(): void {
    startBreathing();
    scheduleBlink(3000, 7000); // 说话时眨眼频率降低
    startHeadSway();
    // 表情由情绪基线决定（通过 watch emotionBaseline）
    applyEmotionBaseline(emotionDetector.emotionBaseline.value.emotion);
  }

  function startListeningBehaviors(): void {
    startBreathing();
    scheduleBlink(2000, 5000);
    avatarModel.setExpression("thinking");
    // 轻微头部倾斜
    avatarModel.setParam("angleX", 3);
    avatarModel.setParam("angleY", -2);
  }

  function applyEmotionBaseline(emotion: EmotionType): void {
    if (state.value === "reacting") return; // reacting 期间不改表情
    avatarModel.setExpression(emotion);

    // 不同情绪影响行为参数
    const { config } = avatarModel;
    switch (emotion) {
      case "happy":
      case "excited":
        // 更活跃的头部微动
        break;
      case "sad":
        // 低头
        avatarModel.setParam("angleY", -5);
        break;
      case "thinking":
        avatarModel.setParam("angleX", -3);
        break;
      default:
        break;
    }
  }

  // === 清理 ===

  function clearAutoBehaviors(): void {
    if (breathRaf) {
      cancelAnimationFrame(breathRaf);
      breathRaf = 0;
    }
    if (blinkTimer) {
      clearTimeout(blinkTimer);
      blinkTimer = null;
    }
    if (idleMotionTimer) {
      clearTimeout(idleMotionTimer);
      idleMotionTimer = null;
    }
    if (headSwayRaf) {
      cancelAnimationFrame(headSwayRaf);
      headSwayRaf = 0;
    }
    if (idleDelayTimer) {
      clearTimeout(idleDelayTimer);
      idleDelayTimer = null;
    }
    // 重置参数
    avatarModel.setParam("angleX", 0);
    avatarModel.setParam("angleY", 0);
    avatarModel.setParam("breath", 0);
  }

  // === 外部输入驱动 ===

  /** 处理 avatar_action SSE 事件（LLM 工具指令） */
  function handleAvatarAction(action: AvatarActionPayload | null): void {
    if (!action) return;

    // LLM 情绪指令同步到 emotionDetector
    if (action.action === "expression" && action.emotion) {
      emotionDetector.setLlmEmotion(action.emotion as EmotionType);
    }

    // 进入 reacting 状态
    transitionTo("reacting");

    // 执行指令
    if (action.action === "expression" && action.emotion) {
      avatarModel.setExpression(action.emotion);
    }
    if (action.action === "motion" && action.group) {
      avatarModel.playMotion(action.group, action.index);
    }

    // reacting 结束后回到前一状态
    setTimeout(() => {
      transitionTo(prevState.value);
    }, 2000);
  }

  // === 响应外部状态变化 ===

  // TTS 状态 → speaking/idle
  watch(
    () => deps.getTtsStatus(),
    (status) => {
      if (idleDelayTimer) {
        clearTimeout(idleDelayTimer);
        idleDelayTimer = null;
      }
      if (status === "speaking") {
        transitionTo("speaking");
      } else if (state.value === "speaking") {
        // 延迟回到 idle
        idleDelayTimer = setTimeout(() => {
          transitionTo("idle");
          idleDelayTimer = null;
        }, IDLE_DELAY);
      }
    },
  );

  // 录音状态 → listening
  watch(
    () => deps.getIsRecording(),
    (recording) => {
      if (recording && state.value !== "reacting") {
        transitionTo("listening");
      } else if (!recording && state.value === "listening") {
        transitionTo("idle");
      }
    },
  );

  // 流式结束 → 回到 neutral（兜底）
  watch(
    () => deps.getIsStreaming(),
    (streaming) => {
      if (!streaming) {
        emotionDetector.resetBuffer();
      }
    },
  );

  // 情绪基线变化 → 应用
  watch(
    () => emotionDetector.emotionBaseline.value.emotion,
    (emotion) => {
      applyEmotionBaseline(emotion);
    },
  );

  // avatarAction 变化
  watch(
    () => deps.getAvatarAction(),
    (action) => {
      handleAvatarAction(action);
    },
  );

  // === 口型同步桥接 ===

  // lipSync.mouthOpenY → avatarModel.setParam
  watch(
    () => lipSync.mouthOpenY.value,
    (v) => {
      if (state.value === "speaking") {
        avatarModel.setParam("mouthOpenY", v);
      }
    },
  );

  // === 生命周期 ===

  // 启动 idle 行为
  startIdleBehaviors();

  onUnmounted(() => {
    clearAutoBehaviors();
  });

  return {
    state,
  };
}
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && npx vue-tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/composables/avatar/useAniBehavior.ts
git commit -m "feat: useAniBehavior composable — 行为状态机 + 自动化行为"
```

---

### Task 8: Live2DAvatar 重构

**Files:**
- Modify: `frontend/src/components/avatar/Live2DAvatar.vue`

移除 `watch(volume)` 和 `volume` prop，新增 `setParam()` exposed 方法。Live2DAvatar 降级为纯渲染层。

- [ ] **Step 1: 修改 Live2DAvatar.vue**

主要改动：
1. 删除 `volume` prop
2. 删除 `watch(volume)` 块
3. 新增 `setParam(paramId: string, value: number)` exposed 方法
4. 保留 `setExpression`、`startMotion`、`tap`

修改 `props` 定义（删除 volume 行）：

```typescript
// 原来的 props:
const props = withDefaults(
  defineProps<{
    modelUrl: string;
    width?: number;
    height?: number;
    volume?: number;   // ← 删除这行
  }>(),
  { width: 400, height: 600, volume: 0 },  // ← 删除 volume: 0
);
```

改为：

```typescript
const props = withDefaults(
  defineProps<{
    modelUrl: string;
    width?: number;
    height?: number;
  }>(),
  { width: 400, height: 600 },
);
```

删除整个 `watch(volume)` 块（原文件 lines 83-92）。

新增 `setParam` 方法（在 `startMotion` 之后）：

```typescript
function setParam(paramId: string, value: number): void {
  try {
    coreModel.value?.setParameterValueById(paramId, value);
  } catch {
    // coreModel 可能在模型切换时不可用
  }
}
```

更新 `defineExpose`：

```typescript
defineExpose({ setExpression, startMotion, tap, setParam });
```

同时暴露 `model` 和 `coreModel` 的 getter，让 `useAvatarModel` 可以访问：

```typescript
defineExpose({
  setExpression,
  startMotion,
  tap,
  setParam,
  get model() { return model.value; },
  get coreModel() { return coreModel.value; },
});
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && npx vue-tsc --noEmit 2>&1 | head -20`

此时 AvatarFloat.vue 会报错（因为它传了 `:volume` prop），这是预期的，在 Task 9 中修复。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/avatar/Live2DAvatar.vue
git commit -m "refactor: Live2DAvatar — 移除 volume prop，新增 setParam 暴露方法"
```

---

### Task 9: AniAvatar.vue 新组件

**Files:**
- Create: `frontend/src/components/avatar/AniAvatar.vue`

AniAvatar 是 Ani 专属入口，组合所有 avatar composable。

- [ ] **Step 1: 创建 AniAvatar.vue**

```vue
<script setup lang="ts">
import { toRef } from "vue";
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

const defaultModelId = "haru";
const modelConfig = getModelConfig(defaultModelId)!;

const avatarModel = useAvatarModel(modelConfig);
const lipSync = useLipSync();
const emotionDetector = useEmotionDetector();

const { avatarAction, isLoading: isStreaming } = useAIChat();
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

// 暴露 lipSync.connectAudioElement 给外部（useVoice 的 TTS 播放时调用）
// 暴露 emotionDetector.feedText 给 useChatTransport 的 SSE 文本流
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
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && npx vue-tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/avatar/AniAvatar.vue
git commit -m "feat: AniAvatar.vue — Ani 专属 avatar 入口组件"
```

---

### Task 10: AvatarFloat.vue 重构

**Files:**
- Modify: `frontend/src/components/avatar/AvatarFloat.vue`

用 AniAvatar 替代 Live2DAvatar，移除散落的行为逻辑（avatarAction watch、isStreaming watch、avatarVolume computed）。

- [ ] **Step 1: 修改 AvatarFloat.vue**

关键改动：

1. 导入 `AniAvatar` 替代 `Live2DAvatar`
2. 删除 `import { HARU_EMOTION_MAP }` 和 `import type { AvatarActionPayload }`
3. 删除 `const { ttsAudioLevel, ttsStatus } = useVoice()` （不再需要 ttsAudioLevel）
4. 删除 `avatarVolume` computed
5. 删除 `watch(avatarAction, ...)` 块
6. 删除 `watch(isStreaming, ...)` 块
7. Template 中用 `<AniAvatar>` 替代 `<Live2DAvatar>`，移除 `:volume` prop
8. 新增 `aniAvatarRef` ref 用于调用 exposed 方法
9. 保留所有布局、拖拽、最小化逻辑不变

修改后的 `<script setup>` 开头：

```typescript
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import AniAvatar from "./AniAvatar.vue";
import { useAIChat } from "@/composables/useAIChat";
import { useAvatarLayout } from "@/composables/useAvatarLayout";
import type { AvatarLayoutMode } from "@/types/avatar";
import { NIcon } from "naive-ui";
import {
  CloseOutline,
  RemoveOutline,
  ContractOutline,
  ExpandOutline,
  TabletLandscapeOutline,
} from "@vicons/ionicons5";
```

删除 `MODEL_URL` 常量（现在由 AniAvatar 内部管理）。

删除 `avatarRef`（Live2DAvatar 的 ref），新增 `aniAvatarRef`：

```typescript
const aniAvatarRef = ref<InstanceType<typeof AniAvatar>>();
```

删除 `const { avatarAction, isLoading: isStreaming } = useAIChat()` 中的 `avatarAction`，保留 `isStreaming`：
```typescript
const { isLoading: isStreaming } = useAIChat();
```

删除 `const { ttsAudioLevel, ttsStatus } = useVoice()`，改用 `useVoice` 只获取 `ttsStatus`（如果需要的话）。实际上 AvatarFloat 不再需要 ttsStatus。

删除以下代码块：
- `const avatarVolume = computed(...)` — 口型由 useAniBehavior 内部管理
- `watch(avatarAction, ...)` — 行为由 useAniBehavior 管理
- `watch(isStreaming, ...)` — 同上

Template 改动 — 将所有 `<Live2DAvatar>` 替换为 `<AniAvatar>`，移除 `:volume`：

```vue
<!-- 全屏模式 -->
<Live2DAvatar
  ref="avatarRef"
  :model-url="MODEL_URL"
  :width="canvasW"
  :height="canvasH"
  :volume="avatarVolume"
/>
```

替换为：

```vue
<AniAvatar
  ref="aniAvatarRef"
  :width="canvasW"
  :height="canvasH"
/>
```

三个布局模式中的 Live2DAvatar 全部按此替换。

- [ ] **Step 2: 验证编译**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && npx vue-tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/avatar/AvatarFloat.vue
git commit -m "refactor: AvatarFloat — 用 AniAvatar 替代 Live2DAvatar，移除散落行为逻辑"
```

---

### Task 11: useVoice.ts 清理

**Files:**
- Modify: `frontend/src/composables/useVoice.ts`

移除被 `useLipSync` 接管的 AnalyserNode 逻辑。`useVoice` 不再负责口型同步，只保留 TTS WebSocket 连接和音频播放。

- [ ] **Step 1: 修改 useVoice.ts**

删除以下变量声明：
- `ttsAudioLevel` ref
- `ttsAudioCtx`, `ttsAnalyser`, `ttsLevelRaf`, `ttsLevelData`

删除 `updateTtsLevel()` 函数。

修改 `prepareStreamingAudio()`：移除 `audioEl.addEventListener("playing", ...)` 中的 AnalyserNode 连接逻辑。

改为：当音频开始播放时，通知外部的 lipSync composable 连接 AudioElement。具体实现：

```typescript
// 新增：外部 lipSync 连接回调
let onAudioPlaying: ((audioEl: HTMLAudioElement) => void) | null = null;

// 在 prepareStreamingAudio 中：
audioEl.addEventListener("playing", () => {
  if (onAudioPlaying && audioEl) {
    onAudioPlaying(audioEl);
  }
});
```

修改 `cleanupAudioPlayback()`：移除 `ttsLevelRaf`、`ttsAnalyser`、`ttsLevelData`、`ttsAudioCtx` 清理，移除 `ttsAudioLevel.value = 0`。

新增 `setOnAudioPlaying` 设置方法（类似现有的 `setOnRecognized`）：

```typescript
setOnAudioPlaying(cb: (audioEl: HTMLAudioElement) => void) {
  onAudioPlaying = cb;
},
```

在 `return` 中移除 `ttsAudioLevel`，新增 `setOnAudioPlaying`。

- [ ] **Step 2: 检查 ttsAudioLevel 的所有消费方**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot && grep -rn "ttsAudioLevel" frontend/src/`

Expected: 应该没有消费方了（AvatarFloat 已在 Task 10 中移除）。如果有残留，一并清理。

- [ ] **Step 3: 验证编译**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && npx vue-tsc --noEmit 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/composables/useVoice.ts
git commit -m "refactor: useVoice — 移除口型同步逻辑，改为外部 lipSync 回调"
```

---

### Task 12: 删除旧 emotion-map + 连接 lipSync 回调

**Files:**
- Delete: `frontend/src/config/emotion-map.ts`
- Modify: 检查所有引用 `HARU_EMOTION_MAP` 的文件

- [ ] **Step 1: 检查 HARU_EMOTION_MAP 引用**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot && grep -rn "HARU_EMOTION_MAP\|emotion-map" frontend/src/`

- [ ] **Step 2: 删除 emotion-map.ts**

```bash
rm frontend/src/config/emotion-map.ts
```

如果有文件仍在引用 `HARU_EMOTION_MAP`，将引用改为使用 `getModelConfig("haru")!.expressions`。

- [ ] **Step 3: 连接 useVoice 的 lipSync 回调**

在 ChatContainer.vue 或使用 AvatarFloat 的父组件中，找到 useVoice 和 AniAvatar 的连接点。需要在组件挂载时调用：

```typescript
// 伪代码：在包含 AvatarFloat 和 useVoice 的父组件中
const { setOnAudioPlaying } = useVoice();
const aniAvatarRef = ref<InstanceType<typeof AniAvatar>>();

setOnAudioPlaying((audioEl) => {
  aniAvatarRef.value?.connectAudioElement(audioEl);
});
```

具体位置需要在代码中找到 useVoice 被调用的位置和 AvatarFloat 被使用的位置。检查 `ChatView.vue` 或 `ChatContainer.vue`。

Run: `grep -rn "AvatarFloat\|useVoice" frontend/src/views/ frontend/src/components/ --include="*.vue" | head -20`

根据输出确定连接点并修改。

- [ ] **Step 4: 验证编译**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && npx vue-tsc --noEmit 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "cleanup: 删除旧 emotion-map，连接 lipSync 回调"
```

---

### Task 13: SSE 文本流 → 情绪检测连接

**Files:**
- Modify: 连接 SSE 文本 chunk 到 `emotionDetector.feedText()`

- [ ] **Step 1: 找到 SSE 文本流的消费点**

Run: `grep -rn "content_delta\|text-delta\|onTextChunk" frontend/src/ --include="*.ts" --include="*.vue" | head -20`

在 `useChatTransport.ts` 的 `convertEventToChunks` 中，`content_delta` 事件已经是 text-delta chunk。需要在 Chat 实例层面监听文本 chunk 并 feed 给情绪检测器。

方案：在 `useAIChat.ts` 的 `createChatTransport` 回调中增加 `onTextDelta` 参数，或在 `AniAvatar.vue` 的父组件中通过 `@update` 事件传递。

最简方案：在 `useChatTransport` 中增加 `onTextDelta` 回调参数，在 `content_delta` 处理时同时调用。

修改 `createChatTransport` 函数签名，新增 `onTextDelta?: (text: string) => void` 参数：

```typescript
export function createChatTransport(
  getExtraBody?: () => Record<string, unknown>,
  onSessionCreated?: (sessionId: string) => void,
  onAgentSwitched?: (from: string, to: string) => void,
  getTtsSessionId?: () => string | null,
  onAvatarAction?: (payload: AvatarActionPayload) => void,
  onTextDelta?: (text: string) => void,  // 新增
): ChatTransport<UIMessage>
```

在 `convertSSEStream` 中，`content_delta` 处理时调用：

```typescript
// 在 convertSSEStream 函数内
if (event.event === "content_delta" && onTextDelta) {
  const content = (event.data.content as string) || "";
  if (content) onTextDelta(content);
}
```

在 `useAIChat.ts` 的 `getChatInstance` 中传入回调。回调需要触发 `AniAvatar` 的 `feedEmotionText`。

由于 `useAIChat` 是模块级单例，`AniAvatar` 是组件实例，需要通过 ref 桥接。方案：

在 `useAIChat` 中新增 `feedEmotionText` ref：

```typescript
let emotionTextCallback: ((text: string) => void) | null = null;

// 在 return 中:
setEmotionTextCallback(cb: (text: string) => void) {
  emotionTextCallback = cb;
},
```

在 `createChatTransport` 的 `onTextDelta` 中：

```typescript
onTextDelta: (text) => {
  if (emotionTextCallback) emotionTextCallback(text);
},
```

在 `AniAvatar.vue` 的 `onMounted` 中注册：

```typescript
import { onMounted } from "vue";
// 在 setup 中:
const { setEmotionTextCallback } = useAIChat();
onMounted(() => {
  setEmotionTextCallback(emotionDetector.feedText);
});
```

- [ ] **Step 2: 验证编译**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && npx vue-tsc --noEmit 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/composables/useChatTransport.ts frontend/src/composables/useAIChat.ts frontend/src/components/avatar/AniAvatar.vue
git commit -m "feat: SSE 文本流 → 情绪检测连接"
```

---

### Task 14: 集成验证

- [ ] **Step 1: 启动前端开发服务器**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && pnpm dev`

- [ ] **Step 2: 浏览器验证**

打开 `https://localhost:3000`，进行以下测试：

1. **idle 状态**：Avatar 加载后应有呼吸动画和随机眨眼
2. **speaking 状态**：发送消息触发 AI 回复，TTS 播放时口型应同步，头部微动
3. **reacting 状态**：AI 调用 `express_emotion` 工具时，表情应立即切换
4. **listening 状态**：点击录音按钮开始录音时，Avatar 应切到专注表情
5. **情绪联动**：AI 回复中出现"哈哈"等关键词时，Avatar 应自动切到 happy 表情

- [ ] **Step 3: Lint 检查**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && pnpm lint`

- [ ] **Step 4: 修复 lint 问题（如有）**

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "feat: Ani Avatar + Voice 联动 Phase 1 完成 — 行为状态机 + 情绪联动 + 口型优化"
```

---

## Phase 2 计划（不在本 plan 范围内）

- 后端 TTS Provider 抽象接口
- 腾讯云 TtsProvider 实现（不实现 viseme）
- Azure TtsProvider 实现（实现 viseme 事件）
- 前端 viseme 时间线调度
- WebSocket viseme 协议扩展
- 多模型管理 UI
