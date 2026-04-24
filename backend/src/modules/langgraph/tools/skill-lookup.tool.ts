import { z } from 'zod';
import { safeTool } from './base/tool.helper';
import { resolve } from 'node:path';

const MAX_INSTRUCTIONS_SIZE = 256 * 1024; // 256KB
const MAX_REFERENCE_SIZE = 1024 * 1024;   // 1MB

export function createSkillLookupTool(
  findSkill: (id: string) => Promise<{ instructions: string; dirPath: string } | null>,
) {
  return safeTool(
    'lookup_skill',
    '加载指定 skill 的完整指令。当你判断用户的问题需要用到某个已安装的 skill 时，调用此工具获取完整的执行指令。',
    z.object({ skill_name: z.string().describe('要加载的 skill 名称') }),
    async ({ skill_name }) => {
      const skill = await findSkill(skill_name);
      if (!skill) return `未找到名为 "${skill_name}" 的 skill。请检查 available_skills 列表中的名称。`;
      if (skill.instructions.length > MAX_INSTRUCTIONS_SIZE) {
        return skill.instructions.slice(0, MAX_INSTRUCTIONS_SIZE) + '\n\n[内容过长，已截断]';
      }
      return skill.instructions;
    },
  );
}

export function createReadSkillReferenceTool(
  findSkill: (id: string) => Promise<{ dirPath: string } | null>,
) {
  return safeTool(
    'read_skill_reference',
    '读取 skill 目录下的引用文件（如 references/、scripts/ 等子目录中的文件）。',
    z.object({
      skill_name: z.string().describe('skill 名称'),
      reference_path: z.string().describe('相对于 skill 目录的文件路径'),
    }),
    async ({ skill_name, reference_path }) => {
      const skill = await findSkill(skill_name);
      if (!skill) return `未找到名为 "${skill_name}" 的 skill。`;

      // 路径安全：resolve 后确保仍在 skill 目录内
      if (reference_path.includes('..')) {
        return `非法路径: ${reference_path}。不允许使用 ".."。`;
      }

      const { readFile } = await import('node:fs/promises');
      const skillDir = resolve(skill.dirPath);
      const fullPath = resolve(skillDir, reference_path);

      if (!fullPath.startsWith(skillDir + '/') && fullPath !== skillDir) {
        return `路径越权: ${reference_path}。只允许访问 skill 目录内的文件。`;
      }

      try {
        const content = await readFile(fullPath, 'utf-8');
        if (content.length > MAX_REFERENCE_SIZE) {
          return `文件过大 (${Math.round(content.length / 1024)}KB)，最大支持 1MB。`;
        }
        return content;
      } catch {
        return `无法读取文件: ${reference_path}。请确认路径正确。`;
      }
    },
  );
}
