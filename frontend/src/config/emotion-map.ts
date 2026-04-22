import type { EmotionMap } from "@/types/avatar";

/**
 * Haru 模型默认情绪映射
 *
 * Haru expressions (haru_greeter_t03.model3.json):
 *   F01-F08 对应 index 0-7
 *
 * 语义映射:
 *   0: 默认/微笑
 *   1: 开心
 *   2: 悲伤
 *   3: 生气
 *   4: 惊讶
 *   5: 同情/温柔
 *   6: 思考
 *   7: 兴奋
 */
export const HARU_EMOTION_MAP: EmotionMap = {
  neutral: 0,
  happy: 1,
  sad: 2,
  angry: 3,
  surprised: 4,
  sympathetic: 5,
  thinking: 6,
  excited: 7,
};
