/** SSE avatar_action 事件的 payload */
export interface AvatarActionPayload {
  action: "expression" | "motion";
  emotion?: string;
  group?: string;
  index?: number;
}

/** 布局模式 */
export type AvatarLayoutMode = "float" | "side" | "fullscreen";

/** 情绪 → 表情索引映射 */
export type EmotionMap = Record<string, number>;

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
