import { Injectable, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { Skill, scanSkillsDir, DEFAULT_SKILLS_DIR } from './skill.types';
import { SettingsService } from '../settings/settings.service';
import { resolve } from 'node:path';
import { rm } from 'node:fs/promises';

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

@Injectable()
export class SkillService implements OnModuleInit {
  private skills: Skill[] = [];
  private cachedIndex = '';

  constructor(
    @Inject(forwardRef(() => SettingsService))
    private settingsService: SettingsService,
  ) {}

  async onModuleInit() {
    await this.refresh();
  }

  private async getSkillsDirs(): Promise<string[]> {
    const configured = await this.settingsService.getValue('skills_dirs').catch(() => '');
    if (configured) return configured.split(',').map(d => resolve(d.trim())).filter(Boolean);
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
    this.cachedIndex = '';
  }

  private findById(id: string): Skill | undefined {
    return this.skills.find(s => s.id === id);
  }

  /** 列表（metadata only，progressive disclosure stage 1） */
  async findAllSummary() {
    return this.skills.map(({ id, name, description, license, compatibility }) => ({
      id, name, description, license, compatibility,
    }));
  }

  /** 详情（含 instructions，stage 2） */
  async findOneSummary(id: string) {
    const s = this.findById(id);
    if (!s) return undefined;
    const { dirPath, ...rest } = s;
    return rest;
  }

  /** 供 lookup_skill 工具调用 */
  async findSkillForLookup(id: string): Promise<{ instructions: string; dirPath: string } | null> {
    const s = this.findById(id);
    if (!s) return null;
    return { instructions: s.instructions, dirPath: s.dirPath };
  }

  /** 构建全局 skill 索引（缓存，refresh 时清除） */
  async buildSkillIndex(): Promise<string> {
    if (this.cachedIndex) return this.cachedIndex;
    if (this.skills.length === 0) return '';

    const entries = this.skills
      .map(s => `  <skill>\n    <name>${escapeXml(s.name)}</name>\n    <description>${escapeXml(s.description)}</description>\n  </skill>`)
      .join('\n');

    this.cachedIndex = `<available_skills>
${entries}
</available_skills>

Use the lookup_skill tool to load a skill's full instructions when the task matches its description.
Use the read_skill_reference tool to read referenced files within a skill's directory.`;
    return this.cachedIndex;
  }

  /** 删除 skill（移除目录） */
  async delete(id: string): Promise<boolean> {
    const s = this.findById(id);
    if (!s) return false;
    try {
      await rm(s.dirPath, { recursive: true, force: true });
      this.skills = this.skills.filter(sk => sk.id !== id);
      this.cachedIndex = '';
      return true;
    } catch {
      return false;
    }
  }
}
