import { Skill } from './skill.types';
import * as os from 'node:os';

/** 获取当前平台标识 */
function getCurrentPlatform(): string {
  const platform = os.platform();
  switch (platform) {
    case 'darwin': return 'mac';
    case 'linux': return 'linux';
    case 'win32': return 'windows';
    default: return platform;
  }
}

/** 检查环境变量是否存在 */
function hasEnv(varName: string): boolean {
  return process.env[varName] !== undefined && process.env[varName] !== '';
}

/**
 * 检查单个 Skill 的条件是否满足
 */
export function isSkillActive(
  skill: Skill,
  availableToolNames?: Set<string>,
): boolean {
  // 没有 requires 条件的 skill 始终 active
  if (!skill.requires && !skill.fallbackFor?.length) return true;

  // 检查 platforms
  if (skill.requires?.platforms?.length) {
    const current = getCurrentPlatform();
    if (!skill.requires.platforms.includes(current)) return false;
  }

  // 检查 env
  if (skill.requires?.env?.length) {
    for (const envVar of skill.requires.env) {
      if (!hasEnv(envVar)) return false;
    }
  }

  // 检查 tools（需要传入当前可用的工具集合）
  if (skill.requires?.tools?.length && availableToolNames) {
    for (const tool of skill.requires.tools) {
      if (!availableToolNames.has(tool)) return false;
    }
  }

  return true;
}

/**
 * 处理 fallback_for 逻辑：当指定工具不可用时，对应 skill 自动激活
 */
export function resolveFallbacks(
  skills: Skill[],
  availableToolNames: Set<string>,
): Skill[] {
  return skills.map(skill => {
    // fallback_for：当指定工具不在可用集合中时，该 skill 应该激活
    if (skill.fallbackFor?.length) {
      const shouldActivate = skill.fallbackFor.some(t => !availableToolNames.has(t));
      if (shouldActivate) {
        return { ...skill, active: true };
      }
    }
    return skill;
  });
}

/**
 * 过滤出 active 的 skills
 */
export function filterActiveSkills(
  skills: Skill[],
  availableToolNames?: Set<string>,
): Skill[] {
  return skills
    .map(skill => {
      const active = isSkillActive(skill, availableToolNames);
      return { ...skill, active };
    })
    .map(skill => resolveFallbacks([skill], availableToolNames || new Set())[0]);
}
