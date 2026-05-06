import { z } from 'zod';
import { safeTool } from '../../langgraph/tools/base/tool.helper';
import { SkillApprovalService } from '../skill-approval.service';
import { SkillService } from '../skill.service';
import { isValidSkillName } from '../skill.types';

export function createCreateSkillTool(
  approvalService: SkillApprovalService,
  skillService: SkillService,
) {
  return safeTool(
    'create_skill',
    '创建一个新的 Skill（可复用的指令模块）。当你在对话中发现可复用的重复模式时使用。创建的 Skill 需要用户审批后才生效。',
    z.object({
      name: z.string().describe('Skill 名称，kebab-case 格式（如 git-workflow、code-review-checklist）'),
      description: z.string().describe('一句话描述这个 Skill 的用途'),
      instructions: z.string().describe('完整的 Skill 指令内容（Markdown 格式）'),
      allowed_tools: z.array(z.string()).optional().describe('该 Skill 可使用的工具白名单'),
    }),
    async ({ name, description, instructions, allowed_tools }) => {
      if (!isValidSkillName(name)) {
        return `名称格式无效: "${name}"。要求 kebab-case（小写字母+数字+连字符），3-64 字符。`;
      }

      const existing = await skillService.findOneSummary(name);
      if (existing) {
        return `Skill "${name}" 已存在。如需修改请使用 update_skill 工具。`;
      }

      const skillMd = [
        '---',
        `name: ${name}`,
        `description: ${description}`,
        'version: 1.0.0',
        'author: agent',
        'source: user-created',
        `created_at: ${new Date().toISOString()}`,
        allowed_tools?.length ? `allowed_tools: [${allowed_tools.join(', ')}]` : '',
        '---',
        '',
        instructions,
      ].filter(Boolean).join('\n');

      const { approvalId, scanResult } = await approvalService.submit({
        skillName: name,
        type: 'create',
        content: skillMd,
      });

      const warnings = scanResult.threats
        .filter(t => t.severity === 'warning')
        .map(t => `⚠️ ${t.message}`)
        .join('\n');

      if (!scanResult.safe) {
        const errors = scanResult.threats
          .filter(t => t.severity === 'error')
          .map(t => `❌ ${t.message}`)
          .join('\n');
        return `安全扫描未通过:\n${errors}\n\nSkill 已提交但需用户审批。`;
      }

      let msg = `Skill "${name}" 已创建并提交审批（ID: ${approvalId}）。等待用户审批后生效。`;
      if (warnings) msg += `\n\n${warnings}`;
      return msg;
    },
  );
}
