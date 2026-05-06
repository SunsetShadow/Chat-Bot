import { z } from 'zod';
import { safeTool } from '../../langgraph/tools/base/tool.helper';
import { SkillApprovalService } from '../skill-approval.service';
import { SkillService } from '../skill.service';

export function createUpdateSkillTool(
  approvalService: SkillApprovalService,
  skillService: SkillService,
) {
  return safeTool(
    'update_skill',
    '修改已有 Skill 的指令内容。仅可修改用户创建的 Skill（source: user-created）。修改需用户审批。',
    z.object({
      skill_id: z.string().describe('要修改的 Skill ID'),
      instructions: z.string().describe('新的完整 instructions 内容'),
      patch_description: z.string().describe('改动说明，简述修改了什么'),
    }),
    async ({ skill_id, instructions, patch_description }) => {
      const existing = await skillService.findOneSummary(skill_id);
      if (!existing) {
        return `Skill "${skill_id}" 不存在。请先使用 create_skill 创建。`;
      }

      const fullSkill = await skillService.findSkillForLookup(skill_id);
      if (!fullSkill) {
        return `Skill "${skill_id}" 无法读取。`;
      }

      const { readFile } = await import('node:fs/promises');
      const oldContent = await readFile(
        `${fullSkill.dirPath}/SKILL.md`, 'utf-8',
      ).catch(() => null);

      const fmMatch = oldContent?.match(/^---\s*\n([\s\S]*?)\n---/);
      const fm = fmMatch ? fmMatch[1] : `name: ${skill_id}\ndescription: ${existing.description}`;

      const newSkillMd = [
        '---',
        fm,
        `updated_at: ${new Date().toISOString()}`,
        '---',
        '',
        instructions,
      ].join('\n');

      const { approvalId, scanResult } = await approvalService.submit({
        skillName: skill_id,
        type: 'update',
        content: newSkillMd,
        oldContent: oldContent || undefined,
        patchDescription: patch_description,
      });

      if (!scanResult.safe) {
        const errors = scanResult.threats
          .filter(t => t.severity === 'error')
          .map(t => `❌ ${t.message}`)
          .join('\n');
        return `安全扫描未通过:\n${errors}\n\n修改已提交但需用户审批。`;
      }

      return `Skill "${skill_id}" 的修改已提交审批（ID: ${approvalId}）。改动: ${patch_description}。等待用户审批。`;
    },
  );
}
