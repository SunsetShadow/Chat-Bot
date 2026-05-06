import { z } from 'zod';
import { safeTool } from '../../langgraph/tools/base/tool.helper';

export function createProposeSkillTool() {
  return safeTool(
    'propose_skill',
    '向用户推荐创建一个 Skill。当你发现对话中有重复模式但不确定是否值得创建 Skill 时使用。',
    z.object({
      name: z.string().describe('建议的 Skill 名称'),
      description: z.string().describe('建议的 Skill 描述'),
      reason: z.string().describe('推荐理由：为什么这个模式值得创建 Skill'),
    }),
    async ({ name, description, reason }) => {
      return JSON.stringify({
        type: 'skill_proposal',
        name,
        description,
        reason,
        message: `已向用户推荐创建 Skill "${name}": ${reason}`,
      });
    },
  );
}
