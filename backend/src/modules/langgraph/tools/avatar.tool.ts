import { z } from 'zod';
import { safeTool } from './base/tool.helper';

export function createExpressEmotionTool() {
  return safeTool(
    'express_emotion',
    `设置虚拟角色的表情，表达你当前的情绪状态。

何时使用：
- 回复用户时想表达情感（开心、同情、思考等）
- 对用户的提问表示好奇或惊讶
- 任务完成时表达满足感
- 遇到错误时表示歉意

可用表情：neutral（平静）, happy（开心）, sad（悲伤）, angry（生气）, surprised（惊讶）, sympathetic（同情）, thinking（思考）, excited（兴奋）

注意：每次回复最多调用一次，选择最贴合当前语境的表情。`,
    z.object({
      emotion: z.enum([
        'neutral', 'happy', 'sad', 'angry',
        'surprised', 'sympathetic', 'thinking', 'excited',
      ]).describe('要表达的情绪'),
    }),
    async ({ emotion }) => {
      return JSON.stringify({ action: 'expression', emotion });
    },
  );
}

export function createPlayMotionTool() {
  return safeTool(
    'play_motion',
    `播放虚拟角色的动作动画。

何时使用：
- 打招呼时播放招手动作
- 完成任务时播放庆祝动作
- 用户长时间未回复时播放待机动作
- 需要增强表达效果时

可用动作组：
- Idle: 待机动作（index 0-2）
- Tap: 点击反应动作（index 0-1）

不指定 index 则随机播放该组中的一个动作。`,
    z.object({
      group: z.enum(['Idle', 'Tap']).describe('动作组名'),
      index: z.number().int().min(0).optional().describe('动作索引，不填则随机'),
    }),
    async ({ group, index }) => {
      return JSON.stringify({ action: 'motion', group, index: index ?? -1 });
    },
  );
}
