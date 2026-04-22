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
