import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { homedir } from 'node:os';

export const DEFAULT_SKILLS_DIR = process.env.SKILLS_DIR || homedir() + '/.aniclaw/skills';

/** Skill（SKILL.md 格式，兼容 agentskills.io 标准） */
export interface Skill {
  id: string;
  name: string;
  description: string;
  /** SKILL.md 文件所在目录的绝对路径 */
  dirPath: string;
  /** skill 来源目录（区分多源加载时的优先级） */
  source: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string[];
  requires?: {
    bins?: string[];
    env?: string[];
  };
  /** SKILL.md 中 --- 之后的 markdown 正文 */
  instructions: string;
}

/** name 字段规范校验：lowercase + hyphens，必须匹配目录名 */
function validateName(name: string, dirName: string): boolean {
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(name)) return false;
  return name === dirName;
}

/** 解析 YAML frontmatter 中简单的 key: value 和嵌套块 */
function parseFrontmatter(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = text.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    // 匹配顶层 key: value
    const m = line.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!m) { i++; continue; }

    const key = m[1];
    const val = m[2].trim();

    // 如果值为空，检查下一行是否有缩进块
    if (!val) {
      const nested: Record<string, string> = {};
      let j = i + 1;
      while (j < lines.length) {
        const subLine = lines[j];
        const subMatch = subLine.match(/^\s+(\w[\w-]*):\s*(.+)$/);
        if (!subMatch) break;
        nested[subMatch[1]] = subMatch[2].trim().replace(/^["']|["']$/g, '');
        j++;
      }
      if (Object.keys(nested).length > 0) {
        result[key] = nested;
        i = j;
        continue;
      }
    }

    // 数组值 [a, b, c]
    if (val.startsWith('[') && val.endsWith(']')) {
      result[key] = val.slice(1, -1).split(/[\s,]+/).filter(Boolean);
    } else {
      result[key] = val.replace(/^["']|["']$/g, '');
    }
    i++;
  }

  return result;
}

/** 解析 SKILL.md 的 YAML frontmatter + markdown body */
export function parseSkillMd(filePath: string, sourceDir: string): Skill | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!match) return null;

    const fm = parseFrontmatter(match[1]);
    const body = match[2].trim();
    const dirPath = resolve(dirname(filePath));
    const dirName = dirPath.split(/[/\\]/).pop() || '';

    const name = (fm['name'] as string) || dirName;
    const description = (fm['description'] as string) || '';
    if (!name || !description) return null;

    const effectiveName = validateName(name, dirName) ? name : dirName;

    const metadata = fm['metadata'] as Record<string, string> | undefined;
    const requires = fm['requires'] as Record<string, string> | undefined;

    const requiresBins = Array.isArray((requires as any)?.['bins'])
      ? (requires as any)['bins'] as string[]
      : typeof (requires as any)?.['bins'] === 'string'
        ? [(requires as any)['bins']]
        : undefined;
    const requiresEnv = Array.isArray((requires as any)?.['env'])
      ? (requires as any)['env'] as string[]
      : typeof (requires as any)?.['env'] === 'string'
        ? [(requires as any)['env']]
        : undefined;

    const allowedTools = Array.isArray(fm['allowed-tools'])
      ? fm['allowed-tools'] as string[]
      : typeof fm['allowed-tools'] === 'string'
        ? [fm['allowed-tools'] as string]
        : undefined;

    return {
      id: effectiveName,
      name: effectiveName,
      description,
      dirPath,
      source: sourceDir,
      license: (fm['license'] as string) || undefined,
      compatibility: (fm['compatibility'] as string) || undefined,
      metadata: metadata && Object.keys(metadata).length > 0 ? metadata : undefined,
      allowedTools,
      requires: (requiresBins || requiresEnv) ? { bins: requiresBins, env: requiresEnv } : undefined,
      instructions: body,
    };
  } catch {
    return null;
  }
}

/** 扫描目录下所有包含 SKILL.md 的子目录（确定性排序） */
export function scanSkillsDir(baseDir: string): Skill[] {
  const skills: Skill[] = [];
  try {
    const resolvedBase = realpathSync(baseDir);
    const entries = readdirSync(resolvedBase, { withFileTypes: true });
    // 确定性排序，对 prompt cache 友好
    const sorted = entries
      .filter(e => e.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));

    for (const entry of sorted) {
      const skillMdPath = join(resolvedBase, entry.name, 'SKILL.md');
      const skill = parseSkillMd(skillMdPath, resolvedBase);
      if (skill) {
        // 路径安全：验证 skill 目录在 base 目录内
        const skillRealPath = realpathSync(skill.dirPath);
        if (skillRealPath.startsWith(resolvedBase + '/') || skillRealPath === resolvedBase) {
          skills.push(skill);
        }
      }
    }
  } catch {
    // 目录不存在或权限错误，跳过
  }
  return skills;
}
