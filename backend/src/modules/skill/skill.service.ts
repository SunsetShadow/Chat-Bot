import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { Skill, scanSkillsDir } from './skill.types';
import { SettingsService } from '../settings/settings.service';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

const DEFAULT_SKILLS_DIR = process.env.SKILLS_DIR || homedir() + '/.aniclaw/skills';

@Injectable()
export class SkillService implements OnModuleInit {
  private skills: Skill[] = [];

  constructor(
    @Inject(forwardRef(() => SettingsService))
    private settingsService: SettingsService,
  ) {}

  async onModuleInit() {
    await this.refresh();
  }

  private async getSkillsDirs(): Promise<string[]> {
    const configured = await this.settingsService.getValue('skills_dirs').catch(() => '');
    if (configured) return configured.split(',').map(d => d.trim()).filter(Boolean);
    return [DEFAULT_SKILLS_DIR];
  }

  /** 重新扫描所有目录 */
  async refresh(): Promise<void> {
    const dirs = await this.getSkillsDirs();
    const seen = new Set<string>();
    this.skills = [];
    for (const dir of dirs) {
      for (const skill of scanSkillsDir(dir)) {
        if (!seen.has(skill.id)) {
          seen.add(skill.id);
          this.skills.push(skill);
        }
      }
    }
  }

  /** 列表（metadata only，progressive disclosure stage 1） */
  async findAllSummary() {
    return this.skills.map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      license: s.license,
      compatibility: s.compatibility,
    }));
  }

  /** 详情（含 instructions，stage 2） */
  async findOneSummary(id: string) {
    const s = this.skills.find(s => s.id === id);
    if (!s) return undefined;
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      license: s.license,
      compatibility: s.compatibility,
      metadata: s.metadata,
      allowedTools: s.allowedTools,
      requires: s.requires,
      instructions: s.instructions,
      dirPath: s.dirPath,
    };
  }

  /** 供 lookup_skill 工具调用 */
  async findSkillForLookup(id: string): Promise<{ instructions: string; dirPath: string } | null> {
    const s = this.skills.find(s => s.id === id);
    if (!s) return null;
    return { instructions: s.instructions, dirPath: s.dirPath };
  }

  /** 构建全局 skill 索引，注入 system prompt（XML 格式，token 友好） */
  async buildSkillIndex(): Promise<string> {
    if (this.skills.length === 0) return '';

    const entries = this.skills
      .map(s => `  <skill>\n    <name>${s.name}</name>\n    <description>${s.description}</description>\n  </skill>`)
      .join('\n');

    return `<available_skills>
${entries}
</available_skills>

Use the lookup_skill tool to load a skill's full instructions when the task matches its description.
Use the read_skill_reference tool to read referenced files within a skill's directory.`;
  }

  /** 删除 skill（移除目录） */
  async delete(id: string): Promise<boolean> {
    const s = this.skills.find(s => s.id === id);
    if (!s) return false;
    try {
      const { rmSync } = await import('node:fs');
      rmSync(s.dirPath, { recursive: true, force: true });
      this.skills = this.skills.filter(sk => sk.id !== id);
      return true;
    } catch {
      return false;
    }
  }
}
