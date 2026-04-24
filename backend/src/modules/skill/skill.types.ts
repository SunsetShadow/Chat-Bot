import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

/** Skill（SKILL.md 格式，兼容 agentskills.io 标准） */
export interface Skill {
  id: string;
  name: string;
  description: string;
  /** SKILL.md 文件所在目录的绝对路径 */
  dirPath: string;
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

/** 解析 SKILL.md 的 YAML frontmatter + markdown body */
export function parseSkillMd(filePath: string): Skill | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
    if (!match) return null;

    const frontmatter = match[1];
    const body = match[2].trim();
    const dirPath = resolve(dirname(filePath));
    const dirName = dirPath.split(/[/\\]/).pop() || '';

    const fields: Record<string, string> = {};
    const metadataFields: Record<string, string> = {};
    let inBlock = false;
    let blockKey = '';

    for (const line of frontmatter.split('\n')) {
      if (inBlock) {
        const kv = line.match(/^\s+(\w[\w-]*):\s*(.+)$/);
        if (kv) {
          (blockKey === 'metadata' ? metadataFields : fields)[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
          continue;
        }
        inBlock = false;
      }
      const m = line.match(/^(\w[\w-]*):\s*(.+)$/);
      if (m) {
        if (m[1] === 'metadata' || m[1] === 'requires') {
          inBlock = true;
          blockKey = m[1];
          continue;
        }
        fields[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
      }
    }

    const name = fields['name'] || dirName;
    const description = fields['description'] || '';
    if (!name || !description) return null;

    const effectiveName = validateName(name, dirName) ? name : dirName;

    // 解析 requires 块中的数组字段
    const requiresBins = fields['bins'] ? fields['bins'].split(/[\s,]+/).filter(Boolean) : undefined;
    const requiresEnv = fields['env'] ? fields['env'].split(/[\s,]+/).filter(Boolean) : undefined;

    return {
      id: effectiveName,
      name: effectiveName,
      description,
      dirPath,
      license: fields['license'] || undefined,
      compatibility: fields['compatibility'] || undefined,
      metadata: Object.keys(metadataFields).length > 0 ? metadataFields : undefined,
      allowedTools: fields['allowed-tools'] ? fields['allowed-tools'].split(/[\s,]+/) : undefined,
      requires: (requiresBins || requiresEnv) ? { bins: requiresBins, env: requiresEnv } : undefined,
      instructions: body,
    };
  } catch {
    return null;
  }
}

/** 扫描目录下所有包含 SKILL.md 的子目录 */
export function scanSkillsDir(baseDir: string): Skill[] {
  if (!existsSync(baseDir)) return [];

  const skills: Skill[] = [];
  try {
    const entries = readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const skillMdPath = join(baseDir, entry.name, 'SKILL.md');
      if (existsSync(skillMdPath)) {
        const skill = parseSkillMd(skillMdPath);
        if (skill) skills.push(skill);
      }
    }
  } catch {
    // 权限或 IO 错误，跳过
  }
  return skills;
}
