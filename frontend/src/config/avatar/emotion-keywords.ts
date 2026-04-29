import type { EmotionKeywordRule, EmotionType } from "@/types/avatar";

export const emotionRules: EmotionKeywordRule[] = [
  {
    keywords: ["哈哈", "开心", "太好了", "不错", "很棒"],
    emotion: "happy",
    weight: 1,
  },
  {
    keywords: ["抱歉", "不好意思", "遗憾", "可惜", "难过"],
    emotion: "sad",
    weight: 1,
  },
  {
    keywords: ["嗯", "让我想想", "这个问题", "分析", "考虑"],
    emotion: "thinking",
    weight: 1,
  },
  {
    keywords: ["太棒了", "哇", "厉害", "厉害了", "太牛"],
    emotion: "excited",
    weight: 2,
  },
  { keywords: ["生气", "过分", "不可接受"], emotion: "angry", weight: 1 },
  {
    keywords: ["没想到", "出乎意料", "居然", "竟然"],
    emotion: "surprised",
    weight: 1,
  },
  {
    keywords: ["理解", "辛苦了", "不容易", "心疼"],
    emotion: "sympathetic",
    weight: 1,
  },
];

const punctuationBoosts: Array<{
  pattern: RegExp;
  emotion: EmotionType;
  boost: number;
}> = [
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

  for (const boost of punctuationBoosts) {
    if (boost.pattern.test(text) && boost.boost >= bestScore) {
      bestEmotion = boost.emotion;
      bestScore = boost.boost;
    }
  }

  return bestEmotion;
}
